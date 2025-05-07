import 'fast-text-encoding';
import './src/app/Shims';
import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import { Wrapper } from './src/app/Wrapper';

// Register the app
AppRegistry.registerComponent(appName, () => Wrapper);

// Initialize the app for web
if (typeof document !== 'undefined') {
  const rootTag = document.getElementById('root') || document.getElementById('main');
  if (rootTag) {
    AppRegistry.runApplication(appName, {
      rootTag,
      initialProps: {}
    });
  }
}

// import { registerRootComponent } from 'expo';
// import { Platform } from 'react-native';
// import App from './src/App';

// // Add polyfills for web
// if (Platform.OS === 'web') {
//   require('react-native-web/dist/exports/AppRegistry/AppContainer');
//   require('react-native-web/dist/exports/AppRegistry/AppContainer');
// }

// registerRootComponent(App); 