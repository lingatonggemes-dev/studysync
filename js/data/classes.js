import { createStore } from './store.js';
import { DAYS } from '../util/dates.js';

export const classesStore = createStore('classes');

export const CLASS_TYPES = [
  { id: 'lecture',  label: 'Lecture' },
  { id: 'lab',      label: 'Lab' },
  { id: 'seminar',  label: 'Seminar' },
  { id: 'tutorial', label: 'Tutorial' },
  { id: 'other',    label: 'Other' },
];

export function validateClass(d) {
  const e = {};
  if (!d.subject?.trim()) e.subject = 'Subject is required.';
  if (d.day == null || d.day < 0 || d.day > 6) e.day = 'Pick a day.';
  if (!d.startTime) e.startTime = 'Start time is required.';
  if (!d.endTime) e.endTime = 'End time is required.';
  if (d.startTime && d.endTime && d.startTime >= d.endTime)
    e.endTime = 'End time must be after start time.';
  return e;
}

export function groupByDay(list) {
  const buckets = Array.from({ length: 7 }, () => []);
  for (const c of list) if (buckets[c.day]) buckets[c.day].push(c);
  return buckets.map((items, day) => ({
    day,
    label: DAYS[day],
    items: items.sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));
}

export function nowNextClass(list, now = new Date()) {
  const day = now.getDay();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' +
               String(now.getMinutes()).padStart(2, '0');
  const todays = list.filter((c) => c.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const current = todays.find((c) => c.startTime <= hhmm && hhmm < c.endTime) ?? null;

  let next = todays.find((c) => c.startTime > hhmm) ?? null;
  if (!next) {
    for (let i = 1; i <= 7; i++) {
      const d = (day + i) % 7;
      const found = list.filter((c) => c.day === d)
                        .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
      if (found) { next = found; break; }
    }
  }
  return { current, next };
}