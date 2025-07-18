export const RELAYS_PROD = [
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nos.lol'
  // 'wss://relay.snort.social',
  // 'wss://nos.lol'
  // 'wss://relay.n057r.club', 'wss://relay.nostr.net',
];

export const RELAYS_TEST = [
  'wss://nos.lol'
];

// export const RELAYS_TEST = ['wss://relay.n057r.club', 'wss://relay.nostr.net'];

export const RELAY_AFK_PRODUCTION = 'wss://nostr-relay-nestjs-production.up.railway.app';

export const AFK_RELAYS =
  process.env.EXPO_NODE_ENV == 'production' ||
    process.env.EXPO_PUBLIC_NODE_ENV == 'production' ||
    process.env.NEXT_PUBLIC_NODE_ENV == 'production' ||
    process.env.NODE_ENV == 'production'
    ? [
      ...RELAYS_PROD,
      'wss://nostr-relay-nestjs-production.up.railway.app',
    ]
    : [
      // ...RELAYS_TEST,
      // ...RELAYS_PROD,
      'wss://nostr-relay-nestjs-production.up.railway.app',
    ];

// Relay health management
export interface RelayHealth {
  url: string;
  isHealthy: boolean;
  lastFailure?: number;
  failureCount: number;
  lastSuccess?: number;
}

class RelayHealthManager {
  private failedRelays: Map<string, RelayHealth> = new Map();
  private readonly MAX_FAILURES = 3;
  private readonly FAILURE_RESET_TIME = 5 * 60 * 1000; // 5 minutes

  markRelayFailed(relayUrl: string): void {
    const now = Date.now();
    const existing = this.failedRelays.get(relayUrl);
    
    if (existing) {
      existing.failureCount++;
      existing.lastFailure = now;
      existing.isHealthy = false;
    } else {
      this.failedRelays.set(relayUrl, {
        url: relayUrl,
        isHealthy: false,
        lastFailure: now,
        failureCount: 1,
      });
    }
    
    console.warn(`Relay ${relayUrl} marked as failed (attempt ${this.failedRelays.get(relayUrl)?.failureCount})`);
  }

  markRelaySuccess(relayUrl: string): void {
    const existing = this.failedRelays.get(relayUrl);
    if (existing) {
      existing.isHealthy = true;
      existing.lastSuccess = Date.now();
      existing.failureCount = 0;
      console.log(`Relay ${relayUrl} marked as healthy`);
    }
  }

  isRelayHealthy(relayUrl: string): boolean {
    const health = this.failedRelays.get(relayUrl);
    if (!health) return true; // New relay, assume healthy
    
    // Reset if enough time has passed
    if (health.lastFailure && Date.now() - health.lastFailure > this.FAILURE_RESET_TIME) {
      this.failedRelays.delete(relayUrl);
      return true;
    }
    
    return health.isHealthy && health.failureCount < this.MAX_FAILURES;
  }

  getHealthyRelays(allRelays: string[]): string[] {
    return allRelays.filter(relay => this.isRelayHealthy(relay));
  }

  getFailedRelays(): RelayHealth[] {
    return Array.from(this.failedRelays.values());
  }

  resetRelay(relayUrl: string): void {
    this.failedRelays.delete(relayUrl);
    console.log(`Relay ${relayUrl} reset`);
  }

  resetAllRelays(): void {
    this.failedRelays.clear();
    console.log('All relays reset');
  }
}

// Global instance
export const relayHealthManager = new RelayHealthManager();

// Helper function to get healthy relays
export const getHealthyRelays = (relays: string[]): string[] => {
  return relayHealthManager.getHealthyRelays(relays);
};

// Helper function to connect with retry logic
export const connectWithRetry = async (
  ndk: any,
  relays: string[],
  maxRetries: number = 2,
  fastMode: boolean = false
): Promise<boolean> => {
  // In fast mode, use all relays without health filtering for initial connection
  const relaysToUse = fastMode ? relays : getHealthyRelays(relays);
  
  if (relaysToUse.length === 0) {
    console.error('No relays available');
    return false;
  }

  // Try direct connection first (fastest)
  try {
    console.log(`Attempting ${fastMode ? 'fast' : 'health-filtered'} connection with ${relaysToUse.length} relays`);
    
    const newNdk = new (ndk.constructor)({
      explicitRelayUrls: relaysToUse,
      signer: ndk.signer,
    });

    await newNdk.connect();
    
    // Mark all used relays as successful
    relaysToUse.forEach(relay => relayHealthManager.markRelaySuccess(relay));
    
    // Update the original NDK instance
    Object.assign(ndk, newNdk);
    
    console.log('Successfully connected to relays on first attempt');
    return true;
  } catch (error) {
    console.error('Direct connection failed:', error);
    
    // Mark failed relays from error message
    if (error.message && error.message.includes('WebSocket connection')) {
      const match = error.message.match(/WebSocket connection to '([^']+)'/);
      if (match) {
        const failedRelay = match[1];
        relayHealthManager.markRelayFailed(failedRelay);
      }
    }
  }

  // If direct connection failed and not in fast mode, try with retries
  if (!fastMode && maxRetries > 1) {
    const remainingRelays = getHealthyRelays(relays);
    
    if (remainingRelays.length === 0) {
      console.error('No healthy relays remaining after failure');
      return false;
    }

    for (let attempt = 1; attempt < maxRetries; attempt++) {
      try {
        console.log(`Retry attempt ${attempt}/${maxRetries - 1} with relays:`, remainingRelays);
        
        const newNdk = new (ndk.constructor)({
          explicitRelayUrls: remainingRelays,
          signer: ndk.signer,
        });

        await newNdk.connect();
        
        // Mark all used relays as successful
        remainingRelays.forEach(relay => relayHealthManager.markRelaySuccess(relay));
        
        // Update the original NDK instance
        Object.assign(ndk, newNdk);
        
        console.log('Successfully connected to relays on retry');
        return true;
      } catch (error) {
        console.error(`Retry attempt ${attempt} failed:`, error);
        
        // Mark failed relays
        if (error.message && error.message.includes('WebSocket connection')) {
          const match = error.message.match(/WebSocket connection to '([^']+)'/);
          if (match) {
            const failedRelay = match[1];
            relayHealthManager.markRelayFailed(failedRelay);
          }
        }
        
        // Update remaining relays for next attempt
        const newRemainingRelays = getHealthyRelays(relays);
        if (newRemainingRelays.length === 0) {
          console.error('No healthy relays remaining');
          return false;
        }
        
        // Update the remaining relays array
        remainingRelays.length = 0;
        remainingRelays.push(...newRemainingRelays);
      }
    }
  }
  
  return false;
};

// Fast connection function for initial connections
export const connectFast = async (
  ndk: any,
  relays: string[]
): Promise<boolean> => {
  return connectWithRetry(ndk, relays, 1, true);
};