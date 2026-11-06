import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '@pollwise/shared/tokens';

/**
 * Small line icons drawn with SVG, so they stay sharp on every density and carry the colour from the caller.
 * Each one is decorative; the label next to it says the same thing (DESIGN §9: colour and icon never alone).
 */

export function TickIcon({ size = 18, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M5 12.5 L10 17 L19 7"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CrossIcon({ size = 18, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M6 6 L18 18 M18 6 L6 18"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function LockIcon({ size = 18, color = colors.ink400 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M8 10 V7.5 A4 4 0 0 1 16 7.5 V10"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Rect x={5} y={10} width={14} height={11} rx={3} fill={color} />
    </Svg>
  );
}

export function FlameIcon({ size = 18, color = colors.amber700 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M12 2.5 C13.5 6 18 8.5 18 14 A6 6 0 0 1 6 14 C6 10.5 8 9 9.2 6.8 C10.4 8.6 11 9 12 9.5 C11.6 7 11.6 4.8 12 2.5 Z"
        fill={color}
      />
    </Svg>
  );
}

export function ChevronIcon({ size = 16, color = colors.ink600, direction = 'down' }) {
  const rotate = { down: 0, up: 180, right: -90, left: 90 }[direction];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={false}
      style={{ transform: [{ rotate: `${rotate}deg` }] }}
    >
      <Path
        d="M6 9 L12 15 L18 9"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ShieldIcon({ size = 18, color = colors.amber700 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path
        d="M12 2.5 L20 5.5 V11.5 C20 16.5 16.8 20.2 12 21.5 C7.2 20.2 4 16.5 4 11.5 V5.5 Z"
        fill={color}
      />
    </Svg>
  );
}
