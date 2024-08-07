
import * as React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../../Icon';
import { MainStackNavigationProps } from '../../../types';
import { DrawerNavigationConfig } from '@react-navigation/drawer/lib/typescript/src/types';
import { ThemedStyleSheet } from '../../../styles';
import { useStyles } from '../../../hooks';
import stylesheet from './styles';

interface CustomHeaderInterface {
    title?: string
    navigation?: any
}
export const CustomHeader = ({ title, navigation }: CustomHeaderInterface) => {



    const styles = useStyles(stylesheet)
    // const navigation = useNavigation<DrawerNavigationConfig>()
    return (
        <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={() =>
                navigation?.openDrawer()


            } style={styles.burgerIcon}>
                <Icon name="SunIcon" size={25} color="#000" />
            </TouchableOpacity>
        </View>
    );
}
