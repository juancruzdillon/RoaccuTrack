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
  formatDateISO, parseISO, isPillDay, getStartOfDay, isBeforeDate, 
  formatDateReadable, isSameDay, isAfterDate, differenceInDays, addDaysToDate
} from '@/lib/date-utils';
import { CheckCircle2, XCircle, CalendarPlus, Info, Pill, Edit3, Loader2 } from 'lucide-react';
import { es } from 'date-fns/locale';
import type { DayContentProps } from 'react-day-picker';

// Helper function to generate initial data based on the user's scenario
const generateInitialRoaccuTrackData = (): RoaccuTrackData => {
  const startDateISO = "2025-03-28";
  const initialDoses: Record<string, 'taken'> = {};
  
  const treatmentStartDate = parseISO(startDateISO);
  const exceptionDate = parseISO("2025-05-11"); // Sunday, May 11, 2025 (missed pill)

  const populateUptoDate = parseISO("2025-05-12"); 

  let currentDate = treatmentStartDate;
  while (isBeforeDate(currentDate, populateUptoDate) || isSameDay(currentDate, populateUptoDate)) {
    if (isPillDay(currentDate, treatmentStartDate)) { 
      const currentDateISO = formatDateISO(currentDate);
      if (!isSameDay(currentDate, exceptionDate)) {
        initialDoses[currentDateISO] = 'taken';
      }
    }
    currentDate = addDaysToDate(currentDate, 1);
    if (differenceInDays(currentDate, treatmentStartDate) > (365 * 5)) { 
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
    generateInitialRoaccuTrackData()
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const { toast } = useToast();
  
  const [clientTime, setClientTime] = useState<Date | undefined>(undefined);
  useEffect(() => {
    setClientTime(new Date());
  }, []);

  const today = useMemo(() => {
    return clientTime ? getStartOfDay(clientTime) : undefined;
  }, [clientTime]);


  useEffect(() => {
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
          if (isPillDay(selectedDate, treatmentStartDate)) { 
            newDoses[selectedDateISO] = 'taken';
            toastMessage = `Pastilla para el ${formatDateReadable(selectedDate)} marcada como tomada.`;
          } else { 
            if (isBeforeDate(selectedDate, treatmentStartDate)) {
              toast({
                title: "Fecha Inválida",
                description: `${formatDateReadable(selectedDate)} es anterior a la fecha de inicio del tratamiento.`,
                variant: "destructive",
              });
              return;
            }
            toast({
                title: "Acción no permitida",
                description: `No se puede marcar una pastilla para ${formatDateReadable(selectedDate)} en este momento.`,
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
    const scheduledPendingDates: Date[] = []; // For dot indicator

    if (!today || !treatmentStartDate) {
      return { taken: takenDates, missed: missedDates, scheduledPending: scheduledPendingDates };
    }

    const loopStartDate = getStartOfDay(treatmentStartDate);
    // Iterate from treatment start up to a reasonable future point for calendar display (e.g., today + 180 days)
    const loopEndDate = addDaysToDate(today, 180); 

    let currentDateIter = loopStartDate;

    while (isBeforeDate(currentDateIter, loopEndDate) || isSameDay(currentDateIter, loopEndDate)) {
      // isPillDay will be true for all days from loopStartDate onwards based on current isPillDay logic
      if (isPillDay(currentDateIter, treatmentStartDate)) {
        const currentDateISO = formatDateISO(currentDateIter);
        const isTaken = data.doses[currentDateISO] === 'taken';

        if (isTaken) {
          takenDates.push(getStartOfDay(currentDateIter));
        } else {
          // Not taken
          // Check if it's a past or current day for "missed" status
          if (isBeforeDate(currentDateIter, today) || isSameDay(currentDateIter, today)) {
            missedDates.push(getStartOfDay(currentDateIter));
          }
          
          // Check if it's a current or future day for "scheduled-pending" status (dot)
          if (isAfterDate(currentDateIter, today) || isSameDay(currentDateIter, today)) {
            scheduledPendingDates.push(getStartOfDay(currentDateIter));
          }
        }
      }
      
      currentDateIter = addDaysToDate(currentDateIter, 1);
      // Safety break to prevent infinite loops in edge cases
      if (differenceInDays(currentDateIter, loopStartDate) > (365 + 180 + 30)) { // Approx 1 year treatment + 6 months future + buffer
          console.warn("Exceeded modifier calculation loop range in RoaccuTrackApp");
          break;
      }
    }

    return {
      taken: takenDates,
      missed: missedDates,
      scheduledPending: scheduledPendingDates,
    };
  }, [data.doses, treatmentStartDate, today]);

  const modifierClassNames = {
    taken: 'rt-taken',
    missed: 'rt-missed',
    scheduledPending: 'rt-scheduled-pending',
  };
  
  const getSelectedDayInfo = () => {
    if (!selectedDate) return null;
    if (!today) { 
      return <p className="text-muted-foreground">Cargando información del día...</p>;
    }

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
           isBeforeDate(selectedDate, treatmentStartDate) ?
            <p className="text-sm text-muted-foreground">Fecha anterior al inicio del tratamiento.</p>
            : <p className="text-sm text-muted-foreground">No es un día de pastilla programado.</p>
        )}
        {isBeforeDate(selectedDate, today) && isScheduledDay && !isTaken && (
            <p className="text-sm text-destructive mt-1">Esta dosis fue omitida.</p>
        )}
         {isSameDay(selectedDate, today) && isScheduledDay && !isTaken && (
            <p className="text-sm text-destructive mt-1">Pastilla de hoy pendiente.</p>
        )}
      </>
    );
  };

  const calendarDisabledFunction = useMemo(() => {
    const currentToday = today; 
    return (date: Date): boolean => {
      if (!currentToday) return true; // Disable if today is not yet determined
      if (isEditingStartDate) return false; // All dates enabled when editing start date
      
      // Allow selection of dates up to today, or future dates if they are part of an already started treatment.
      // However, the main interaction is for past/today. Limiting future selection unless needed.
      // For simplicity, let's stick to the original logic of disabling future dates for marking.
      // The user can select future dates to see they are scheduled, but not mark them.
      // This check is for enabling/disabling interaction, not for styling.
      if (isAfterDate(date, currentToday) && (!treatmentStartDate || isAfterDate(date, addDaysToDate(today, 7)))) {
        // Disable dates far in the future if no treatment or beyond a small window
        // return true; // Original was strict, let's allow viewing future scheduled ones.
      }
      
      // If treatment has started, disable dates before treatment start.
      if (treatmentStartDate) {
         if(isBeforeDate(date, treatmentStartDate)) return true;
         // Allow selection of any day on or after treatment start if it's not too far in future.
         // The actual "markable" action is controlled by handleToggleDose logic.
         return false;
      }
      
      // If no treatment start date, enable all past/today dates for initiating treatment.
      // And disable future dates.
      return isAfterDate(date, currentToday);
    };
  }, [treatmentStartDate, today, isEditingStartDate]);


  const CustomDayContent: React.FC<DayContentProps> = ({ date }) => {
    return (
      <div className="day-content">
        <span>{date.getDate()}</span>
      </div>
    );
  };


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
            Alternativamente, puedes <Button variant="link" className="p-0 h-auto text-primary underline" onClick={() => {setIsEditingStartDate(true); if (today) setSelectedDate(today); else setSelectedDate(getStartOfDay(new Date()))}}>establecer una fecha de inicio pasada</Button>.
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
            <CardDescription>Rastrea tu toma de pastillas. Verde: Tomada, Rosa: Omitida, Punto Turquesa: Programada/Pendiente hoy.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {today ? (
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
                  DayContent: CustomDayContent
                }}
                initialFocus // Helps with testing environments if needed
                month={treatmentStartDate || today} // Show month of treatment start or today
                defaultMonth={treatmentStartDate || today} // Default to relevant month
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-[360px] w-full text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                Cargando calendario...
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 md:col-span-1">
          { (selectedDate || (!treatmentStartDate && !isEditingStartDate) ) && ( 
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
