import { getDB } from './database';
import type { Survey, SurveyDraft, SurveySyncStatus } from '../types/survey';

const DRAFT_KEY = 'active_inspection_draft';

export async function saveSurvey(survey: Survey): Promise<void> {
  const db = await getDB();
  await db.put('surveys', survey);
}

export async function getSurvey(id: string): Promise<Survey | undefined> {
  const db = await getDB();
  return db.get('surveys', id);
}

export async function getAllSurveys(): Promise<Survey[]> {
  const db = await getDB();
  const surveys = await db.getAll('surveys');
  // Return sorted newest first
  return surveys.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSurvey(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('surveys', id);
}

export async function updateSurveyStatus(id: string, status: SurveySyncStatus, synced: boolean): Promise<void> {
  const db = await getDB();
  const survey = await db.get('surveys', id);
  if (survey) {
    survey.status = status;
    survey.synced = synced;
    survey.updatedAt = Date.now();
    await db.put('surveys', survey);
  }
}

export async function saveDraft(draft: SurveyDraft): Promise<void> {
  const db = await getDB();
  await db.put('drafts', {
    key: DRAFT_KEY,
    ...draft,
    lastSavedAt: Date.now(),
  });
}

export async function getDraft(): Promise<SurveyDraft | undefined> {
  const db = await getDB();
  const result = await db.get('drafts', DRAFT_KEY);
  if (!result) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key, ...draft } = result;
  return draft as SurveyDraft;
}

export async function clearDraft(): Promise<void> {
  const db = await getDB();
  await db.delete('drafts', DRAFT_KEY);
}