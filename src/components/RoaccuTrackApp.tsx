
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import TreatmentSummary from './TreatmentSummary';
import type { RoaccuTrackData } from '@/types/roaccutrack';
import useLocalStorage from '@/hooks/useLocalStorage';
import { useToast } from "@/hooks/use-toast";
import {
  formatDateISO, parseISO, isPillDay, isPillDayHistorically, getStartOfDay, isBeforeDate,
  formatDateReadable, isSameDay, differenceInDays, addDaysToDate
} from '@/lib/date-utils';
import { CheckCircle2, XCircle, CalendarPlus, Pill, Edit3, Loader2 } from 'lucide-react';
import { es } from 'date-fns/locale';
import type { DayContentProps } from 'react-day-picker';

const generateInitialRoaccuTrackData = (): RoaccuTrackData => {
  const defaultStartDateISO = "2025-03-28";
  const defaultUserName = "Usuario"; // Default name
  const defaultUserAge = null;    // Default age

  const initialDoses: Record<string, 'taken'> = {};
  
  const treatmentStartDate = parseISO(defaultStartDateISO);
  const exceptionDate = parseISO("2025-05-11"); // Sunday, May 11, 2025 (missed pill example)
  const populateUptoDate = parseISO("2025-05-12"); 

  let currentDate = treatmentStartDate;
  while (isBeforeDate(currentDate, populateUptoDate) || isSameDay(currentDate, populateUptoDate)) {
    if (isPillDayHistorically(currentDate, treatmentStartDate)) { 
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
    treatmentStartDate: defaultStartDateISO,
    doses: initialDoses,
    userName: defaultUserName,
    userAge: defaultUserAge,
  };
};


const RoaccuTrackApp: React.FC = () => {
  const [appData, setAppData] = useLocalStorage<RoaccuTrackData>(
    'roaccuTrackData',
    generateInitialRoaccuTrackData()
  );

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const { toast } = useToast();
  
  const [clientTime, setClientTime] = useState<Date | undefined>(undefined);
  const [currentDisplayMonth, setCurrentDisplayMonth] = useState<Date | undefined>();


  useEffect(() => {
    setClientTime(new Date());
  }, []);

  const today = useMemo(() => {
    return clientTime ? getStartOfDay(clientTime) : undefined;
  }, [clientTime]);

  const treatmentStartDate = useMemo(() => appData.treatmentStartDate ? parseISO(appData.treatmentStartDate) : null, [appData.treatmentStartDate]);
  
  useEffect(() => {
    if (today && !currentDisplayMonth) {
      // Initialize currentDisplayMonth to selectedDate if available, otherwise to today.
      // If treatmentStartDate exists, prefer that for initial month view.
      const initialMonth = selectedDate || today;
      setCurrentDisplayMonth(initialMonth);
    }
  }, [today, selectedDate, currentDisplayMonth]);


  useEffect(() => {
    if (selectedDate) {
      const startOfSelectedDay = getStartOfDay(selectedDate);
      if (selectedDate.getTime() !== startOfSelectedDay.getTime()) {
        setSelectedDate(startOfSelectedDay);
      }
    }
  }, [selectedDate]);


  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      const startOfSelected = getStartOfDay(date);
      setSelectedDate(startOfSelected); 

      if (currentDisplayMonth && startOfSelected.getMonth() !== currentDisplayMonth.getMonth()) {
        setCurrentDisplayMonth(startOfSelected);
      }
    } else {
      setSelectedDate(undefined);
    }
  };

  const handleToggleDose = () => {
    if (!selectedDate || !today) return; 

    const selectedDateISO = formatDateISO(selectedDate);
    const newDoses = { ...appData.doses };
    let newTreatmentStartDate = appData.treatmentStartDate;
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
      toastMessage = `Fecha de inicio del tratamiento establecida para el ${formatDateReadable(selectedDate)}. Pastilla marcada como tomada.`;
      
    } else {
      if (!treatmentStartDate) { 
        // This case is less likely now that generateInitialRoaccuTrackData provides a default start date
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
                description: `No se puede marcar una pastilla para ${formatDateReadable(selectedDate)} ya que no es un día de toma programado según la pauta actual.`,
                variant: "destructive",
            });
            return;
          }
        }
      }
    }
    
    setAppData(prev => ({ ...prev, treatmentStartDate: newTreatmentStartDate, doses: newDoses }));
    if (toastMessage) {
      toast({ title: "Actualización", description: toastMessage });
    }
  };
  
  const modifiers = useMemo(() => {
    const takenDates: Date[] = [];
    const missedDates: Date[] = [];
    const scheduledPendingDates: Date[] = [];

    if (!today || !treatmentStartDate) { 
        return { taken: [], missed: [], scheduledPending: [] };
    }

    const earliestModifierDate = addDaysToDate(treatmentStartDate, -90); 
    const latestModifierDate = addDaysToDate(today, 180); 
    
    let currentDate = earliestModifierDate;

    while(isBeforeDate(currentDate, latestModifierDate) || isSameDay(currentDate, latestModifierDate)) {
      if (isPillDay(currentDate, treatmentStartDate)) {
          const currentDateISO = formatDateISO(currentDate);
          if (appData.doses[currentDateISO] === 'taken') {
              takenDates.push(getStartOfDay(parseISO(currentDateISO))); 
          } else if (isBeforeDate(currentDate, today) && !isSameDay(currentDate, today)) { 
              missedDates.push(getStartOfDay(parseISO(currentDateISO)));
          } else { 
              scheduledPendingDates.push(getStartOfDay(parseISO(currentDateISO)));
          }
      }
      currentDate = addDaysToDate(currentDate, 1);
      if (differenceInDays(currentDate, earliestModifierDate) > (365 * 3)) { 
          console.warn("Exceeded modifier calculation range");
          break;
      }
    }
    return {
      taken: takenDates,
      missed: missedDates,
      scheduledPending: scheduledPendingDates,
    };
  }, [appData.doses, treatmentStartDate, today]);

  const modifierClassNames = {
    taken: 'rt-taken',
    missed: 'rt-missed',
    scheduledPending: 'rt-scheduled-pending',
    today: 'day_today', 
  };
  
  const getSelectedDayInfo = () => {
    if (!selectedDate) return null;
    if (!today) { 
      return <p className="text-muted-foreground">Cargando información del día...</p>;
    }

    const selectedDateISO = formatDateISO(selectedDate);
    const isTaken = appData.doses[selectedDateISO] === 'taken';
    
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
      // This should be rare now given generateInitialRoaccuTrackData provides a default start date
      return (
         <p className="text-muted-foreground">Configura una fecha de inicio para el tratamiento.</p>
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
      </>
    );
  };

  const calendarDisabledFunction = useMemo(() => {
    return (date: Date): boolean => {
      if (isEditingStartDate) {
        return false; // All days selectable when editing start date
      }
      // If no treatment start date, all days are potentially selectable to set it.
      // However, primary flow for setting initial start date is now via "Edit Start Date" or if it's null.
      // This function mainly gates interaction once a start date IS set.
      if (!treatmentStartDate) {
        return false; 
      }
      if (!today) { 
          return true; 
      }

      const dateToEvaluate = getStartOfDay(date);
      
      // Disable dates before treatment start (unless editing start date)
      if (isBeforeDate(dateToEvaluate, treatmentStartDate)) {
        return true;
      }
      // Disable days that are not pill days according to the schedule
      if (!isPillDay(dateToEvaluate, treatmentStartDate)) {
        return true;
      }
      return false;
    };
  }, [treatmentStartDate, today, isEditingStartDate]);


  const CustomDayContent: React.FC<DayContentProps> = ({ date, displayMonth }) => {
    const isOutside = date.getMonth() !== displayMonth.getMonth();
    let className = "day-content";
  
    if (!isOutside && today && treatmentStartDate) {
      const dateISO = formatDateISO(date);
      if (isPillDay(date, treatmentStartDate)) {
        if (appData.doses[dateISO] === 'taken') {
          // Color handled by rt-taken on button via modifiers
        } else if (isBeforeDate(date, today) && !isSameDay(date, today)) {
          // Color handled by rt-missed on button via modifiers
        } else {
          className += " rt-scheduled-pending"; 
        }
      }
    }
  
    return (
      <div className={className}>
        <span>{date.getDate()}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center">
          <Pill className="h-12 w-12 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold ml-3">Cuándo<span className="text-primary">Tomo</span></h1>
        </div>
        <p className="text-muted-foreground mt-2 text-lg">
            Hola {appData.userName || 'Usuario'}, bienvenido a tu seguimiento de Roacutan.
        </p>
      </header>
      
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
            {today && currentDisplayMonth && treatmentStartDate ? ( 
              <Calendar
                locale={es}
                mode="single"
                selected={selectedDate}
                onSelect={handleDaySelect}
                month={currentDisplayMonth}
                onMonthChange={setCurrentDisplayMonth}
                modifiers={modifiers} 
                modifiersClassNames={modifierClassNames}
                className="rounded-md"
                disabled={calendarDisabledFunction}
                components={{
                  DayContent: CustomDayContent
                }}
                defaultMonth={new Date()} 
                fromDate={addDaysToDate(treatmentStartDate, -365)} 
                toDate={addDaysToDate(today, 365 * 2)} 
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
                {selectedDate ? getSelectedDayInfo() : <p className="text-muted-foreground">Selecciona un día para ver detalles.</p>}
              </CardContent>
            </Card>
          )}
          
          {!isEditingStartDate && treatmentStartDate && (
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => {
                setIsEditingStartDate(true); 
                if (treatmentStartDate) setSelectedDate(treatmentStartDate); 
              }}
            >
              <Edit3 className="mr-2 h-4 w-4" /> Editar Fecha de Inicio del Tratamiento
            </Button>
          )}

          <TreatmentSummary data={appData} />
        </div>
      </div>
    </div>
  );
};

export default RoaccuTrackApp;
