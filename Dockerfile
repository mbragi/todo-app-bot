# Multi-stage Dockerfile for WhatsApp Productivity Assistant

# Base stage
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

# Builder stage
FROM base AS builder
RUN npm ci --only=production && npm cache clean --force

# Runtime stage
FROM node:18-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy dependencies and source
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
 CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/index.js"] 