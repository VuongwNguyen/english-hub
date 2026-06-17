import { NextResponse } from 'next/server'
import { getHistory } from '@/server/history'

export async function GET() {
  try {
    const history = await getHistory(30)

    return NextResponse.json(history)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to load history',
      },
      { status: 500 }
    )
  }
}
