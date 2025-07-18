import React from 'react';
import NDK, { NDKNip07Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { NDKCashuWallet, NDKWallet, NDKNWCWallet } from '@nostr-dev-kit/ndk-wallet';
import { createContext, useContext, useEffect, useState } from 'react';

import { useSettingsStore } from '../store';
import { useAuth } from '../store/auth';
import { AFK_RELAYS, connectWithRetry, connectFast, relayHealthManager } from '../utils/relay';
import { checkIsConnected } from '../hooks/connect';

// Create a separate type for the NDK instance to avoid direct type conflicts
type NDKInstance = NDK;

export type NostrContextType = {
  ndk: NDKInstance;
  nip07Signer?: NDKNip07Signer;
  nwcNdk?: NDKNWCWallet;
  ndkCashuWallet?: NDKCashuWallet;
  ndkWallet?: NDKWallet;
  setNdk: (ndk: NDKInstance) => void;
  isNdkConnected: boolean;
  setIsNdkConnected: (isNdkConnected: boolean) => void;
  reconnect: () => Promise<void>;
  getFailedRelays: () => any[];
  resetFailedRelays: () => void;
};

export const NostrContext = createContext<NostrContextType | null>(null);

export const NostrProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const privateKey = useAuth((state) => state.privateKey);
  const publicKey = useAuth((state) => state.publicKey);
  const isExtension = useAuth((state) => state.isExtension);
  const nwcUrl = useAuth((state) => state.nwcUrl);
  const relays = useSettingsStore((state) => state.relays);
  const setIsConnected = useSettingsStore((state) => state.setIsConnected);
  const nip07Signer = new NDKNip07Signer();
  const [isNdkConnected, setIsNdkConnected] = useState(false);
  const [ndk, setNdk] = useState<NDKInstance>(
    new NDK({
      explicitRelayUrls: relays ?? AFK_RELAYS,
      signer: isExtension ?
        nip07Signer :
        privateKey
          ? new NDKPrivateKeySigner(privateKey)
          : isExtension
            ? nip07Signer
            : undefined,
    }),
  );

  // Use any type to avoid type incompatibility issues
  const [ndkCashuWallet, setNDKCashuWallet] = useState<any>(
    new NDKCashuWallet(ndk as any),
  );
  const [ndkWallet, setNDKWallet] = useState<any>();
  // const [ndkWallet, setNDKWallet] = useState<any>(new NDKWalletNWC(ndk as any));

  const [nwcNdk, setNWCNdk] = useState<NDKNWCWallet | undefined>(undefined);

  const [ndkExtension, setNdkExtension] = useState<NDKInstance>(
    new NDK({
      explicitRelayUrls: relays ?? AFK_RELAYS,
    }),
  );

  // Function to connect with retry logic
  const connectToRelays = async (useFastMode: boolean = false) => {
    try {
      const currentRelays = relays ?? AFK_RELAYS;
      
      let success: boolean;
      if (useFastMode) {
        success = await connectFast(ndk, currentRelays);
      } else {
        success = await connectWithRetry(ndk, currentRelays, 2);
      }
      
      if (success) {
        setIsNdkConnected(true);
        console.log('Successfully connected to relays');
      } else {
        setIsNdkConnected(false);
        console.error('Failed to connect to any relays');
      }
    } catch (error) {
      console.error('Error in connectToRelays:', error);
      setIsNdkConnected(false);
    }
  };

  // Manual reconnect function
  const reconnect = async () => {
    console.log('Manual reconnect triggered');
    setIsNdkConnected(false);
    await connectToRelays(false); // Use health-filtered mode for manual reconnect
  };

  // Get failed relays
  const getFailedRelays = () => {
    return relayHealthManager.getFailedRelays();
  };

  // Reset failed relays
  const resetFailedRelays = () => {
    relayHealthManager.resetAllRelays();
    console.log('All failed relays have been reset');
  };

  useEffect(() => {
    const newNdk = new NDK({
      explicitRelayUrls: relays ?? AFK_RELAYS,
      signer: privateKey
        ? new NDKPrivateKeySigner(privateKey)
        : isExtension
          ? nip07Signer
          : undefined,
    });

    setNdk(newNdk);
    
    // Use fast mode for initial connection
    connectToRelays(true);

    // Use any type to avoid type incompatibility issues
    const ndkCashuWalletNew = new NDKCashuWallet(newNdk as any);
    setNDKCashuWallet(ndkCashuWalletNew);

    // newNdk.wallet= ndkCashuWalletNew;

    // const ndkNewWallet = new NDKWalletNWC(ndk as any);
    // setNDKWallet(ndkNewWallet);
  }, [privateKey, isExtension, relays]);

  useEffect(() => {
    if (nwcUrl) {
      // ndk.nwc(nwcUrl).then((res) => {
      //   setNWCNdk(res);
      // });
    }
  }, [nwcUrl, ndk]);

  useEffect(() => {
    const checkConnection = () => {
      const connected = ndk.pool.connectedRelays().length > 0;
      setIsConnected(connected);
      
      // Only try to reconnect if we're not connected and haven't tried recently
      if (!connected && !isNdkConnected) {
        console.log('No connected relays detected, attempting to reconnect...');
        connectToRelays(false); // Use health-filtered mode for reconnection
      }
    };

    const interval = setInterval(checkConnection, 1000 * 60); // Check every minute

    // Initial check
    checkConnection();

    return () => clearInterval(interval); // Cleanup on component unmount
  }, [ndk, setIsConnected, isNdkConnected]);

  // Simplified connection check - only run once after NDK is set
  useEffect(() => {
    if (ndk && !isNdkConnected) {
      // Quick check without full reconnection
      const connected = ndk.pool.connectedRelays().length > 0;
      if (connected) {
        setIsNdkConnected(true);
      } else {
        // Only try to reconnect if not already connected
        connectToRelays(false); // Use health-filtered mode for reconnection
      }
    }
  }, [ndk]);

  return (
    <NostrContext.Provider
      value={{ 
        ndk, 
        nip07Signer, 
        nwcNdk, 
        ndkWallet, 
        ndkCashuWallet, 
        setNdk, 
        isNdkConnected, 
        setIsNdkConnected,
        reconnect,
        getFailedRelays,
        resetFailedRelays
      }}>
      {children}
    </NostrContext.Provider>
  );
};

export const useNostrContext = () => {
  const nostr = useContext(NostrContext);

  if (!nostr) {
    throw new Error('NostrContext must be used within a NostrProvider');
  }

  return nostr;
};
