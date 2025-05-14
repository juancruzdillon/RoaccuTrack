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

export const formatDateISO = (date: Date): string => dateFnsFormatISO(date, { representation: 'date' });
export const parseISO = (dateString: string): Date => dateFnsParseISO(dateString);
export const differenceInDays = (dateLeft: Date, dateRight: Date): number => dateFnsDifferenceInCalendarDays(dateLeft, dateRight);
export const isSameDay = (dateLeft: Date, dateRight: Date): boolean => dateFnsIsSameDay(dateLeft, dateRight);
export const isBeforeDate = (date: Date, dateToCompare: Date): boolean => dateFnsIsBefore(date, dateToCompare);
export const isAfterDate = (date: Date, dateToCompare: Date): boolean => dateFnsIsAfter(date, dateToCompare);
export const isTodayDate = (date: Date): boolean => dateFnsIsToday(date);
export const getStartOfDay = (date: Date): Date => dateFnsStartOfDay(date);
export const addDaysToDate = (date: Date, amount: number): Date => dateFnsAddDays(date, amount);
export const formatDateReadable = (date: Date, formatString: string = 'MMMM d, yyyy'): string => dateFnsFormat(date, formatString);
export const formatDateShort = (date: Date, formatString: string = 'MMM d'): string => dateFnsFormat(date, formatString);

export const isPillDay = (date: Date, treatmentStartDate: Date | null): boolean => {
  if (!treatmentStartDate) return false;
  const daysDifference = differenceInDays(getStartOfDay(date), getStartOfDay(treatmentStartDate));
  return daysDifference >= 0 && daysDifference % 2 === 0;
};
