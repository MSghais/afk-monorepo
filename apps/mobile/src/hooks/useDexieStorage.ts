import { useCallback } from 'react';
import { MeltQuoteResponse, Proof, Token } from '@cashu/cashu-ts';
import { ICashuInvoice, MintData } from 'afk_nostr_sdk';

import { db, useLiveQuery, ProofWithMint } from '../utils/database/db';

// Generic hook for settings
export function useSettingStorage<T extends string>(key: string, initialValue: T) {
  // Get the value from database using live query
  const value = useLiveQuery(
    async () => {
      const result = await db.settings.get(key);
      return result?.value || initialValue;
    },
    [key, initialValue]
  ) as T;

  // Set value
  const setValue = useCallback(
    async (newValue: T | ((prev: T) => T)) => {
      const valueToStore = newValue instanceof Function ? newValue(value) : newValue;
      await db.settings.put({ key, value: valueToStore });
    },
    [key, value]
  );

  return { value, setValue };
}

// Hook for mints
export function useMintStorage() {
  // Get mints
  const value = useLiveQuery(() => db.mints.toArray(), []) as MintData[];

  // Update mints
  const setValue = useCallback(async (newMints: MintData[] | ((prev: MintData[]) => MintData[])) => {
    const mintsToStore = newMints instanceof Function ? newMints(value || []) : newMints;
    
    // Clear the table and add new mints
    await db.transaction('rw', db.mints, async () => {
      await db.mints.clear();
      await db.mints.bulkAdd(mintsToStore);
    });
  }, [value]);

  return { value: value || [], setValue };
}

// Hook for active mint
export function useActiveMintStorage() {
  return useSettingStorage<string>('ACTIVE_MINT', '');
}

// Hook for proofs
export function useProofsStorage() {
  // Get proofs
  const value = useLiveQuery(() => db.proofs.toArray(), []) as Proof[];

  // Update proofs
  const setValue = useCallback(async (newProofs: Proof[] | ((prev: Proof[]) => Proof[])) => {
    const proofsToStore = newProofs instanceof Function ? newProofs(value || []) : newProofs;
    
    // Clear the table and add new proofs
    await db.transaction('rw', db.proofs, async () => {
      await db.proofs.clear();
      await db.proofs.bulkAdd(proofsToStore);
    });
  }, [value]);

  return { value: value || [], setValue };
}

// Hook for proofs by mint
export function useProofsByMintStorage(mintUrl?: string) {
  // Get proofs for specific mint or all proofs if no mintUrl specified
  const value = useLiveQuery(async () => {
    if (mintUrl) {
      return db.proofsByMint.where('mintUrl').equals(mintUrl).toArray();
    } 
    return db.proofsByMint.toArray();
  }, [mintUrl]) as ProofWithMint[];

  // Set or update proofs for a mint
  const setValue = useCallback(async (
    newProofs: Proof[] | ((prev: ProofWithMint[]) => Proof[]), 
    mint: string = mintUrl || ''
  ) => {
    if (!mint) {
      console.error('No mint URL provided for useProofsByMintStorage.setValue');
      return;
    }
    
    const proofsToStore = newProofs instanceof Function ? newProofs(value || []) : newProofs;
    
    // Convert to ProofWithMint
    const proofsWithMint = proofsToStore.map(proof => ({
      ...proof,
      mintUrl: mint
    }));
    
    // Clear existing proofs for this mint and add new ones
    await db.transaction('rw', db.proofsByMint, async () => {
      await db.proofsByMint.where('mintUrl').equals(mint).delete();
      await db.proofsByMint.bulkAdd(proofsWithMint);
    });
  }, [value, mintUrl]);

  // Add proofs to a mint
  const addProofs = useCallback(async (
    proofsToAdd: Proof[],
    mint: string = mintUrl || ''
  ) => {
    if (!mint) {
      console.error('No mint URL provided for useProofsByMintStorage.addProofs');
      return;
    }
    
    // Convert to ProofWithMint
    const proofsWithMint = proofsToAdd.map(proof => ({
      ...proof,
      mintUrl: mint
    }));
    
    // Add proofs keeping existing ones
    await db.transaction('rw', db.proofsByMint, async () => {
      await db.proofsByMint.bulkPut(proofsWithMint);
    });
  }, [mintUrl]);

  // Delete proofs from a mint
  const deleteProofs = useCallback(async (
    proofIds: string[],
    mint: string = mintUrl || ''
  ) => {
    if (!mint) {
      console.error('No mint URL provided for useProofsByMintStorage.deleteProofs');
      return;
    }
    
    await db.transaction('rw', db.proofsByMint, async () => {
      await db.proofsByMint.bulkDelete(proofIds);
    });
  }, [mintUrl]);

  // Sync proofs between regular proofs table and proofsByMint
  const syncWithProofs = useCallback(async (
    proofs: Proof[],
    mint: string = mintUrl || ''
  ) => {
    if (!mint) {
      console.error('No mint URL provided for useProofsByMintStorage.syncWithProofs');
      return;
    }
    
    const proofsWithMint = proofs.map(proof => ({
      ...proof,
      mintUrl: mint
    }));
    
    await db.transaction('rw', db.proofsByMint, async () => {
      // Remove all existing proofs for this mint
      await db.proofsByMint.where('mintUrl').equals(mint).delete();
      // Add the current proofs
      await db.proofsByMint.bulkAdd(proofsWithMint);
    });
  }, [mintUrl]);

  return { 
    value: value || [], 
    setValue, 
    addProofs, 
    deleteProofs, 
    syncWithProofs 
  };
}

