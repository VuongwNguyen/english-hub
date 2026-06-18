import { NextRequest, NextResponse } from 'next/server'
import { requireAdminKey } from '@/lib/adminAuth'
import { generateLessonsFromCachedData } from '@/server/external/generate-lessons-from-cache'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Lesson generation is disabled in production' },
      { status: 403 }
    )
  }

  const authError = requireAdminKey(request)
  if (authError) return authError

  try {
    const result = await generateLessonsFromCachedData()
    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to generate lessons' },
      { status: 500 }
    )
  }
}
