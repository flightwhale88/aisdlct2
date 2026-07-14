import { getSingaporeNow } from '@/lib/timezone';
import type { FilterState } from '@/lib/filters';

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
}

const PRESETS_KEY = 'todo-app:filter-presets';

export function loadPresets(): FilterPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FilterPreset[]) : [];
  } catch {
    return [];
  }
}

export function savePreset(preset: FilterPreset): { presets: FilterPreset[]; error: string | null } {
  try {
    const presets = [...loadPresets(), preset];
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    return { presets, error: null };
  } catch {
    return { presets: loadPresets(), error: 'Could not save preset - storage full.' };
  }
}

export function deletePreset(id: string): FilterPreset[] {
  const presets = loadPresets().filter((preset) => preset.id !== id);
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  return presets;
}

export function createPreset(name: string, filters: FilterState): FilterPreset {
  return {
    id: crypto.randomUUID(),
    name,
    filters,
    createdAt: getSingaporeNow().toISOString(),
  };
}
