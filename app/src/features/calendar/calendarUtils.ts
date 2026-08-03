import { isSameDay } from 'date-fns'
import type { CalendarEntry } from './components/CalendarDay'

export function entriesForDay(entries: CalendarEntry[], day: Date) {
  return entries.filter((entry) => isSameDay(new Date(entry.queueItem.scheduledAt), day))
}
