# OBS Integration Troubleshooting Guide

This guide helps you debug and fix OBS connection issues with the Nostr stream authentication system.

## Common OBS Error

**Error**: "Could not access the specified channel or stream key, please double-check your stream key. If it is correct, there may be a problem connecting to the server."

## Debug Steps

### 1. Run the Debug Script

First, run the comprehensive debug script to identify the issue:

```bash
node debug-obs-integration.js
```

This will test:
- Backend connection
- RTMP server connection
- Stream key generation
- RTMP key registration
- Stream key validation
- OBS configuration

### 2. Check Service Status

#### Data Backend
```bash
cd apps/data-backend
pnpm dev
```
Check: http://localhost:5050/livestream/health

#### RTMP Server
```bash
cd rtmp
go run main.go
```
Check: http://localhost:8080/debug/stream-keys

### 3. Verify Stream Key Generation

Test the stream key generation endpoint:

```bash
curl -X POST http://localhost:5050/livestream/test-stream/rtmp-key \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "nostrEvent": {
      "id": "test-event-id",
      "pubkey": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "created_at": 1234567890,
      "kind": 1,
      "tags": [["stream", "test-stream"], ["t", "livestream"]],
      "content": "Test stream",
      "sig": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  }'
```

### 4. Check RTMP Server Stream Keys

View all registered stream keys:

```bash
curl http://localhost:8080/debug/stream-keys
```

### 5. Test RTMP Authentication

Test Nostr authentication with RTMP server:

```bash
curl -X POST http://localhost:8080/auth/nostr \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-event-id",
    "pubkey": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "created_at": 1234567890,
    "kind": 1,
    "tags": [["stream", "test-stream"], ["t", "livestream"]],
    "content": "Test stream",
    "sig": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }'
```

## Common Issues and Solutions

### Issue 1: "Invalid stream key format"

**Cause**: Stream key extraction from RTMP publish command failed.

**Solution**:
1. Check RTMP server logs for "Failed to extract stream key"
2. Verify OBS is sending the correct stream key
3. Check AMF0 parsing in RTMP server

### Issue 2: "Invalid stream key. Access denied"

**Cause**: Stream key is not registered with RTMP server.

**Solution**:
1. Check if stream key was generated successfully
2. Verify RTMP key registration endpoint worked
3. Check RTMP server logs for validation details
4. Use debug endpoint to see registered keys

### Issue 3: "Invalid Nostr signature"

**Cause**: Nostr event validation failed.

**Solution**:
1. Check if event has required fields (id, pubkey, sig)
2. Verify pubkey is 64 hex characters
3. Verify signature is 128 hex characters
4. Check if event has required stream tag
5. Verify event is not too old (max 24 hours)

### Issue 4: "Event expired"

**Cause**: Nostr event is too old.

**Solution**:
1. Generate a new stream key
2. Check system time synchronization
3. Reduce event expiration time if needed

### Issue 5: "WebSocket connection failed"

**Cause**: Data-backend and RTMP server can't communicate.

**Solution**:
1. Check if data-backend is running on port 5050
2. Check if RTMP server is running on port 8080
3. Verify WebSocket endpoint is accessible
4. Check firewall settings

## Debugging Commands

### Check Backend Logs
```bash
# In data-backend terminal
# Look for these log messages:
# ✅ Nostr event validation passed
# 🔑 Generated stream key: nostr_abc123
# ✅ RTMP server notified about stream key
```

### Check RTMP Server Logs
```bash
# In RTMP server terminal
# Look for these log messages:
# ✅ Stream key registered: nostr_abc123 (pubkey: 01234567...)
# 🔍 Validating stream key: nostr_abc123
# ✅ Valid Nostr stream key: nostr_abc123
# ✅ Publish acknowledged - stream accepted
```

### Check OBS Logs
1. Open OBS Studio
2. Go to Help → Log Files → Current Log
3. Look for connection errors or authentication failures

## Manual Testing

### Test with FFmpeg
Instead of OBS, test with FFmpeg directly:

```bash
ffmpeg -f avfoundation -i "0:0" -c:v libx264 -preset veryfast -f flv rtmp://localhost:1935/live/YOUR_STREAM_KEY
```

### Test with Simple RTMP Client
Use a simple RTMP client to test the connection:

```bash
# Install rtmpdump
brew install rtmpdump  # macOS
# or
sudo apt-get install rtmpdump  # Ubuntu

# Test connection
rtmpdump -r rtmp://localhost:1935/live/YOUR_STREAM_KEY -o test.flv
```

## Configuration Verification

### OBS Studio Settings
1. **Settings → Stream**
   - Service: Custom
   - Server: `rtmp://localhost:1935/live`
   - Stream Key: `nostr_abc123` (generated key)

### Environment Variables
```bash
# Data Backend
RTMP_HOST=rtmp://localhost:1935/live
RTMP_SERVER_URL=http://localhost:8080

# RTMP Server
# No additional env vars needed
```

## Advanced Debugging

### Enable Verbose Logging

#### Data Backend
Add to your environment:
```bash
DEBUG=* pnpm dev
```

#### RTMP Server
The Go server already has verbose logging enabled.

### Network Debugging
```bash
# Check if ports are open
netstat -an | grep :1935  # RTMP
netstat -an | grep :8080  # RTMP HTTP
netstat -an | grep :5050  # Data Backend

# Test port connectivity
telnet localhost 1935
telnet localhost 8080
telnet localhost 5050
```

### Firewall Issues
```bash
# Check firewall status
sudo ufw status  # Ubuntu
sudo firewall-cmd --list-all  # CentOS/RHEL

# Allow RTMP port
sudo ufw allow 1935
sudo firewall-cmd --add-port=1935/tcp --permanent
```

## Still Having Issues?

1. **Check the debug script output** for specific error messages
2. **Verify all services are running** on the correct ports
3. **Check the logs** for detailed error information
4. **Test with a simple static stream key** first (like "test123")
5. **Verify network connectivity** between all components

## Quick Fix Checklist

- [ ] Data backend running on port 5050
- [ ] RTMP server running on port 8080
- [ ] Stream key generated successfully
- [ ] Stream key registered with RTMP server
- [ ] OBS configured with correct server and key
- [ ] No firewall blocking ports 1935, 8080, 5050
- [ ] All services can communicate with each other
- [ ] Nostr event is properly formatted and signed
- [ ] System time is synchronized
