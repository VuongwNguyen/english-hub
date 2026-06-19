import type { DailyPlanItemDTO } from '@/types/english'

export const LESSON_TYPE_LABELS: Record<DailyPlanItemDTO['type'], string> = {
  listening: 'Listening',
  vocab: 'Vocabulary',
  speaking: 'Speaking',
  writing: 'Writing',
  dev_english: 'Dev English',
}

/**
 * Sums `activeSeconds` across the given items and converts to whole minutes.
 */
export function computeActiveMinutes(items: DailyPlanItemDTO[]): number {
  const activeSeconds = items.reduce(
    (total, item) => total + (item.activeSeconds ?? 0),
    0,
  )
  return Math.round(activeSeconds / 60)
}
