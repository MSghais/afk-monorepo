import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import stylesheet from './styles';
import { useStyles, useTheme } from '../../../hooks';
import { Icon } from '../../Icon';
import { useNavigation } from '@react-navigation/native';
import { MainStackNavigationProps } from '../../../types';
import { useAuth } from '../../../store/auth';
import { DrawerContentComponentProps } from '@react-navigation/drawer';

interface ISidebar {
    props?:DrawerContentComponentProps
}
const Sidebar = ({props}:ISidebar) => {
    const styles = useStyles(stylesheet);
    const theme = useTheme()

    const publicKey = useAuth((state) => state.publicKey);

    const navigation = useNavigation<MainStackNavigationProps>()
    const handleNavigateProfile = () => {
        navigation.navigate("Profile", { publicKey: publicKey });
    };





    const dimensions = useWindowDimensions();
    const isDesktop = dimensions.width >= 1024;

    // const handleNavigateHome = () => {
    //     navigation.navigate("Home");
    // };


    const handleDefiScreen = () => {
        navigation.navigate("Defi");
    };

    const handleGameScreen = () => {
        navigation.navigate("Games");
    };

    const handleHomeScreen = () => {
        navigation.navigate("Home");
    };


    return (
        <View style={[styles.sidebar, 
            // {width:is}
            ]
    
    }
        {...props}
        
        >
            <Text style={styles.sidebarText}>AFK</Text>
            <Text style={[styles.title]}>Features coming soon</Text>

            <Pressable
                onPress={handleHomeScreen}
                style={styles.item}>
                <Icon
                    name="HomeIcon"
                    size={24}
                    style={{ backgroundColor: theme.theme.colors.background }}
                />
                <Text style={styles.textItem}>
                    Home
                </Text>

            </Pressable>


            <Pressable
                onPress={handleGameScreen}
                style={styles.item}>
                <Icon
                    name="GameIcon"
                    size={24}
                    style={{ backgroundColor: theme.theme.colors.background }}
                />
                <Text style={styles.textItem}>
                    Gamefi
                </Text>

            </Pressable>


            <Pressable
                onPress={handleDefiScreen}
                style={styles.item}>
                <Icon
                    name="CoinIcon"
                    size={24}
                />
                <Text style={styles.textItem}>
                    Onramp & DeFI
                </Text>

            </Pressable>


            <Pressable
                onPress={handleNavigateProfile}
                style={styles.item}>
                <Icon
                    name="UserIcon"
                    size={24}
                />
                <Text style={styles.textItem}>
                    Profile
                </Text>
            </Pressable>

        </View>
    );
};

export default Sidebar;
