import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ThemeProvider from '../src/theme/ThemeProvider.js';
import { theme } from '../src/theme/theme.js';
import ToastHost from '../src/components/ToastHost.js';
import CelebrationHost from '../src/components/CelebrationHost.js';
import { bootstrap } from '../src/lib/bootstrap.js';
import { useSession } from '../src/stores/sessionStore.js';

// Keep the native splash up until Nunito is ready, so text never flashes in a fallback font.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [theme.fonts.regular]: Nunito_600SemiBold,
    [theme.fonts.bold]: Nunito_700Bold,
    [theme.fonts.heavy]: Nunito_800ExtraBold,
    [theme.fonts.black]: Nunito_900Black,
  });
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    bootstrap()
      .catch(() => {})
      .finally(() => {
        // If bootstrap failed before it decided, send the learner to sign-in rather than spin forever.
        if (useSession.getState().status === 'booting')
          useSession.getState().setStatus('signedOut');
        setBooted(true);
      });
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && booted) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError, booted]);

  // Render nothing until fonts are ready; the native splash stays visible in the meantime.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BottomSheetModalProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.colors.bg },
              }}
            />
            <ToastHost />
            <CelebrationHost />
          </BottomSheetModalProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
