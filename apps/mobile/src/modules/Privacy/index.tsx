import { View, Text, Pressable, ScrollView } from 'react-native';
import { Button } from "src/components";
import { Notes } from "../../components/Privacy/notes";
// import { Receive } from "../../components/Privacy/receive";
// import { Transfer } from "../../components/Privacy/transfer";
// import { Approve } from "../../components/Privacy/approve";
import { useBalance } from "../../hooks/privacy/use-balance";
import { formatTokenAmount } from "../../lib/utils";
import { useState } from "react";
import styles from './styles';
import { useStyles } from '../../hooks/useStyles';
import { useTheme } from '../../hooks/useTheme';

enum Tab {
  Notes = "notes",
  Send = "send",
  Receive = "receive",
  Approve = "approve",
}

function PrivacyCoin() {
  const { balance } = useBalance();
  const [tab, setTab] = useState<Tab>(Tab.Notes);
  const [show, setShow] = useState(false);
  const themedStyles = useStyles(styles);
  const { theme } = useTheme();

  return (
    <ScrollView style={themedStyles.container}>
      <View style={themedStyles.replyView}>
        <View style={themedStyles.info}>
          <Text style={[themedStyles.infoDetails, { fontSize: 40, color: theme.colors.text }]}>
            {show ? formatTokenAmount(balance) : "****"}
          </Text>
          <View style={themedStyles.infoUser}>
            <Text style={[themedStyles.infoProfile, { color: theme.colors.text }]}>My balance</Text>
            <Pressable
              onPress={() => setShow(!show)}
              style={themedStyles.infoLikes}
            >
              {/* {show ? <Icon name="eye" size={8} /> : <Icon name="eye-slash" size={8} />} */}
            </Pressable>
          </View>
        </View>
      </View>

      <View style={themedStyles.footer}>
        <Pressable
          onPress={() => setTab(Tab.Notes)}
          style={[themedStyles.tabButton, tab === Tab.Notes && themedStyles.activeTab]}
        >
          <Text style={{ color: theme.colors.text }}>Notes</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab(Tab.Send)}
          style={[themedStyles.tabButton, tab === Tab.Send && themedStyles.activeTab]}
        >
          <Text style={{ color: theme.colors.text }}>Send</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab(Tab.Approve)}
          style={[themedStyles.tabButton, tab === Tab.Approve && themedStyles.activeTab]}
        >
          <Text style={{ color: theme.colors.text }}>Approve</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab(Tab.Receive)}
          style={[themedStyles.tabButton, tab === Tab.Receive && themedStyles.activeTab]}
        >
          <Text style={{ color: theme.colors.text }}>Receive</Text>
        </Pressable>
      </View>

      {tab === Tab.Notes && <Notes show={show} />}
      {/* {tab === Tab.Send && <Transfer />} */}
      {/* {tab === Tab.Receive && <Receive />} */}
      {/* {tab === Tab.Approve && <Approve />} */}
    </ScrollView>
  );
}

export default PrivacyCoin;
