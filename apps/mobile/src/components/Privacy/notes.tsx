import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useState, useMemo, useCallback } from "react";
import { useUserNotes } from "../../hooks/privacy/use-user-notes";
import { useDeposit } from "../../hooks/privacy/use-deposit";
import { formatTokenAmount } from "../../lib/utils";
import { useTheme } from "../../hooks/useTheme";
import { useStyles } from "../../hooks/useStyles";
import styles from './notes/styles';
import { useToast } from "src/hooks/modals";
interface Note {
  commitment: bigint;
  index: bigint;
  value?: bigint;
  spent?: boolean;
}

export const Notes: React.FC<{ show: boolean }> = ({ show }) => {
  const { notes } = useUserNotes();
  console.log("notes", notes);
  const [showBuy, setShowBuy] = useState(false);
  const [amount, setAmount] = useState("");
  const { sendDeposit, loading: depositLoading, sendDepositMulticall } = useDeposit();
  const { theme } = useTheme();
  const themedStyles = useStyles(styles);
  const { showToast } = useToast();

  const sortedNotes = useMemo(
    () => notes.sort((a: Note, b: Note) => parseInt((b.index - a.index).toString())),
    [notes]
  );

  const onDeposit = useCallback(async () => {
    try {
      const amountBn = BigInt((parseFloat(amount) * 10 ** 18).toFixed(0));
      const txHash = await sendDepositMulticall({
        amount: amountBn,
      });
      // TODO: Add toast notification

      showToast({
        title: "Deposit successful",
        description: txHash,
        type: "success",
      });
    } catch (e) {
      // TODO: Add error toast notification
      showToast({
        title: "Deposit failed",
        description: (e as Error).message,
        type: "error",
      });
    }
  }, [amount]);

  return (
    <View style={themedStyles.container}>
      {showBuy ? (
        <View style={themedStyles.buyContainer}>
          <Text style={themedStyles.title}>Buy</Text>

          <View style={themedStyles.inputContainer}>
            <Text style={themedStyles.label}>Amount</Text>
            <View style={themedStyles.amountInput}>
              <TextInput
                style={themedStyles.input}
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
              <Text style={themedStyles.ethAmount}>
                ~ {formatTokenAmount(0n, 18n, 8)} ETH
              </Text>
            </View>
          </View>

          <View style={themedStyles.buttonContainer}>
            <Pressable
              style={themedStyles.backButton}
              onPress={() => setShowBuy(false)}
            >
              <Text style={themedStyles.buttonText}>Back</Text>
            </Pressable>

            <Pressable
              style={themedStyles.buyButton}
              onPress={onDeposit}
              disabled={depositLoading}
            >
              <Text style={themedStyles.buttonText}>
                {depositLoading ? "Buying..." : "Buy"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={themedStyles.notesContainer}>
          <View style={themedStyles.header}>
            <Text style={themedStyles.title}>Notes</Text>
            <Pressable
              style={themedStyles.buyButton}
              onPress={() => setShowBuy(true)}
            >
              <Text style={themedStyles.buttonText}>Buy</Text>
            </Pressable>
          </View>

          {show && (
            <ScrollView style={themedStyles.notesList}>
              {sortedNotes.map((note: Note) => (
                <View key={note.commitment.toString()} style={themedStyles.noteItem}>
                  <Text style={[
                    themedStyles.noteText,
                    note.spent && themedStyles.spentNote
                  ]}>
                    {note.commitment.toString(16).slice(0, 8)}... ({note.index.toString()})
                  </Text>
                  <Text style={[
                    themedStyles.noteValue,
                    note.spent && themedStyles.spentNote
                  ]}>
                    {note.value?.toString()}
                  </Text>
                </View>
              ))}

              {sortedNotes.length === 0 && (
                <View style={themedStyles.emptyContainer}>
                  <Text style={themedStyles.emptyText}>No notes</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};
