import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { confettiColors } from '@pollwise/shared/tokens';

/**
 * One small, tasteful burst (DESIGN §7: the one exception to calm). Brand colours only. Off when the
 * person has asked for reduced motion (DESIGN §3).
 */
export default function Confetti({ burstKey, count = 36 }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: `${burstKey}-${i}`,
        x: (Math.random() - 0.5) * 320,
        y: -(80 + Math.random() * 140),
        rotate: Math.random() * 540 - 270,
        color: confettiColors[i % confettiColors.length],
        delay: Math.random() * 0.1,
      })),
    [burstKey, count]
  );
  if (reduce || !burstKey) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] flex items-end justify-center overflow-hidden"
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute bottom-1/3 block h-2.5 w-2 rounded-sm"
          style={{ backgroundColor: p.color }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 420], rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: 1.6, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
