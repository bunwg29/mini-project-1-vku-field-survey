export type SurveyCategory =
  | 'Hardware'
  | 'Projector'
  | 'AC'
  | 'Electrical'
  | 'Furniture';

export type SurveySyncStatus = 'PENDING_SYNC' | 'SYNCED';

export interface Survey {
  id: string;
  building: string;
  floor: string;
  room: string;
  category: SurveyCategory;
  conditionRating: number; // 1 to 5 stars
  defectNotes: string;
  photos: string[];
  latitude?: number;
  longitude?: number;
  status: SurveySyncStatus;
  synced: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SurveyDraft {
  building: string;
  floor: string;
  room: string;
  category: SurveyCategory;
  conditionRating: number;
  defectNotes: string;
  photos: string[];
  latitude?: number;
  longitude?: number;
  lastSavedAt: number;
}