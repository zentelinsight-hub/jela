import { useNetworkState } from 'expo-network';
import { WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useAppTheme } from '@/contexts/theme-context';

export function OfflineBanner() {
  const network = useNetworkState();
  const { colors } = useAppTheme();
  if (network.isConnected !== false && network.isInternetReachable !== false) return null;
  return <View accessibilityRole="alert" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.danger }}><WifiOff color="#FFFFFF" size={17} /><AppText style={{ color: '#FFFFFF' }} variant="caption">You’re offline. Cached workspace data remains available; Jela needs internet to respond.</AppText></View>;
}