// Hook for tokens
export function useTokensStorage() {
  // Get tokens
  const value = useLiveQuery(() => db.tokens.toArray(), []) as Token[];

  // Update tokens
  const setValue = useCallback(async (newTokens: Token[] | ((prev: Token[]) => Token[])) => {
    const tokensToStore = newTokens instanceof Function ? newTokens(value || []) : newTokens;
    
    // Clear the table and add new tokens
    await db.transaction('rw', db.tokens, async () => {
      await db.tokens.clear();
      await db.tokens.bulkAdd(tokensToStore);
    });
  }, [value]);

  return { value: value || [], setValue };
}

// Hook for quotes
export function useQuotesStorage() {
  // Get quotes
  const value = useLiveQuery(() => db.quotes.toArray(), []) as MeltQuoteResponse[];

  // Update quotes
  const setValue = useCallback(async (newQuotes: MeltQuoteResponse[] | ((prev: MeltQuoteResponse[]) => MeltQuoteResponse[])) => {
    const quotesToStore = newQuotes instanceof Function ? newQuotes(value || []) : newQuotes;
    
    // Clear the table and add new quotes
    await db.transaction('rw', db.quotes, async () => {
      await db.quotes.clear();
      await db.quotes.bulkAdd(quotesToStore);
    });
  }, [value]);

  return { value: value || [], setValue };
}

// Hook for invoices
export function useInvoicesStorage() {
  // Get invoices
  const value = useLiveQuery(() => db.invoices.toArray(), []) as ICashuInvoice[];

  // Update invoices
  const setValue = useCallback(async (newInvoices: ICashuInvoice[] | ((prev: ICashuInvoice[]) => ICashuInvoice[])) => {
    const invoicesToStore = newInvoices instanceof Function ? newInvoices(value || []) : newInvoices;
    
    // Clear the table and add new invoices
    await db.transaction('rw', db.invoices, async () => {
      await db.invoices.clear();
      await db.invoices.bulkAdd(invoicesToStore);
    });
  }, [value]);

  return { value: value || [], setValue };
}

// Hook for transactions
export function useTransactionsStorage() {
  // Get transactions
  const value = useLiveQuery(() => db.transactions.toArray(), []) as ICashuInvoice[];

  // Update transactions
  const setValue = useCallback(async (newTransactions: ICashuInvoice[] | ((prev: ICashuInvoice[]) => ICashuInvoice[])) => {
    const transactionsToStore = newTransactions instanceof Function ? newTransactions(value || []) : newTransactions;
    
    // Clear the table and add new transactions
    await db.transaction('rw', db.transactions, async () => {
      await db.transactions.clear();
      await db.transactions.bulkAdd(transactionsToStore);
    });
  }, [value]);

  return { value: value || [], setValue };
}

// Hook for active unit
export function useActiveUnitStorage() {
  return useSettingStorage<string>('ACTIVE_UNIT', '');
}

// Hook for signer type
export function useSignerTypeStorage() {
  return useSettingStorage<string>('SIGNER_TYPE', '');
}

// Hook for private key signer
export function usePrivKeySignerStorage() {
  return useSettingStorage<string>('PRIVATEKEY_SIGNER', '');
}

// Hook for wallet ID
export function useWalletIdStorage() {
  return useSettingStorage<string>('WALLET_ID', '');
} 