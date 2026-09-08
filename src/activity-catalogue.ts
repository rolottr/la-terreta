/** Stable task identities. Progress is independent of sites, UI and live poses. */
export const activityCatalogue = [
  { id: 'oranges', name: 'Pick oranges', description: 'Pick three different oranges in the grove.', places: ['turia'], target: 3, unit: '', symbol: '🍊' },
  { id: 'horchata', name: 'Drink an horchata', description: 'Enjoy an eight-second drink at the Serranos café.', places: ['serranos'], target: 8, unit: 's', symbol: '🥛' },
  { id: 'firecracker', name: 'Throw a firecracker', description: 'Throw once and watch the ground pop.', places: ['serranos', 'townhall'], target: 1, unit: '', symbol: '✦' },
  { id: 'rowing', name: 'Row in Albufera', description: 'Row 20 metres. You can continue across trips.', places: ['albufera'], target: 20, unit: 'm', symbol: '🛶' },
  { id: 'band', name: 'March with the band', description: 'Join, then walk beside the band for 10 seconds.', places: ['serranos', 'oldtown', 'townhall'], target: 10, unit: 's', symbol: '♫' },
  { id: 'bike', name: 'Ride a Valenbisi', description: 'Ride 1 kilometre in total. Reverse travel counts too.', places: ['serranos', 'oldtown', 'townhall', 'station', 'bullring', 'science', 'aqua', 'beach', 'university', 'albufera', 'turia'], target: 1000, unit: 'm', symbol: '🚲' },
  { id: 'bull', name: 'Pet the bull', description: 'Stand beside the bull and stroke it for three seconds.', places: ['bullring'], target: 3, unit: 's', symbol: '🐂' },
  { id: 'falla', name: 'Selfie with the Falla', description: 'Save a selfie with you and the Fallas monument in view.', places: ['townhall'], target: 1, unit: '', symbol: '📷' },
] as const;
export type TaskId = typeof activityCatalogue[number]['id'];
export type TaskProgress = Record<TaskId, number>;
export const fruitIds = ['grove-0', 'grove-1', 'grove-2'] as const;
export interface ActivitySave { progress: TaskProgress; picked: string[]; completed: TaskId[]; helped: boolean }
export function normalizeActivities(raw: unknown, memories: readonly string[] = []): ActivitySave {
  const a = raw && typeof raw === 'object' ? raw as Partial<ActivitySave> : {};
  const progress = {} as TaskProgress;
  for (const task of activityCatalogue) {
    const n = a.progress?.[task.id];
    progress[task.id] = typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(task.target, n)) : 0;
  }
  const picked = Array.isArray(a.picked) ? [...new Set(a.picked.filter(id => fruitIds.some(known => known === id)))] : [];
  const completed = activityCatalogue.filter(task => Array.isArray(a.completed) && a.completed.includes(task.id) && (task.id !== 'bike' || progress.bike >= task.target)).map(task => task.id);
  progress.oranges = picked.length;
  if (memories.includes('horchata')) progress.horchata = 8;
  if (memories.includes('procession')) progress.band = 10;
  for (const task of activityCatalogue) if (progress[task.id] >= task.target && !completed.includes(task.id)) completed.push(task.id);
  for (const id of completed) if (id !== 'oranges') progress[id] = activityCatalogue.find(t => t.id === id)!.target;
  return { progress, picked, completed, helped: a.helped === true };
}
/** Returns true once, when a validated gameplay event crosses its target. */
export function addProgress(state: ActivitySave, id: TaskId, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const task = activityCatalogue.find(t => t.id === id)!;
  state.progress[id] = Math.min(task.target, state.progress[id] + amount);
  if (state.progress[id] < task.target || state.completed.includes(id)) return false;
  state.completed.push(id);
  return true;
}
