/**
 * Local reminder notifications only (CLAUDE.md: expo-notifications for local reminders). No push, so no
 * server tokens are stored and nothing is sent to a third party.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { planReminders } from './reminders.js';

const CHANNEL_ID = 'reminders';

/** Call once at launch, before anything is scheduled. */
export async function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Ask for permission, but only when the learner has chosen a reminder time. */
export async function ensureReminderPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.status === 'granted') return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted || asked.status === 'granted';
}

/**
 * Replace every reminder with a fresh plan. Called on launch, after a lesson, and when settings change.
 * @param {{ hhmm: string | null, learnedToday: boolean, daysToElection: number | null }} input
 */
export async function syncReminders({ hhmm, learnedToday, daysToElection }) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!hhmm) return 0;
  const plan = planReminders({ hhmm, now: new Date(), learnedToday, daysToElection });
  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: 'PollWise', body: reminder.body, channelId: CHANNEL_ID },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.date },
    });
  }
  return plan.length;
}
