import {Dimensions} from 'react-native';

import {ThemedStyleSheet} from '../../styles';

export default ThemedStyleSheet(() => ({
  videoContainer: {
    width: Dimensions.get('window').width,
    // height: Dimensions.get('window').height - 60,
    height: Dimensions.get('window').height * 0.9,
    // height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  innerVideo: {
    width: Dimensions.get('window').width,
    // height: Dimensions.get('window').height - 60,
    // height: Dimensions.get('window').height,
    height: '100%',
  },
  actionsContainer: {
    position: 'relative',
    // right: Dimensions.get('window').width * 0.1,
    bottom: Dimensions.get('window').height * 0.3,
    // right: Dimensions.get('window').width * 0.2,
    // bottom: Dimensions.get('window').height * 0.2,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    alignItems: 'center',
  },
  actionsContainerMobile: {
    position: 'absolute',
    right: 20,
    // bottom: 20,
    // right: Dimensions.get('window').width * 0.2,
    bottom: Dimensions.get('window').height * 0.2,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    alignItems: 'center',
  },
  // actionsContainer: {
  //   position: 'absolute',
  //   right: 20,
  //   bottom: 40,
  //   display: 'flex',
  //   flexDirection: 'column',
  //   gap: 20,
  //   alignItems: 'center',
  // },
}));
