/** Display helpers for the super admin screens. Dates are shown in Africa/Lagos, as the app works in Lagos days. */
const TZ = 'Africa/Lagos';

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(value));
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-GB').format(value ?? 0);
}

export function percent(value) {
  return value === null || value === undefined ? '—' : `${Math.round(value)}%`;
}
