import { StyleSheet, Text, View } from 'react-native';
import AppSheet from './AppSheet.js';
import LipButton from './LipButton.js';
import Chip from './Chip.js';
import { typeLabel } from '../lib/path.js';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * The sheet that opens when a learner taps an available node (DESIGN §3, interaction 7): title, type, length, XP, and
 * a Start button. It only summarises; the lesson itself opens on Start.
 * @param {{ row: object | null, visible: boolean, onClose: () => void, onStart: (row: object) => void }} props
 */
export default function NodePopover({ row, visible, onClose, onStart }) {
  return (
    <AppSheet visible={visible} onClose={onClose} snapPoints={['46%']}>
      {row ? (
        <View style={styles.body}>
          <Text accessibilityRole="header" style={styles.title}>
            {row.title}
          </Text>
          <View style={styles.meta}>
            <Chip label={row.check ? 'Module check' : typeLabel(row.type)} tone="sky" />
            {row.durationSec ? (
              <Chip label={`${Math.round(row.durationSec / 60)} min`} tone="neutral" />
            ) : null}
            {row.xp ? <Chip label={`+${row.xp} XP`} tone="amber" /> : null}
          </View>
          <LipButton
            label={row.state === 'completed' ? 'Review' : 'Start'}
            onPress={() => onStart(row)}
            testID="node-start"
          />
        </View>
      ) : null}
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h2.size,
    lineHeight: type.h2.line,
    color: colors.ink900,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
