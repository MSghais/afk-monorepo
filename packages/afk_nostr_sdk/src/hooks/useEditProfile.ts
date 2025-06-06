import { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { useNostrContext } from '../context/NostrContext';
import { useAuth } from '../store/auth';

export const useEditProfile = (): UseMutationResult<any, Error, NDKUserProfile, any> => {
  const { ndk } = useNostrContext();
  const { publicKey } = useAuth();

  return useMutation({
    mutationKey: ['editProfile', ndk],
    mutationFn: async (data: NDKUserProfile, tags?: string[]) => {
      try {
        const user = ndk.getUser({ pubkey: publicKey });
        await user.fetchProfile();
        // console.log('user.profile', user.profile);

        if (!user.profile) {
          // throw new Error('Profile not found');
        }

        user.profile = { ...user.profile, ...data };

        return user.publish();
      } catch (error) {
        console.error('Error editing profile', error);
        throw error;
      }
    },
  });
};
