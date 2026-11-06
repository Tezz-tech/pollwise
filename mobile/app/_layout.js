import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import ThemeProvider from '../src/theme/ThemeProvider.js';
import { theme } from '../src/theme/theme.js';

// Keep the native splash up until Nunito is ready, so text never flashes in a fallback font.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [theme.fonts.regular]: Nunito_600SemiBold,
    [theme.fonts.bold]: Nunito_700Bold,
    [theme.fonts.heavy]: Nunito_800ExtraBold,
    [theme.fonts.black]: Nunito_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Render nothing until fonts are ready; the splash stays visible in the meantime.
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}
      />
    </ThemeProvider>
  );
}
