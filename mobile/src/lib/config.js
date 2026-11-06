import { Platform } from 'react-native';

/**
 * Where the API lives. Set EXPO_PUBLIC_API_URL in mobile/.env (see .env.example). The Android emulator
 * reaches the host machine at 10.0.2.2, not localhost.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000/api/v1' : 'http://localhost:4000/api/v1');

/**
 * Where the public certificate check lives (the admin site's /verify/:code page). A shared certificate points here,
 * so anyone can check it without an account.
 */
export const VERIFY_BASE_URL =
  process.env.EXPO_PUBLIC_VERIFY_BASE_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:5173' : 'http://localhost:5173');
