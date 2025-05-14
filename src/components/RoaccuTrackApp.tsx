
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
  formatDateISO, parseISO, isPillDay, getStartOfDay, isBeforeDate, isTodayDate, 
  formatDateReadable, isSameDay, isAfterDate, differenceInDays, addDaysToDate
} from '@/lib/date-utils';
import { CheckCircle2, XCircle, CalendarPlus, Info, Pill, Edit3 } from 'lucide-react';
import { es } from 'date-fns/locale';

// Helper function to generate initial data based on the user's scenario
const generateInitialRoaccuTrackData = (): RoaccuTrackData => {
  const startDateISO = "2025-03-28";
  const initialDoses: Record<string, 'taken'> = {};
  
  const treatmentStartDate = parseISO(startDateISO);
  const exceptionDate = parseISO("2025-05-11"); // Sunday, May 11, 2025 (missed pill)

  // Populate doses up to a date that includes the user's scenario (e.g., day after missed dose)
  // This data serves as the default if no data is in localStorage.
  const populateUptoDate = parseISO("2025-05-12"); 

  let currentDate = treatmentStartDate;
  while (isBeforeDate(currentDate, populateUptoDate) || isSameDay(currentDate, populateUptoDate)) {
    // Using the updated isPillDay logic (every day from start date is a pill day)
    if (isPillDay(currentDate, treatmentStartDate)) { 
      const currentDateISO = formatDateISO(currentDate);
      // Mark as taken unless it's the specified exception date
      if (!isSameDay(currentDate, exceptionDate)) {
        initialDoses[currentDateISO] = 'taken';
      }
    }
    currentDate = addDaysToDate(currentDate, 1);
    // Safety break, though date logic should prevent infinite loop normally
    if (differenceInDays(currentDate, treatmentStartDate) > (365 * 5)) { // Max 5 years of pre-population
        console.warn("Exceeded pre-population limit in generateInitialRoaccuTrackData");
        break;
    }
  }

  return {
    treatmentStartDate: startDateISO,
    doses: initialDoses,
  };
};


