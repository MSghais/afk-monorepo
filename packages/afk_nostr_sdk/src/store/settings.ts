import {createStore} from 'zustand';

import {AFK_RELAYS, relayHealthManager} from '../utils/relay';
import createBoundedUseStore from './createBoundedUseStore';

type State = {
  relays: string[];
  isConnected: boolean;
  failedRelays: string[];
  lastConnectionAttempt: number;
};

type Action = {
  setRelays: (relays: string[]) => void;
  setIsConnected: (isConnected: boolean) => void;
  addFailedRelay: (relay: string) => void;
  removeFailedRelay: (relay: string) => void;
  resetFailedRelays: () => void;
  setLastConnectionAttempt: (timestamp: number) => void;
  getHealthyRelays: () => string[];
};

const getDefaultValue = () => {
  return {
    relays: AFK_RELAYS,
    isConnected: false,
    failedRelays: [],
    lastConnectionAttempt: 0,
  };
};

export const settingsStore = createStore<State & Action>((set, get) => ({
  // relays: undefined as unknown as string[],
  relays: getDefaultValue().relays,
  isConnected: getDefaultValue().isConnected,
  failedRelays: getDefaultValue().failedRelays,
  lastConnectionAttempt: getDefaultValue().lastConnectionAttempt,
  
  setRelays: (relays) => {
    set({relays});
  },
  
  setIsConnected: (isConnected) => {
    set({isConnected});
  },
  
  addFailedRelay: (relay) => {
    const { failedRelays } = get();
    if (!failedRelays.includes(relay)) {
      set({ failedRelays: [...failedRelays, relay] });
    }
  },
  
  removeFailedRelay: (relay) => {
    const { failedRelays } = get();
    set({ failedRelays: failedRelays.filter(r => r !== relay) });
  },
  
  resetFailedRelays: () => {
    set({ failedRelays: [] });
    relayHealthManager.resetAllRelays();
  },
  
  setLastConnectionAttempt: (timestamp) => {
    set({ lastConnectionAttempt: timestamp });
  },
  
  getHealthyRelays: () => {
    const { relays } = get();
    return relayHealthManager.getHealthyRelays(relays);
  },
}));

export const useSettingsStore = createBoundedUseStore(settingsStore);
