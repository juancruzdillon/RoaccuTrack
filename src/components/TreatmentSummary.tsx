
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { RoaccuTrackData } from '@/types/roaccutrack';
import { parseISO, differenceInDays, isPillDay, getStartOfDay, addDaysToDate, isBeforeDate, isSameDay, formatDateShort, isTodayDate, isAfterDate, formatDateISO } from '@/lib/date-utils';
import { TrendingUp, CalendarCheck2, Percent, Loader2 } from 'lucide-react';

interface TreatmentSummaryProps {
  data: RoaccuTrackData;
}

const TreatmentSummary: React.FC<TreatmentSummaryProps> = ({ data }) => {
  const { treatmentStartDate: startDateString, doses } = data;

  const [clientTime, setClientTime] = useState<Date | undefined>(undefined);
  useEffect(() => {
    setClientTime(new Date());
  }, []);

  const today = useMemo(() => {
    return clientTime ? getStartOfDay(clientTime) : undefined;
  }, [clientTime]);

  const treatmentStartDate = useMemo(() => startDateString ? parseISO(startDateString) : null, [startDateString]);

  const summaryDetails = useMemo(() => {
    if (!today || !treatmentStartDate) {
      return {
        nextDoseDateString: "Calculando...",
        currentStreak: 0,
        complianceRate: 0,
        isLoading: true,
        totalScheduledDaysPast: 0,
      };
    }

    let nextDoseDateObj: Date | null = null;
    // Start checking from today for the next dose
    let checkFutureDate = today; 
    for (let i = 0; i < 365 * 2; i++) { // Check up to 2 years in future
      const dateToScan = addDaysToDate(checkFutureDate, i);
      // Pass `today` to isPillDay
      if (isPillDay(dateToScan, treatmentStartDate, today)) {
        const dateToScanISO = formatDateISO(dateToScan);
        // If it's a pill day and not already taken (or it's today and not taken)
        if (!doses[dateToScanISO]) {
          nextDoseDateObj = dateToScan;
          break;
        }
        // If it's today, and it IS taken, we still need to find the *next* actual pill day.
        // So, if it's today and taken, loop continues to find nextDoseDateObj after today.
        if (isSameDay(dateToScan, today) && doses[dateToScanISO]) {
           // continue to find next one if today is taken
        } else if (!doses[dateToScanISO]){ // For any other scheduled day not taken
            nextDoseDateObj = dateToScan;
            break;
        }
      }
    }
    const nextDoseDateString = nextDoseDateObj ? formatDateShort(nextDoseDateObj) : "¡Todo al día!";


    let currentStreakValue = 0;
    if (Object.keys(doses).length > 0) {
        let lastConsecutiveTakenDay: Date | null = null;
        
        // Find the latest day at or before today that was scheduled and taken
        for (let i = 0; ; i++) {
            const d = addDaysToDate(today, -i);
            if (isBeforeDate(d, treatmentStartDate)) break;
            // Pass `today` to isPillDay
            if (isPillDay(d, treatmentStartDate, today) && doses[formatDateISO(d)] === 'taken') {
                lastConsecutiveTakenDay = d;
                break; 
            }
            if (isPillDay(d, treatmentStartDate, today) && !(doses[formatDateISO(d)] === 'taken')) {
                 // Scheduled but not taken, streak is 0 unless this day is today and its taken
                 if(isSameDay(d,today) && doses[formatDateISO(d)] === 'taken'){
                    // Handled by finding lastConsecutiveTakenDay above
                 } else {
                    break; // Streak broken before or on this day
                 }
            }
            if (i > 365*2) break; // Safety
        }

        if (lastConsecutiveTakenDay) {
            for (let i = 0; ; i++) {
                const dateToCheck = addDaysToDate(lastConsecutiveTakenDay, -i);
                if (isBeforeDate(dateToCheck, treatmentStartDate)) break;
                // Pass `today` to isPillDay
                if (isPillDay(dateToCheck, treatmentStartDate, today)) {
                    if (doses[formatDateISO(dateToCheck)] === 'taken') {
                        currentStreakValue++;
                    } else {
                        break; // Streak broken
                    }
                }
                if (i > 365*2) break; // Safety
            }
        }
    }


    let complianceRateValue = 0;
    const daysSinceStart = differenceInDays(today, treatmentStartDate);
    let totalScheduledDaysPastValue = 0;
    let totalTakenOnScheduledDays = 0;

    if (daysSinceStart >= 0) {
      for (let i = 0; i <= daysSinceStart; i++) {
        const dateToCheck = addDaysToDate(treatmentStartDate, i);
        // Pass `today` to isPillDay. It will use daily rule for past/today.
        if (isPillDay(dateToCheck, treatmentStartDate, today)) {
          // Only count days up to and including today for past scheduled days
          if (isBeforeDate(dateToCheck, today) || isSameDay(dateToCheck,today)) { 
              totalScheduledDaysPastValue++;
              const dateToCheckISO = formatDateISO(dateToCheck);
              if (doses[dateToCheckISO] === 'taken') {
                  totalTakenOnScheduledDays++;
              }
          }
        }
      }
      if (totalScheduledDaysPastValue > 0) {
        complianceRateValue = Math.round((totalTakenOnScheduledDays / totalScheduledDaysPastValue) * 100);
      } else if (totalScheduledDaysPastValue === 0 && Object.keys(doses).length > 0 ) { 
          // handles case where today is the first day and its taken
          if(isPillDay(today, treatmentStartDate, today) && doses[formatDateISO(today)] === 'taken') {
            complianceRateValue = 100;
            totalScheduledDaysPastValue = 1; 
          }
      }
    }
    
    return {
      nextDoseDateString,
      currentStreak: currentStreakValue,
      complianceRate: complianceRateValue,
      isLoading: false,
      totalScheduledDaysPast: totalScheduledDaysPastValue,
    };

  }, [today, treatmentStartDate, doses]);


  if (!startDateString) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Resumen del Tratamiento</CardTitle>
          <CardDescription>Comienza tu tratamiento para ver tu progreso.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Aún no hay datos.</p>
        </CardContent>
      </Card>
    );
  }
  
  if (summaryDetails.isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-6 w-6 text-primary"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
            Resumen del Tratamiento
          </CardTitle>
          <CardDescription>Tu resumen del tratamiento con Roacutan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
            Cargando resumen...
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const summaryItems = [
    { icon: TrendingUp, label: "Racha Actual", value: `${summaryDetails.currentStreak} día${summaryDetails.currentStreak === 1 ? '' : 's'}` },
    { icon: CalendarCheck2, label: "Próxima Dosis", value: summaryDetails.nextDoseDateString },
    { icon: Percent, label: "Tasa de Cumplimiento", value: `${summaryDetails.totalScheduledDaysPast > 0 ? summaryDetails.complianceRate : '-'}%`, progress: summaryDetails.complianceRate },
  ];

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-6 w-6 text-primary"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
          Resumen del Tratamiento
        </CardTitle>
        <CardDescription>Tu resumen del tratamiento con Roacutan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {summaryItems.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center text-muted-foreground">
                <item.icon className="mr-2 h-5 w-5 text-primary" />
                {item.label}
              </span>
              <span className="font-semibold text-foreground">{item.value}</span>
            </div>
            {item.progress !== undefined && (
              <Progress value={item.progress} aria-label={`${item.label} ${item.value}`} className="h-2 [&>div]:bg-accent" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TreatmentSummary;
