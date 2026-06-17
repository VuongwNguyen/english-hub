import { NextRequest, NextResponse } from 'next/server'
import { getDailyStats } from '@/server/stats'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const from = searchParams.get('from') ?? undefined
    const to = searchParams.get('to') ?? undefined

    const stats = await getDailyStats(from, to)

    return NextResponse.json(stats)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to load daily stats',
      },
      { status: 500 }
    )
  }
}
