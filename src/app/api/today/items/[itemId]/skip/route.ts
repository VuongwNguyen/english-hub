/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { connectMongo } from '@/lib/mongoose'
import { getVietnamTodayDate } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { maybeRecordComeback, recalculateDailyStats } from '@/server/stats'
import { serializeDailyPlan } from '@/server/serializers'

export async function POST(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    await connectMongo()

    const { itemId } = await context.params
    const today = getVietnamTodayDate()

    const plan = await DailyPlan.findOne({ date: today })

    if (!plan) {
      return NextResponse.json(
        { error: 'Today plan not found' },
        { status: 404 }
      )
    }

    const item = plan.items.id(itemId)

    if (!item) {
      return NextResponse.json(
        { error: 'Daily plan item not found' },
        { status: 404 }
      )
    }

    const wasInactiveToday = !plan.items.some((i: any) =>
      ['done', 'skipped'].includes(i.status)
    )

    item.status = 'skipped'
    item.completedAt = null

    await plan.save()
    await recalculateDailyStats(today)

    if (wasInactiveToday) {
      await maybeRecordComeback(today)
    }

    const updatedPlan = await DailyPlan.findOne({ date: today })

    return NextResponse.json(serializeDailyPlan(updatedPlan))
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to mark item as skipped',
      },
      { status: 500 }
    )
  }
}
