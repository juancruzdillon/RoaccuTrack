
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

    if (!today || !treatmentStartDate) { // Guard against undefined today
        return { taken: [], missed: [], scheduledPending: [] };
    }

    const earliestDisplayDate = addDaysToDate(treatmentStartDate, -90);
    const latestDisplayDate = addDaysToDate(today, 180);
    
    let currentDate = earliestDisplayDate;
    while(isBeforeDate(currentDate, latestDisplayDate) || isSameDay(currentDate, latestDisplayDate)) {
      if (isPillDay(currentDate, treatmentStartDate)) {
          const currentDateISO = formatDateISO(currentDate);
          if (data.doses[currentDateISO] === 'taken') {
              takenDates.push(currentDate);
          } else if (isBeforeDate(currentDate, today) && !isSameDay(currentDate, today)) {
              missedDates.push(currentDate);
          } else {
              scheduledPendingDates.push(currentDate);
          }
      }
      currentDate = addDaysToDate(currentDate, 1);
      if (differenceInDays(currentDate, earliestDisplayDate) > (365 * 2)) {
          console.warn("Exceeded modifier calculation range");
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
    if (!today) { // Guard against undefined today for comparisons
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
          <p className="text-sm text-muted-foreground">Fecha anterior al inicio del tratamiento.</p>
        )}
        {isBeforeDate(selectedDate, today) && isScheduledDay && !isTaken && (
            <p className="text-sm text-destructive mt-1">Esta dosis fue omitida.</p>
        )}
      </>
    );
  };

  const calendarDisabledFunction = useMemo(() => {
    const currentTreatmentStartDate = treatmentStartDate; 
    const currentToday = today; 
    const currentIsEditingStartDate = isEditingStartDate; 

    return (date: Date): boolean => {
      if (!currentToday) return true; // Disable all if today is not yet set by client

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
            <CardDescription>Rastrea tu toma de pastillas. Rosa: Omitida, Verde: Tomada, Punto Turquesa: Programada.</CardDescription>
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
                  DayContent: (props) => {
                    const { date } = props;
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
