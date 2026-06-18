import { NextRequest, NextResponse } from 'next/server'
import { requireAdminKey } from '@/lib/adminAuth'
import { syncExternalSources } from '@/server/external/sync-sources'
import { syncWordsFromExternalApis } from '@/server/external/sync-words'
import { syncSentencesFromTatoeba } from '@/server/external/sync-sentences'
import { generateLessonsFromCachedData } from '@/server/external/generate-lessons-from-cache'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Bootstrap is disabled in production' },
      { status: 403 }
    )
  }

  const authError = requireAdminKey(request)
  if (authError) return authError

  try {
    const sources = await syncExternalSources()
    const words = await syncWordsFromExternalApis()
    const sentences = await syncSentencesFromTatoeba()
    const lessons = await generateLessonsFromCachedData()

    return NextResponse.json({
      sources,
      words,
      sentences,
      lessons,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to bootstrap external data' },
      { status: 500 }
    )
  }
}
