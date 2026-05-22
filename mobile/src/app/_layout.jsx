import "../../global.css";
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';

export default function Layout() {
  const colorScheme = useColorScheme();

  return (
    <GluestackUIProvider mode={colorScheme === 'dark' ? 'dark' : 'light'}>
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#ffffff' }
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="home" />
      </Stack>
    </GluestackUIProvider>
  );
}
