import { StyleSheet, View } from 'react-native';
import { theme } from '../theme/theme.js';

const { colors, radius, space } = theme;

/**
 * A white card with a `line` border. `raised` adds the 4 px solid lip used on interactive cards (DESIGN §2).
 * @param {{ children: import('react').ReactNode, raised?: boolean, tint?: string, style?: import('react-native').ViewStyle }} props
 */
export default function Card({ children, raised = false, tint, style }) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tint ?? colors.surface },
        raised && styles.raised,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
  },
  raised: { borderBottomWidth: 4 },
});
