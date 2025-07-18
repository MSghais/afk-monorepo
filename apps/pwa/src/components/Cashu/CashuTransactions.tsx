import React, { useState, useEffect } from 'react';
import { Icon } from '../small/icon-component';
import { Transaction } from '@/utils/storage';
import { useUIStore } from '@/store/uiStore';
import QRCode from 'react-qr-code';
import { useCashuStorage } from '@/hooks/useCashuStorage';
import { getWalletData, saveWalletData } from '@/utils/storage';
import { v4 as uuidv4 } from 'uuid';
import styles from '@/styles/components/_cashu-wallet.module.scss'; 

interface CashuTransactionsProps {
  transactions: Transaction[];
  onCheckPayment?: (transaction: Transaction) => void;
  onTransactionClick?: (transaction: Transaction) => void;
  ecash?: { token: string; amount: number; mintUrl: string; created: string }[];
}

type TabType = 'all' | 'in' | 'out' | 'mintQuote' | 'ecash';

export const CashuTransactions: React.FC<CashuTransactionsProps> = ({
  transactions,
  onCheckPayment,
  onTransactionClick,
  ecash,
}) => {
  const { showToast } = useUIStore();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [qrCodeTransaction, setQrCodeTransaction] = useState<Transaction | null>(null);
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] = useState<boolean>(false);
  const [checkingTransactionId, setCheckingTransactionId] = useState<string | null>(null);
  
  // Get a human-readable status label
  const getStatusLabel = (status?: string) => {
    if (!status) return null;
    
    switch (status) {
      case 'pending':
        return <span className={styles['cashu-wallet__status-badge'] + ' ' + styles['cashu-wallet__status-badge--pending']}>Pending</span>;
      case 'paid':
        return <span className={styles['cashu-wallet__status-badge'] + ' ' + styles['cashu-wallet__status-badge--success']}>Paid</span>;
      case 'failed':
        return <span className={styles['cashu-wallet__status-badge'] + ' ' + styles['cashu-wallet__status-badge--error']}>Failed</span>;
      default:
        return null;
    }
  };
  
  // Filter transactions based on active tab
  const getFilteredTransactions = () => {
    switch (activeTab) {
      case 'in':
        return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).filter(tx => tx.type === 'received');
      case 'out':
        return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).filter(tx => tx.type === 'sent');
      case 'mintQuote':
        return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).filter(tx => 
          tx.invoiceType === 'lightning' || 
          (tx.type === 'received' && tx.token)
        );
      case 'ecash':
        return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).filter(tx => 
          tx.token && !tx.invoiceType // Only ecash tokens, not lightning invoices
        );
      case 'all':
      default:
        return transactions;
    }
  };
  
  // Determine if this transaction should show a check button
  const shouldShowCheckButton = (transaction: Transaction) => {
    // For lightning invoices
    if (transaction.type === 'received' && 
        transaction.invoiceType === 'lightning' && 
        transaction.status !== 'paid' && 
        transaction.paymentHash) {
      return true;
    }
    
    // For other types of quotes (tokens, etc.)
    if (transaction.type === 'received' && 
        transaction.status !== 'paid' && 
        (transaction.token || transaction.invoiceType)) {
      return true;
    }
    
    return false;
  };
  
  // Check if transaction is a receivable type (Lightning or Ecash)
  const isReceivableTransaction = (transaction: Transaction) => {
    return transaction.type === 'received' && 
           (transaction.invoiceType === 'lightning' || transaction.token) &&
           transaction.status !== 'paid';
  };
  
  // Get appropriate button text based on transaction type
  const getCheckButtonText = (transaction: Transaction) => {
    if (transaction.invoiceType === 'lightning') {
      return 'Check Payment';
    }
    return 'Check Quote';
  };
  
  // Get content to copy based on transaction type
  const getContentToCopy = (transaction: Transaction) => {
    if (transaction.invoiceType === 'lightning') {
      return transaction.invoice || '';
    } else if (transaction.token) {
      return transaction.token;
    }
    return '';
  };

  // Get transaction type label
  const getTransactionTypeLabel = (transaction: Transaction) => {
    if (transaction.invoiceType === 'lightning') {
      return 'Lightning Invoice';
    } else if (transaction.token) {
      return 'Ecash Token';
    }
    return transaction.type === 'received' ? 'Received' : 'Sent';
  };

  // Handle copying content to clipboard
  const handleCopy = async (transaction: Transaction, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the onTransactionClick
    
    const content = getContentToCopy(transaction);
    
    if (!content) {
      showToast({
        message: 'Nothing to copy',
        type: 'error',
        description: 'No invoice or token data available'
      });
      return;
    }
    
    try {
      await navigator.clipboard.writeText(content);
      showToast({
        message: 'Copied to clipboard',
        type: 'success'
      });
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      showToast({
        message: 'Copy failed',
        type: 'error',
        description: 'Could not copy to clipboard'
      });
    }
  };

  // Toggle QR code display
  const toggleQRCode = (transaction: Transaction, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the onTransactionClick
    
    if (qrCodeTransaction && qrCodeTransaction.id === transaction.id) {
      setQrCodeTransaction(null); // Close if the same transaction
    } else {
      setQrCodeTransaction(transaction); // Open for this transaction
    }
  };

  // Check if transaction has copyable content
  const hasCopyableContent = (transaction: Transaction) => {
    return transaction.invoice || transaction.token;
  };

  // Function to download QR code as image
  const handleDownloadQR = (transaction: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const qrCodeElement = document.getElementById(`qr-code-${transaction.id}`);
    if (!qrCodeElement) {
      showToast({
        message: 'Could not download QR code',
        type: 'error',
        description: 'QR code element not found'
      });
      return;
    }
    
    try {
      // Create a canvas element
      const canvas = document.createElement('canvas');
      const svgData = new XMLSerializer().serializeToString(qrCodeElement.querySelector('svg')!);
      
      // Create an image from SVG
      const img = new Image();
      img.onload = () => {
        // Set canvas dimensions
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw white background and image
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        // Create download link
        const link = document.createElement('a');
        link.download = `qr-code-${transaction.amount}-${transaction.unit || 'sats'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        showToast({
          message: 'QR code downloaded',
          type: 'success'
        });
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    } catch (err) {
      console.error('Error downloading QR code:', err);
      showToast({
        message: 'Download failed',
        type: 'error',
        description: 'Could not download QR code image'
      });
    }
  };
  
  const filteredTransactions = getFilteredTransactions();
  
  // Add debug storage handler
  const { addToken } = useCashuStorage();
  
  const handleDebugStorage = async () => {
    console.log('Debug: Checking IndexDB storage...');
    
    try {
      // Get current wallet data
      const data = await getWalletData();
      console.log('Current wallet data:', data);
      console.log('Tokens count:', data.tokens?.length || 0);
      console.log('Transactions count:', data.transactions?.length || 0);
      
      // Check if we have tokens
      if (!data.tokens || data.tokens.length === 0) {
        console.log('No tokens found, creating a test token...');
        
        // Create a test token
        const testToken = {
          id: uuidv4(),
          token: 'cashu_test_token_' + Date.now(),
          amount: 100,
          mintUrl: data.activeMint || 'https://mint.test.com',
          spendable: true,
          created: new Date().toISOString(),
        };
        
        // Add token to data
        const updatedData = {
          ...data,
          tokens: [...(data.tokens || []), testToken],
        };
        
        // Save updated data
        await saveWalletData(updatedData);
        console.log('Test token saved to IndexDB');
        console.log('Updated tokens count:', updatedData.tokens.length);
        
        // Also update through the hook
        addToken(testToken.token, testToken.amount, testToken.mintUrl);
        console.log('Test token also added through hook');
      }
      
      // Refresh data to confirm
      const refreshedData = await getWalletData();
      console.log('Refreshed wallet data:', refreshedData);
      console.log('Tokens count after refresh:', refreshedData.tokens?.length || 0);
      
      alert(`IndexDB Status:
      - Tokens: ${refreshedData.tokens?.length || 0}
      - Transactions: ${refreshedData.transactions?.length || 0}
      - Active Mint: ${refreshedData.activeMint || 'None'}
      
      Check console for details`);
    } catch (err) {
      console.error('Debug: Error accessing IndexDB:', err);
      alert('Error checking IndexDB: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className={styles['cashu-wallet__transactions']}>
      <div className={styles['cashu-wallet__transactions-header']}>
        <h3 className={styles['cashu-wallet__transactions-header-title']}>Recent Transactions</h3>
        <a href="#" className={styles['cashu-wallet__transactions-header-view-all']}>View All</a>
      </div>
      
      <div className={styles['cashu-wallet__tabs']}>
        <button 
          className={styles['cashu-wallet__tabs-item'] + ' ' + (activeTab === 'all' ? styles['cashu-wallet__tab--active'] : '')}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
        <button 
          className={styles['cashu-wallet__tabs-item'] + ' ' + (activeTab === 'in' ? styles['cashu-wallet__tab--active'] : '')}
          onClick={() => setActiveTab('in')}
        >
          Received
        </button>
        <button 
          className={styles['cashu-wallet__tabs-item'] + ' ' + (activeTab === 'out' ? styles['cashu-wallet__tab--active'] : '')}
          onClick={() => setActiveTab('out')}
        >
          Sent
        </button>
        <button 
          className={styles['cashu-wallet__tabs-item'] + ' ' + (activeTab === 'mintQuote' ? styles['cashu-wallet__tab--active'] : '')}
          onClick={() => setActiveTab('mintQuote')}
        >
          Lightning
        </button>
        <button 
          className={styles['cashu-wallet__tabs-item'] + ' ' + (activeTab === 'ecash' ? styles['cashu-wallet__tab--active'] : '')}
          onClick={() => setActiveTab('ecash')}
        >
          Ecash
        </button>
      </div>
      
      <div className={styles['cashu-wallet__transactions-list']}>
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map((transaction) => (
            <React.Fragment key={transaction.id}>
              <div 
                className={styles['cashu-wallet__transactions-list-item']}
                onClick={() => onTransactionClick && onTransactionClick(transaction)}
              >
                <div className={styles['cashu-wallet__transactions-list-item-icon']}>
                  <Icon 
                    name={
                      transaction.invoiceType === 'lightning' 
                        ? 'LightningIcon' 
                        : transaction.type === 'sent' 
                          ? 'SendIcon' 
                          : 'ReceiveIcon'
                    } 
                    size={16} 
                  />
                </div>
                <div className={styles['cashu-wallet__transactions-list-item-details']}>
                  <div className={styles['cashu-wallet__transactions-list-item-details-title']}>
                    {getTransactionTypeLabel(transaction)}
                  </div>
                  <div className={styles['cashu-wallet__transactions-list-item-details-date']}>
                    {transaction.date}
                  </div>
                  {transaction.memo && (
                    <div className={styles['cashu-wallet__transactions-list-item-details-memo']}>
                      {transaction.memo}
                    </div>
                  )}
                  {getStatusLabel(transaction.status)}
                </div>
                <div className={styles['cashu-wallet__transactions-list-item-actions']}>
                  <div className={styles['cashu-wallet__transactions-list-item-amount'] + ' ' + styles[`cashu-wallet__transactions-list-item-amount--${transaction.type}`]}>
                    {transaction.type === 'sent' ? '-' : '+'}{transaction.amount}
                  </div>
                  
                  {/* Quick action buttons */}
                  <div className={styles['cashu-wallet__transactions-list-item-quick-actions']}>
                    {hasCopyableContent(transaction) && (
                      <button 
                        className={styles['cashu-wallet__transactions-list-item-icon-btn']}
                        onClick={(e) => handleCopy(transaction, e)}
                        title="Copy Invoice/Token"
                      >
                        <Icon name="CopyIcon" size={16} />
                      </button>
                    )}
                    
                    {hasCopyableContent(transaction) && (
                      <button 
                        className={styles['cashu-wallet__transactions-list-item-icon-btn']}
                        onClick={(e) => toggleQRCode(transaction, e)}
                        title="Show QR Code"
                      >
                        <Icon name="ScanIcon" size={16} />
                      </button>
                    )}
                  </div>
                  
                  {/* Receive button for receivable transactions */}
                  {isReceivableTransaction(transaction) && (
                    <button 
                      className={styles['cashu-wallet__transactions-list-item-receive-btn']}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleQRCode(transaction, e);
                      }}
                    >
                      <Icon name="ReceiveIcon" size={14} style={{marginRight: '4px'}} />
                      Receive
                    </button>
                  )}
                  
                  {/* Check payment button */}
                  {shouldShowCheckButton(transaction) && onCheckPayment && (
                    <button 
                      className={styles['cashu-wallet__transactions-list-item-check-btn']}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering the onTransactionClick
                        setCheckingTransactionId(transaction.id);
                        setCheckingPayment(true);
                        onCheckPayment(transaction);
                      }}
                      disabled={checkingPayment && checkingTransactionId === transaction.id}
                    >
                      {checkingPayment && checkingTransactionId === transaction.id ? (
                        'Checking...'
                      ) : (
                        getCheckButtonText(transaction)
                      )}
                    </button>
                  )}
                </div>
              </div>
              
              {/* QR Code Display */}
              {qrCodeTransaction && qrCodeTransaction.id === transaction.id && (
                <div className={styles['cashu-wallet__transactions-list-item-qr-container']}>
                  <div className={styles['cashu-wallet__transactions-list-item-qr-content']}>
                    <div className={styles['cashu-wallet__transactions-list-item-qr-header']}>
                      <div className={styles['cashu-wallet__transactions-list-item-qr-title']}>
                        <span className={styles['cashu-wallet__transactions-list-item-qr-icon']}>
                          {transaction.invoiceType === 'lightning' ? '⚡' : '💸'}
                        </span>
                        <span>
                          {transaction.invoiceType === 'lightning' ? 'Lightning Invoice' : 'Ecash Token'}
                        </span>
                      </div>
                      <button 
                        className={styles['cashu-wallet__transactions-list-item-qr-close']}
                        onClick={(e) => toggleQRCode(transaction, e)}
                      >
                        <Icon name="CloseIcon" size={16} />
                      </button>
                    </div>
                    
                    {/* Simplified QR Code approach */}
                    <div className={styles['cashu-wallet__transactions-list-item-qr-simple']}>
                      <div className={styles['cashu-wallet__transactions-list-item-qr-code-wrapper']} id={`qr-code-${transaction.id}`}>
                        <QRCode
                          value={getContentToCopy(transaction) || 'No data available'}
                          size={250}
                          bgColor="#FFFFFF"
                          fgColor="#000000" 
                          level="L"
                        />
                      </div>
                      
                      <div className={styles['cashu-wallet__transactions-list-item-qr-amount']}>
                        {transaction.amount} {transaction.unit || 'sats'}
                      </div>
                    </div>
                    
                    <div className={styles['cashu-wallet__transactions-list-item-qr-actions']}>
                      <div className={styles['cashu-wallet__transactions-list-item-qr-buttons']}>
                        <button 
                          className={styles['cashu-wallet__button'] + ' ' + styles['cashu-wallet__button--primary']}
                          onClick={(e) => handleCopy(transaction, e)}
                        >
                          <Icon name="CopyIcon" size={16} style={{marginRight: '4px'}} />
                          Copy
                        </button>
                        
                        <button 
                          className={styles['cashu-wallet__button'] + ' ' + styles['cashu-wallet__button--secondary']}
                          onClick={(e) => handleDownloadQR(transaction, e)}
                        >
                          <Icon name="SettingsIcon" size={16} style={{marginRight: '4px'}} />
                          Save QR
                        </button>
                      </div>
                      
                      {isReceivableTransaction(transaction) && (
                        <div className={styles['cashu-wallet__transactions-list-item-qr-instruction']}>
                          Scan this QR code or share the copied code to receive payment
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))
        ) : (
          <div className="cashu-wallet__transactions-empty">
            {activeTab === 'all' 
              ? 'No transactions yet' 
              : activeTab === 'mintQuote' 
                ? 'No pending quotes'
                : `No ${activeTab === 'in' ? 'incoming' : 'outgoing'} transactions`}
          </div>
        )}
      </div>
      
      {/* Add debug section at the bottom */}
      {/* <div className="cashu-wallet__debug-section" style={{ padding: '10px', marginTop: '10px', border: '1px dashed #666', borderRadius: '4px' }}>
        <h4>Debug Tools</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <button
            className="cashu-wallet__button cashu-wallet__button--secondary"
            onClick={handleDebugStorage}
            style={{ fontSize: '12px' }}
          >
            Check IndexDB Storage
          </button>
          
          <button
            className="cashu-wallet__button cashu-wallet__button--secondary"
            onClick={async () => {
              try {
                // Get current wallet data
                const data = await getWalletData();
                console.log("Current wallet data:", data);
                
                // Update balance to match token total
                const totalFromTokens = data.tokens.reduce((sum, token) => sum + token.amount, 0);
                const totalFromTransactions = data.transactions
                  .filter(tx => tx.status === 'paid' || (tx.type === 'received' && !tx.invoiceType))
                  .reduce((sum, tx) => {
                    if (tx.type === 'received') return sum + tx.amount;
                    if (tx.type === 'sent') return sum - tx.amount;
                    return sum;
                  }, 0);
                
                console.log(`Balance info:
                  Current balance: ${data.balance}
                  Total from tokens: ${totalFromTokens}
                  Total from transactions: ${totalFromTransactions}
                `);
                
                if (data.balance !== totalFromTransactions) {
                  console.log(`Balance mismatch between state (${data.balance}) and transactions (${totalFromTransactions})`);
                  
                  // Update balance
                  const updatedData = {
                    ...data,
                    balance: totalFromTransactions
                  };
                  
                  // Save directly
                  await saveWalletData(updatedData);
                  console.log("Balance synchronized with transactions");
                  
                  alert(`Balance fixed! Previous: ${data.balance}, New: ${totalFromTransactions}`);
                } else {
                  alert(`Balance (${data.balance}) already matches transaction history total (${totalFromTransactions}).
                  
Note: The current Cashu SDK implementation uses a balance-based approach rather than token-based.`);
                }
              } catch (err) {
                console.error("Error fixing balance:", err);
                alert("Error: " + (err instanceof Error ? err.message : String(err)));
              }
            }}
            style={{ fontSize: '12px' }}
          >
            Verify & Fix Balance
          </button>
          
          <div style={{ fontSize: '10px', marginTop: '4px', color: '#888', padding: '4px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            Note: The current SDK implementation uses a balance-based approach. Lightning payments update your balance directly rather than creating tokens.
          </div>
        </div>
      </div> */}
    </div>
  );
};

export function DebugStorage({ onCheckStorage }: { onCheckStorage: () => void }) {
  return (
    <div className="cashu-wallet__debug-section" style={{ padding: '10px', marginTop: '10px', border: '1px dashed #666', borderRadius: '4px' }}>
      <h4>Debug Tools</h4>
      <button
        className="cashu-wallet__button cashu-wallet__button--secondary"
        onClick={onCheckStorage}
        style={{ marginTop: '8px', fontSize: '12px' }}
      >
        Check IndexDB Storage
      </button>
    </div>
  );
} 