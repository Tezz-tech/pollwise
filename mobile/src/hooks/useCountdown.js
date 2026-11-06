import { useEffect, useState } from 'react';

/**
 * Milliseconds left until an ISO time, updated twice a second. With no end time it reports no limit.
 * The server decides when an attempt has expired; this only drives the display and the auto-submit.
 * @param {string | null | undefined} endsAt
 * @returns {{ ms: number | null, expired: boolean }}
 */
export function useCountdown(endsAt) {
  const end = endsAt ? new Date(endsAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (end === null) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [end]);
  if (end === null) return { ms: null, expired: false };
  const ms = end - now;
  return { ms, expired: ms <= 0 };
}
