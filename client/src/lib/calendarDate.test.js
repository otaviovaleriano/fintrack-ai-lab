import { parseCalendarDate, formatCalendarDate } from './calendarDate';

// The contract: a selected/stored calendar date must remain the same
// calendar date regardless of the machine's timezone.
//
// This file does NOT mutate process.env.TZ - Jest's jsdom environment
// resolves the timezone once when the environment is created, before
// this file's own code runs, so a mid-test mutation has no effect
// (confirmed empirically during Modernization 2's investigation).
// Instead, this exact file is invoked twice, once per timezone, by a
// dedicated CI job (see the timezone-regression job in
// .github/workflows/ci.yml) with TZ set before the process starts.
// Running it as part of the normal test suite too (under whatever
// default timezone that runner has, typically UTC on GitHub Actions)
// is harmless but doesn't exercise the bug - UTC has zero offset, so
// both the buggy and fixed implementations agree there.

test('parseCalendarDate preserves the calendar date regardless of timezone', () => {
  const date = parseCalendarDate('2026-01-01');
  expect(date.getFullYear()).toBe(2026);
  expect(date.getMonth()).toBe(0); // January
  expect(date.getDate()).toBe(1);
});

test('parseCalendarDate returns null for null/empty/undefined input', () => {
  expect(parseCalendarDate(null)).toBeNull();
  expect(parseCalendarDate('')).toBeNull();
  expect(parseCalendarDate(undefined)).toBeNull();
});

test('formatCalendarDate preserves the calendar date regardless of timezone', () => {
  // Constructed independently of parseCalendarDate, via local
  // components - this is what react-datepicker hands back when a user
  // clicks a calendar day cell.
  const date = new Date(2026, 0, 1);
  expect(formatCalendarDate(date)).toBe('2026-01-01');
});

test('formatCalendarDate returns null for null input', () => {
  expect(formatCalendarDate(null)).toBeNull();
});

test('round trip preserves the calendar date regardless of timezone', () => {
  expect(formatCalendarDate(parseCalendarDate('2026-01-01'))).toBe('2026-01-01');
});
