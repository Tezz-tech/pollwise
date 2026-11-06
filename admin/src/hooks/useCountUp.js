/**
 * Counts a number up from 0 over 700 ms with an ease-out curve (DESIGN §3, interaction 6). With reduced
 * motion the number jumps straight to its final value.
 */
import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

export function useCountUp(target, duration = 700) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce || !Number.isFinite(target)) {
      setValue(target);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduce]);
  return value;
}
