'use client';

import React, { useState } from 'react';
import NostrFeed from './NostrFeed';
import { NDKKind } from '@nostr-dev-kit/ndk';
import NostrShortFeed from './NostrShortFeed';
import { Modal } from '@/components/Modal/Modal';
import { useAuth, useContacts } from 'afk_nostr_sdk';
import NostrTagsFeed from './NostrTagsFeed';
import { TAGS_DEFAULT } from 'common';
import { NostrFilter, Tab } from './NostrFilter';
import { logClickedEvent } from '@/lib/analytics';
import styles from '@/styles/nostr/feed.module.scss';

interface FeedTabsProps {
  className?: string;
  limit?: number;
  authors?: string[];
  searchQuery?: string;
  sinceProps?: number;
  untilProps?: number;
  tagsProps?: string[];
  selectedTagProps?: string;
  selectedTagsProps?: string[];
  setSelectedTagProps?: (tag: string) => void;
}

export const FeedTabs: React.FC<FeedTabsProps> = ({
  className = '',
  limit = 5,
  authors,
  searchQuery,
  sinceProps,
  untilProps,
  tagsProps,
  selectedTagProps,
  selectedTagsProps,
  setSelectedTagProps
}) => {
  const tabs: Tab[] = [
    // {
    //   id: 'all',
    //   label: 'All',
    //   kinds: [
    //     NDKKind.Text,
    //     NDKKind.Repost,
    //     NDKKind.GenericRepost,
    //     NDKKind.Article,
    //     NDKKind.ShortVideo,
    //     NDKKind.VerticalVideo,
    //     NDKKind.HorizontalVideo,
    //   ],
    //   icon: (
    //     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    //       <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    //     </svg>
    //   )
    // },
  

    {
      id: 'posts',
      label: 'Posts',
      kinds: [
        NDKKind.Text,
        NDKKind.Repost,
        // NDKKind.GenericRepost,
      ], // Text
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      id: 'tags',
      label: 'Tags',
      kinds: [
        NDKKind.Text,
        // NDKKind.Repost,
        // NDKKind.GenericRepost,
        NDKKind.Article,
        // NDKKind.ShortVideo,
        // NDKKind.VerticalVideo,
        // NDKKind.HorizontalVideo,
      ],
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      id: 'articles',
      label: 'Articles',
      kinds: [30023], // Article
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
          <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
        </svg>
      ),
    },

    {
      id: 'shorts',
      label: 'Shorts',
      kinds: [
        // 1311, // ShortForm
        31000, // VerticalVideo
        31001, // HorizontalVideo
        34236,
        NDKKind.ShortVideo,
        // NDKKind.Image,
        NDKKind.VerticalVideo,
        NDKKind.HorizontalVideo,
        NDKKind.Video,

      ],
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
        </svg>
      ),
    },
  ];

  const [activeTab, setActiveTab] = useState<string>(tabs[0].id);

  const getActiveTabKinds = (): number[] => {
    const tab = tabs.find(tab => tab.id === activeTab);
    return tab ? tab.kinds : tabs[0].kinds;
  };

  const { publicKey } = useAuth()


  const [kinds, setKinds] = useState<number[]>(tabs[0].kinds);

  const [openFilters, setOpenFilters] = useState(false);
  const [since, setSince] = useState<number>(sinceProps || Math.round(Date.now() / 1000) - 60 * 60 * 3);
  const [until, setUntil] = useState<number>(untilProps || Math.round(Date.now() / 1000));

  const [isForYou, setIsForYou] = useState(false);

  const [tags, setTags] = useState<string[]>(TAGS_DEFAULT);

  const [selectedTag, setSelectedTag] = useState<string | null>(tagsProps?.[0] || null);
  const [selectedTags, setSelectedTags] = useState<string[]>(tagsProps || TAGS_DEFAULT);

  // const contacts = useContacts({authors: [publicKey || '']})

  return (
    <div className={`${styles['nostr-feed__container']} ${className}`}>
      <div className={styles['nostr-feed__tabs'] + ' px-4'}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={
              styles['nostr-feed__tabs-button'] +
              ' flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium transition-all duration-150 ' +
              (activeTab === tab.id ? styles['nostr-feed__tabs-button--active'] + ' border border-green-500' : 'hover:border-gray-100 dark:hover:border-gray-800')
            }
            onClick={() => {
              setActiveTab(tab.id)
              logClickedEvent("feed_nostr_tab", "click_nostr_tab", tab.id)
            }}
          >
            <span className="inline-flex items-center justify-center h-4 w-4">
              {tab?.icon}
            </span>
            <span className="text-sm">
              {tab.label}
            </span>
          </button>
        ))}
        {/* 
        <NostrFilter
          limit={limit}
          authors={authors}
          searchQuery={searchQuery}
          sinceProps={since}
          setSinceProps={setSince}
          setUntilProps={setUntil}
          untilProps={until}
          tagsProps={tagsProps}
          selectedTagProps={selectedTagProps}
          setActiveTabProps={setActiveTab}
          activeTabProps={tabs.find(tab => tab.id === activeTab)}
          isForYouProps={isForYou}
          setIsForYouProps={setIsForYou}
          ></NostrFilter> */}
        {/* <button
          className="px-3 py-1 text-xs bg-blue-500 rounded hover:bg-blue-600 transition"
          onClick={() => setOpenFilters(!openFilters)}
        >
          Filters
        </button>

        {openFilters && (
          <Modal isOpen={openFilters} onClose={() => setOpenFilters(false)}>
            <div className="nostr-feed__filters mb-4 p-3 rounded-lg">
              <div className="flex flex-wrap gap-2 justify-between items-center">
                <h3 className="text-sm font-medium">Feed Filters</h3>
                <button
                  className="px-3 py-1 text-xs bg-blue-500 rounded hover:bg-blue-600 transition"
                >
                  Refresh
                </button>
              </div>

              <div>
                <button
                  onClick={() => {
                    setActiveTab('tags');
                  }}
                  className="px-3 py-1 text-xs bg-blue-500 rounded hover:bg-blue-600 transition"
                >
                  For you
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs mb-1">Date Range</label>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={until ? new Date(until * 1000).toISOString().slice(0, 16) : ''}
                      className="flex-1 px-2 py-1 text-xs rounded border dark:bg-gray-700 dark:border-gray-600"
                      onChange={(e) => {
                        const timestamp = Math.floor(new Date(e.target.value).getTime() / 1000);
                        if (!isNaN(timestamp)) {
                          // Set since timestamp
                        }
                      }}
                    />
                    <span className="self-center text-xs">to</span>
                    <input
                      value={since ? new Date(since * 1000).toISOString().slice(0, 16) : ''}
                      type="datetime-local"
                      className="flex-1 px-2 py-1 text-xs rounded border dark:bg-gray-700 dark:border-gray-600"
                      onChange={(e) => {
                        const timestamp = Math.floor(new Date(e.target.value).getTime() / 1000);
                        if (!isNaN(timestamp)) {
                          setUntil(timestamp);
                        }
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs mb-1">Search Tags</label>
                  <input
                    type="text"
                    placeholder="Enter tags (comma separated)"
                    className="w-full px-2 py-1 text-xs rounded border dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-xs mb-1">Author Pubkeys</label>
                  <input
                    type="text"
                    placeholder="Enter pubkeys (comma separated)"
                    className="w-full px-2 py-1 text-xs rounded border dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-xs mb-1">Event Kinds</label>
                  <select
                    className="w-full px-2 py-1 text-xs rounded border dark:bg-gray-700 dark:border-gray-600"
                    multiple={false}
                    onChange={(e) => {
                      // Update kinds filter
                    }}
                  >
                    <option value="1">Text Notes (1)</option>
                    <option value="30023">Long-form Content (30023)</option>
                    <option value="6">Reposts (6)</option>
                    <option value="7">Reactions (7)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end mt-3">
                <button
                  className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition"
                  onClick={() => {

                  }}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </Modal>

        )} */}
      </div>

      <div className={styles['nostr-feed__content']}>

        {activeTab != 'shorts' && activeTab != 'tags' && (
          <NostrFeed
            kinds={getActiveTabKinds()}
            limit={limit}
            authors={authors}
            searchQuery={searchQuery}
            activeTabProps={activeTab}
          />
        )}

        {activeTab === 'tags' && (
          <NostrTagsFeed
            kinds={getActiveTabKinds()}
            limit={limit}
            authors={authors}
            searchQuery={searchQuery}
            tagsProps={tags}
            selectedTagProps={selectedTagProps}
            setSelectedTagProps={setSelectedTagProps}
            selectedTagsProps={selectedTagsProps}
            sinceProps={since}
            setUntilProps={setUntil}
            setSinceProps={setSince}
          />
        )}

        {activeTab === 'shorts' && (
          <NostrShortFeed
            kinds={getActiveTabKinds()}
            limit={limit}
            authors={authors}
            searchQuery={searchQuery}
          />
        )}
      </div>
    </div>
  );
};

export default FeedTabs; 