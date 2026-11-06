import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, radius, space, size, motion } = theme;

/**
 * Ordering (DESIGN §6.8). Drag the grip handle to move an item; the neighbours step aside as it moves. The up and down
 * buttons do the same thing for anyone who cannot drag, so the question never needs a gesture. `value` is the list of
 * item ids in order; when it is not set yet, the server's order is used.
 * @param {{ items: { id: string, text: string }[], value: string[] | null, onChange: (ids: string[]) => void, disabled?: boolean }} props
 */
export default function Ordering({ items, value, onChange, disabled }) {
  const order = value ?? items.map((i) => i.id);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  const move = (from, to) => {
    if (from === to || to < 0 || to >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <View style={styles.list}>
      {order.map((id, index) => (
        <OrderRow
          key={id}
          text={byId[id]?.text ?? ''}
          index={index}
          count={order.length}
          disabled={disabled}
          onMove={(to) => move(index, to)}
        />
      ))}
    </View>
  );
}

function OrderRow({ text, index, count, disabled, onMove }) {
  const lift = useSharedValue(0);
  const dragging = useSharedValue(0);
  const step = useSharedValue(size.touch);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      dragging.value = 1;
    })
    .onUpdate((e) => {
      lift.value = e.translationY;
    })
    .onEnd((e) => {
      const steps = Math.round(e.translationY / step.value);
      dragging.value = 0;
      lift.value = withSpring(0, motion.springSnappy);
      if (steps !== 0) runOnJS(onMove)(index + steps);
    })
    .onFinalize(() => {
      dragging.value = 0;
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
    zIndex: dragging.value ? 10 : 0,
    shadowOpacity: dragging.value ? 0.18 : 0,
  }));

  return (
    <Animated.View
      style={[styles.row, style]}
      onLayout={(e) => {
        // One step is a row's height plus the gap below it, so a drag of one row moves one place.
        step.value = e.nativeEvent.layout.height + space.sm;
      }}
    >
      <GestureDetector gesture={pan}>
        <View
          style={styles.grip}
          accessibilityLabel={`Drag to move ${text}`}
          accessibilityRole="adjustable"
        >
          <Text style={styles.gripText}>⋮⋮</Text>
        </View>
      </GestureDetector>
      <Text style={styles.position} accessibilityLabel={`Position ${index + 1}`}>
        {index + 1}
      </Text>
      <Text style={styles.text}>{text}</Text>
      <View style={styles.buttons}>
        <Pressable
          onPress={() => onMove(index - 1)}
          disabled={disabled || index === 0}
          accessibilityRole="button"
          accessibilityLabel={`Move ${text} up`}
          style={[styles.step, (disabled || index === 0) && styles.stepOff]}
        >
          <Text style={styles.stepText}>▲</Text>
        </Pressable>
        <Pressable
          onPress={() => onMove(index + 1)}
          disabled={disabled || index === count - 1}
          accessibilityRole="button"
          accessibilityLabel={`Move ${text} down`}
          style={[styles.step, (disabled || index === count - 1) && styles.stepOff]}
        >
          <Text style={styles.stepText}>▼</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: {
    minHeight: size.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.line,
    paddingLeft: space.xs,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    shadowColor: colors.ink900,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  grip: {
    width: size.touch - 16,
    minHeight: size.touch - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gripText: {
    fontFamily: fonts.black,
    fontSize: type.h3.size,
    color: colors.ink400,
    letterSpacing: -2,
  },
  position: {
    width: 22,
    textAlign: 'center',
    fontFamily: fonts.black,
    fontSize: type.h3.size,
    color: colors.jade700,
  },
  text: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
  buttons: { flexDirection: 'column', gap: space.xs },
  step: {
    width: size.touch - 8,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.jade100,
  },
  stepOff: { backgroundColor: colors.line },
  stepText: { fontSize: type.small.size, color: colors.jade700 },
});
