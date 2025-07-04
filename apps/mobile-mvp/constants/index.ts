import { generateNonce } from '@/utils/helpers';
import { constants, shortString } from 'starknet';

export * from './env';
export * from './tokens';

export const typedDataValidate = {
  types: {
    StarkNetDomain: [
      { name: 'name', type: 'felt' },
      { name: 'version', type: 'felt' },
      { name: 'chainId', type: 'felt' },
      { name: 'uri', type: 'felt' },
    ],
    Message: [
      { name: 'address', type: 'felt' },
      { name: 'statement', type: 'felt' },
      { name: 'nonce', type: 'felt' },
      { name: 'issuedAt', type: 'felt' },
    ],
  },
  primaryType: 'Message',
  domain: {
    name: 'AFk',
    version: '0.0.5',
    chainId: shortString.encodeShortString(process.env.EXPO_PUBLIC_NETWORK || 'SN_MAIN'),
    uri: 'https://afk-community.xyz/',
  },
  message: {
    address: '',
    statement: 'I love Afk!',
    nonce: generateNonce.randomString(),
    issuedAt: new Date().toISOString(),
  },
};


export enum Entrypoint {
  // ERC-20
  NAME = 'name',
  SYMBOL = 'symbol',
  APPROVE = 'approve',
  TRANSFER = 'transfer',
  BALANCE_OF = 'balance_of',

  // Escrow
  DEPOSIT = 'deposit',
  CLAIM = 'claim',
  GET_DEPOSIT = 'get_deposit',
}

export enum EventKey {
  DepositEvent = '0xa1db419bdf20c7726cf74c30394c4300e5645db4e3cacaf897da05faabae03',
  TransferEvent = '0x15884c9d44b49803fec52bec32166b4a87f9683725e9c83e8b0bc12306fc10',
  ClaimEvent = '0x1338111cc170c56fecb176d35cca4c04823f0b8d9c64cfb956c97b236ea6fc6',
}

export const DEFAULT_TIMELOCK = 0; // 7 days
// export const DEFAULT_TIMELOCK = 7 * 24 * 60 * 60 * 1_000; // 7 days

export const WEB_MAX_WIDTH = 520;

export enum EventKeyForKeysMarketplace {
  CreateKeys = '0x10847dcd18ec5858348344447324265bf28e3f8c5fa6f6863f5210845821914',
}
