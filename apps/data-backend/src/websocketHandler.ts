import { FastifyInstance } from 'fastify';

export function setupWebSocketHandler(fastify: FastifyInstance) {
  // WebSocket endpoint for RTMP server communication
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      console.log('🔌 RTMP server connected to WebSocket');
      
      connection.socket.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('📡 Received message from RTMP server:', data);
          
          // Handle different message types from RTMP server
          switch (data.type) {
            case 'stream-started':
              console.log('🎬 Stream started:', data.streamKey);
              // Broadcast to Socket.IO clients
              fastify.io.to(data.streamKey).emit('stream-started', data);
              break;
            case 'stream-ended':
              console.log('🛑 Stream ended:', data.streamKey);
              // Broadcast to Socket.IO clients
              fastify.io.to(data.streamKey).emit('stream-ended', data);
              break;
            case 'stream-key-registered':
              console.log('🔑 Stream key registered:', data.streamKey);
              // Broadcast to Socket.IO clients
              fastify.io.to(data.streamKey).emit('stream-key-registered', data);
              break;
            default:
              console.log('📡 Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      });

      connection.socket.on('close', () => {
        console.log('❌ RTMP server disconnected from WebSocket');
      });

      connection.socket.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });

      // Send welcome message
      connection.socket.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connection established',
        timestamp: new Date().toISOString()
      }));
    });
  });
}

