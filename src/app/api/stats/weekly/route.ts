import { NextResponse } from 'next/server'
import { getVietnamTodayDate } from '@/lib/date'
import { getWeeklyStats } from '@/server/stats'

export async function GET() {
  try {
    const today = getVietnamTodayDate()
    const stats = await getWeeklyStats(today)

    return NextResponse.json(stats)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to load weekly stats',
      },
      { status: 500 }
    )
  }
}
