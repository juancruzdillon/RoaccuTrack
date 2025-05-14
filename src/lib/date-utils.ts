
import {
  formatISO as dateFnsFormatISO,
  parseISO as dateFnsParseISO,
  differenceInCalendarDays as dateFnsDifferenceInCalendarDays,
  isSameDay as dateFnsIsSameDay,
  isBefore as dateFnsIsBefore,
  isAfter as dateFnsIsAfter,
  isToday as dateFnsIsToday,
  startOfDay as dateFnsStartOfDay,
  addDays as dateFnsAddDays,
  format as dateFnsFormat,
} from 'date-fns';
import { es } from 'date-fns/locale';

export const formatDateISO = (date: Date): string => dateFnsFormatISO(date, { representation: 'date' });
export const parseISO = (dateString: string): Date => dateFnsParseISO(dateString);
export const differenceInDays = (dateLeft: Date, dateRight: Date): number => dateFnsDifferenceInCalendarDays(dateLeft, dateRight);
export const isSameDay = (dateLeft: Date, dateRight: Date): boolean => dateFnsIsSameDay(dateLeft, dateRight);
export const isBeforeDate = (date: Date, dateToCompare: Date): boolean => dateFnsIsBefore(date, dateToCompare);
export const isAfterDate = (date: Date, dateToCompare: Date): boolean => dateFnsIsAfter(date, dateToCompare);
export const isTodayDate = (date: Date): boolean => dateFnsIsToday(date);
export const getStartOfDay = (date: Date): Date => dateFnsStartOfDay(date);
export const addDaysToDate = (date: Date, amount: number): Date => dateFnsAddDays(date, amount);

export const formatDateReadable = (date: Date, formatString: string = "d 'de' MMMM 'de' yyyy"): string => dateFnsFormat(date, formatString, { locale: es });
export const formatDateShort = (date: Date, formatString: string = "d 'de' MMM"): string => dateFnsFormat(date, formatString, { locale: es });

// Function for historical data generation, assumes daily intake from treatment start.
export const isPillDayHistorically = (date: Date, treatmentStartDate: Date | null): boolean => {
  if (!treatmentStartDate) return false;
  const startDate = getStartOfDay(treatmentStartDate);
  const currentDate = getStartOfDay(date);
  if (isBeforeDate(currentDate, startDate)) {
    return false;
  }
  return true; // Historically, it was daily
};


// Updated isPillDay logic:
// - For past dates (before today) and today: daily schedule.
// - For future dates (after today): every other day, with 'today' as the reference for the new pattern.
export const isPillDay = (date: Date, treatmentStartDate: Date | null, today: Date | null): boolean => {
  if (!treatmentStartDate || !today) {
    // If today is not yet available (e.g., during initial SSR or before client mount),
    // default to false to avoid incorrect scheduling until client-side hydration.
    return false;
  }

  const startDate = getStartOfDay(treatmentStartDate);
  const currentDate = getStartOfDay(date);
  const currentToday = getStartOfDay(today);

  // Rule 1: Pills are only scheduled on or after the treatment start date.
  if (isBeforeDate(currentDate, startDate)) {
    return false;
  }

  // Rule 2: For any date in the past (before currentToday) or for currentToday itself.
  // The schedule was/is daily.
  if (isBeforeDate(currentDate, currentToday) || isSameDay(currentDate, currentToday)) {
    return true;
  }

  // Rule 3: For any date in the future (after currentToday).
  // The schedule is "every other day", with currentToday being the reference for the pattern.
  // If today is considered day 0 of this new pattern, then future pill days are on even day differences from today.
  const daysDifferenceFromToday = differenceInDays(currentDate, currentToday);
  return daysDifferenceFromToday % 2 === 0;
};
