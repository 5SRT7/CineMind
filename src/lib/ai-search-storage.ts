import type { AiSearchResult, MovieSummary } from "./types";

const STORAGE_KEY = "cinemind_ai_search_state";

export type AiSearchPersistedState = {
  pickerQuery: string;
  searchResults: MovieSummary[];
  selected: MovieSummary[];
  filterGenres: string[];
  yearMin: number | null;
  yearMax: number | null;
  languages: string[];
  certifications: string[];
  notes: string;
  result: AiSearchResult | null;
};

export function loadAiSearchState(): AiSearchPersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AiSearchPersistedState;
  } catch {
    return null;
  }
}

export function saveAiSearchState(state: AiSearchPersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota or serialization failure should not break the page.
  }
}
