export interface DoseEntry {
  status: 'taken';
}

// UserData interface is removed as the form is removed.
// User-specific info like name and age are now part of RoaccuTrackData,
// initialized with defaults or from localStorage.

export interface RoaccuTrackData {
  treatmentStartDate: string | null; // ISO date string 'YYYY-MM-DD'
  doses: Record<string, DoseEntry['status']>; // Key: 'YYYY-MM-DD', Value: 'taken'
  userName: string | null;
  userAge: number | null;
}
