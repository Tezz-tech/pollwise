import { StyleSheet, Text, View } from 'react-native';
import ProgressBar from './ProgressBar.js';
import { LockIcon } from './icons.js';
import { theme } from '../theme/theme.js';
import { BANNER_HEIGHT } from '../lib/path.js';

const { colors, fonts, type, space, radius } = theme;

/**
 * The band that starts each module on the path: "MODULE 2 OF 3", the title, and how many of its steps are done
 * (DESIGN §6.5). Locked modules are grey with a lock.
 * @param {{ index: number, total: number, title: string, done: number, steps: number, locked: boolean }} props
 */
export default function ModuleBanner({ index, total, title, done, steps, locked }) {
  const progress = steps > 0 ? done / steps : 0;
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={`Module ${index} of ${total}, ${title}, ${done} of ${steps} done${locked ? ', locked' : ''}`}
      style={[styles.band, locked && styles.bandLocked]}
    >
      <View style={styles.top}>
        <Text style={[styles.kicker, locked && styles.kickerLocked]}>
          Module {index} of {total}
        </Text>
        {locked ? (
          <LockIcon size={18} color={colors.ink600} />
        ) : (
          <Text style={styles.count}>{`${done}/${steps}`}</Text>
        )}
      </View>
      <Text style={[styles.title, locked && styles.titleLocked]} numberOfLines={2}>
        {title}
      </Text>
      {!locked && steps > 0 ? (
        <ProgressBar progress={progress} height={8} accessibilityLabel={`${title} progress`} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    height: BANNER_HEIGHT,
    backgroundColor: colors.jade600,
    borderRadius: radius.lg,
    borderBottomWidth: 4,
    borderBottomColor: colors.jade700,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    justifyContent: 'space-between',
  },
  bandLocked: { backgroundColor: colors.line, borderBottomColor: colors.line },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: {
    fontFamily: fonts.heavy,
    fontSize: type.label.size,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
    color: colors.white,
  },
  kickerLocked: { color: colors.ink600 },
  count: { fontFamily: fonts.heavy, fontSize: type.small.size, color: colors.white },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h3.size,
    lineHeight: type.h3.line,
    color: colors.white,
  },
  titleLocked: { color: colors.ink600 },
});
