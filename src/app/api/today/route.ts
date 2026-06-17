import { NextResponse } from 'next/server'
import { getVietnamTodayDate } from '@/lib/date'
import { getOrCreateTodayPlan } from '@/server/rotation'
import { serializeDailyPlan } from '@/server/serializers'

export async function GET() {
  try {
    const today = getVietnamTodayDate()
    const plan = await getOrCreateTodayPlan(today)

    return NextResponse.json(serializeDailyPlan(plan))
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to load today plan',
      },
      { status: 500 }
    )
  }
}
