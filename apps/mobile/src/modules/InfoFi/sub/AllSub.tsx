import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';

import Loading from '../../../components/Loading';
import { useStyles } from '../../../hooks';

import stylesheet from './styles';
import { useNavigation } from '@react-navigation/native';
import { MainStackNavigationProps } from 'src/types';
import { formatUnits } from 'viem';
import { useScoreFactoryData } from '../../../hooks/infofi/useSubFactoryData';
import { SubCard } from './card/SubCard';

export const AllSubsComponent: React.FC = () => {
  const styles = useStyles(stylesheet);
  const navigation = useNavigation<MainStackNavigationProps>();
  const { allSubs, isLoading, isError, refetch } = useScoreFactoryData();
  const [refreshing, setRefreshing] = useState(false);

  console.log('allSubs', allSubs);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleSubPress = (subAddress: string) => {
    navigation.navigate('SubPage', { subAddress });
  };

  const formatDecimal = (value: any) => {
    if (!value) return '0';
    return formatUnits(BigInt(Math.floor(Number(value) * 1e18)), 18);
  };

  if (isLoading) {
    return <Loading />;
  }

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading subs</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <FlatList
        data={allSubs}
        renderItem={({ item }) => (
          <SubCard
            subInfo={{
              contract_address: item.contract_address,
              name: item.name || 'Unnamed Sub',
              about: item.about || '',
              main_tag: item.main_tag || '',
              total_amount_deposit: item.total_amount_deposit || 0,
            }}
            onPress={() => handleSubPress(item.contract_address)}
          />
        )}
        keyExtractor={(item) => item.contract_address}
        style={styles.subList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </ScrollView>
  );
};
