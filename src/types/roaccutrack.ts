export interface DoseEntry {
  status: 'taken';
}

export interface RoaccuTrackData {
  treatmentStartDate: string | null; // ISO date string 'YYYY-MM-DD'
  doses: Record<string, DoseEntry['status']>; // Key: 'YYYY-MM-DD', Value: 'taken'
}
