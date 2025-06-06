import {NDKEvent, NDKKind} from '@nostr-dev-kit/ndk';
import {useMutation} from '@tanstack/react-query';

import {useNostrContext} from '../context/NostrContext';

/**
 * Send an article to Nostr 
 * https://github.com/nostr-protocol/nips/blob/master/23.md
 * @returns 
 */
export const useSendArticle = () => {
  const {ndk} = useNostrContext();

  return useMutation({
    mutationKey: ['sendArticle', ndk],
    mutationFn: async (data: {content: string; tags?: string[][]}) => {
      const event = new NDKEvent(ndk);
      event.kind = NDKKind.Article;
      event.content = data.content;
      event.tags = data.tags ?? [];

      return event.publish();
    },
  });
};
