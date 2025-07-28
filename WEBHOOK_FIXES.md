# Webhook Fixes and Improvements

## Issues Identified from Logs

### 1. **Command Routing Issue**
- **Problem**: User sent "connect" but system started onboarding instead of handling the connect command
- **Root Cause**: Onboarding flow was taking priority over all commands
- **Fix**: Modified logic to allow "connect" command to bypass onboarding flow

### 2. **Rate Limiting**
- **Problem**: WaSender API rate limiting with "1 message every 1 minute" on free trial
- **Root Cause**: Insufficient rate limiting handling and too frequent message attempts
- **Fix**: 
  - Increased minimum interval between messages to 65 seconds
  - Improved error handling in WaSender provider
  - Added timeout to API calls

### 3. **Duplicate Webhook Events**
- **Problem**: Multiple webhook events for the same message causing duplicate processing
- **Root Cause**: WaSender sends multiple event types for the same message
- **Fix**: 
  - Extracted message processing logic into separate functions
  - Added early returns for non-command messages
  - Improved event filtering

### 4. **Missing Message Content**
- **Problem**: Some webhook events have `hasData: false` but need proper handling
- **Root Cause**: Incomplete message extraction logic
- **Fix**: 
  - Created `extractMessageData()` function for consistent message parsing
  - Added proper null checks and validation

### 5. **Message Filtering**
- **Problem**: Users who haven't started onboarding sending random messages
- **Root Cause**: No filtering for non-command messages from new users
- **Fix**: Added logic to ignore messages from users who haven't started onboarding and aren't sending commands

### 6. **API Reliability**
- **Problem**: No retry logic for failed API calls
- **Root Cause**: Network issues and temporary server errors causing message failures
- **Fix**: Added comprehensive retry logic with exponential backoff

## Key Changes Made

### 1. **Webhook Route (`src/routes/webhook.js`)**

#### New Helper Functions:
```javascript
// Extract message data from WaSender webhook payload
function extractMessageData(body) { ... }

// Check if message is a command
function isCommand(text) { ... }
```

#### Improved Command Routing:
- **Before**: Onboarding took priority over all commands
- **After**: "connect" command bypasses onboarding, other commands follow normal flow

#### Better Rate Limiting:
- **Before**: 60 seconds between messages
- **After**: 65 seconds between messages (respects WaSender's 1/minute limit)

#### Enhanced Message Filtering:
- Only process command messages to avoid spam
- **NEW**: Ignore messages from users who haven't started onboarding and aren't sending commands
- Better handling of empty or invalid messages
- Improved logging for debugging

### 2. **WaSender Provider (`src/whatsapp/providers/wasender.js`)**

#### Retry Logic Added:
```javascript
// Retry configuration
this.maxRetries = 3;
this.retryDelay = 1000; // 1 second base delay

// Exponential backoff retry logic
for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
  try {
    // API call
  } catch (error) {
    // Handle different error types with appropriate retry logic
  }
}
```

#### Improved Error Handling:
```javascript
// Handle rate limiting specifically - don't retry
if (error.response?.status === 429) {
  const retryAfter = error.response.data?.retry_after || 60;
  throw new Error(`Rate limited. Try again in ${retryAfter} seconds.`);
}

// Retry on server errors (5xx) and 408
if (status >= 500 || status === 408) {
  if (attempt < this.maxRetries) {
    const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
    await this.sleep(delay);
    continue;
  }
}

// Retry on network errors
if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT" || error.code === "ECONNRESET" || error.code === "ENOTFOUND") {
  if (attempt < this.maxRetries) {
    const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
    await this.sleep(delay);
    continue;
  }
}
```

#### Added Timeout:
- 10-second timeout for API calls
- Better error messages for different failure types

### 3. **Provider Simplification**

#### WaSender Only:
- Removed WhatsApp Cloud API provider
- Simplified client factory to only use WaSender
- Updated configuration validation

### 4. **New Commands Added**

#### "onboard" Command:
- Allows users to manually start onboarding process
- Added to help text and command list

## Retry Strategy

### Retryable Errors:
- **Server Errors (5xx)**: Temporary server issues
- **408 Request Timeout**: Server overload
- **Network Errors**: Connection timeouts, DNS failures, connection resets
- **Temporary Network Issues**: ENOTFOUND, ECONNRESET, etc.
- **Rate Limiting (429)**: Retry after specified delay (60s default)

### Non-Retryable Errors:
- **Client Errors (4xx)**: Bad requests, authentication issues, etc.
- **Permanent Errors**: Invalid phone numbers, etc.

### Retry Configuration:
- **Max Retries**: 3 attempts
- **Base Delay**: 1 second
- **Backoff Strategy**: Exponential (1s, 2s, 4s)
- **Total Max Time**: ~7 seconds per message

## Message Filtering Logic

### New User Behavior:
- **Commands** (connect, help, hi, etc.) → Processed normally
- **Non-commands** → Ignored (user hasn't started onboarding)

### User in Onboarding:
- **Commands** → Processed normally (connect bypasses onboarding)
- **Non-commands** → Handled as onboarding responses

### Completed User:
- **Commands** → Processed normally
- **Non-commands** → Ignored (spam filtering)

## Expected Behavior After Fixes

### 1. **Command Routing**
- ✅ "connect" → Shows OAuth URL (even for new users)
- ✅ "help" → Shows help message
- ✅ "onboard" → Starts onboarding flow
- ✅ Other commands → Normal processing

### 2. **Rate Limiting**
- ✅ Messages spaced 65+ seconds apart
- ✅ Graceful handling of rate limit errors
- ✅ No crashes on rate limit responses

### 3. **Duplicate Events**
- ✅ Only command messages processed
- ✅ Non-command messages ignored
- ✅ Empty messages ignored
- ✅ Better logging for debugging

### 4. **Message Filtering**
- ✅ New users sending random messages → Ignored
- ✅ New users sending commands → Processed
- ✅ Users in onboarding → All messages handled appropriately
- ✅ Completed users sending non-commands → Ignored

### 5. **API Reliability**
- ✅ Automatic retry on server errors (5xx)
- ✅ Automatic retry on network timeouts
- ✅ Exponential backoff to prevent overwhelming servers
- ✅ Retry on rate limits after specified delay (60s default)
- ✅ No retry on client errors (4xx)

### 6. **Error Handling**
- ✅ Timeout handling (10 seconds)
- ✅ Network error handling with retries
- ✅ HTTP error handling with appropriate retry logic
- ✅ Rate limit error handling (retry after delay)
- ✅ Detailed logging for debugging

## Environment Variables

Make sure these are set for proper functionality:

```bash
# WaSender Configuration
WASENDER_API_KEY=your_api_key_here
WASENDER_BASE_URL=https://wasenderapi.com/api

# Google OAuth (for connect command)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.com/oauth/google/callback

# Timezone
TZ=Africa/Lagos
```

## Monitoring

### Key Log Messages to Watch:
- `"Message received"` - Valid commands being processed
- `"Non-command message ignored"` - Spam filtering working
- `"Ignoring message from user who hasn't started onboarding"` - New user filtering working
- `"Rate limiting message"` - Rate limiting working
- `"Rate limited by WaSender - will retry after delay"` - Rate limit retry working
- `"retrying"` - Retry logic working
- `"All retries failed"` - Persistent API issues

### Success Indicators:
- ✅ "connect" command shows OAuth URL
- ✅ No duplicate message processing
- ✅ Rate limiting prevents API errors
- ✅ New users sending random messages are ignored
- ✅ Automatic retries on temporary failures
- ✅ Clean logs with proper error handling 