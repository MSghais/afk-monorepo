import { useAccount, useNetwork, useProvider } from '@starknet-react/core';
import {  TOKENS_ADDRESS, NOSTR_FI_SCORING_ADDRESS } from 'common';
import { AccountInterface, byteArray, cairo, CairoCustomEnum, CallData, constants, RpcProvider, uint256 } from 'starknet';
import { formatFloatToUint256 } from '../../utils/format';
import { prepareAndConnectContract } from '../keys/useDataKeys';
import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import { useAuth, useNostrContext } from 'afk_nostr_sdk';
import { useWaitConnection } from '../useWaitConnection';
import { useTransaction } from '../modals';
import { useWalletModal } from '../modals/useWalletModal';
export const NAMESERVICE_ENDPOINTS = {
  claimed: '/username-claimed',
  byUsername: (username: string) => `/username-claimed/username/${username}`,
  byUser: (address: string) => `/username-claimed/user/${address}`,
} as const;

export interface NameserviceData {
  owner_address: string;
  username: string;
  time_stamp: string;
  paid: string;
  quote_address: string;
  expiry: string;
}

export interface VoteParams {
  nostr_address: string;
  vote: "good" | "bad";
  is_upvote: boolean;
  upvote_amount: string;
  downvote_amount: string;
  amount: string;
  amount_token: string;
}

// Original useNameservice hook for contract interactions
export const useVoteTip = () => {
  const account = useAccount();
  const chain = useNetwork();
  const rpcProvider = useProvider();
  const chainId = chain?.chain?.id;
  const provider = new RpcProvider({ nodeUrl: process.env.EXPO_PUBLIC_PROVIDER_URL });
  const { ndk } = useNostrContext();
  const { publicKey } = useAuth();
  const walletModal = useWalletModal();
  const waitConnection = useWaitConnection();
  const { sendTransaction } = useTransaction({});

  const handleVoteStarknetOnly = async (
    voteParams: VoteParams,
    contractAddress?: string,
  ) => {
    // if (!account) return;
    if (!account?.address) {
      walletModal.show();
    }

    const connectedAccount = await waitConnection();
    if (!connectedAccount || !connectedAccount.address) return;

    const addressContract =
      contractAddress ?? NOSTR_FI_SCORING_ADDRESS[constants.StarknetChainId.SN_SEPOLIA];
    console.log('addressContract', addressContract);
    console.log('read asset');

    let quote_address: string =
      TOKENS_ADDRESS[constants.StarknetChainId.SN_SEPOLIA].STRK ??
      TOKENS_ADDRESS[constants.StarknetChainId.SN_SEPOLIA].ETH ??
      '';
    console.log('read nameservice asset');


    const amountToken = formatFloatToUint256(Number(voteParams.amount_token));
    const amount = formatFloatToUint256(Number(voteParams.amount));
    const upvoteAmount = formatFloatToUint256(Number(voteParams.upvote_amount));
    const downvoteAmount = formatFloatToUint256(Number(voteParams.downvote_amount));

    

    let approveCallData = {
      contractAddress: quote_address,
      entrypoint: 'approve',
      calldata: CallData.compile({
        address: addressContract,
        amount: amountToken,
      }),
    };
    let voteEnum = new CairoCustomEnum({ Good: {} });
    if (voteParams?.vote === "good") {
      voteParams.is_upvote = true;
      voteEnum = new CairoCustomEnum({ Good: {} });
    } else {
      voteParams.is_upvote = false;
      voteEnum = new CairoCustomEnum({ Bad: {} });
    }

    const linkedData = CallData.compile({
      nostr_address: uint256.bnToUint256(`0x${voteParams.nostr_address}`), // Recipient nostr pubkey
      vote: voteEnum,
      is_upvote: cairo.felt(voteParams.is_upvote?.toString()),
      upvote_amount: upvoteAmount,
      downvote_amount: downvoteAmount,
      amount: amount,
      amount_token: amountToken,
    });

    const linkedNamespace = {
      contractAddress: addressContract,
      entrypoint: 'vote_nostr_profile_starknet_only',
      calldata: linkedData
    };

    const tx = await sendTransaction([approveCallData, linkedNamespace]);
    console.log('tx hash', tx.transaction_hash);
    // const wait_tx = await account?.waitForTransaction(tx?.transaction_hash);
    return tx;
  };

  const handleVoteWithEvent= async (
    account: AccountInterface,
    voteParams: VoteParams,
    contractAddress?: string,
  ) => {
    if (!account) return;

    const addressContract =
      contractAddress ?? NOSTR_FI_SCORING_ADDRESS[constants.StarknetChainId.SN_SEPOLIA];
    console.log('addressContract', addressContract);
    console.log('read asset');

    const nameservice = await prepareAndConnectContract(provider, addressContract);
    let quote_address: string =
      TOKENS_ADDRESS[constants.StarknetChainId.SN_SEPOLIA].STRK ??
      TOKENS_ADDRESS[constants.StarknetChainId.SN_SEPOLIA].ETH ??
      '';
    console.log('read nameservice asset');

    try {
      quote_address = await nameservice.get_token_quote();
    } catch (error) {
      console.log('Error get amount to paid', error);
    }

    const asset = await prepareAndConnectContract(
      provider,
      quote_address ?? TOKENS_ADDRESS[constants.StarknetChainId.SN_SEPOLIA].ETH,
      account,
    );
    console.log('convert float');
    console.log('read amountToPaid');


    const getNostrEvent = async () => {
      const event = new NDKEvent(ndk);
      event.kind = NDKKind.Text;
      event.content = `link to ${cairo.felt(account?.address!)}`;
      event.tags = [];

      await event.sign();
      return event.rawEvent();
    };

    // Send the claim through the wallet
    const event = await getNostrEvent();


    const amountToken = formatFloatToUint256(Number(voteParams.amount_token));
    const amount = formatFloatToUint256(Number(voteParams.amount));
    const upvoteAmount = formatFloatToUint256(Number(voteParams.upvote_amount));
    const downvoteAmount = formatFloatToUint256(Number(voteParams.downvote_amount));

    let approveCallData = {
      contractAddress: quote_address,
      entrypoint: 'approve',
      calldata: CallData.compile({
        address: addressContract,
        amount: amountToken,
      }),
    };
    const signature = event.sig ?? '';
    const signatureR = signature.slice(0, signature.length / 2);
    const signatureS = signature.slice(signature.length / 2);

    let voteEnum = new CairoCustomEnum({ Good: {} });

    if (voteParams?.vote === "good") {
      voteParams.is_upvote = true;
      voteEnum = new CairoCustomEnum({ Good: {} });

    } else {
      voteParams.is_upvote = false;
      voteEnum = new CairoCustomEnum({ Bad: {} });

    }

    const linkedData = CallData.compile({
      nostr_address: uint256.bnToUint256(`0x${voteParams.nostr_address}`), // Recipient nostr pubkey
      vote: voteEnum,
      is_upvote: cairo.felt(voteParams.is_upvote?.toString()),
      upvote_amount: upvoteAmount,
      downvote_amount: downvoteAmount,
      amount: amount,
      amount_token: amountToken,
    });

    const linkedNamespace = {
      contractAddress: addressContract,
      entrypoint: 'vote_nostr_profile_starknet_only',
      calldata: linkedData
    };

    const tx = await sendTransaction([approveCallData, linkedNamespace]);
    console.log('tx hash', tx.transaction_hash);
    // const wait_tx = await account?.waitForTransaction(tx?.transaction_hash);
    return tx;
  };

  return {
    handleVoteStarknetOnly,
  };
};
