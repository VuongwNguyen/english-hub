import { NextResponse } from 'next/server'
import { generateLessonsFromCachedData } from '@/server/external/generate-lessons-from-cache'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Lesson generation is disabled in production' },
      { status: 403 }
    )
  }

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
