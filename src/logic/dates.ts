import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { ISODate } from '../types';

export const toISO = (d: Date): ISODate => format(d, 'yyyy-MM-dd');
export const fromISO = (s: ISODate): Date => parseISO(s);
export const todayISO = (): ISODate => toISO(new Date());
export const addDaysISO = (s: ISODate, n: number): ISODate => toISO(addDays(fromISO(s), n));
export const diffDays = (a: ISODate, b: ISODate): number =>
  differenceInCalendarDays(fromISO(a), fromISO(b));
export const weekday = (s: ISODate): number => fromISO(s).getDay();

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const TH_WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/** e.g. "27 มี.ค. 2570" (Buddhist year). */
export function formatThai(s: ISODate): string {
  const d = fromISO(s);
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}
