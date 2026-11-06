/**
 * The six "About you" questions (SPEC §3 step 4) and the rule for finishing them. Pure, so it is tested in Node.
 */

/** The steps in order. Each one is a route, /onboarding/<number>. */
export const ONBOARDING_STEPS = Object.freeze(['state', 'lga', 'role', 'ward', 'goal', 'reminder']);

/** Ward and polling unit can be skipped, so only these three decide whether the learner is set up. */
export function isOnboarded(user) {
  const profile = user?.profile;
  return Boolean(profile?.stateCode && profile?.lgaCode && profile?.personnelRole);
}

/**
 * The first step a learner has not answered yet.
 * @param {object | null | undefined} user
 */
export function firstUnansweredStep(user) {
  const profile = user?.profile ?? {};
  if (!profile.stateCode) return 1;
  if (!profile.lgaCode) return 2;
  if (!profile.personnelRole) return 3;
  return 4;
}

/** The daily goal choices (SPEC §3 step 4.5), matching the server's allowed values. */
export const DAILY_GOAL_CHOICES = Object.freeze([
  { xp: 10, label: 'Casual', hint: '10 XP a day' },
  { xp: 20, label: 'Regular', hint: '20 XP a day' },
  { xp: 30, label: 'Serious', hint: '30 XP a day' },
]);

/** Reminder times offered on the reminder step. Presets, because no time-picker library is approved. */
export const REMINDER_CHOICES = Object.freeze([
  { hhmm: '07:30', label: 'Morning', hint: '7:30 am' },
  { hhmm: '12:30', label: 'Lunch', hint: '12:30 pm' },
  { hhmm: '18:30', label: 'Evening', hint: '6:30 pm' },
  { hhmm: null, label: 'No reminders', hint: 'I will open the app myself' },
]);
