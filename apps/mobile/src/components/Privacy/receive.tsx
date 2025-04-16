import { useAccount } from "../../hooks/privacy/use-account";
import { useCopyToClipboard } from "../../hooks/privacy/use-copy";
import { formatHex, shortenString } from "../../lib/utils";
import { useMemo } from "react";
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from "../Text";
import QRCode from 'react-native-qrcode-svg';

export const Receive: React.FC = () => {
  const { account } = useAccount();

  const qrValue = useMemo(() => {
    if (!account) return "";

    return JSON.stringify({
      address: formatHex(account.owner.address),
      publicKey: formatHex(account.viewer.publicKey),
    });
  }, [account]);

  return (
    <ScrollView style={{ padding: 24, backgroundColor: 'white' }}>
      <View style={{ alignItems: 'center', marginBottom: 48 }}>
        {/* <QRCode
          size={230}
          value={qrValue}
          color="#1C1B78"
        /> */}
      </View>

      <View style={{ gap: 32 }}>
        <AddressField
          value={formatHex(account?.owner.address ?? 0n)}
          label={"Address"}
        />
        <AddressField
          value={formatHex(account?.viewer.publicKey ?? 0n)}
          label={"Public key"}
        />
      </View>
    </ScrollView>
  );
};

const AddressField: React.FC<{ value: string; label: string }> = ({
  value,
  label,
}) => {
  const { copyToClipboard, isCopied } = useCopyToClipboard({ timeout: 2000 });

  return (
    <TouchableOpacity
      onPress={() => copyToClipboard(value)}
      disabled={isCopied}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
    >
      <View style={{ padding: 4 }}>
        {isCopied ? (
          <Text>✓</Text>
        ) : (
          <Text>📋</Text>
        )}
      </View>
      <View>
        <Text style={{ fontSize: 14 }}>{shortenString(value)}</Text>
        <Text style={{ fontSize: 12, color: '#666' }}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};
