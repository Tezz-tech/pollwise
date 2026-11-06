import { Image } from 'expo-image';

/**
 * Tally, the PollWise mascot (DESIGN §2). Phase 0 uses the exported PNG. The animated, layered
 * react-native-svg version (with blink, look, cheer and wave moods) replaces this in Phase 7.
 * Tally is never sad (CLAUDE.md rule 9).
 */
const SOURCES = {
  happy: require('../../assets/tally-happy.png'),
};

/**
 * @param {{ mood?: 'happy', size?: number, accessibilityLabel?: string }} props
 */
export default function Tally({
  mood = 'happy',
  size = 160,
  accessibilityLabel = 'Tally the ballot box',
}) {
  return (
    <Image
      source={SOURCES[mood]}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    />
  );
}
