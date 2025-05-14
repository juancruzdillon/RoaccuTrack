
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import TreatmentSummary from './TreatmentSummary';
import type { RoaccuTrackData } from '@/types/roaccutrack';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useToast } from "@/hooks/use-toast";
import {
  formatDateISO, parseISO, isPillDay, getStartOfDay, isBeforeDate, isTodayDate, formatDateReadable, isSameDay, isAfterDate, differenceInDays, addDaysToDate
} from '@/lib/date-utils';
import { CheckCircle2, XCircle, CalendarPlus, Info, Pill, Edit3 } from 'lucide-react';

const RoaccuTrackApp: React.FC = () => {
  const [data, setData] = useLocalStorage<RoaccuTrackData>('roaccuTrackData', {
    treatmentStartDate: null,
    doses: {},
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const { toast } = useToast();
  const today = useMemo(() => getStartOfDay(new Date()), []);

  useEffect(() => {
    // Ensure selectedDate is always start of day for consistency
    if (selectedDate) {
      setSelectedDate(getStartOfDay(selectedDate));
    }
  }, [selectedDate]);

  const treatmentStartDate = useMemo(() => data.treatmentStartDate ? parseISO(data.treatmentStartDate) : null, [data.treatmentStartDate]);

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(getStartOfDay(date));
      setIsEditingStartDate(false); // Close start date editor if a day is clicked
    }
  };

  const handleToggleDose = () => {
    if (!selectedDate) return;

    const selectedDateISO = formatDateISO(selectedDate);
    const newDoses = { ...data.doses };
    let newTreatmentStartDate = data.treatmentStartDate;
    let toastMessage = "";

    if (isEditingStartDate) {
      newTreatmentStartDate = selectedDateISO;
      // Clear doses that are before the new start date or not on the new schedule
      const tempStartDate = parseISO(selectedDateISO);
      Object.keys(newDoses).forEach(doseDateISO => {
        const doseDate = parseISO(doseDateISO);
        if (isBeforeDate(doseDate, tempStartDate) || !isPillDay(doseDate, tempStartDate)) {
          delete newDoses[doseDateISO];
        }
      });
      if (!newDoses[selectedDateISO]) { // Also mark the new start date as taken
         newDoses[selectedDateISO] = 'taken';
      }
      setIsEditingStartDate(false);
      setSelectedDate(undefined); // Clear selection after setting start date
      toastMessage = `Treatment start date set to ${formatDateReadable(selectedDate)}. Pill marked as taken.`;
    } else {
      if (!treatmentStartDate) { // First pill, setting treatment start date
        newTreatmentStartDate = selectedDateISO;
        newDoses[selectedDateISO] = 'taken';
        toastMessage = `Treatment started on ${formatDateReadable(selectedDate)}! Pill marked as taken.`;
      } else { // Existing treatment
        if (newDoses[selectedDateISO] === 'taken') {
          delete newDoses[selectedDateISO];
          toastMessage = `Pill for ${formatDateReadable(selectedDate)} unmarked.`;
        } else {
          if (isPillDay(selectedDate, treatmentStartDate)) {
            newDoses[selectedDateISO] = 'taken';
            toastMessage = `Pill for ${formatDateReadable(selectedDate)} marked as taken.`;
          } else {
            toast({
              title: "Not a Scheduled Day",
              description: `${formatDateReadable(selectedDate)} is not a scheduled pill day.`,
              variant: "destructive",
            });
            return;
          }
        }
      }
    }
    
    setData({ treatmentStartDate: newTreatmentStartDate, doses: newDoses });
    if (toastMessage) {
      toast({ title: "Update", description: toastMessage });
    }
  };
  
  const modifiers = useMemo(() => {
    const takenDates: Date[] = [];
    const missedDates: Date[] = [];
    const scheduledPendingDates: Date[] = [];

    if (treatmentStartDate) {
      const daySpan = differenceInDays(addDaysToDate(today, 90), treatmentStartDate) + 90; // Look back & forward
      for (let i = -daySpan; i <= daySpan; i++) {
        const dateToCheck = addDaysToDate(treatmentStartDate, i);
        if (isPillDay(dateToCheck, treatmentStartDate)) {
          const dateToCheckISO = formatDateISO(dateToCheck);
          if (data.doses[dateToCheckISO] === 'taken') {
            takenDates.push(dateToCheck);
          } else if (isBeforeDate(dateToCheck, today) && !isSameDay(dateToCheck, today)) {
            missedDates.push(dateToCheck);
          } else { // Today or future scheduled day, not taken
            scheduledPendingDates.push(dateToCheck);
          }
        }
      }
    }
    return {
      taken: takenDates,
      missed: missedDates,
      scheduledPending: scheduledPendingDates,
    };
  }, [data, treatmentStartDate, today]);

  const modifierClassNames = {
    taken: 'rt-taken',
    missed: 'rt-missed',
    scheduledPending: 'rt-scheduled-pending',
  };
  
  const getSelectedDayInfo = () => {
    if (!selectedDate) return null;

    const selectedDateISO = formatDateISO(selectedDate);
    const isTaken = data.doses[selectedDateISO] === 'taken';
    
    if (isEditingStartDate) {
      return (
        <>
          <p className="font-semibold">Set new treatment start date:</p>
          <p className="text-sm text-muted-foreground mb-2">{formatDateReadable(selectedDate)}</p>
          <Button onClick={handleToggleDose} className="w-full bg-primary hover:bg-primary/90">
            <CalendarPlus className="mr-2 h-4 w-4" /> Set as Start Date & Mark Taken
          </Button>
        </>
      );
    }

    if (!treatmentStartDate) {
      return (
        <>
          <p className="font-semibold">Start your treatment:</p>
          <p className="text-sm text-muted-foreground mb-2">{formatDateReadable(selectedDate)}</p>
          <Button onClick={handleToggleDose} className="w-full bg-primary hover:bg-primary/90">
            <CalendarPlus className="mr-2 h-4 w-4" /> Start Treatment & Mark Taken
          </Button>
        </>
      );
    }
    
    const isScheduled = isPillDay(selectedDate, treatmentStartDate);

    return (
      <>
        <p className="font-semibold">{formatDateReadable(selectedDate)}</p>
        {isScheduled ? (
          isTaken ? (
            <Button onClick={handleToggleDose} variant="outline" className="w-full">
              <XCircle className="mr-2 h-4 w-4" /> Unmark as Taken
            </Button>
          ) : (
            <Button onClick={handleToggleDose} className="w-full bg-accent hover:bg-accent/90">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Taken
            </Button>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Not a scheduled pill day.</p>
        )}
        {isBeforeDate(selectedDate, today) && isScheduled && !isTaken && (
            <p className="text-sm text-destructive mt-1">This dose was missed.</p>
        )}
      </>
    );
  };


  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center">
          <Pill className="h-12 w-12 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold ml-3">Roaccu<span className="text-primary">Track</span></h1>
        </div>
        <p className="text-muted-foreground mt-2 text-lg">Your personal Roaccutane treatment companion.</p>
      </header>

      {!data.treatmentStartDate && !isEditingStartDate && (
        <Alert className="mb-6 max-w-2xl mx-auto border-primary bg-primary/10">
          <Info className="h-5 w-5 text-primary" />
          <AlertTitle className="font-semibold text-primary">Welcome to RoaccuTrack!</AlertTitle>
          <AlertDescription className="text-primary/80">
            To get started, select the day you first took your medication on the calendar and mark it as 'Taken'.
            Alternatively, you can <Button variant="link" className="p-0 h-auto text-primary underline" onClick={() => {setIsEditingStartDate(true); setSelectedDate(today);}}>set a past start date</Button>.
          </AlertDescription>
        </Alert>
      )}
      
      {isEditingStartDate && (
         <Alert className="mb-6 max-w-2xl mx-auto border-accent bg-accent/10">
          <Edit3 className="h-5 w-5 text-accent" />
          <AlertTitle className="font-semibold text-accent">Editing Start Date</AlertTitle>
          <AlertDescription className="text-accent/80">
            Select a day on the calendar to set it as your new treatment start date. This day will also be marked as taken.
            <Button variant="link" className="p-0 h-auto text-accent underline ml-2" onClick={() => setIsEditingStartDate(false)}>Cancel</Button>
          </AlertDescription>
        </Alert>
      )}


      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">Medication Calendar</CardTitle>
            <CardDescription>Track your pill intake. Pink: Missed, Teal: Taken, Dot: Scheduled.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDaySelect}
              modifiers={modifiers}
              modifierClassNames={modifierClassNames}
              className="rounded-md"
              disabled={(date) => isAfterDate(date, today) && !isEditingStartDate && (!treatmentStartDate || !isPillDay(date, treatmentStartDate))}
              components={{
                DayContent: (props) => {
                  const { date } = props;
                  const classNamesForDay = modifierClassNames.taken && modifiers.taken.some(d => isSameDay(d, date)) ? modifierClassNames.taken :
                                           modifierClassNames.missed && modifiers.missed.some(d => isSameDay(d, date)) ? modifierClassNames.missed :
                                           modifierClassNames.scheduledPending && modifiers.scheduledPending.some(d => isSameDay(d,date)) ? modifierClassNames.scheduledPending : '';
                  return (
                    <div className={`day-content ${classNamesForDay}`}>
                      <span>{date.getDate()}</span>
                    </div>
                  );
                }
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-6 md:col-span-1">
          { (selectedDate || !treatmentStartDate) && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">
                  {isEditingStartDate ? "Set Start Date" : treatmentStartDate ? "Selected Day" : "Begin Treatment"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-center">
                {getSelectedDayInfo()}
              </CardContent>
            </Card>
          )}
          
          {!isEditingStartDate && treatmentStartDate && (
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => {
                setIsEditingStartDate(true); 
                setSelectedDate(treatmentStartDate); // Pre-select current start date
              }}
            >
              <Edit3 className="mr-2 h-4 w-4" /> Edit Treatment Start Date
            </Button>
          )}

          <TreatmentSummary data={data} />
        </div>
      </div>
    </div>
  );
};

export default RoaccuTrackApp;

