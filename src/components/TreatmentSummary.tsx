
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { RoaccuTrackData } from '@/types/roaccutrack';
import { parseISO, differenceInDays, isPillDay, getStartOfDay, addDaysToDate, isBeforeDate, isSameDay, formatDateShort, isTodayDate, isAfterDate } from '@/lib/date-utils';
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
  
  if (!today) {
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

  const treatmentStartDate = parseISO(startDateString);

  let nextDoseDate: Date | null = null;
  let currentDate = isBeforeDate(treatmentStartDate, today) || isSameDay(treatmentStartDate, today) ? today : treatmentStartDate;
  
  for (let i = 0; i < 60; i++) { 
    const checkDate = addDaysToDate(currentDate, i);
    if (isPillDay(checkDate, treatmentStartDate)) {
      const checkDateISO = checkDate.toISOString().split('T')[0];
      if (!doses[checkDateISO] || isTodayDate(checkDate)) {
        if (isSameDay(checkDate, today) && doses[checkDateISO]) { 
            continue;
        }
        nextDoseDate = checkDate;
        break;
      }
    }
  }

  let currentStreak = 0;
  if (Object.keys(doses).length > 0) {
    let streakDate = today;
    const doseDays = Object.keys(doses).map(d => parseISO(d)).sort((a,b) => b.getTime() - a.getTime());
    let lastInteractedScheduledDay: Date | null = null;

    for (let i = 0; i <= differenceInDays(today, treatmentStartDate) ; i++) {
        const d = addDaysToDate(treatmentStartDate, i);
        if (isPillDay(d, treatmentStartDate) && (isBeforeDate(d, today) || isSameDay(d, today))) {
            if (!lastInteractedScheduledDay || isAfterDate(d, lastInteractedScheduledDay) ) {
                lastInteractedScheduledDay = d;
            }
        }
         if (i > 365*2) break; 
    }
    
    if(lastInteractedScheduledDay) {
        streakDate = lastInteractedScheduledDay;
        // Iterate backwards from the last interacted scheduled day (or today if it was interacted)
        for (let i = 0; ; i++) {
            const dateToCheck = addDaysToDate(streakDate, -i); // Check every day backwards from streakDate
            
            // Stop if before treatment start or not a pill day according to schedule
            if (isBeforeDate(dateToCheck, treatmentStartDate) || !isPillDay(dateToCheck, treatmentStartDate)) {
                break;
            }
            
            const dateToCheckISO = dateToCheck.toISOString().split('T')[0];
            if (doses[dateToCheckISO] === 'taken') {
                currentStreak++;
            } else {
                // If a pill day was encountered that wasn't taken, the streak breaks
                break; 
            }
            if (i > 365*2) break; // Safety break for very long streaks
        }
    }
  }


  let complianceRate = 0;
  const daysSinceStart = differenceInDays(today, treatmentStartDate);
  let totalScheduledDaysPast = 0;
  let totalTakenOnScheduledDays = 0;

  if (daysSinceStart >= 0) {
    for (let i = 0; i <= daysSinceStart; i++) {
      const dateToCheck = addDaysToDate(treatmentStartDate, i);
      if (isPillDay(dateToCheck, treatmentStartDate)) {
        if (isBeforeDate(dateToCheck, today) || isSameDay(dateToCheck,today)) { 
            totalScheduledDaysPast++;
            const dateToCheckISO = dateToCheck.toISOString().split('T')[0];
            if (doses[dateToCheckISO] === 'taken') {
                totalTakenOnScheduledDays++;
            }
        }
      }
    }
    if (totalScheduledDaysPast > 0) {
      complianceRate = Math.round((totalTakenOnScheduledDays / totalScheduledDaysPast) * 100);
    } else if (Object.keys(doses).length > 0 && totalScheduledDaysPast === 0 && isPillDay(today, treatmentStartDate) && doses[today.toISOString().split('T')[0]] === 'taken') {
      complianceRate = 100;
      totalScheduledDaysPast = 1; 
    }
  }
  
  const summaryItems = [
    { icon: TrendingUp, label: "Racha Actual", value: `${currentStreak} día${currentStreak === 1 ? '' : 's'}` },
    { icon: CalendarCheck2, label: "Próxima Dosis", value: nextDoseDate ? formatDateShort(nextDoseDate) : "¡Todo al día!" },
    { icon: Percent, label: "Tasa de Cumplimiento", value: `${totalScheduledDaysPast > 0 ? complianceRate : '-'}%`, progress: complianceRate },
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
