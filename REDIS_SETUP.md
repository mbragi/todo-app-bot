# Redis Setup for Goals & History

## Overview
The application has been updated to use **Redis** instead of in-memory storage for:
- ✅ User goals (`user:{uid}:goals`)
- ✅ Interaction history (`user:{uid}:history`) - capped at 50 items
- ✅ All existing cache operations

## Installation

1. **Install Redis dependency:**
   ```bash
   npm install ioredis@^5.3.2
   ```

2. **Configure Environment Variables:**
   Copy the Redis configuration to your `.env` file:
   ```bash
   # Railway Redis Configuration
   REDIS_URL="redis://default:dbTMKEPkgkbYUadoITkVtDAieCOSLqjI@viaduct.proxy.rlwy.net:25058"
   REDISHOST="viaduct.proxy.rlwy.net"
   REDISPASSWORD="dbTMKEPkgkbYUadoITkVtDAieCOSLqjI"
   REDISPORT="25058"
   REDISUSER="default"
   
   # Backend Configuration
   STORE_BACKEND=redis
   CACHE_BACKEND=redis
   ```

3. **Verify Configuration:**
   ```bash
   node -c src/lib/redisClient.js
   node -c src/store/memory.js
   node -c src/agenda/goals.js
   ```

## Features

### ✅ Redis LIST Operations
- `LPUSH/RPUSH` - Add items to lists
- `LRANGE` - Retrieve list items
- `LSET` - Update specific items
- `LTRIM` - Cap list sizes automatically
- `LLEN` - Get list length

### ✅ Goals Management
- **Add Goal:** `add goal: Exercise for 30 minutes`
- **List Goals:** `list goals`
- **Mark Done:** `done 0`

### ✅ History Tracking
All user interactions are automatically tracked with:
- Timestamp
- Interaction type (`command`, `goal_add`, etc.)
- Content (capped at 200 chars)
- Auto-capped at 50 items per user

## Data Structure

### Goals (`list:user:{uid}:goals`)
```json
{
  "text": "Exercise for 30 minutes",
  "completed": false,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "completedAt": null
}
```

### History (`list:user:{uid}:history`)
```json
{
  "type": "command",
  "content": "add goal: Exercise",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Testing

Once Redis is connected, test the functionality:

```bash
# Via WhatsApp
add goal: Learn Redis
list goals
done 0
```

The system will:
1. ✅ Store goals in Redis Lists
2. ✅ Track all interactions in capped history
3. ✅ Maintain data persistence across restarts
4. ✅ Handle concurrent access safely

## Troubleshooting

### Connection Issues
- Verify `REDIS_URL` is correctly formatted
- Check Railway Redis service is running
- Ensure network access to Railway domain

### Performance
- Redis operations are atomic and fast
- History capping prevents memory bloat
- All operations use efficient Redis primitives

## Migration Notes

**From Memory → Redis:**
- ✅ No data loss (fresh start)
- ✅ Same API interface
- ✅ Better persistence & performance
- ✅ Ready for production scaling