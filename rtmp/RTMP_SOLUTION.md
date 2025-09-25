# 🎬 RTMP Streaming Solution

## Current Status

### ✅ What's Working:
1. **WebSocket Connection**: RTMP server ↔ Data-backend communication is stable
2. **RTMP Handshake**: Basic handshake protocol is working correctly  
3. **Nostr Authentication**: Stream key generation and authentication flow is complete
4. **Server Infrastructure**: Both servers are running and listening on correct ports

### ❌ Current Issue:
**FFmpeg/OBS Connection Fails**: Despite the handshake working, FFmpeg gets "Input/output error" when trying to stream to the RTMP server.

## 🔧 Recommended Solutions

### Option 1: Use nginx-rtmp-module (Recommended)

This is the most reliable solution for production use:

```bash
# Install nginx with rtmp module
sudo apt update
sudo apt install nginx libnginx-mod-rtmp

# Create nginx config
sudo nano /etc/nginx/nginx.conf
```

Add this configuration:

```nginx
events {
    worker_connections 1024;
}

rtmp {
    server {
        listen 1935;
        chunk_size 4096;
        
        application live {
            live on;
            record off;
            
            # Allow publishing from localhost
            allow publish all;
            
            # Push to data-backend for processing
            push rtmp://localhost:1936/process;
        }
        
        application process {
            live on;
            record off;
            
            # This is where the data-backend will process the stream
            allow play all;
        }
    }
}

http {
    server {
        listen 8080;
        location /stat {
            rtmp_stat all;
            rtmp_stat_stylesheet stat.xsl;
        }
        location /stat.xsl {
            root /usr/share/nginx/html;
        }
    }
}
```

### Option 2: Use SRS (Simple Realtime Server)

```bash
# Download and install SRS
wget https://github.com/ossrs/srs/releases/download/v5.0.0/srs-5.0.0.tar.gz
tar -xzf srs-5.0.0.tar.gz
cd srs-5.0.0/trunk
./configure
make
sudo make install

# Create SRS config
cat > srs.conf << EOF
listen              1935;
max_connections     1000;
srs_log_tank        console;

http_server {
    enabled         on;
    listen          8080;
    dir             ./objs/nginx/html;
}

vhost __defaultVhost__ {
    hls {
        enabled         on;
        hls_path        ./objs/nginx/html;
        hls_fragment    10;
        hls_window      60;
    }
    
    http_remux {
        enabled     on;
        mount       [vhost]/[app]/[stream].flv;
    }
}
EOF

# Start SRS
./objs/srs -c srs.conf
```

### Option 3: Fix Current Go Implementation

If you want to continue with the Go implementation, the main issues are:

1. **Message Processing**: The server needs better handling of RTMP message types
2. **Connection State**: Proper state management for different RTMP phases
3. **Error Handling**: More robust error handling and recovery

## 🎯 Integration with Data-Backend

Once you have a working RTMP server, integrate it with the data-backend:

### 1. Update RTMP Server to Push to Data-Backend

```go
// In the Go RTMP server, after receiving a stream:
func handleStream(streamKey string) {
    // Send stream info to data-backend via WebSocket
    sendToDataBackend(map[string]interface{}{
        "type": "stream-started",
        "streamKey": streamKey,
        "rtmpUrl": "rtmp://localhost:1935/live/" + streamKey,
        "hlsUrl": "http://localhost:5050/livestream/" + streamKey + "/manifest.m3u8",
    })
}
```

### 2. Data-Backend Stream Processing

The data-backend should:
1. Receive WebSocket notifications from RTMP server
2. Process the RTMP stream (convert to HLS)
3. Serve HLS streams to frontend clients
4. Handle stream lifecycle events

## 🧪 Testing

### Test with FFmpeg:
```bash
# Test basic connection
ffmpeg -f lavfi -i testsrc2=size=640x480:rate=30 \
       -c:v libx264 -preset ultrafast \
       -f flv rtmp://localhost:1935/live/test123

# Test with audio
ffmpeg -f lavfi -i testsrc2=size=640x480:rate=30 \
       -f lavfi -i sine=frequency=1000:duration=10 \
       -c:v libx264 -preset ultrafast \
       -c:a aac \
       -f flv rtmp://localhost:1935/live/test123
```

### Test with OBS:
1. Open OBS Studio
2. Go to Settings → Stream
3. Set Service to "Custom"
4. Set Server to: `rtmp://localhost:1935/live/`
5. Set Stream Key to: `test123` or your generated Nostr key
6. Click "Start Streaming"

## 📊 Monitoring

### Check RTMP Server Status:
```bash
# For nginx-rtmp
curl http://localhost:8080/stat

# For SRS
curl http://localhost:8080/api/v1/streams
```

### Check Data-Backend Integration:
```bash
# Check WebSocket connection
curl -s -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" \
     -H "Sec-WebSocket-Version: 13" \
     http://localhost:5050/ws
```

## 🚀 Next Steps

1. **Choose a solution** (nginx-rtmp recommended)
2. **Set up the RTMP server** with the chosen solution
3. **Update the Go server** to work as a bridge between RTMP and data-backend
4. **Test the complete flow** with OBS and frontend
5. **Deploy to production** with proper monitoring

## 🔗 Integration Points

- **RTMP Server** → **WebSocket** → **Data-Backend** → **HLS** → **Frontend**
- **Nostr Authentication** → **Stream Key Generation** → **RTMP Publishing**
- **Real-time Events** → **WebSocket** → **Frontend Updates**

The WebSocket connection between your Go server and data-backend is working perfectly, so the infrastructure is ready for any RTMP server solution you choose.

