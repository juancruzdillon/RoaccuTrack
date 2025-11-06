
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
  getDay as dateFnsGetDay,
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

// Date when the schedule changes to every other day
const INTERCALATED_SCHEDULE_START_DATE_ISO = "2025-05-13";
const NEW_SCHEDULE_START_DATE_ISO = "2025-11-05";

// Function for historical data generation, assumes daily intake from treatment start.
// This is used for the initial data seeding which happens before INTERCALATED_SCHEDULE_START_DATE_ISO.
export const isPillDayHistorically = (date: Date, treatmentStartDate: Date | null): boolean => {
  if (!treatmentStartDate) return false;
  const startDate = getStartOfDay(treatmentStartDate);
  const currentDate = getStartOfDay(date);
  
  if (isBeforeDate(currentDate, startDate)) {
    return false;
  }
  
  const dayOfWeek = dateFnsGetDay(currentDate); // Sunday is 0, Saturday is 6
  return dayOfWeek !== 0 && dayOfWeek !== 6;
};


// Updated isPillDay logic:
// - Before NEW_SCHEDULE_START_DATE_ISO, it was intercalated.
// - From NEW_SCHEDULE_START_DATE_ISO onwards, it is Mon-Fri.
export const isPillDay = (date: Date, treatmentStartDate: Date | null): boolean => {
  if (!treatmentStartDate) {
    return false;
  }

  const startDate = getStartOfDay(treatmentStartDate);
  const currentDate = getStartOfDay(date);
  const newScheduleStartDate = parseISO(NEW_SCHEDULE_START_DATE_ISO);

  // Pills are only scheduled on or after the treatment start date.
  if (isBeforeDate(currentDate, startDate)) {
    return false;
  }

  // Logic for dates BEFORE the new schedule starts
  if (isBeforeDate(currentDate, newScheduleStartDate)) {
      const intercalatedStartDate = parseISO(INTERCALATED_SCHEDULE_START_DATE_ISO);
      
      // Before the intercalated schedule, it was Mon-Fri
      if (isBeforeDate(currentDate, intercalatedStartDate)) {
          const dayOfWeek = dateFnsGetDay(currentDate); // Sunday is 0, Saturday is 6
          return dayOfWeek !== 0 && dayOfWeek !== 6;
      }
      
      // During the intercalated period
      const daysFromIntercalatedStart = differenceInDays(currentDate, intercalatedStartDate);
      // Pills on the start day of intercalated schedule, and every 2 days after.
      return daysFromIntercalatedStart % 2 === 0;
  }

  // Logic for dates ON or AFTER the new schedule starts
  const dayOfWeek = dateFnsGetDay(currentDate); // Sunday is 0, Saturday is 6
  return dayOfWeek !== 0 && dayOfWeek !== 6;
};
