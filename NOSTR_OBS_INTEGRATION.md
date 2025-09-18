# Nostr OBS Integration Guide

This document explains the complete integration between Nostr event signing, OBS Studio streaming, and the AFK livestream platform.

## Overview

The integration allows users to:
1. Sign Nostr events to authenticate OBS streaming sessions
2. Generate secure, time-limited stream keys for OBS
3. Stream through OBS with RTMP while maintaining Nostr identity
4. Have real-time communication between all components

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PWA Frontend  │    │   Data Backend   │    │  Go RTMP Server │
│                 │    │                  │    │                 │
│ HostStudio.tsx  │◄──►│ fastifyRoutes.ts │◄──►│    main.go      │
│                 │    │                  │    │                 │
│ Nostr Auth      │    │ Nostr Verification│   │ Stream Key Mgmt │
│ Service         │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Nostr SDK     │    │   WebSocket      │    │   RTMP Client   │
│   (NDK)         │    │   Communication  │    │   (OBS Studio)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Components

### 1. Frontend (PWA)

#### Nostr Stream Authentication Hooks (`apps/pwa/src/services/nostrStreamAuth.ts`)
- `useCreateStreamAuthEvent()`: Creates and signs Nostr events using afk_nostr_sdk
- `useGenerateStreamKey()`: Generates stream keys with Nostr authentication
- `useAuthenticateWithRtmp()`: Direct RTMP server authentication
- Uses proper NDKPrivateKeySigner for event signing

#### HostStudio Component (`apps/pwa/src/components/Livestream/HostStudio.tsx`)
- Updated to use afk_nostr_sdk hooks for Nostr authentication
- Generates signed stream keys when user selects OBS mode
- Provides copy-paste interface for OBS configuration
- Integrated with existing useAuth() and useNostrContext()

### 2. Data Backend (`apps/data-backend`)

#### Enhanced RTMP Key Generation (`src/services/livestream/fastifyRoutes.ts`)
- Accepts Nostr events for stream key generation
- Verifies Nostr signatures (basic validation)
- Generates deterministic stream keys from Nostr events
- Notifies RTMP server about new stream keys

### 3. Go RTMP Server (`rtmp/`)

#### Stream Key Management (`main.go`)
- Receives stream key registrations from data-backend
- Validates stream keys during RTMP connection
- Maintains mapping between Nostr pubkeys and stream keys
- WebSocket communication with data-backend

## Setup Instructions

### 1. Environment Variables

#### Data Backend
```bash
RTMP_HOST=rtmp://localhost:1935/live
RTMP_SERVER_URL=http://localhost:8080
```

#### RTMP Server
```bash
# No additional environment variables needed
# WebSocket URL is hardcoded to ws://localhost:5050/ws
```

### 2. Dependencies

#### PWA App
```bash
# Already included in afk_nostr_sdk
@nostr-dev-kit/ndk
```

#### Data Backend
```bash
# No additional dependencies needed
# Uses built-in crypto module for hashing
```

#### RTMP Server
```bash
go mod tidy
# Adds github.com/gorilla/websocket v1.5.1
```

### 3. Running the Services

#### Start Data Backend
```bash
cd apps/data-backend
pnpm dev
```

#### Start RTMP Server
```bash
cd rtmp
go run main.go
```

#### Start PWA App
```bash
cd apps/pwa
pnpm dev
```

## Usage Flow

### 1. User Opens HostStudio
- User navigates to livestream page
- HostStudio component loads with stream ID

### 2. User Selects OBS Mode
- User clicks "OBS Studio" mode in HostStudio
- System checks for Nostr authentication (publicKey, privateKey)

### 3. Generate Stream Key
- User clicks "Generate Stream Key" button
- Frontend uses `useGenerateStreamKey()` hook from afk_nostr_sdk
- Hook creates and signs Nostr event using NDKPrivateKeySigner
- Signed event is sent to data-backend for stream key generation

### 4. Backend Processing
- Data-backend receives signed Nostr event
- Validates event format and signature
- Generates deterministic stream key from event
- Notifies RTMP server about new stream key

### 5. OBS Configuration
- User copies RTMP URL and stream key
- Configures OBS Studio with these credentials
- Starts streaming in OBS

### 6. Stream Validation
- RTMP server validates stream key when OBS connects
- Stream is accepted and processed
- HLS segments are generated for viewers

## Security Features

### 1. Nostr Event Signing
- All stream keys are generated from signed Nostr events
- Events include expiration timestamps (1 hour)
- Signature verification ensures authenticity

### 2. Deterministic Key Generation
- Stream keys are generated deterministically from Nostr events
- Same event always produces same stream key
- Keys are time-limited and user-specific

### 3. Real-time Communication
- WebSocket communication between components
- Stream status updates in real-time
- Automatic cleanup of expired keys

