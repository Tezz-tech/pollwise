import { StyleSheet, Text, View } from 'react-native';
import AppSheet from './AppSheet.js';
import CountUp from './CountUp.js';
import { FlameIcon } from './icons.js';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Detail behind the streak and XP chips (DESIGN §6.5): the streak with its freezes and a seven-day row, or today's XP
 * against the goal. Everything shown is the server's figure.
 * @param {{ kind: 'streak' | 'xp' | null, stats: object | null, onClose: () => void }} props
 */
export default function StatSheet({ kind, stats, onClose }) {
  return (
    <AppSheet visible={kind !== null} onClose={onClose} snapPoints={['52%']}>
      {stats && kind === 'streak' ? <StreakDetail stats={stats} /> : null}
      {stats && kind === 'xp' ? <XpDetail stats={stats} /> : null}
    </AppSheet>
  );
}

function StreakDetail({ stats }) {
  const days = stats.activity7d ?? [];
  const today = days[days.length - 1]?.day;
  return (
    <View style={styles.body}>
      <View style={styles.headline}>
        <FlameIcon size={40} color={colors.amber500} />
        <CountUp
          value={stats.streak?.current ?? 0}
          suffix=" days"
          color={colors.ink900}
          size={36}
        />
      </View>
      <Text style={styles.caption}>
        Longest streak: {stats.streak?.longest ?? 0}{' '}
        {(stats.streak?.longest ?? 0) === 1 ? 'day' : 'days'}. Freezes held:{' '}
        {stats.streak?.freezes ?? 0}.
      </Text>
      <View style={styles.week} accessibilityLabel="The last seven days">
        {days.map((d) => {
          const active = d.xp > 0;
          const letter = DAY_LETTERS[new Date(`${d.day}T12:00:00`).getDay()];
          return (
            <View key={d.day} style={styles.day}>
              <View
                style={[styles.dot, active && styles.dotActive, d.day === today && styles.dotToday]}
              />
              <Text style={styles.dayLetter}>{letter}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.caption}>A lesson a day keeps the streak going.</Text>
    </View>
  );
}

function XpDetail({ stats }) {
  const goal = stats.today?.goal ?? 0;
  const earned = stats.today?.xp ?? 0;
  return (
    <View style={styles.body}>
      <Text style={styles.label}>Today</Text>
      <CountUp value={earned} suffix={` of ${goal} XP`} color={colors.jade700} size={32} />
      <Text style={styles.caption}>
        {earned >= goal
          ? 'Daily goal reached.'
          : `${Math.max(0, goal - earned)} XP to go for today.`}
      </Text>
      <Text style={styles.label}>All time</Text>
      <CountUp value={stats.xp ?? 0} suffix=" XP" color={colors.amber700} size={32} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  headline: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  caption: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    lineHeight: type.small.line,
    color: colors.ink600,
  },
  label: {
    fontFamily: fonts.heavy,
    fontSize: type.label.size,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
    color: colors.ink600,
  },
  week: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm },
  day: { alignItems: 'center', gap: space.xs },
  dot: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.line },
  dotActive: { backgroundColor: colors.jade500 },
  dotToday: { borderWidth: 2, borderColor: colors.jade700 },
  dayLetter: { fontFamily: fonts.heavy, fontSize: type.small.size, color: colors.ink600 },
});
