/**
 * Shared helpers for interpreting DailyPlanItem completion status.
 *
 * DailyPlanItem.status historically only had three values: 'pending',
 * 'done', 'skipped'. The redesigned learning experience introduces
 * 'in_progress' and renames the completion value to 'completed'
 * ('pending' | 'in_progress' | 'completed' | 'skipped').
 *
 * Documents persisted before this change may still have status: 'done'
 * on disk. isItemDone() is the single source of truth for "is this item
 * complete" so that legacy 'done' values keep behaving exactly like
 * 'completed' everywhere completion is checked (serializers, stats,
 * history, rotation, etc.) without requiring a data migration.
 */

export type LegacyItemStatus = 'pending' | 'done' | 'skipped'

export type ItemStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | LegacyItemStatus

/**
 * Returns true if the given DailyPlanItem status represents a completed
 * item, treating the legacy 'done' value as equivalent to 'completed'.
 */
export function isItemDone(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'done'
}
