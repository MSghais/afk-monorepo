import React, { useState, useEffect } from 'react';
import { useNostrContext } from '../context/NostrContext';
import { relayHealthManager } from '../utils/relay';

interface RelayHealthStatusProps {
  showDetails?: boolean;
  onRelayReset?: () => void;
}

export const RelayHealthStatus: React.FC<RelayHealthStatusProps> = ({ 
  showDetails = false, 
  onRelayReset 
}) => {
  const { getFailedRelays, resetFailedRelays, isNdkConnected } = useNostrContext();
  const [failedRelays, setFailedRelays] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateFailedRelays = () => {
      const failed = getFailedRelays();
      setFailedRelays(failed);
      setIsVisible(failed.length > 0);
    };

    // Update immediately
    updateFailedRelays();

    // Update every 30 seconds
    const interval = setInterval(updateFailedRelays, 30000);

    return () => clearInterval(interval);
  }, [getFailedRelays]);

  const handleResetAllRelays = () => {
    resetFailedRelays();
    setFailedRelays([]);
    setIsVisible(false);
    onRelayReset?.();
  };

  const handleResetRelay = (relayUrl: string) => {
    relayHealthManager.resetRelay(relayUrl);
    setFailedRelays(getFailedRelays());
    onRelayReset?.();
  };

  if (!isVisible && !showDetails) {
    return null;
  }

  return (
    <div style={{
      padding: '12px',
      margin: '8px 0',
      borderRadius: '8px',
      backgroundColor: '#fef3c7',
      border: '1px solid #f59e0b',
      fontSize: '14px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: failedRelays.length > 0 ? '8px' : '0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: isNdkConnected ? '#10b981' : '#ef4444' 
          }} />
          <strong>
            {isNdkConnected ? 'Connected' : 'Disconnected'} 
            {failedRelays.length > 0 && ` (${failedRelays.length} failed relay${failedRelays.length > 1 ? 's' : ''})`}
          </strong>
        </div>
        
        {failedRelays.length > 0 && (
          <button
            onClick={handleResetAllRelays}
            style={{
              background: 'none',
              border: '1px solid #f59e0b',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              color: '#92400e'
            }}
          >
            Reset All
          </button>
        )}
      </div>

      {showDetails && failedRelays.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>
            Failed Relays:
          </div>
          {failedRelays.map((relay) => (
            <div key={relay.url} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              fontSize: '12px'
            }}>
              <span style={{ fontFamily: 'monospace' }}>{relay.url}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#92400e' }}>
                  {relay.failureCount} failures
                </span>
                <button
                  onClick={() => handleResetRelay(relay.url)}
                  style={{
                    background: 'none',
                    border: '1px solid #f59e0b',
                    borderRadius: '2px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    color: '#92400e'
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 