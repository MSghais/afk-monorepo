
import * as React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../../Icon';
import { MainStackNavigationProps } from '../../../types';
import { DrawerNavigationConfig } from '@react-navigation/drawer/lib/typescript/src/types';
import { ThemedStyleSheet } from '../../../styles';


export default ThemedStyleSheet((theme) => ({


    // const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
        paddingHorizontal: 15,
        backgroundColor: theme.colors.background,
        color:theme.colors.text,
        borderBottomWidth: 1,
        // borderBottomColor: '#ddd',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    burgerIcon: {
        padding: 5,
    },
})
)