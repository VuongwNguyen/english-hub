import { NextRequest, NextResponse } from 'next/server'
import { requireAdminKey } from '@/lib/adminAuth'
import { syncWordsFromExternalApis } from '@/server/external/sync-words'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Word sync is disabled in production' },
      { status: 403 }
    )
  }

  const authError = requireAdminKey(request)
  if (authError) return authError

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
