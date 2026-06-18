import { NextRequest, NextResponse } from 'next/server'

export function requireAdminKey(request: NextRequest): NextResponse | null {
  const expectedKey = process.env.ADMIN_SYNC_KEY

  if (!expectedKey) {
    return NextResponse.json(
      { error: 'ADMIN_SYNC_KEY is not configured' },
      { status: 500 }
    )
  }

  const providedKey = request.headers.get('x-admin-key')

  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
