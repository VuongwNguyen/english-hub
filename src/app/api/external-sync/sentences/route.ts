import { NextResponse } from 'next/server'
import { syncSentencesFromTatoeba } from '@/server/external/sync-sentences'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Sentence sync is disabled in production' },
      { status: 403 }
    )
  }

  try {
    const result = await syncSentencesFromTatoeba()
    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to sync sentences' },
      { status: 500 }
    )
  }
}
