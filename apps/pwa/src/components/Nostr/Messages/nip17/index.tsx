'use client';

import React, { useEffect, useState } from 'react';
import { useAuth, useContacts, useGetAllMessages, useIncomingMessageUsers, useMyGiftWrapMessages, useMyMessagesSent, useNostrContext, useRoomMessages } from 'afk_nostr_sdk';
import { useNostrAuth } from '@/hooks/useNostrAuth';
import { FormPrivateMessage } from './FormPrivateMessage';
import NDK, { NDKKind, NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk';
import { NostrConversationList } from './ConversationList';
import { NostrContactList } from '../NostrContactList';
export const NostrMessagesComponent: React.FC = () => {
  const [type, setType] = useState<"NIP4" | "NIP17">('NIP4');
  const { publicKey, privateKey } = useAuth();
  const { handleCheckNostrAndSendConnectDialog } = useNostrAuth();
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('messages');
  const [isProcessingMessages, setIsProcessingMessages] = useState(false);
  const [messagesData, setMessages] = useState<any>([]);
  const [isBack, setIsBack] = useState(false);
  const [showNewMessageForm, setShowNewMessageForm] = useState(false);

  const contacts = useContacts();

  const { ndk } = useNostrContext();
  const [ndkSigner, setNdkSigner] = useState<NDKPrivateKeySigner | null>(null);
  const [ndkUser, setNdkUser] = useState<NDKUser | null>(null);

  const handleGoBack = () => {
    setSelectedConversation(null);
  };

  const handleConnect = async () => {
    const connected = await handleCheckNostrAndSendConnectDialog();
    if (connected) {
      // refetch();
    }
  };


  const handleNewMessageSent = () => {
    setShowNewMessageForm(false);
    // refetch();
  };

  if (!publicKey) {
    return (
      <div className="flex flex-col items-center justify-center p-4 space-y-4">
        <h2 className="text-xl font-semibold">Connect your Nostr account</h2>
        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Connect
        </button>
      </div>
    );
  }


  // if (isLoadingAllMessages) {
  //   return <div>Loading...</div>;
  // }
  //   useEffect(() => {
  //   if (publicKey) {

  //     ndk.fetchEvents({
  //       kinds: [NDKKind.PrivateDirectMessage],
  //       authors: [publicKey],
  //     }).then((events) => {
  //       console.log(events);
  //     });

  //     ndk.fetchEvents({
  //       kinds: [NDKKind.PrivateDirectMessage],
  //       '#p': [publicKey],
  //     }).then((events) => {
  //       console.log(events);
  //     });

  //   }
  // }, [publicKey, privateKey]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b overflow-x-auto scrollbar-hide">
        <button
          className={`flex-1 py-2 px-4 ${activeTab === 'messages' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          Messages
        </button>
        <button
          className={`flex-1 py-2 px-4 ${activeTab === 'contacts' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          Contacts
        </button>
        <button
          className={`flex-1 py-2 px-4 ${activeTab === 'followers' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('followers')}
        >
          Followers
        </button>
        <button
          className={`flex-1 py-2 px-4 ${activeTab === 'direct_messages' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('direct_messages')}
        >
          Direct Messages
        </button>
      </div>

      {activeTab == "messages" && (

        <>
          <NostrConversationList type={type} setType={setType} />
        </>
      )}

      {activeTab == "contacts" && (
        <NostrContactList />
      )}

      {activeTab == "direct_messages" && (
        <div className="flex">
          <FormPrivateMessage onClose={() => setActiveTab('messages')} type={type} />
        </div>
      )}

    </div>
  );
};

export default NostrMessagesComponent;
