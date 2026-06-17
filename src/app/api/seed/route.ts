import { NextResponse } from 'next/server'
import { seedLessons } from '@/server/seed'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error: 'Seed route is disabled in production',
      },
      { status: 403 }
    )
  }

  try {
    const result = await seedLessons()

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to seed lessons',
      },
      { status: 500 }
    )
  }
}
