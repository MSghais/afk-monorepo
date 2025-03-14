import {Spacing, ThemedStyleSheet} from '../../styles';

export default ThemedStyleSheet((theme) => ({
  container: {
    flex: 1,
  },
  containerLoading: {
    flex: 1,
    height: '100%',
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },

  post: {
    paddingVertical: Spacing.small,
    paddingHorizontal: Spacing.pagePadding,
  },
  comment: {
    paddingVertical: Spacing.large,
    paddingHorizontal: Spacing.pagePadding,
  },

  commentInputContainer: {
    backgroundColor: theme.colors.surface,
  },
  commentInputContent: {
    gap: Spacing.small,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xsmall,
    paddingHorizontal: Spacing.pagePadding,
    backgroundColor: theme.colors.surface,
  },
  commentInput: {
    flex: 1,
    width: 'auto',
  },
}));
