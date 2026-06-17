import { NextResponse } from 'next/server'
import { connectMongo } from '@/lib/mongoose'
import { getVietnamTodayDate } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { recalculateDailyStats } from '@/server/stats'
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

    item.status = 'pending'
    item.completedAt = null

    await plan.save()
    await recalculateDailyStats(today)

    const updatedPlan = await DailyPlan.findOne({ date: today })

    return NextResponse.json(serializeDailyPlan(updatedPlan))
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to mark item as pending',
      },
      { status: 500 }
    )
  }
}
