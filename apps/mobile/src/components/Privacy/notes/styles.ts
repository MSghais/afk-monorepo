import { Spacing, ThemedStyleSheet } from '../../../styles';

export default ThemedStyleSheet((theme) => ({
  container: {
    flex: 1,
    padding: Spacing.medium,
  },
  buyContainer: {
    backgroundColor: theme.colors.surface,
    padding: Spacing.large,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  notesContainer: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: Spacing.large,
    paddingVertical: Spacing.small,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.medium,
    color: theme.colors.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.small,
  },
  inputContainer: {
    marginBottom: Spacing.xxxlarge,
  },
  label: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: Spacing.small,
  },
  amountInput: {
    position: 'relative',
  },
  input: {
    height: 60,
    fontSize: 20,
    paddingHorizontal: Spacing.medium,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    color: theme.colors.text,
  },
  ethAmount: {
    position: 'absolute',
    right: Spacing.small,
    top: '50%',
    transform: [{ translateY: -10 }],
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.medium,
  },
  backButton: {
    padding: Spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  buyButton: {
    flex: 1,
    padding: Spacing.medium,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  notesList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBorder,
  },
  noteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.large,
    paddingRight: Spacing.small,
  },
  noteText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  noteValue: {
    color: theme.colors.text,
    fontSize: 14,
  },
  spentNote: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: Spacing.large,
    paddingRight: Spacing.small,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
})); 