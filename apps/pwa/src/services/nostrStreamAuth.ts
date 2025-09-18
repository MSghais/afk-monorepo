import { useMutation } from '@tanstack/react-query';
import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { useNostrContext } from 'afk_nostr_sdk';
import { useAuth } from 'afk_nostr_sdk';

export interface StreamAuthEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface StreamAuthResponse {
  success: boolean;
  streamKey?: string;
  rtmpUrl?: string;
  error?: string;
  event?: StreamAuthEvent;
}

/**
 * Hook for creating Nostr stream authentication events using afk_nostr_sdk
 */
export function useCreateStreamAuthEvent() {
  const { ndk } = useNostrContext();
  const { publicKey, privateKey } = useAuth();

  return useMutation<StreamAuthEvent, Error, {
    streamId: string;
    title?: string;
    description?: string;
  }>({
    mutationKey: ['createStreamAuthEvent'],
    mutationFn: async ({ streamId, title, description }) => {
      if (!publicKey || !privateKey) {
        throw new Error('Public key or private key not available');
      }

      try {
        // Create the signer
        const signer = new NDKPrivateKeySigner(privateKey);
        
        // Create the authentication event
        const event = new NDKEvent(ndk);
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

        // Sign the event
        await event.sign(signer);

        if (!event.sig) {
          throw new Error('Failed to sign stream authentication event');
        }

        return {
          id: event.id || '',
          pubkey: event.pubkey,
          created_at: event.created_at,
          kind: event.kind,
          tags: event.tags,
          content: event.content,
          sig: event.sig,
        };
      } catch (error) {
        console.error('Failed to create stream auth event:', error);
        throw new Error(`Failed to create stream auth event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  });
}

/**
 * Hook for generating stream keys with Nostr authentication
 */
export function useGenerateStreamKey() {
  const createStreamAuthEvent = useCreateStreamAuthEvent();

  return useMutation<StreamAuthResponse, Error, {
    streamId: string;
    title?: string;
    description?: string;
  }>({
    mutationKey: ['generateStreamKey'],
    mutationFn: async ({ streamId, title, description }) => {
      try {
        // Create the authentication event
        const authEvent = await createStreamAuthEvent.mutateAsync({
          streamId,
          title,
          description,
        });

        // Send to data-backend for stream key generation
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';
        const response = await fetch(`${backendUrl}/livestream/${streamId}/rtmp-key`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            publicKey: authEvent.pubkey,
            nostrEvent: authEvent,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to generate stream key');
        }

        return {
          success: true,
          streamKey: result.streamKey,
          rtmpUrl: result.rtmpUrl,
          event: authEvent,
        };
      } catch (error) {
        console.error('Failed to generate stream key:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate stream key',
        };
      }
    },
  });
}

/**
 * Hook for authenticating with RTMP server directly
 */
export function useAuthenticateWithRtmp() {
  const createStreamAuthEvent = useCreateStreamAuthEvent();

  return useMutation<StreamAuthResponse, Error, {
    streamId: string;
    title?: string;
    description?: string;
  }>({
    mutationKey: ['authenticateWithRtmp'],
    mutationFn: async ({ streamId, title, description }) => {
      try {
        // Create the authentication event
        const authEvent = await createStreamAuthEvent.mutateAsync({
          streamId,
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
    },
  });
}
