# WhatsApp AI Productivity Assistant

A Node.js backend service that acts as a WhatsApp productivity assistant with calendar integration, goal management, and automated scheduling.

## Features

- **Multi-Provider Support**: WhatsApp Cloud API or WaSender API
- **Calendar Integration**: Google Calendar events and scheduling
- **Goal Management**: Add, list, and track personal goals
- **Automated Agenda**: Daily agenda generation and reminders
- **Redis Storage**: Persistent memory for goals and history
- **Docker Support**: Containerized deployment

## Quick Start

### Prerequisites

- Node.js 18+
- Redis server
- WhatsApp Business API access (Cloud or WaSender)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd todo-app-bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

4. Start the server:
```bash
npm start
```

### Docker Deployment

```bash
# Build the image
docker build -t whatsapp-assistant .

# Run with Redis
docker run -d --name whatsapp-assistant \
  -p 3000:3000 \
  --env-file .env \
  whatsapp-assistant
```

## Environment Configuration

### Required Variables

- `MESSAGING_PROVIDER`: `wasender` or `cloud`
- `TZ`: Timezone (default: `Africa/Lagos`)

### Provider-Specific Variables

#### WaSender API
- `WASENDER_API_KEY`: Your WaSender API key
- `WASENDER_BASE_URL`: API base URL (default: `https://wasenderapi.com/api`)

#### WhatsApp Cloud API
- `WHATSAPP_TOKEN`: Your WhatsApp Business API token
- `PHONE_NUMBER_ID`: Your WhatsApp phone number ID
- `VERIFY_TOKEN`: Webhook verification token

### Optional Variables

- `GOOGLE_CREDENTIALS_JSON`: Google Calendar service account credentials
- `GOOGLE_CALENDAR_ID`: Google Calendar ID
- `REDIS_URL`: Redis connection URL
- `OPENAI_API_KEY`: OpenAI API key for AI features

## API Endpoints

### Health Check
```
GET /health
```

### Webhook (WhatsApp)
```
GET /webhook?hub.mode=subscribe&hub.challenge=CHALLENGE&hub.verify_token=TOKEN
POST /webhook
```

## WhatsApp Commands

- `help` - List available commands
- `agenda` - Show today's agenda
- `add goal: <text>` - Add a new goal
- `list goals` - List all goals
- `done <index>` - Mark goal as completed
- `schedule <text>` - Schedule an event

## Development

```bash
# Development mode with auto-restart
npm run dev

# Run tests
npm test
```

## Architecture

```
src/
├── index.js              # Application entry point
├── server.js             # Express server setup
├── routes/               # API routes
│   ├── health.js         # Health check endpoint
│   └── webhook.js        # WhatsApp webhook handling
├── whatsapp/             # WhatsApp integration
│   ├── client.js         # Provider factory
│   └── providers/        # Provider implementations
│       ├── cloud.js      # WhatsApp Cloud API
│       └── wasender.js   # WaSender API
├── calendar/             # Calendar integration
├── agenda/               # Agenda and scheduling
└── lib/                  # Shared utilities
    ├── config.js         # Environment configuration
    ├── logger.js         # Structured logging
    └── redisClient.js    # Redis client
```

## License

MIT 