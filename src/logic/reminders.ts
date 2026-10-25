import type { ISODate, Settings } from '../types';
import { addDaysISO } from './dates';

const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Fold a content line at 75 octets (RFC 5545). Thai is 3 bytes per char, so count bytes. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (bytes + b > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const compact = (d: ISODate) => d.replace(/-/g, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/**
 * Calendar file with a daily study reminder (skipping rest days) until the day before the
 * exam, plus the exam itself. Phones keep these alarms even when the app is closed.
 */
export function reminderICS(s: Settings, from: ISODate, appUrl: string, stamp = new Date()): string {
  const time = (s.reminderTime ?? '19:00').replace(':', '') + '00';
  const days = ICS_DAYS.filter((_, i) => !s.restWeekdays.includes(i)).join(',');
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lastDay = compact(addDaysISO(s.examDate, -1));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//examprep//TH',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:examprep-daily-${compact(from)}@examprep`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${compact(from)}T${time}`,
    'DURATION:PT1H',
    `RRULE:FREQ=WEEKLY;BYDAY=${days};UNTIL=${lastDay}T235959`,
    `SUMMARY:${esc('📚 ตะลุยโจทย์ + ทวนข้อผิด')}`,
    `DESCRIPTION:${esc(`ทำโจทย์ตามโควต้าวันนี้ แล้วทวนข้อที่ถึงกำหนด\n${appUrl}`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('ถึงเวลาตะลุยโจทย์แล้ว')}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'BEGIN:VEVENT',
    `UID:examprep-exam-${compact(s.examDate)}@examprep`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${compact(s.examDate)}`,
    `DTEND;VALUE=DATE:${compact(addDaysISO(s.examDate, 1))}`,
    `SUMMARY:${esc(`🎯 ${s.examName}`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`พรุ่งนี้${s.examName} เตรียมอุปกรณ์ พักผ่อนให้พอ`)}`,
    'TRIGGER:-PT12H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** True when the last backup is missing or older than a week (and there is something to lose). */
export const backupDue = (s: Settings, hasData: boolean, now = Date.now()) =>
  hasData && (!s.lastBackupAt || now - s.lastBackupAt > 7 * 24 * 3600 * 1000);
