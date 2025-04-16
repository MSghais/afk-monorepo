import { useTransfer } from "../../hooks/privacy/use-transfer";
import { useCallback, useEffect, useState } from "react";
import { TextInput, View, Text as RNText, TouchableOpacity, ScrollView } from 'react-native';
import { useTransferFrom } from "../../hooks/privacy/use-transfer-from";
import { buildExplorerUrl, formatHex } from "../../lib/utils";
import { useAccount } from "../../hooks/privacy/use-account";
import { useToast } from "src/hooks/modals";
import { Text } from "../Text";
import { Button } from "../Button";

export const Transfer: React.FC = () => {
  const { showToast } = useToast();
  const { account } = useAccount();
  const { sendTransfer, loading: transferLoading } = useTransfer();
  const { sendTransferFrom, loading: transferFromLoading } = useTransferFrom();

  const [amount, setAmount] = useState("0");
  const [scan, setScan] = useState(false);
  const [transferFrom, setTransferFrom] = useState(false);
  const [from, setFrom] = useState({ address: "", publicKey: "" });
  const [to, setTo] = useState({ address: "", publicKey: "" });

  const onTransfer = useCallback(async () => {
    try {
      const amountBn = BigInt((parseFloat(amount) * 10 ** 6).toFixed(0));

      const txHash = transferFrom
        ? await sendTransferFrom({
            amount: amountBn,
            from: {
              address: BigInt(from.address),
              publicKey: BigInt(from.publicKey),
            },
            to: {
              address: BigInt(to.address),
              publicKey: BigInt(to.publicKey),
            },
          })
        : await sendTransfer({
            amount: amountBn,
            to: {
              address: BigInt(to.address),
              publicKey: BigInt(to.publicKey),
            },
          });

      showToast({
        title: "Transaction sent successfully",
        type: "success",
      });
    } catch (e) {
      showToast({
        title: "Something went wrong",
        description: (e as Error).message,
        type: "error",
      });
    }
  }, [amount, to, from, sendTransfer]);

  useEffect(() => {
    if (account && !transferFrom) {
      setFrom({
        address: formatHex(account.owner.address),
        publicKey: formatHex(account.viewer.publicKey),
      });
    }
  }, [account, transferFrom]);

  return (
    <ScrollView style={{ padding: 24, backgroundColor: 'white' }}>
      <Text style={{ fontWeight: '600', marginBottom: 24 }}>Transfer</Text>

      {scan ? (
        <View>
          {/* Scanner component would go here */}
        </View>
      ) : (
        <View>
          <View style={{ marginBottom: 32 }}>
            <View style={{ marginBottom: 16 }}>
              <View style={{ position: 'relative' }}>
                <TouchableOpacity 
                  style={{ position: 'absolute', top: 8, right: 0 }}
                  onPress={() => setTransferFrom(!transferFrom)}
                >
                  <Text style={{ color: '#3B82F6', fontSize: 14 }}>
                    {transferFrom ? "Reset" : "Edit"}
                  </Text>
                </TouchableOpacity>

                <View style={{ marginBottom: 16 }}>
                  <Text>{transferFrom ? "From Address" : "From My Address"}</Text>
                  <TextInput
                    style={{ 
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 8
                    }}
                    placeholder="0x..."
                    value={from.address}
                    editable={!transferFrom}
                    onChangeText={(text) => setFrom({ ...from, address: text })}
                  />
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text>{transferFrom ? "From Public Key" : "From My Public Key"}</Text>
                  <TextInput
                    style={{ 
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 8
                    }}
                    placeholder="0x..."
                    value={from.publicKey}
                    editable={!transferFrom}
                    onChangeText={(text) => setFrom({ ...from, publicKey: text })}
                  />
                </View>
              </View>

              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  style={{ position: 'absolute', top: 8, right: 0 }}
                  onPress={() => setScan(!scan)}
                >
                  <Text style={{ color: '#3B82F6' }}>Scan</Text>
                </TouchableOpacity>

                <View style={{ marginBottom: 16 }}>
                  <Text>To Address</Text>
                  <TextInput
                    style={{ 
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 8
                    }}
                    placeholder="0x..."
                    value={to.address}
                    onChangeText={(text) => setTo({ ...to, address: text })}
                  />
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text>To Public Key</Text>
                  <TextInput
                    style={{ 
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 8
                    }}
                    placeholder="0x..."
                    value={to.publicKey}
                    onChangeText={(text) => setTo({ ...to, publicKey: text })}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={{ marginBottom: 48 }}>
            <Text>Amount</Text>
            <TextInput
              style={{ 
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 8,
                padding: 12,
                marginTop: 8
              }}
              placeholder="0.0"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>

          <Button
            onPress={onTransfer}
            disabled={transferFromLoading || transferLoading}
          >
            <Text>
              {transferFromLoading || transferLoading ? "Transferring..." : "Transfer"}
            </Text>
          </Button>
        </View>
      )}
    </ScrollView>
  );
};
