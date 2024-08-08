import { LightningAddress } from "@getalby/lightning-tools";
import "../../../applyGlobalPolyfills";

import { webln } from "@getalby/sdk";
import React from "react";
import {
  Button,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import WebView from "react-native-webview";
import { LightningNetworkScreenProps } from "../../types";
import PolyfillCrypto from "react-native-webview-crypto";
import {
  init, launchModal, requestProvider
} from '@getalby/bitcoin-connect-react';
import { useStyles } from "../../hooks";
import stylesheet from "./styles";
import { useTheme } from "@react-navigation/native";
// import { requestProvider } from '@getalby/bitcoin-connect';

export const LightningView: React.FC<LightningNetworkScreenProps> = ({ navigation, route }) => {
  const styles = useStyles(stylesheet)
  return (
    <SafeAreaView style={styles.safeArea}>
      <PolyfillCrypto />
      <NWCPlayground />
    </SafeAreaView>
  );
}

function NWCPlayground() {
  const styles = useStyles(stylesheet)

  const [nwcUrl, setNwcUrl] = React.useState("");
  const [pendingNwcUrl, setPendingNwcUrl] = React.useState("");
  const [nwcAuthUrl, setNwcAuthUrl] = React.useState("");
  const [paymentRequest, setPaymentRequest] = React.useState("");
  const [preimage, setPreimage] = React.useState("");
  const [nostrWebLN, setNostrWebLN] = React.useState<
    webln.NostrWebLNProvider | undefined
  >(undefined);

  const [balance, setBalance] = React.useState<number | undefined>();
  React.useEffect(() => {
    // Initialize Bitcoin Connect
    init({
      appName: 'AFK Lightning App', // your app name
      filters: ["nwc"],
      showBalance: true,
      providerConfig: {
        nwc: {
          authorizationUrlOptions: {
            requestMethods: ['get_balance', 'make_invoice', 'lookup_invoice'],
          },
        },
      }
    });
    if (!nwcUrl) {
      return;
    }
    (async () => {
      try {
        const _nostrWebLN = new webln.NostrWebLNProvider({
          nostrWalletConnectUrl: nwcUrl,
        });
        setNostrWebLN(_nostrWebLN);
        await _nostrWebLN.enable();
        const response = await _nostrWebLN.getBalance();
        console.log("Balance response", response);
        setBalance(response.balance);
      } catch (error) {
        console.error(error);
      }
    })();

    (async () => {
      try {
        const lightningAddress = new LightningAddress("hello@getalby.com");
        await lightningAddress.fetch();
        const invoice = await lightningAddress.requestInvoice({
          satoshi: 1,
        });
        setPaymentRequest(invoice.paymentRequest);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [nwcUrl]);

  async function payInvoice() {
    try {
      if (!nostrWebLN) {
        throw new Error("No WebLN provider");
      }
      const result = await nostrWebLN.sendPayment(paymentRequest);
      setPreimage(result.preimage);
    } catch (error) {
      console.error(error);
    }
  }

  async function connectWithAlby() {
    const nwc = webln.NostrWebLNProvider.withNewSecret({
      //authorizationUrl: "http://192.168.1.102:8080",
    });
    console.log("nwc", nwc)

    const authUrl = nwc.client.getAuthorizationUrl({
      name: "React Native NWC demo",
    });
    setPendingNwcUrl(nwc.client.getNostrWalletConnectUrl(true));
    setNwcAuthUrl(authUrl.toString());
    console.log("auth url", authUrl)
    console.log("nwc.client.getNostrWalletConnectUrl(true)", nwc.client.getNostrWalletConnectUrl(true))
  }

  if (nwcAuthUrl) {
    return (Platform.OS == "web"
      ? <iframe src={nwcAuthUrl}
       height={"250"} 
      width={"100%"} 
      /> :
      <WebView
        source={{ uri: nwcAuthUrl }}
        javaScriptEnabled={true}
        injectedJavaScriptBeforeContentLoaded={`
          // TODO: remove once NWC also posts messages to the window
          window.opener = window;
          // Listen for window messages
          window.addEventListener("message", (event) => {
            window.ReactNativeWebView.postMessage(event.data?.type);
          });

        `}
        onMessage={(event) => {
          if (event.nativeEvent.data === "nwc:success") {
            setNwcAuthUrl("");
            setNwcUrl(pendingNwcUrl);
          }
        }}
      />)

  }


  const handleRequest = async () => {
    launchModal();
    // const provider = await requestProvider();
    // let send_payment = await provider.sendPayment('lnbc...');
    return
  }
  return (
    <View>
      {!nwcUrl && (
        <>
          <Text 
          style={styles.text}
          
          >Paste NWC URL</Text>
          <TextInput
            onChangeText={(text) => setNwcUrl(text)}
            style={{
              borderWidth: 1,
              padding: 10,
              margin: 10,
            }}
          />
          <Text style={styles.text}>or</Text>
          <Button title="Connect with Alby NWC" onPress={connectWithAlby} />
        </>
      )}
      <View
      // style={{ margin: 5 }}
      >
        <Button title='Handle' onPress={handleRequest}></Button>
      </View>
      {nwcUrl && (
        <>
          <Text style={styles.text}>Balance</Text>
          <Text style={styles.text}>{balance ?? "Loading..."}</Text>
          <Text style={styles.text}>Pay an invoice</Text>
          <Text style={styles.text}>{paymentRequest ?? "Loading..."}</Text>
          {paymentRequest && (
            <Button title="Pay invoice (1 sat)" onPress={payInvoice} />
          )}
          <Text style={styles.text}>{preimage ? `PAID: ${preimage}` : "Not paid yet"}</Text>
        </>
      )}
    </View>
  );
}

