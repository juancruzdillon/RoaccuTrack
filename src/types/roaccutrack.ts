export interface DoseEntry {
  status: 'taken';
}

export interface UserData {
  name: string;
  age: number | null;
  treatmentStartDate: string | null; // ISO date string 'YYYY-MM-DD'
}

export interface RoaccuTrackData {
  treatmentStartDate: string | null; // ISO date string 'YYYY-MM-DD'
  doses: Record<string, DoseEntry['status']>; // Key: 'YYYY-MM-DD', Value: 'taken'
  userName: string | null;
  userAge: number | null;
}
