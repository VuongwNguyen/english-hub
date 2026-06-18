import { NextResponse } from 'next/server'
import { syncExternalSources } from '@/server/external/sync-sources'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'External source sync is disabled in production' },
      { status: 403 }
    )
  }

  try {
    const result = await syncExternalSources()
    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to sync external sources' },
      { status: 500 }
    )
  }
}
