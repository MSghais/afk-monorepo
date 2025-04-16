import { useApprove } from "../../hooks/privacy/use-approve";
import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Button } from "../Button";
import { buildExplorerUrl } from "../../lib/utils";
import ScanQRCode from "../QR/ScanCode";
import { Input } from "../Input";
import { useToast } from "src/hooks/modals";
import Checkbox from "expo-checkbox";

export const Approve: React.FC = () => {
  const { sendApprove, loading } = useApprove();
  const [shareViewingKey, setShareViewingKey] = useState<boolean>(false);

  const { showToast } = useToast();
  const [scan, setScan] = useState(false);
  const [amount, setAmount] = useState("0");
  const [spender, setSpender] = useState({ address: "", publicKey: "" });

  const onApprove = useCallback(async () => {
    try {
      const txHash = await sendApprove({
        spender: {
          address: BigInt(spender.address),
          publicKey: BigInt(spender.publicKey),
        },
        amount: BigInt((parseFloat(amount) * 10 ** 6).toFixed(0)),
        shareViewingKey,
      });
    } catch (e) {
      showToast({
        title: "Something went wrong",
        description: (e as Error).message,
        type: "error",
        // variant: "destructive",
      });
    }
  }, [amount, spender, sendApprove, showToast]);

  const onScan = useCallback((result: any) => {
    const { address, publicKey } = JSON.parse(result[0].rawValue);
    setSpender({ address, publicKey });
    setScan(false);
  }, []);

  return (
    <ScrollView style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 20 }}>Approve</Text>

      {scan ? (
        <View>
          {/* <ScanQRCode onScan={onScan} /> */}
        </View>
      ) : (
        <View>
          <View style={{ marginBottom: 24 }}>
            <View style={{ marginBottom: 16 }}>
              <TouchableOpacity 
                onPress={() => setScan(!scan)}
                style={{ position: "absolute", right: 0, top: -8 }}
              >
                <Text>Scan</Text>
              </TouchableOpacity>

              <View style={{ marginBottom: 16 }}>
                <Text>Spender Address</Text>
                <Input
                  placeholder="Spender Address"
                  onChangeText={(text) => setSpender({ ...spender, address: text })}
                />
              </View>

              <View>
                <Text>Spender Public Key</Text>
                <Input
                  placeholder="Spender Public Key" 
                  onChangeText={(text) => setSpender({ ...spender, publicKey: text })}
                />
              </View>
            </View>

            <View>
              <View style={{ marginBottom: 16 }}>
                <Text>Amount</Text>
                <Input
                  placeholder="Amount"
                  onChangeText={setAmount}
                />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Checkbox
                  value={shareViewingKey}
                  onValueChange={(value) => setShareViewingKey(value)}
                />
                <Text style={{ marginLeft: 8 }}>Share viewing key</Text>
              </View>
            </View>
          </View>

          <Button onPress={onApprove}>
            <Text>{loading ? "Approving..." : "Approve"}</Text>
          </Button>
        </View>
      )}
    </ScrollView>
  );
};