## Frontend Hooks

### useCreateStreamAuthEvent()
Creates and signs a Nostr event for stream authentication.

```typescript
const createStreamAuthEvent = useCreateStreamAuthEvent();

const result = await createStreamAuthEvent.mutateAsync({
  streamId: 'stream-123',
  title: 'My Live Stream',
  description: 'Stream description'
});
```

### useGenerateStreamKey()
Generates a stream key using Nostr authentication and sends it to the data-backend.

```typescript
const generateStreamKey = useGenerateStreamKey();

const result = await generateStreamKey.mutateAsync({
  streamId: 'stream-123',
  title: 'My Live Stream',
  description: 'Stream description'
});

if (result.success) {
  console.log('Stream Key:', result.streamKey);
  console.log('RTMP URL:', result.rtmpUrl);
}
```

### useAuthenticateWithRtmp()
Directly authenticates with the RTMP server using a Nostr event.

```typescript
const authenticateWithRtmp = useAuthenticateWithRtmp();

const result = await authenticateWithRtmp.mutateAsync({
  streamId: 'stream-123',
  title: 'My Live Stream',
  description: 'Stream description'
});
```

## API Endpoints

### Data Backend

#### Generate RTMP Key with Nostr Auth
```
POST /livestream/:streamId/rtmp-key
Content-Type: application/json

{
  "publicKey": "user_pubkey",
  "nostrEvent": {
    "id": "event_id",
    "pubkey": "user_pubkey", 
    "created_at": 1234567890,
    "kind": 1,
    "tags": [["stream", "stream_id"]],
    "content": "Stream description",
    "sig": "event_signature"
  }
}
```

### RTMP Server

#### Stream Key Registration
```
POST /api/stream-key
Content-Type: application/json

{
  "streamId": "stream_id",
  "streamKey": "generated_key",
  "pubkey": "user_pubkey",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### Nostr Authentication
```
POST /auth/nostr
Content-Type: application/json

{
  "id": "event_id",
  "pubkey": "user_pubkey",
  "created_at": 1234567890,
  "kind": 1,
  "tags": [["stream", "stream_id"]],
  "content": "Stream description", 
  "sig": "event_signature"
}
```

## WebSocket Messages

### Data Backend → RTMP Server

#### Stream Key Registered
```json
{
  "type": "stream-key-registered",
  "streamKey": "nostr_abc123",
  "pubkey": "user_pubkey",
  "streamId": "stream_id",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### Stream Started
```json
{
  "type": "stream-started",
  "streamKey": "nostr_abc123",
  "pubkey": "user_pubkey"
}
```

#### Stream Ended
```json
{
  "type": "stream-ended", 
  "streamKey": "nostr_abc123"
}
```

## Troubleshooting

### Common Issues

1. **"Missing required authentication data"**
   - Ensure user is logged in with Nostr wallet
   - Check that privateKey is available in useAuth()

2. **"Invalid Nostr signature"**
   - Verify the event is properly signed
   - Check that the signature format is correct (128 hex characters)

3. **"Event expired"**
   - Nostr events expire after 1 hour
   - Generate a new stream key

4. **"WebSocket connection failed"**
   - Ensure data-backend is running on port 5050
   - Check WebSocket endpoint is accessible

5. **"RTMP connection failed"**
   - Verify RTMP server is running on port 1935
   - Check stream key is registered with RTMP server

### Debug Commands

#### Check Active Stream Keys (RTMP Server)
```bash
# In RTMP server console
admin> list
```

#### Check Stream Status (Data Backend)
```bash
curl http://localhost:5050/livestream/debug/streams
```

#### Test Nostr Authentication
```bash
curl -X POST http://localhost:8080/auth/nostr \
  -H "Content-Type: application/json" \
  -d '{"id":"test","pubkey":"test_pubkey","created_at":1234567890,"kind":1,"tags":[],"content":"test","sig":"test_sig"}'
```

## Future Enhancements

1. **Proper Nostr Signature Verification**
   - Implement full signature verification using nostr-tools
   - Add support for different signature algorithms

2. **Stream Analytics**
   - Track stream metrics and viewer counts
   - Integrate with existing analytics system

3. **Multi-Stream Support**
   - Allow users to manage multiple concurrent streams
   - Stream key rotation and management

4. **Advanced Security**
   - Rate limiting for stream key generation
   - IP whitelisting for RTMP connections
   - Stream encryption support

5. **OBS Integration**
   - Direct OBS plugin for easier setup
   - Automatic configuration import/export
   - Real-time stream status in OBS

## Contributing

When making changes to this integration:

1. Update the relevant component documentation
2. Add tests for new functionality
3. Update this integration guide
4. Test with both development and production environments
5. Ensure backward compatibility where possible
