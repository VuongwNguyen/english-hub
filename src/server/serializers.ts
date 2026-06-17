/* eslint-disable @typescript-eslint/no-explicit-any */
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
    status: item.status,
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
  }))

  const doneItems = items.filter((item: any) => item.status === 'done')
  const skippedItems = items.filter((item: any) => item.status === 'skipped')
  const pendingItems = items.filter((item: any) => item.status === 'pending')

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
