// import './types/fastify';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyIO from 'fastify-socket.io';
import fastifyWebSocket from '@fastify/websocket';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { config } from './config';
import { setupWebSocket } from './services/livestream/socket';
import { setupWebSocketHandler } from './websocketHandler';
import { registerLivestreamRoutes } from './services/livestream/fastifyRoutes';
import authPlugin from './plugins/auth';
import jwt from 'jsonwebtoken';
import prismaPlugin from './plugins/prisma';
import { launchBot } from './services/telegram-app';
import declareRoutes from './router';
import fastifySession from '@fastify/session';
import fastifyOauth2 from '@fastify/oauth2';
import fastifyMultipart from '@fastify/multipart';
import dotenv from 'dotenv';

dotenv.config();

// Type declarations
declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

export const publicDir = path.join(__dirname, 'public');

async function buildServer() {
  const fastify = Fastify({
    logger: true,
  });

  // CORS configuration
  await fastify.register(fastifyCors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    // origin: '*',
    credentials: true
  });

  // Socket.IO setup
  await fastify.register(fastifyIO, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // WebSocket setup for RTMP server communication
  await fastify.register(fastifyWebSocket);

  // Register core plugins
  await fastify.register(prismaPlugin);
  await fastify.register(authPlugin);
  // await fastify.register(twitterPlugin);
  await fastify.register(fastifyOauth2, {
    name: 'twitterOAuth',
    credentials: {
      client: {
        id: process.env.TWITTER_API_KEY!,
        secret: process.env.TWITTER_API_SECRET_KEY!,
      },
      // auth: fastifyOauth2.TWITTER_CONFIGURATION,
      auth: {
        authorizeHost: 'https://api.twitter.com',
        authorizePath: '/oauth/authorize',
        tokenHost: 'https://api.twitter.com',
        tokenPath: '/oauth/access_token',
      },
    },
    startRedirectPath: '/auth/login',
    callbackUri: process.env.TWITTER_CALLBACK_URL!,
  });

  //Middleware to verify JWT
  const JWT_SECRET = config.jwt.secret;
  fastify.decorate('verifyJWT', async (request, reply) => {
    try {
      const token = request.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      request.user = decoded;
    } catch (error) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.register(fastifySession, {
    secret: JWT_SECRET,
    cookie: { secure: process.env.NODE_ENV == 'production' ? true : false }, // Set to true in production
  });

  fastify.register(fastifyMultipart, {
    limits: {
      // fieldNameSize: 200, // Max field name size in bytes
      // fieldSize: 200,     // Max field value size in bytes
      // fields: 10,         // Max number of non-file fields
      fileSize: 1024*1024*20,  // For multipart forms, the max file size in bytes
      // files: 2,           // Max number of file fields
      // headerPairs: 2000,  // Max number of header key=>value pairs
      // parts: 1000         // For multipart forms, the max number of parts (fields + files)
      // fileSize: 1024 * 1024 * 15, // 15MB
    },
  });

  // Register routes
  // Auth
  // await fastify.register(authRoutes);
  // Indexer
  await declareRoutes(fastify);

  // Register livestream HTTP routes
  await registerLivestreamRoutes(fastify);

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  // WebSocket endpoint for RTMP server communication
  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      console.log('🔌 RTMP server connected to WebSocket');
      
      // Set up ping/pong to keep connection alive
      const pingInterval = setInterval(() => {
        if (connection.readyState === 1) { // WebSocket.OPEN
          try {
            connection.ping();
          } catch (error) {
            console.error('❌ Error sending ping:', error);
            clearInterval(pingInterval);
          }
        } else {
          clearInterval(pingInterval);
        }
      }, 30000); // Ping every 30 seconds
      
      connection.on('message', (message) => {
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
            case 'pong':
              console.log('🏓 Received pong from RTMP server');
              break;
            default:
              console.log('📡 Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      });

      connection.on('close', (code, reason) => {
        console.log('❌ RTMP server disconnected from WebSocket:', code, reason?.toString());
        clearInterval(pingInterval);
      });

      connection.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        clearInterval(pingInterval);
      });

      connection.on('pong', () => {
        console.log('🏓 Received pong from RTMP server');
      });

      // Send welcome message
      try {
        connection.send(JSON.stringify({
          type: 'connected',
          message: 'WebSocket connection established',
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        console.error('❌ Error sending welcome message:', error);
      }
    });
  });

  // Initialize WebSocket handlers
  fastify.ready((err) => {
    if (err) throw err;
    setupWebSocket(fastify.io);
  });

  return fastify;
}

let server: any = null;

async function start() {
  try {
    server = await buildServer();
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';

    await server.listen({
      port: config.server.port,
      host,
    });

    console.log(`Server listening on ${host}:${config.server.port}`);

    // Launch Telegram bot

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.IS_TELEGRAM_BOT_RUNNING === 'true') {
      try {
        await launchBot(process.env.TELEGRAM_BOT_TOKEN || '');
      } catch (error) {
        console.log('Error launching bot:', error);
      }
    } 
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

// Graceful shutdown handling
async function shutdown() {
  console.log('Received shutdown signal');
  if (server) {
    try {
      await server.close();
      console.log('Server closed successfully');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  }
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGHUP', shutdown);

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  start();
}

export { buildServer };
