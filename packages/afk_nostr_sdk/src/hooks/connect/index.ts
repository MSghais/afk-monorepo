import { useMutation } from "@tanstack/react-query";
import { useNostrContext } from "../../context/NostrContext";
import NDK from "@nostr-dev-kit/ndk";
import { connectWithRetry, relayHealthManager } from "../../utils/relay";

export const checkIsConnected = async (ndk: NDK) => {
  try {
    const connectedRelays = ndk.pool.connectedRelays();
    console.log("Connected relays:", connectedRelays.length);
    
    if (connectedRelays.length === 0) {
      console.log("No connected relays, attempting to connect");
      
      // Get the current relay URLs from the NDK instance
      const currentRelays = Array.from(ndk.pool.relays.keys());
      
      if (currentRelays.length === 0) {
        console.error("No relays configured in NDK instance");
        return false;
      }
      
      // Use the new retry logic with reduced retries for speed
      const success = await connectWithRetry(ndk, currentRelays, 1); // Only 1 retry for speed
      
      if (success) {
        console.log("Successfully connected to relays");
        return true;
      } else {
        console.error("Failed to connect to any relays");
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Error in checkIsConnected:", error);
    
    // Try to extract relay URL from error and mark it as failed
    if (error.message && error.message.includes('WebSocket connection')) {
      const match = error.message.match(/WebSocket connection to '([^']+)'/);
      if (match) {
        const failedRelay = match[1];
        relayHealthManager.markRelayFailed(failedRelay);
        console.warn(`Marked relay ${failedRelay} as failed`);
      }
    }
    
    return false;
  }
};

export const useConnect = () => {
  const { ndk, reconnect } = useNostrContext();

  return useMutation({
    mutationKey: ['connect', ndk],
    mutationFn: async () => {
      const success = await checkIsConnected(ndk);
      if (!success) {
        // If checkIsConnected fails, try manual reconnect
        await reconnect();
      }
    },
  });
};  