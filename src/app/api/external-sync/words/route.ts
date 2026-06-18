import { NextResponse } from 'next/server'
import { syncWordsFromExternalApis } from '@/server/external/sync-words'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Word sync is disabled in production' },
      { status: 403 }
    )
  }

  try {
    const result = await syncWordsFromExternalApis()
    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to sync words' },
      { status: 500 }
    )
  }
}
