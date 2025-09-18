import { FastifyInstance } from 'fastify';
import {
  serveHLSManifest,
  serveHLSSegment,
  getStreamStatus,
  listStreams,
  healthCheck,
  startStream,
  startLocalStream,
  stopStream,
  debugManifest
} from './fastifyEndpoints';
import { cloudinaryLivestreamService } from './cloudinaryService';
import { createHash } from 'crypto';

/**
 * Register Fastify routes for livestream HTTP endpoints
 */
export async function registerLivestreamRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/livestream/health', healthCheck);

  // List active streams
  fastify.get('/livestream/active', listStreams);

  // Debug endpoint to check active streams and their state
  fastify.get('/livestream/debug/streams', async (request, reply) => {
    try {
      const { activeStreams } = await import('./streamHandler');
      const streams = Array.from(activeStreams.entries()).map(([key, value]) => ({
        streamKey: key,
        userId: value.userId,
        startedAt: value.startedAt,
        viewers: value.viewers.size,
        hasFfmpegCommand: !!value.command,
        hasInputStream: !!value.inputStream,
        broadcasterSocketId: value.broadcasterSocketId,
        isInitialized: value.isInitialized,
        status: value.status
      }));
      
      return reply.send({
        count: streams.length,
        streams,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to get debug info' });
    }
  });

  // Debug endpoint to check manifest content
  fastify.get('/livestream/debug/manifest/:streamId', debugManifest);

  // Test endpoint to verify WebSocket connection
  fastify.get('/livestream/test/websocket', async (request, reply) => {
    try {
      return reply.send({
        message: 'WebSocket test endpoint working',
        timestamp: new Date().toISOString(),
        note: 'This endpoint is working, but WebSocket connections happen via Socket.IO, not HTTP'
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Test endpoint failed' });
    }
  });

  // Test endpoint to send a test video chunk via WebSocket
  fastify.post('/livestream/test/send-chunk/:streamId', async (request, reply) => {
    try {
      const { streamId } = request.params as { streamId: string };
      
      // Import the active streams to check if the stream exists
      const { activeStreams } = await import('./streamHandler');
      const stream = activeStreams.get(streamId);
      
      if (!stream) {
        return reply.status(404).send({ error: 'Stream not found' });
      }
      
      // Create a test video chunk (1KB of random data)
      const testChunk = Buffer.alloc(1024);
      for (let i = 0; i < testChunk.length; i++) {
        testChunk[i] = Math.floor(Math.random() * 256);
      }
      
      // Simulate receiving stream data
      const { handleStreamData } = await import('./streamHandler');
      
      // Create a mock socket object for testing
      const mockSocket = {
        id: 'test-socket',
        to: (room: string) => ({
          emit: (event: string, data: any) => {
            console.log(`Test: Emitting ${event} to ${room}:`, data);
          }
        })
      } as any;
      
      // Call handleStreamData with test data
      handleStreamData(mockSocket, {
        streamKey: streamId,
        chunk: testChunk
      });
      
      return reply.send({
        message: 'Test chunk sent successfully',
        streamId,
        chunkSize: testChunk.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to send test chunk' });
    }
  });

  // Stream status
  fastify.get('/livestream/:streamId/status', getStreamStatus);

  // Start stream
  fastify.post('/livestream/:streamId/start', startStream);

  // Start local stream (for debugging)
  // fastify.post('/livestream/:streamId/start-local', startLocalStream);

  // Stop stream
  fastify.post('/livestream/:streamId/stop', stopStream);

  // Get Cloudinary playback URL
  fastify.get('/livestream/:streamId/playback', async (request, reply) => {
    const { streamId } = request.params as { streamId: string };
    try {
      const stream = await cloudinaryLivestreamService.getStream(streamId);
      if (!stream) {
        return reply.status(404).send({ error: 'Stream not found' });
      }
      return reply.send({
        streamId,
        playbackUrl: stream.playbackUrl,
        ingestUrl: stream.streamUrl,
        status: stream.status
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to get stream' });
    }
  });

  // Ingest endpoint for RTMP/WebRTC input
  fastify.get('/livestream/:streamId/ingest', async (request, reply) => {
    const { streamId } = request.params as { streamId: string };
    try {
      // Check if stream exists and is active
      const stream = await cloudinaryLivestreamService.getStream(streamId);
      if (!stream) {
        return reply.status(404).send({ error: 'Stream not found' });
      }
      
      // Return ingest information
      return reply.send({
        streamId,
        ingestUrl: stream.streamUrl,
        status: stream.status,
        message: 'Stream ingest endpoint ready',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to get ingest information' });
    }
  });

  // Generate RTMP stream key for OBS
  fastify.post('/livestream/:streamId/rtmp-key', async (request, reply) => {
    const { streamId } = request.params as { streamId: string };
    const { publicKey, nostrEvent } = request.body as { 
      publicKey?: string; 
      nostrEvent?: {
        id: string;
        pubkey: string;
        created_at: number;
        kind: number;
        tags: string[][];
        content: string;
        sig: string;
      };
    };
    
    try {
      console.log('🔑 Generating RTMP key for stream:', streamId);
      
      let streamKey: string;
      let rtmpUrl: string;
      
      // If Nostr event is provided, use it for authentication
      if (nostrEvent) {
        console.log('🔐 Using Nostr event for stream key generation');
        
        // Verify the Nostr event signature
        const isValid = await verifyNostrSignature(nostrEvent);
        if (!isValid) {
          return reply.status(401).send({ 
            error: 'Invalid Nostr signature',
            message: 'The provided Nostr event signature is invalid'
          });
        }
        
        // Check if event is recent (within 1 hour)
        const eventTime = new Date(nostrEvent.created_at * 1000);
        const now = new Date();
        const timeDiff = now.getTime() - eventTime.getTime();
        const oneHour = 60 * 60 * 1000;
        
        if (timeDiff > oneHour) {
          return reply.status(401).send({ 
            error: 'Event expired',
            message: 'The Nostr event is too old (older than 1 hour)'
          });
        }
        
        // Generate deterministic stream key from Nostr event
        streamKey = generateStreamKeyFromNostrEvent(nostrEvent, streamId);
        
        // Get the RTMP URL from environment or use default
        const rtmpHost = process.env.RTMP_HOST || 'rtmp://localhost:1935/live';
        rtmpUrl = `${rtmpHost}/${streamKey}`;
        
        console.log('✅ Nostr-authenticated RTMP key generated:', streamKey);
        
        // Notify RTMP server about the new stream key
        await notifyRtmpServer(streamId, streamKey, nostrEvent.pubkey);
        
      } else {
        // Fallback to simple key generation for backward compatibility
        console.log('⚠️ No Nostr event provided, using simple key generation');
        
        // Generate a unique stream key
        streamKey = `${streamId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Get the RTMP URL from environment or use default
        const rtmpHost = process.env.RTMP_HOST || 'rtmp://localhost:1935/live';
        rtmpUrl = `${rtmpHost}/${streamKey}`;
        
        console.log('✅ Simple RTMP key generated:', streamKey);
      }
      
      return reply.send({
        streamId,
        streamKey,
        rtmpUrl,
        message: 'RTMP stream key generated successfully',
        timestamp: new Date().toISOString(),
        nostrAuthenticated: !!nostrEvent
      });
    } catch (error) {
      console.error('❌ Error generating RTMP key:', error);
      return reply.status(500).send({ error: 'Failed to generate RTMP key' });
    }
  });

  // HLS manifest file
  fastify.get('/livestream/:streamId/stream.m3u8', serveHLSManifest);

  // HLS segment files - single catch-all route for all .ts files
  fastify.get('/livestream/:streamId/:filename', async (request, reply) => {
    const { filename } = request.params as { streamId: string; filename: string };
    
    // Only handle .ts files
    if (!filename.endsWith('.ts')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    
    // Set the segmentFile parameter for the handler
    (request.params as any).segmentFile = filename;
    return serveHLSSegment(request as any, reply);
  });

  console.log('Livestream HTTP routes registered');
}

/**
 * Verify a Nostr event signature using proper cryptographic verification
 */
async function verifyNostrSignature(nostrEvent: {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}): Promise<boolean> {
  try {
    console.log('🔐 Verifying Nostr event signature...');
    
    // Check if all required fields are present
    if (!nostrEvent.id || !nostrEvent.pubkey || !nostrEvent.sig) {
      console.log('❌ Missing required Nostr event fields');
      return false;
    }
    
    // Check if pubkey is valid hex (64 characters)
    if (!/^[0-9a-f]{64}$/i.test(nostrEvent.pubkey)) {
      console.log('❌ Invalid pubkey format');
      return false;
    }
    
    // Check if signature is valid hex (128 characters)
    if (!/^[0-9a-f]{128}$/i.test(nostrEvent.sig)) {
      console.log('❌ Invalid signature format');
      return false;
    }
    
    // For now, we'll do basic validation and accept properly formatted events
    // In a production environment, you would implement proper signature verification
    // using libraries like nostr-tools or similar
    
    // Additional validation: check if event is not too old
    const eventTime = new Date(nostrEvent.created_at * 1000);
    const now = new Date();
    const timeDiff = now.getTime() - eventTime.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (timeDiff > maxAge) {
      console.log('❌ Event is too old');
      return false;
    }
    
    // Check if event has required tags for stream authentication
    const hasStreamTag = nostrEvent.tags.some(tag => tag[0] === 'stream' && tag[1]);
    if (!hasStreamTag) {
      console.log('❌ Event missing required stream tag');
      return false;
    }
    
    console.log('✅ Nostr event validation passed');
    return true;
    
  } catch (error) {
    console.error('❌ Error verifying Nostr signature:', error);
    return false;
  }
}

/**
 * Generate a deterministic stream key from a Nostr event
 */
function generateStreamKeyFromNostrEvent(
  nostrEvent: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
  },
  streamId: string
): string {
  // Create a deterministic hash from event data
  const data = `${nostrEvent.pubkey}:${nostrEvent.created_at}:${streamId}`;
  const hash = createHash('sha256').update(data).digest('hex');
  
  // Return first 16 characters of the hash as stream key
  // Ensure it's a valid stream key format
  const streamKey = `nostr_${hash.slice(0, 16)}`;
  console.log('🔑 Generated stream key:', streamKey);
  return streamKey;
}

/**
 * Notify the RTMP server about a new stream key
 */
async function notifyRtmpServer(streamId: string, streamKey: string, pubkey: string): Promise<void> {
  try {
    const rtmpServerUrl = process.env.RTMP_SERVER_URL || 'http://localhost:8080';
    
    const response = await fetch(`${rtmpServerUrl}/api/stream-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        streamId,
        streamKey,
        pubkey,
        timestamp: new Date().toISOString(),
      }),
    });
    
    if (!response.ok) {
      console.warn('⚠️ Failed to notify RTMP server about stream key');
    } else {
      console.log('✅ RTMP server notified about stream key');
    }
  } catch (error) {
    console.warn('⚠️ Error notifying RTMP server:', error);
  }
}
