// A savings-goal date is a calendar date (e.g. "January 1, 2026"), not
// an instant in time - it has no time-of-day and no timezone. Postgres's
// `date` columns and PostgREST both already model this correctly as a
// plain "YYYY-MM-DD" string. This file exists only because
// react-datepicker's API requires a JS Date object, which has no
// "calendar-date-only" mode - every Date is an instant. These two
// functions are the narrow bridge between the two representations, used
// only by SetGoalModal.jsx.
//
// Deliberately local-only: never new Date(dateOnlyString) (parses as
// UTC midnight, per spec) and never .toISOString() (serializes via
// UTC) - both silently shift the calendar day depending on the sign of
// the local UTC offset. Reading/writing local Y/M/D components instead
// keeps construction and serialization in the same reference frame, so
// there is nothing to shift regardless of what timezone the code runs
// in.

export function parseCalendarDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatCalendarDate(date) {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
