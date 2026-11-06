/** "3 hours ago", "yesterday", "12 Nov 2026". Uses the browser locale, falling back to en-GB. */
const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });

export function relativeTime(value, now = Date.now()) {
  if (!value) return 'just now';
  const diffSec = Math.round((new Date(value).getTime() - now) / 1000);
  const units = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSec) >= seconds) return rtf.format(Math.round(diffSec / seconds), unit);
  }
  return 'just now';
}
