/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectMongo } from '@/lib/mongoose'
import { DailyPlan } from '@/models/DailyPlan'
import { isItemDone } from '@/server/learning/progress'

export async function getHistory(limit = 30) {
  await connectMongo()

  const plans = await DailyPlan.find({}).sort({ date: -1 }).limit(limit).lean()

  return plans.map((plan: any) => {
    const items = plan.items ?? []

    const doneItems = items.filter((item: any) => isItemDone(item.status))
    const skippedItems = items.filter((item: any) => item.status === 'skipped')

    return {
      id: plan._id.toString(),
      date: plan.date,
      theme: plan.theme ?? null,
      totalItems: items.length,
      doneItems: doneItems.length,
      skippedItems: skippedItems.length,
      minutesSpent: doneItems.reduce(
        (sum: number, item: any) => sum + (item.estimatedMinutes ?? 0),
        0
      ),
    }
  })
}
