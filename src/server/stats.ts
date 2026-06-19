/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectMongo } from '@/lib/mongoose'
import { getCurrentWeekRange, addDaysToDateString } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { DailyStats } from '@/models/DailyStats'
import { isItemDone } from '@/server/learning/progress'

export async function recalculateDailyStats(date: string) {
  await connectMongo()

  const plan = await DailyPlan.findOne({ date })

  if (!plan) {
    return null
  }

  const items = plan.items ?? []

  const doneItems = items.filter((item: any) => isItemDone(item.status))
  const skippedItems = items.filter((item: any) => item.status === 'skipped')
  const pendingItems = items.filter(
    (item: any) => item.status === 'pending' || item.status === 'in_progress'
  )

  const minutesSpent = doneItems.reduce(
    (sum: number, item: any) => sum + (item.estimatedMinutes ?? 0),
    0
  )

  const wordsLearned = doneItems.reduce(
    (sum: number, item: any) => sum + (item.wordsCount ?? 0),
    0
  )

  const speakingMinutes = doneItems.reduce(
    (sum: number, item: any) => sum + (item.speakingMinutes ?? 0),
    0
  )

  const writingSentences = doneItems.reduce(
    (sum: number, item: any) => sum + (item.writingSentences ?? 0),
    0
  )

  return DailyStats.findOneAndUpdate(
    { date },
    {
      $set: {
        totalItems: items.length,
        doneItems: doneItems.length,
        skippedItems: skippedItems.length,
        pendingItems: pendingItems.length,
        minutesSpent,
        wordsLearned,
        speakingMinutes,
        writingSentences,
      },
    },
    {
      upsert: true,
      new: true,
    }
  )
}

export async function getDailyStats(from?: string, to?: string) {
  await connectMongo()

  const query: Record<string, any> = {}

  if (from || to) {
    query.date = {}

    if (from) query.date.$gte = from
    if (to) query.date.$lte = to
  }

  return DailyStats.find(query).sort({ date: 1 }).lean()
}

export async function getWeeklyStats(today: string) {
  await connectMongo()

  const range = getCurrentWeekRange(today)

  const stats = await DailyStats.find({
    date: {
      $gte: range.from,
      $lte: range.to,
    },
  }).lean()

  const activeDays = stats.filter((day) => day.doneItems > 0).length

  return {
    from: range.from,
    to: range.to,
    activeDays,
    totalMinutes: stats.reduce((sum, day) => sum + (day.minutesSpent ?? 0), 0),
    completedLessons: stats.reduce((sum, day) => sum + (day.doneItems ?? 0), 0),
    skippedLessons: stats.reduce((sum, day) => sum + (day.skippedItems ?? 0), 0),
    wordsLearned: stats.reduce((sum, day) => sum + (day.wordsLearned ?? 0), 0),
    speakingMinutes: stats.reduce(
      (sum, day) => sum + (day.speakingMinutes ?? 0),
      0
    ),
    writingSentences: stats.reduce(
      (sum, day) => sum + (day.writingSentences ?? 0),
      0
    ),
    comebackCount: stats.reduce((sum, day) => sum + (day.comeback ?? 0), 0),
  }
}

export async function maybeRecordComeback(today: string) {
  await connectMongo()

  const todayStats = await DailyStats.findOne({ date: today })

  if (todayStats?.comeback > 0) {
    return todayStats
  }

  const previousActiveDay = await DailyStats.findOne({
    date: { $lt: today },
    $or: [{ doneItems: { $gt: 0 } }, { skippedItems: { $gt: 0 } }],
  })
    .sort({ date: -1 })
    .lean()

  if (!previousActiveDay) {
    return todayStats
  }

  const yesterday = addDaysToDateString(today, -1)

  if (previousActiveDay.date < yesterday) {
    return DailyStats.findOneAndUpdate(
      { date: today },
      { $inc: { comeback: 1 } },
      { new: true, upsert: true }
    )
  }

  return todayStats
}
