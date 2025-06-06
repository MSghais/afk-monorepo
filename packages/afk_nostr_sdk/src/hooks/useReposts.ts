import {NDKKind} from '@nostr-dev-kit/ndk';
import {InfiniteData, useInfiniteQuery, UseInfiniteQueryResult} from '@tanstack/react-query';

import {useNostrContext} from '../context/NostrContext';

export type UseRepostsOptions = {
  authors?: string[];
  search?: string;
};

export const useReposts = (options?: UseRepostsOptions):UseInfiniteQueryResult<InfiniteData<any, any>, Error>=> {
  const {ndk} = useNostrContext();

  return useInfiniteQuery({
    initialPageParam: 0,
    queryKey: ['reposts', options?.authors, options?.search, ndk],
    getNextPageParam: (lastPage: any, allPages, lastPageParam) => {
      if (!lastPage?.length) return undefined;

      const pageParam = lastPage[lastPage.length - 1].created_at - 1;

      if (!pageParam || pageParam === lastPageParam) return undefined;
      return pageParam;
    },
    queryFn: async ({pageParam}) => {
      const reposts = await ndk.fetchEvents({
        kinds: [NDKKind.Repost],
        authors: options?.authors,
        search: options?.search,
        until: pageParam || Math.round(Date.now() / 1000),
        limit: 20,
      });

      return [...reposts];
    },
    placeholderData: {pages: [], pageParams: []},
  });
};
