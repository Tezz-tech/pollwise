import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme.js';

const { colors, space } = theme;

/**
 * The page frame for every screen: safe area, background, optional scrolling, a footer pinned above the keyboard.
 * @param {{
 *   children: import('react').ReactNode,
 *   scroll?: boolean,
 *   footer?: import('react').ReactNode,
 *   padded?: boolean,
 *   contentStyle?: import('react-native').ViewStyle,
 * }} props
 */
export default function Screen({ children, scroll = false, footer, padded = true, contentStyle }) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, styles.grow, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.grow, padded && styles.padded, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.grow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
        {footer ? <View style={[styles.footer, padded && styles.padded]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  grow: { flex: 1 },
  padded: { paddingHorizontal: space['2xl'], paddingTop: space.lg },
  footer: { paddingBottom: space['2xl'], paddingTop: space.md, gap: space.md },
});
