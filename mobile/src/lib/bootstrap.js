/**
 * Launch sequence: settings, audio, notifications, then the session. Runs once from the root layout.
 * Offline at launch: a learner who signed in before stays signed in, using the last-known profile.
 */
import { api } from '../api/client.js';
import { useSession, readStoredSession } from '../stores/sessionStore.js';
import { usePrefs } from '../stores/prefsStore.js';
import { initFeedback } from './feedback.js';
import { configureNotifications, syncReminders } from './notifications.js';
import { daysUntil } from './reminders.js';

export async function bootstrap() {
  await Promise.all([usePrefs.getState().hydrate(), initFeedback(), configureNotifications()]);

  const { refreshToken, user: cachedUser } = await readStoredSession();
  if (!refreshToken) {
    useSession.getState().setStatus('signedOut');
    return;
  }

  // Put the stored refresh token in memory, then let the client rotate it into an access token.
  useSession.getState().setTokens({ accessToken: null, refreshToken });
  try {
    await api.refreshAccess();
    const me = await api.request('/me');
    useSession.setState({ status: 'signedIn', user: me });
    await refreshReminders(me);
  } catch (err) {
    if (err?.isNetwork && cachedUser) {
      // Offline at launch: keep the learner in, with what we last knew.
      useSession.setState({ status: 'signedIn', user: cachedUser });
      return;
    }
    useSession.getState().signOut();
  }
}

/** Re-plan reminders from the server's view of the learner (DESIGN §8). Best effort. */
export async function refreshReminders(user) {
  try {
    const stats = await api.request('/me/stats');
    const { reminderTime } = user.learning ?? {};
    const electionDate = await electionDateFromSettings();
    await syncReminders({
      hhmm: reminderTime ?? null,
      learnedToday: (stats?.today?.xp ?? 0) > 0,
      daysToElection: daysUntil(electionDate, new Date()),
    });
  } catch {
    // Reminders are a nicety; a failed refresh keeps the existing schedule.
  }
}

async function electionDateFromSettings() {
  const settings = await api.request('/settings/public', { auth: false });
  return settings?.nextElectionDate ?? null;
}
