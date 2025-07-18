# Relay Health Management System

This document describes the relay health management system implemented in the AFK Nostr SDK to handle relay connection failures gracefully.

## Overview

The relay health management system automatically detects and handles relay connection failures, preventing a single failed relay from breaking the entire connection. It provides:

- Automatic detection of failed relays
- Retry logic with healthy relays only
- Manual relay reset capabilities
- Real-time relay health monitoring
- User-friendly status display

## Key Components

### 1. RelayHealthManager

The core class that manages relay health status:

```typescript
import { relayHealthManager } from 'afk_nostr_sdk';

// Mark a relay as failed
relayHealthManager.markRelayFailed('wss://relay.damus.io');

// Mark a relay as successful
relayHealthManager.markRelaySuccess('wss://relay.damus.io');

// Check if a relay is healthy
const isHealthy = relayHealthManager.isRelayHealthy('wss://relay.damus.io');

// Get only healthy relays from a list
const healthyRelays = relayHealthManager.getHealthyRelays(allRelays);

// Reset a specific relay
relayHealthManager.resetRelay('wss://relay.damus.io');

// Reset all failed relays
relayHealthManager.resetAllRelays();
```

### 2. connectWithRetry Function

A utility function that handles connection with automatic retry logic:

```typescript
import { connectWithRetry } from 'afk_nostr_sdk';

const success = await connectWithRetry(ndk, relayUrls, maxRetries);
```

### 3. useRelayHealth Hook

A React hook that provides relay health information and management functions:

```typescript
import { useRelayHealth } from 'afk_nostr_sdk';

const {
  failedRelays,
  healthyRelays,
  isLoading,
  isNdkConnected,
  resetAllRelays,
  resetRelay,
  reconnect,
  connectionStatus,
  relayStats,
  hasFailedRelays,
  hasHealthyRelays,
} = useRelayHealth();
```

### 4. RelayHealthStatus Component

A React component that displays relay health status:

```typescript
import { RelayHealthStatus } from 'afk_nostr_sdk';

<RelayHealthStatus 
  showDetails={true} 
  onRelayReset={() => console.log('Relays reset')}
/>
```

## Usage Examples

### Basic Implementation

```typescript
import { useNostrContext, useRelayHealth, RelayHealthStatus } from 'afk_nostr_sdk';

const MyComponent = () => {
  const { isNdkConnected } = useNostrContext();
  const { failedRelays, resetAllRelays } = useRelayHealth();

  return (
    <div>
      <RelayHealthStatus showDetails={failedRelays.length > 0} />
      
      {failedRelays.length > 0 && (
        <button onClick={resetAllRelays}>
          Reset Failed Relays
        </button>
      )}
    </div>
  );
};
```

### Advanced Usage with Custom Logic

```typescript
import { useRelayHealth, relayHealthManager } from 'afk_nostr_sdk';

const AdvancedRelayManager = () => {
  const {
    failedRelays,
    healthyRelays,
    connectionStatus,
    relayStats,
    resetRelay
  } = useRelayHealth();

  const handleRelayReset = async (relayUrl: string) => {
    await resetRelay(relayUrl);
    // Custom logic after relay reset
  };

  return (
    <div>
      <h3>Relay Status: {connectionStatus.message}</h3>
      
      <div>
        <strong>Statistics:</strong>
        <ul>
          <li>Connected: {relayStats.connected}</li>
          <li>Healthy: {relayStats.healthy}</li>
          <li>Failed: {relayStats.failed}</li>
          <li>Success Rate: {relayStats.successRate}%</li>
        </ul>
      </div>

      {failedRelays.map(relay => (
        <div key={relay.url}>
          <span>{relay.url}</span>
          <span>Failures: {relay.failureCount}</span>
          <button onClick={() => handleRelayReset(relay.url)}>
            Reset
          </button>
        </div>
      ))}
    </div>
  );
};
```

## Configuration

### Failure Thresholds

The system uses the following default thresholds:

- **MAX_FAILURES**: 3 (maximum consecutive failures before marking relay as unhealthy)
- **FAILURE_RESET_TIME**: 5 minutes (time before resetting a failed relay)

These can be modified in the `RelayHealthManager` class:

```typescript
class RelayHealthManager {
  private readonly MAX_FAILURES = 3;
  private readonly FAILURE_RESET_TIME = 5 * 60 * 1000; // 5 minutes
}
```

### Automatic Behavior

The system automatically:

1. **Detects failures**: When a WebSocket connection fails, the relay is marked as failed
2. **Filters healthy relays**: Only healthy relays are used for new connections
3. **Retries connections**: Failed connections are retried with remaining healthy relays
4. **Resets after timeout**: Failed relays are automatically reset after 5 minutes
5. **Updates status**: Connection status is continuously monitored and updated

## Error Handling

The system handles various error scenarios:

- **WebSocket connection failures**: Automatically detected and relay marked as failed
- **Network timeouts**: Handled with retry logic
- **Partial failures**: App continues to work with remaining healthy relays
- **Complete failure**: Graceful degradation with user notification

## Integration with Existing Code

The system is designed to work seamlessly with existing NDK implementations:

1. **Backward compatible**: Existing code continues to work without changes
2. **Automatic integration**: New NDK instances automatically use the health management system
3. **Transparent operation**: Users don't need to change their connection logic

## Best Practices

1. **Monitor relay health**: Use the `RelayHealthStatus` component to show users relay status
2. **Handle reset events**: Implement `onRelayReset` callbacks to notify users of relay resets
3. **Provide user feedback**: Show appropriate messages when relays fail or are reset
4. **Regular health checks**: Use the `useRelayHealth` hook to monitor relay status
5. **Graceful degradation**: Design your app to work with partial relay connectivity

## Troubleshooting

### Common Issues

1. **No relays connecting**: Check if all relays are marked as failed and reset them
2. **Intermittent connections**: Monitor relay health and consider adding more reliable relays
3. **Performance issues**: Ensure you're not creating too many NDK instances

### Debug Information

Enable debug logging to see relay health information:

```typescript
// The system automatically logs relay health events
console.log('Relay health events will appear in console');
```

## API Reference

### RelayHealthManager Methods

- `markRelayFailed(relayUrl: string): void`
- `markRelaySuccess(relayUrl: string): void`
- `isRelayHealthy(relayUrl: string): boolean`
- `getHealthyRelays(allRelays: string[]): string[]`
- `getFailedRelays(): RelayHealth[]`
- `resetRelay(relayUrl: string): void`
- `resetAllRelays(): void`

### useRelayHealth Hook Return Value

```typescript
{
  // State
  failedRelays: RelayHealth[];
  healthyRelays: string[];
  isLoading: boolean;
  isNdkConnected: boolean;
  
  // Actions
  resetAllRelays: () => Promise<void>;
  resetRelay: (relayUrl: string) => Promise<void>;
  reconnect: () => Promise<void>;
  updateRelayStatus: () => void;
  
  // Computed values
  connectionStatus: { status: string; message: string };
  relayStats: { connected: number; healthy: number; failed: number; total: number; successRate: string };
  
  // Utilities
  hasFailedRelays: boolean;
  hasHealthyRelays: boolean;
}
```

### RelayHealthStatus Props

```typescript
{
  showDetails?: boolean;  // Show detailed relay information
  onRelayReset?: () => void;  // Callback when relays are reset
}
``` 