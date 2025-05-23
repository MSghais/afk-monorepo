'use client';

import { CHAIN_ID, NETWORK_NAME } from '@/constants/misc';
import { mainnet, sepolia } from '@starknet-react/chains';
import {
  argent,
  braavos,
  publicProvider,
  StarknetConfig,
  useInjectedConnectors,
  voyager,
} from '@starknet-react/core';

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const chains = [mainnet, sepolia];
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: 'onlyIfNoConnectors',
    order: 'random',
  });

  return (
    <StarknetConfig
      chains={chains}
      provider={publicProvider()}
      explorer={voyager}
      connectors={connectors}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}

// 'use client';

// import React from 'react';
// import { StarknetConfig } from '@starknet-react/core';
// // import { StarknetkitConnector } from 'starknetkit';
// import { sepolia } from '@starknet-react/chains';
// import { Provider } from 'starknet';

// const connectors = [
//     {
//       chains: [sepolia],
//       projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '',
//     },
// ];

// const provider = new Provider({ rpc: { nodeUrl: 'https://sepolia.starknet.io' } });

// interface StarknetProvidersProps {
//   children: React.ReactNode;
// }

// export const StarknetProviders: React.FC<StarknetProvidersProps> = ({ children }) => {
//   return (
//     <StarknetConfig 
//       connectors={connectors} 
//       autoConnect
//       chains={[sepolia]}
//       provider={provider}
//     >
//       {children}
//     </StarknetConfig>
//   );
// }; 