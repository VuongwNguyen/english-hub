/* eslint-disable @typescript-eslint/no-explicit-any */
import { isItemDone } from '@/server/learning/progress'

export function serializeDailyPlan(plan: any) {
  const items = plan.items.map((item: any) => ({
    id: item._id.toString(),
    lessonId: item.lessonId.toString(),
    type: item.type,
    title: item.title,
    content: item.content,
    sourceUrl: item.sourceUrl ?? null,
    estimatedMinutes: item.estimatedMinutes,
    wordsCount: item.wordsCount,
    speakingMinutes: item.speakingMinutes,
    writingSentences: item.writingSentences,
    // Legacy DailyPlan documents may still have status: 'done' persisted on
    // disk (Mongoose only validates on write, not read). Normalize it to
    // 'completed' here so the DTO's status always conforms to the real
    // ItemStatus union the client expects.
    status: isItemDone(item.status) ? 'completed' : item.status,
    startedAt: item.startedAt ? item.startedAt.toISOString() : null,
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
    skippedAt: item.skippedAt ? item.skippedAt.toISOString() : null,
    activeSeconds: item.activeSeconds ?? 0,
    progressPercent: item.progressPercent ?? 0,
  }))

  const doneItems = items.filter((item: any) => isItemDone(item.status))
  const skippedItems = items.filter((item: any) => item.status === 'skipped')
  const pendingItems = items.filter(
    (item: any) => item.status === 'pending' || item.status === 'in_progress'
  )

  const progress = {
    total: items.length,
    done: doneItems.length,
    skipped: skippedItems.length,
    pending: pendingItems.length,
    minutesSpent: doneItems.reduce(
      (sum: number, item: any) => sum + item.estimatedMinutes,
      0
    ),
    wordsLearned: doneItems.reduce(
      (sum: number, item: any) => sum + item.wordsCount,
      0
    ),
    speakingMinutes: doneItems.reduce(
      (sum: number, item: any) => sum + item.speakingMinutes,
      0
    ),
    writingSentences: doneItems.reduce(
      (sum: number, item: any) => sum + item.writingSentences,
      0
    ),
  }

  return {
    id: plan._id.toString(),
    date: plan.date,
    theme: plan.theme ?? null,
    progress,
    items,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
}
