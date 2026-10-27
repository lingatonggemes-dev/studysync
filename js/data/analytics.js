import { sessionsStore } from './focus.js';
import { tasksStore } from './tasks.js';
import { toISO, addDays, todayISO } from '../util/dates.js';

export function getLast7DaysData() {
  const days = [];
  const today = todayISO();

  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    const label = new Date(date).toLocaleDateString(undefined, { weekday: 'short' });
    
    // Focus minutes for this day
    const daySessions = sessionsStore.all().filter(s => toISO(new Date(s.endedAt)) === date);
    const focusMins = daySessions.reduce((sum, s) => sum + s.durationMinutes, 0);

    // Tasks completed this day
    const dayTasks = tasksStore.all().filter(t => t.done && toISO(new Date(t.updatedAt)) === date);

    days.push({ date, label, focusMins, tasksDone: dayTasks.length });
  }

  return days;
}

export function getOverallStats() {
  const tasks = tasksStore.all();
  const done = tasks.filter(t => t.done).length;
  const total = tasks.length;
  
  const sessions = sessionsStore.all().filter(s => s.mode === 'focus');
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);

  return {
    taskCompletion: total === 0 ? 0 : Math.round((done / total) * 100),
    totalFocusHours: Math.round((totalMinutes / 60) * 10) / 10,
  };
}