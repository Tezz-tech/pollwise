import { StyleSheet, Text, View } from 'react-native';
import Card from './Card.js';
import ProgressRing from './ProgressRing.js';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * "47 days to election day. You're 60% ready." with a readiness ring (DESIGN §5). Shown only when a date is set and
 * still ahead. Readiness is the server's figure; with no required courses there is no ring.
 * @param {{ days: number, label?: string | null, readinessPct?: number | null }} props
 */
export default function CountdownCard({ days, label, readinessPct }) {
  const headline = `${days} ${days === 1 ? 'day' : 'days'} to ${label ?? 'election day'}.`;
  const readiness = typeof readinessPct === 'number' ? `You're ${readinessPct}% ready.` : null;
  return (
    <Card style={styles.card} accessibilityLabel={[headline, readiness].filter(Boolean).join(' ')}>
      <View style={styles.text}>
        <Text style={styles.headline}>{headline}</Text>
        {readiness ? <Text style={styles.body}>{readiness}</Text> : null}
      </View>
      {typeof readinessPct === 'number' ? (
        <ProgressRing progress={readinessPct / 100} size={56} stroke={6} color={colors.jade500}>
          <Text style={styles.ringText}>{readinessPct}%</Text>
        </ProgressRing>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: space.xs },
  headline: {
    fontFamily: fonts.black,
    fontSize: type.h3.size,
    lineHeight: type.h3.line,
    color: colors.ink900,
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    lineHeight: type.small.line,
    color: colors.ink600,
  },
  ringText: { fontFamily: fonts.black, fontSize: type.small.size, color: colors.ink900 },
});