const RoaccuTrackApp: React.FC = () => {
  const [data, setData] = useLocalStorage<RoaccuTrackData>(
    'roaccuTrackData',
    generateInitialRoaccuTrackData() // Use generated data as default
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const { toast } = useToast();
  const today = useMemo(() => getStartOfDay(new Date()), []);

  useEffect(() => {
    // Ensure selectedDate is always start of day for consistency
    // And prevent re-setting if already start of day to avoid potential loops
    if (selectedDate) {
      const startOfSelectedDay = getStartOfDay(selectedDate);
      if (selectedDate.getTime() !== startOfSelectedDay.getTime()) {
        setSelectedDate(startOfSelectedDay);
      }
    }
  }, [selectedDate]);

  const treatmentStartDate = useMemo(() => data.treatmentStartDate ? parseISO(data.treatmentStartDate) : null, [data.treatmentStartDate]);

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      const startOfSelected = getStartOfDay(date);
      // Prevent re-selection if already selected and correctly at start of day
      if (!selectedDate || selectedDate.getTime() !== startOfSelected.getTime() || isEditingStartDate) {
         setSelectedDate(startOfSelected);
      }
      if (isEditingStartDate && selectedDate?.getTime() === startOfSelected.getTime()){
        // If editing start date and clicked same day again, do nothing extra here
      } else {
        setIsEditingStartDate(false); 
      }
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
      const tempStartDate = parseISO(selectedDateISO);
      Object.keys(newDoses).forEach(doseDateISO => {
        const doseDate = parseISO(doseDateISO);
        // With new isPillDay, only condition is being before new start date
        if (isBeforeDate(doseDate, tempStartDate)) { 
          delete newDoses[doseDateISO];
        }
      });
      if (!newDoses[selectedDateISO]) { 
         newDoses[selectedDateISO] = 'taken';
      }
      setIsEditingStartDate(false);
      setSelectedDate(undefined); 
      toastMessage = `Fecha de inicio del tratamiento establecida para el ${formatDateReadable(selectedDate)}. Pastilla marcada como tomada.`;
    } else {
      if (!treatmentStartDate) { 
        newTreatmentStartDate = selectedDateISO;
        newDoses[selectedDateISO] = 'taken';
        toastMessage = `¡Tratamiento iniciado el ${formatDateReadable(selectedDate)}! Pastilla marcada como tomada.`;
      } else { 
        if (newDoses[selectedDateISO] === 'taken') {
          delete newDoses[selectedDateISO];
          toastMessage = `Pastilla para el ${formatDateReadable(selectedDate)} desmarcada.`;
        } else {
          // isPillDay will be true if selectedDate is on or after treatmentStartDate
          if (isPillDay(selectedDate, treatmentStartDate)) { 
            newDoses[selectedDateISO] = 'taken';
            toastMessage = `Pastilla para el ${formatDateReadable(selectedDate)} marcada como tomada.`;
          } else { // This case now means selectedDate is BEFORE treatmentStartDate
            toast({
              title: "Fecha Inválida",
              description: `${formatDateReadable(selectedDate)} es anterior a la fecha de inicio del tratamiento.`,
              variant: "destructive",
            });
            return;
          }
        }
      }
    }
    
    setData({ treatmentStartDate: newTreatmentStartDate, doses: newDoses });
    if (toastMessage) {
      toast({ title: "Actualización", description: toastMessage });
    }
  };
  
  const modifiers = useMemo(() => {
    const takenDates: Date[] = [];
    const missedDates: Date[] = [];
    const scheduledPendingDates: Date[] = [];

    if (treatmentStartDate) {
      // Determine a reasonable range for displaying modifiers
      // e.g., 3 months back from today and 6 months forward from today or treatment start date.
      const earliestDisplayDate = addDaysToDate(treatmentStartDate, -90);
      const latestDisplayDate = addDaysToDate(today, 180);
      
      let currentDate = earliestDisplayDate;
      while(isBeforeDate(currentDate, latestDisplayDate) || isSameDay(currentDate, latestDisplayDate)) {
        // Only consider dates on or after treatment start for pill status
        if (isPillDay(currentDate, treatmentStartDate)) {
            const currentDateISO = formatDateISO(currentDate);
            if (data.doses[currentDateISO] === 'taken') {
                takenDates.push(currentDate);
            } else if (isBeforeDate(currentDate, today) && !isSameDay(currentDate, today)) {
                // Missed if it's a past pill day and not marked as taken
                missedDates.push(currentDate);
            } else {
                // Scheduled and pending if it's today (and not taken) or a future pill day
                scheduledPendingDates.push(currentDate);
            }
        }
        currentDate = addDaysToDate(currentDate, 1);
        if (differenceInDays(currentDate, earliestDisplayDate) > (365 * 2)) { // Safety break
            console.warn("Exceeded modifier calculation range");
            break;
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
          <p className="font-semibold">Establecer nueva fecha de inicio:</p>
          <p className="text-sm text-muted-foreground mb-2">{formatDateReadable(selectedDate)}</p>
          <Button onClick={handleToggleDose} className="w-full bg-primary hover:bg-primary/90">
            <CalendarPlus className="mr-2 h-4 w-4" /> Establecer como Inicio y Marcar Tomada
          </Button>
        </>
      );
    }

    if (!treatmentStartDate) {
      return (
        <>
          <p className="font-semibold">Comienza tu tratamiento:</p>
          <p className="text-sm text-muted-foreground mb-2">{formatDateReadable(selectedDate)}</p>
          <Button onClick={handleToggleDose} className="w-full bg-primary hover:bg-primary/90">
            <CalendarPlus className="mr-2 h-4 w-4" /> Iniciar Tratamiento y Marcar Tomada
          </Button>
        </>
      );
    }
    
    // isPillDay is true if selectedDate >= treatmentStartDate
    const isScheduledDay = isPillDay(selectedDate, treatmentStartDate); 

    return (
      <>
        <p className="font-semibold">{formatDateReadable(selectedDate)}</p>
        {isScheduledDay ? (
          isTaken ? (
            <Button onClick={handleToggleDose} variant="outline" className="w-full">
              <XCircle className="mr-2 h-4 w-4" /> Desmarcar como Tomada
            </Button>
          ) : (
            <Button onClick={handleToggleDose} className="w-full bg-accent hover:bg-accent/90">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como Tomada
            </Button>
          )
        ) : (
          // This message now appears if selectedDate is BEFORE treatmentStartDate
          <p className="text-sm text-muted-foreground">Fecha anterior al inicio del tratamiento.</p>
        )}
        {isBeforeDate(selectedDate, today) && isScheduledDay && !isTaken && (
            <p className="text-sm text-destructive mt-1">Esta dosis fue omitida.</p>
        )}
      </>
    );
  };

  const calendarDisabledFunction = useMemo(() => {
    // Memoize the disabled function itself and its dependencies
    const currentTreatmentStartDate = treatmentStartDate; // Capture for stable reference
    const currentToday = today; // Capture for stable reference
    const currentIsEditingStartDate = isEditingStartDate; // Capture for stable reference

    return (date: Date): boolean => {
      // Check if isAfterDate is available, to prevent runtime errors if there's an issue
      if (typeof isAfterDate !== 'function' || typeof isPillDay !== 'function') {
        console.error("Date utility function not available for calendar disable logic");
        return true; // Disable if functions are missing
      }
      // A day is disabled if it's in the future AND (we are not editing start date) 
      // AND ( (treatment hasn't started yet) OR (it's not a pill day according to schedule - this part is effectively always true for future days with new isPillDay) )
      // Simplified: Disable future days if not editing start date.
      // With new isPillDay (every day from start), this logic simplifies:
      // If treatment started, future days are pill days. They should be selectable.
      // If treatment NOT started, future days are not pill days. They should be disabled unless editing.
      
      // Original logic:
      // disabled={(date) => isAfterDate(date, today) && !isEditingStartDate && (!treatmentStartDate || !isPillDay(date, treatmentStartDate))}
      // With new isPillDay (true for date >= treatmentStartDate):
      // If treatmentStartDate is set, and date is a future pill day:
      // isAfterDate(date, today) = true
      // !isEditingStartDate = true (assume)
      // !treatmentStartDate = false
      // !isPillDay(date, treatmentStartDate) = false (because it IS a pill day)
      // So, term becomes: true && true && (false || false) => false. So, NOT disabled. This is intended.
      // If treatmentStartDate is NOT set:
      // isAfterDate(date, today) = true
      // !isEditingStartDate = true (assume)
      // !treatmentStartDate = true
      // term becomes: true && true && (true || irrelevant) => true. So, disabled. This is intended.
      return isAfterDate(date, currentToday) && !currentIsEditingStartDate && (!currentTreatmentStartDate || !isPillDay(date, currentTreatmentStartDate));
    };
  }, [treatmentStartDate, today, isEditingStartDate]);


  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center">
          <Pill className="h-12 w-12 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold ml-3">Roaccu<span className="text-primary">Track</span></h1>
        </div>
        <p className="text-muted-foreground mt-2 text-lg">Tu compañero personal para el tratamiento con Roacutan.</p>
      </header>

      {!data.treatmentStartDate && !isEditingStartDate && (
        <Alert className="mb-6 max-w-2xl mx-auto border-primary bg-primary/10">
          <Info className="h-5 w-5 text-primary" />
          <AlertTitle className="font-semibold text-primary">¡Bienvenido a RoaccuTrack!</AlertTitle>
          <AlertDescription className="text-primary/80">
            Para comenzar, selecciona en el calendario el día que tomaste tu primer medicamento y márcalo como 'Tomada'.
            Alternativamente, puedes <Button variant="link" className="p-0 h-auto text-primary underline" onClick={() => {setIsEditingStartDate(true); setSelectedDate(getStartOfDay(new Date()));}}>establecer una fecha de inicio pasada</Button>.
          </AlertDescription>
        </Alert>
      )}
      
      {isEditingStartDate && (
         <Alert className="mb-6 max-w-2xl mx-auto border-accent bg-accent/10">
          <Edit3 className="h-5 w-5 text-accent" />
          <AlertTitle className="font-semibold text-accent">Editando Fecha de Inicio</AlertTitle>
          <AlertDescription className="text-accent/80">
            Selecciona un día en el calendario para establecerlo como tu nueva fecha de inicio del tratamiento. Este día también se marcará como tomado.
            <Button variant="link" className="p-0 h-auto text-accent underline ml-2" onClick={() => setIsEditingStartDate(false)}>Cancelar</Button>
          </AlertDescription>
        </Alert>
      )}


      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">Calendario de Medicación</CardTitle>
            <CardDescription>Rastrea tu toma de pastillas. Rosa: Omitida, Turquesa: Tomada, Punto: Programada.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              locale={es}
              mode="single"
              selected={selectedDate}
              onSelect={handleDaySelect}
              modifiers={modifiers}
              modifierClassNames={modifierClassNames}
              className="rounded-md"
              disabled={calendarDisabledFunction}
              components={{
                DayContent: (props) => {
                  const { date } = props;
                   // Correctly determine classNames based on modifiers for the specific date
                  let daySpecificClassName = '';
                  if (modifiers.taken.some(d => isSameDay(d, date))) {
                    daySpecificClassName = modifierClassNames.taken;
                  } else if (modifiers.missed.some(d => isSameDay(d, date))) {
                    daySpecificClassName = modifierClassNames.missed;
                  } else if (modifiers.scheduledPending.some(d => isSameDay(d,date))) {
                    daySpecificClassName = modifierClassNames.scheduledPending;
                  }
                  return (
                    <div className={`day-content ${daySpecificClassName}`}>
                      <span>{date.getDate()}</span>
                    </div>
                  );
                }
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-6 md:col-span-1">
          { (selectedDate || (!treatmentStartDate && !isEditingStartDate) ) && ( // Show if day selected OR (no treatment started AND not editing start date)
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold">
                  {isEditingStartDate ? "Establecer Fecha de Inicio" : treatmentStartDate ? "Día Seleccionado" : "Comenzar Tratamiento"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-center">
                {selectedDate ? getSelectedDayInfo() : <p className="text-muted-foreground">Selecciona un día para ver detalles o comenzar.</p>}
              </CardContent>
            </Card>
          )}
          
          {!isEditingStartDate && treatmentStartDate && (
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => {
                setIsEditingStartDate(true); 
                setSelectedDate(treatmentStartDate); 
              }}
            >
              <Edit3 className="mr-2 h-4 w-4" /> Editar Fecha de Inicio del Tratamiento
            </Button>
          )}

          <TreatmentSummary data={data} />
        </div>
      </div>
    </div>
  );
};

export default RoaccuTrackApp;

