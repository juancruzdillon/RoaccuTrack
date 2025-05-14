import type React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { RoaccuTrackData } from '@/types/roaccutrack';
import { parseISO, differenceInDays, isPillDay, getStartOfDay, addDaysToDate, isBeforeDate, isSameDay, formatDateShort, isTodayDate, isAfterDate } from '@/lib/date-utils';
import { TrendingUp, CalendarCheck2, Percent } from 'lucide-react';

interface TreatmentSummaryProps {
  data: RoaccuTrackData;
}

const TreatmentSummary: React.FC<TreatmentSummaryProps> = ({ data }) => {
  const { treatmentStartDate: startDateString, doses } = data;
  const today = getStartOfDay(new Date());

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

  const treatmentStartDate = parseISO(startDateString);

  // Calculate Next Dose Day
  let nextDoseDate: Date | null = null;
  let currentDate = isBeforeDate(treatmentStartDate, today) || isSameDay(treatmentStartDate, today) ? today : treatmentStartDate;
  
  for (let i = 0; i < 60; i++) { // Check up to 60 days ahead
    const checkDate = addDaysToDate(currentDate, i);
    if (isPillDay(checkDate, treatmentStartDate)) {
      const checkDateISO = checkDate.toISOString().split('T')[0];
      if (!doses[checkDateISO] || isTodayDate(checkDate)) {
         // if it's today and not taken OR any future scheduled day
        if (isSameDay(checkDate, today) && doses[checkDateISO]) { // if today and taken, look for next
            continue;
        }
        nextDoseDate = checkDate;
        break;
      }
    }
  }


  // Calculate Current Streak
  let currentStreak = 0;
  if (Object.keys(doses).length > 0) {
    let streakDate = today;
    // Find the latest day a pill was potentially taken or missed (up to today)
    const doseDays = Object.keys(doses).map(d => parseISO(d)).sort((a,b) => b.getTime() - a.getTime());
    let lastInteractedScheduledDay: Date | null = null;

    // Find the most recent scheduled day up to today
    for (let i = 0; i <= differenceInDays(today, treatmentStartDate) ; i++) {
        const d = addDaysToDate(treatmentStartDate, i);
        if (isPillDay(d, treatmentStartDate) && (isBeforeDate(d, today) || isSameDay(d, today))) {
            if (!lastInteractedScheduledDay || isAfterDate(d, lastInteractedScheduledDay) ) {
                lastInteractedScheduledDay = d;
            }
        }
         if (i > 365*2) break; // Safety break for very long treatments
    }
    
    if(lastInteractedScheduledDay) {
        streakDate = lastInteractedScheduledDay;
        for (let i = 0; ; i++) {
            const dateToCheck = addDaysToDate(streakDate, -i * 2); // Check every other day backwards
            if (isBeforeDate(dateToCheck, treatmentStartDate) || !isPillDay(dateToCheck, treatmentStartDate)) {
                break;
            }
            const dateToCheckISO = dateToCheck.toISOString().split('T')[0];
            if (doses[dateToCheckISO] === 'taken') {
                currentStreak++;
            } else {
                break;
            }
             if (i > 365) break; // Safety break
        }
    }
  }


  // Calculate Compliance Rate
  let complianceRate = 0;
  const daysSinceStart = differenceInDays(today, treatmentStartDate);
  let totalScheduledDaysPast = 0;
  let totalTakenOnScheduledDays = 0;

  if (daysSinceStart >= 0) {
    for (let i = 0; i <= daysSinceStart; i++) {
      const dateToCheck = addDaysToDate(treatmentStartDate, i);
      if (isPillDay(dateToCheck, treatmentStartDate)) {
        if (isBeforeDate(dateToCheck, today) || isSameDay(dateToCheck,today)) { // Only count past or today's scheduled days
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
      // Special case: treatment started today and pill taken today
      complianceRate = 100;
      totalScheduledDaysPast = 1; // to avoid NaN display if only today is scheduled
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
