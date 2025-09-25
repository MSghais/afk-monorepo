# 🎬 Complete Nostr + OBS Streaming Guide

This guide walks you through the complete streaming flow using Nostr authentication and OBS Studio with the RTMP server.

## 🏗️ Architecture Overview

```
Frontend (PWA) → Nostr Auth → RTMP Server → OBS Studio → Data Backend → HLS Stream
     ↓              ↓            ↓           ↓            ↓
  WebSocket    Stream Key    RTMP:1935   Video/Audio   HLS:5050
```

## 📋 Prerequisites

1. **RTMP Server** running on `localhost:1935`
2. **Data Backend** running on `localhost:5050` 
3. **OBS Studio** installed
4. **Nostr private key** for authentication

## 🚀 Step-by-Step Setup

### 1. Start the RTMP Server

```bash
cd /home/msg-encrypted/Documents/dev/afk/afk-monorepo/rtmp
go run .
```

You should see:
```
HTTP server for Nostr auth and stream key registration listening on :8080
RTMP (stdlib-only) listening on :1935
Static stream keys: [test123 live_key_1 stream_abc demo_stream secret_key my_live_key]
Connect with: rtmp://localhost:1935/live/<stream_key>
Nostr auth endpoint: http://localhost:8080/auth/nostr
```

### 2. Start the Data Backend

```bash
cd /home/msg-encrypted/Documents/dev/afk/afk-monorepo/apps/data-backend
pnpm dev
```

### 3. Start the PWA Frontend

```bash
cd /home/msg-encrypted/Documents/dev/afk/afk-monorepo/apps/pwa
pnpm dev
```

## 🔑 Nostr Authentication Flow

### Frontend Authentication

The frontend uses the `useAuthenticateWithRtmp` hook to authenticate:

```typescript
const { mutate: authenticateWithRtmp } = useAuthenticateWithRtmp();

// Generate stream key with Nostr authentication
const result = await authenticateWithRtmp({
  streamId: 'your-stream-id',
  title: 'My Live Stream',
  description: 'Stream description'
});

if (result.success) {
  console.log('Stream Key:', result.streamKey);
  console.log('RTMP URL:', result.rtmpUrl);
}
```

### Manual Authentication (Testing)

You can also test authentication manually using the test client:

```bash
cd /home/msg-encrypted/Documents/dev/afk/afk-monorepo/rtmp
go run test_client.go
```

Or use the HTML test interface:
```bash
open test_stream_flow.html
```

## 📺 OBS Studio Configuration

### 1. Open OBS Studio

### 2. Configure Stream Settings

1. Go to **Settings → Stream**
2. Set **Service** to **"Custom"**
3. Set **Server** to: `rtmp://localhost:1935/live/`
4. Set **Stream Key** to: `[Generated Nostr stream key]`

### 3. Configure Video/Audio

1. Add video sources (Camera, Display Capture, etc.)
2. Add audio sources (Microphone, Desktop Audio)
3. Set appropriate bitrates and resolution

### 4. Start Streaming

Click **"Start Streaming"** in OBS Studio.

## 🔍 Verification Steps

### 1. Check RTMP Server Logs

The RTMP server will show connection logs:
```
> client 127.0.0.1:52366
handshake ok
📏 Received set chunk size message
✅ Stream key registered: nostr_50faa5b1088725a3 (pubkey: c03f1c9c...)
```

### 2. Check HLS Stream

Visit the HLS manifest URL:
```
http://localhost:5050/livestream/[stream-key]/manifest.m3u8
```

### 3. Monitor Stream Status

Use the test interface at `test_stream_flow.html` to monitor:
- RTMP server status
- Stream key generation
- OBS connection status
- HLS stream availability

## 🧪 Testing Commands

### Test with FFmpeg (Alternative to OBS)

```bash
# Generate test video and audio
ffmpeg -f lavfi -i testsrc2=size=640x480:rate=30 \
       -f lavfi -i sine=frequency=1000:duration=10 \
       -c:v libx264 -preset ultrafast \
       -c:a aac \
       -f flv rtmp://localhost:1935/live/[stream-key]
```

### Test Authentication

```bash
# Test Nostr authentication
curl -X POST http://localhost:8080/auth/nostr \
  -H "Content-Type: application/json" \
  -d '{
    "id": "event_id",
    "pubkey": "npub1...",
    "created_at": 1234567890,
    "kind": 1,
    "tags": [["stream", "test-stream"]],
    "content": "Test stream",
    "sig": "signature"
  }'
```

## 🔧 Troubleshooting

### Common Issues

1. **RTMP Server Not Responding**
   - Check if port 1935 is available
   - Verify server is running: `netstat -tlnp | grep 1935`

2. **Authentication Fails**
   - Verify Nostr event format
   - Check signature validity
   - Ensure RTMP server is running on port 8080

3. **OBS Connection Fails**
   - Verify RTMP URL format: `rtmp://localhost:1935/live/`
   - Check stream key is correct
   - Ensure no firewall blocking

4. **No Video in HLS Stream**
   - Check data backend is running
   - Verify stream key matches
   - Check HLS manifest URL

### Debug Commands

```bash
# Check RTMP server status
curl http://localhost:8080/health

# Check data backend status  
curl http://localhost:5050/health

# List active stream keys
curl http://localhost:8080/admin/list

# Monitor RTMP connections
netstat -an | grep 1935
```

## 📊 Stream Monitoring

### Real-time Status

The system provides real-time monitoring through:

1. **WebSocket Events**:
   - `stream-started`: Stream begins
   - `stream-ended`: Stream stops
   - `viewer-joined`: Viewer connects
   - `viewer-left`: Viewer disconnects

2. **HTTP Endpoints**:
   - `/health`: Server status
   - `/admin/list`: Active streams
   - `/livestream/{key}/manifest.m3u8`: HLS manifest

3. **Frontend Integration**:
   - `LivestreamWebSocketContext` for real-time updates
   - `HostStudio` component for stream management

## 🎯 Complete Flow Example

1. **Frontend**: User clicks "Go Live"
2. **Nostr Auth**: Generate signed event with stream metadata
3. **RTMP Auth**: Send event to `http://localhost:8080/auth/nostr`
4. **Stream Key**: Receive `nostr_[hash]` stream key
5. **OBS Config**: Configure OBS with RTMP URL and stream key
6. **Start Stream**: OBS sends video/audio to RTMP server
7. **HLS Generation**: Data backend converts RTMP to HLS
8. **Viewer Access**: Viewers watch via HLS URL

## 🔐 Security Notes

- Stream keys are generated dynamically and rotate hourly
- Nostr events must be properly signed
- RTMP server validates Nostr signatures
- WebSocket connections require valid stream keys

## 📚 Additional Resources

- [OBS Studio Documentation](https://obsproject.com/help)
- [RTMP Protocol Specification](https://www.adobe.com/devnet/rtmp.html)
- [HLS Streaming Guide](https://developer.apple.com/streaming/)
- [Nostr Protocol Documentation](https://nostr.com/)

---

**Need Help?** Check the debug interface at `test_stream_flow.html` or review the server logs for detailed error information.
