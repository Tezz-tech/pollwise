/**
 * The celebration queue (DESIGN §5, SPEC §8.8). Every server response with an `events` array is pushed here.
 * Pop-ups wait in `queue` and show one at a time, after the current screen finishes. Path moments (a module
 * unlocking) wait in `pathQueue` for the Learn screen, which plays them on the path. Nothing else in the app
 * decides when to celebrate.
 */
import { create } from 'zustand';

/**
 * Event types that become a pop-up. module_passed is not one of them: the assessment results screen shows it, so a
 * second pop-up would say the same thing twice.
 */
export const POPUP_EVENTS = Object.freeze([
  'streak_extended',
  'streak_milestone',
  'streak_freeze_earned',
  'streak_freeze_used',
  'daily_goal_met',
  'course_completed',
]);

/** module_unlocked plays on the path (DESIGN §3, interaction 8), not as a modal. */
export const PATH_EVENTS = Object.freeze(['module_unlocked']);

let counter = 0;

export const useCelebrations = create((set, get) => ({
  /** @type {{ id: number, event: { type: string } }[]} */
  queue: [],
  /** @type {{ id: number, event: { type: string } }[]} */
  pathQueue: [],
  /** Lesson screens pause pop-ups so they never appear on top of a question. */
  paused: false,

  /**
   * Add the events from one response. Returns the events that are shown inline by the caller (XP, lesson done).
   * @param {{ type: string }[] | undefined} events
   * @returns {{ inline: { type: string }[] }}
   */
  push(events) {
    const inline = [];
    const popups = [];
    const onPath = [];
    for (const event of events ?? []) {
      const entry = { id: (counter += 1), event };
      if (POPUP_EVENTS.includes(event.type)) popups.push(entry);
      else if (PATH_EVENTS.includes(event.type)) onPath.push(entry);
      else inline.push(event);
    }
    const patch = {};
    if (popups.length) patch.queue = [...get().queue, ...popups];
    if (onPath.length) patch.pathQueue = [...get().pathQueue, ...onPath];
    if (Object.keys(patch).length) set(patch);
    return { inline };
  },

  /** Remove the first pop-up once the learner has dismissed it. */
  shift() {
    set({ queue: get().queue.slice(1) });
  },

  /** Take every waiting path moment (the Learn screen calls this when it mounts). */
  takePathMoments() {
    const moments = get().pathQueue;
    set({ pathQueue: [] });
    return moments;
  },

  /** @param {boolean} paused */
  setPaused(paused) {
    set({ paused });
  },
}));
