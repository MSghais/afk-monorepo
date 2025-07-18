import { useCallback, useEffect, useState } from 'react';
import { useNostrContext } from '../context/NostrContext';
import { useSettingsStore } from '../store/settings';
import { relayHealthManager, RelayHealth } from '../utils/relay';

export const useRelayHealth = () => {
  const { ndk, isNdkConnected, reconnect } = useNostrContext();
  const { getHealthyRelays, resetFailedRelays } = useSettingsStore();
  const [failedRelays, setFailedRelays] = useState<RelayHealth[]>([]);
  const [healthyRelays, setHealthyRelays] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const updateRelayStatus = useCallback(() => {
    const failed = relayHealthManager.getFailedRelays();
    const healthy = getHealthyRelays();
    
    setFailedRelays(failed);
    setHealthyRelays(healthy);
  }, [getHealthyRelays]);

  useEffect(() => {
    updateRelayStatus();
    
    // Update status every 2 minutes instead of 30 seconds for better performance
    const interval = setInterval(updateRelayStatus, 120000);
    
    return () => clearInterval(interval);
  }, [updateRelayStatus]);

  const handleResetAllRelays = useCallback(async () => {
    setIsLoading(true);
    try {
      resetFailedRelays();
      updateRelayStatus();
      
      // Attempt to reconnect
      await reconnect();
    } catch (error) {
      console.error('Error resetting relays:', error);
    } finally {
      setIsLoading(false);
    }
  }, [resetFailedRelays, updateRelayStatus, reconnect]);

  const handleResetRelay = useCallback(async (relayUrl: string) => {
    setIsLoading(true);
    try {
      relayHealthManager.resetRelay(relayUrl);
      updateRelayStatus();
      
      // Attempt to reconnect
      await reconnect();
    } catch (error) {
      console.error('Error resetting relay:', error);
    } finally {
      setIsLoading(false);
    }
  }, [updateRelayStatus, reconnect]);

  const getConnectionStatus = useCallback(() => {
    const connectedCount = ndk.pool.connectedRelays().length;
    const totalHealthy = healthyRelays.length;
    
    if (connectedCount === 0) {
      return { status: 'disconnected', message: 'No relays connected' };
    } else if (connectedCount < totalHealthy) {
      return { 
        status: 'partial', 
        message: `${connectedCount}/${totalHealthy} relays connected` 
      };
    } else {
      return { 
        status: 'connected', 
        message: `All ${connectedCount} relays connected` 
      };
    }
  }, [ndk, healthyRelays]);

  const getRelayStats = useCallback(() => {
    const connectedCount = ndk.pool.connectedRelays().length;
    const totalRelays = healthyRelays.length + failedRelays.length;
    
    return {
      connected: connectedCount,
      healthy: healthyRelays.length,
      failed: failedRelays.length,
      total: totalRelays,
      successRate: totalRelays > 0 ? ((healthyRelays.length / totalRelays) * 100).toFixed(1) : '0'
    };
  }, [healthyRelays, failedRelays, ndk]);

  return {
    // State
    failedRelays,
    healthyRelays,
    isLoading,
    isNdkConnected,
    
    // Actions
    resetAllRelays: handleResetAllRelays,
    resetRelay: handleResetRelay,
    reconnect,
    updateRelayStatus,
    
    // Computed values
    connectionStatus: getConnectionStatus(),
    relayStats: getRelayStats(),
    
    // Utilities
    hasFailedRelays: failedRelays.length > 0,
    hasHealthyRelays: healthyRelays.length > 0,
  };
}; 