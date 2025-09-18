import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { NDKKind } from '@nostr-dev-kit/ndk';

export interface StreamAuthEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface StreamAuthRequest {
  streamId: string;
  publicKey: string;
  privateKey: string;
  title?: string;
  description?: string;
}

export interface StreamAuthResponse {
  success: boolean;
  streamKey?: string;
  rtmpUrl?: string;
  error?: string;
  event?: StreamAuthEvent;
}

/**
 * Nostr Stream Authentication Service
 * Handles signing of Nostr events for OBS stream authentication
 */
export class NostrStreamAuthService {
  private ndk: NDK;

  constructor(ndk: NDK) {
    this.ndk = ndk;
  }

  /**
   * Create and sign a Nostr event for stream authentication
   */
  async createStreamAuthEvent(request: StreamAuthRequest): Promise<StreamAuthEvent> {
    const { streamId, publicKey, privateKey, title, description } = request;

    // Create the authentication event
    const event = new NDKEvent(this.ndk);
    event.kind = NDKKind.Text; // Use text note for stream auth
    event.created_at = Math.floor(Date.now() / 1000);
    event.content = description || `Stream authentication for ${streamId}`;
    
    // Add stream-specific tags
    event.tags = [
      ['stream', streamId],
      ['title', title || `Live Stream - ${streamId.slice(0, 8)}`],
      ['t', 'livestream'],
      ['t', 'obs'],
      ['t', 'rtmp'],
      ['expiration', (Math.floor(Date.now() / 1000) + 3600).toString()], // 1 hour expiration
    ];

    // Set the pubkey
    event.pubkey = publicKey;

    // For now, we'll create a mock signature
    // In a real implementation, you'd use proper Nostr signing
    const mockSignature = 'a'.repeat(128); // 128 character hex string
    event.sig = mockSignature;

    return {
      id: event.id || '',
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
      sig: event.sig,
    };
  }

  /**
   * Authenticate with the RTMP server using Nostr signature
   */
  async authenticateWithRtmpServer(
    streamId: string,
    publicKey: string,
    privateKey: string,
    title?: string,
    description?: string
  ): Promise<StreamAuthResponse> {
    try {
      // Create the authentication event
      const authEvent = await this.createStreamAuthEvent({
        streamId,
        publicKey,
        privateKey,
        title,
        description,
      });

      // Send to RTMP server for authentication
      const rtmpAuthUrl = process.env.NEXT_PUBLIC_RTMP_AUTH_URL || 'http://localhost:8080/auth/nostr';
      
      const response = await fetch(rtmpAuthUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authEvent),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Authentication failed');
      }

      return {
        success: true,
        streamKey: result.stream_key,
        rtmpUrl: result.rtmp_url,
        event: authEvent,
      };
    } catch (error) {
      console.error('Nostr stream authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Generate a stream key for OBS without immediate authentication
   * This creates a signed event that can be used later for authentication
   */
  async generateStreamKey(
    streamId: string,
    publicKey: string,
    privateKey: string,
    title?: string,
    description?: string
  ): Promise<{ streamKey: string; rtmpUrl: string; event: StreamAuthEvent }> {
    // Create the authentication event
    const authEvent = await this.createStreamAuthEvent({
      streamId,
      publicKey,
      privateKey,
      title,
      description,
    });

    // Generate a deterministic stream key from the event
    const streamKey = this.generateDeterministicStreamKey(authEvent);
    
    // Get RTMP URL
    const rtmpHost = process.env.NEXT_PUBLIC_RTMP_HOST || 'rtmp://localhost:1935/live';
    const rtmpUrl = `${rtmpHost}/${streamKey}`;

    return {
      streamKey,
      rtmpUrl,
      event: authEvent,
    };
  }

  /**
   * Generate a deterministic stream key from a Nostr event
   */
  private generateDeterministicStreamKey(event: StreamAuthEvent): string {
    // Create a deterministic hash from event data
    const data = `${event.pubkey}:${event.created_at}:${event.id}`;
    const hash = this.simpleHash(data);
    return `nostr_${hash.slice(0, 16)}`;
  }

  /**
   * Simple hash function for generating deterministic keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Verify a stream authentication event
   */
  async verifyStreamAuthEvent(event: StreamAuthEvent): Promise<boolean> {
    try {
      // Create NDKEvent from the event data
      const ndkEvent = new NDKEvent(this.ndk);
      ndkEvent.id = event.id;
      ndkEvent.pubkey = event.pubkey;
      ndkEvent.created_at = event.created_at;
      ndkEvent.kind = event.kind;
      ndkEvent.tags = event.tags;
      ndkEvent.content = event.content;
      ndkEvent.sig = event.sig;

      // Verify the signature
      // Note: In a real implementation, you'd use proper signature verification
      // For now, we'll do basic validation
      return ndkEvent.sig !== undefined && ndkEvent.sig.length === 128;
    } catch (error) {
      console.error('Failed to verify stream auth event:', error);
      return false;
    }
  }
}

/**
 * Hook for using Nostr stream authentication
 */
export function useNostrStreamAuth(ndk: NDK) {
  const service = new NostrStreamAuthService(ndk);

  const authenticateStream = async (
    streamId: string,
    publicKey: string,
    privateKey: string,
    title?: string,
    description?: string
  ) => {
    return service.authenticateWithRtmpServer(streamId, publicKey, privateKey, title, description);
  };

  const generateStreamKey = async (
    streamId: string,
    publicKey: string,
    privateKey: string,
    title?: string,
    description?: string
  ) => {
    return service.generateStreamKey(streamId, publicKey, privateKey, title, description);
  };

  return {
    authenticateStream,
    generateStreamKey,
    verifyEvent: service.verifyStreamAuthEvent.bind(service),
  };
}
