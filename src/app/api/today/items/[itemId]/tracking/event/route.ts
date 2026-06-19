import { NextResponse } from 'next/server'
import {
  processTrackingEvent,
  TrackingError,
  VALID_EVENT_TYPES,
  type TrackingEventPayload,
  type TrackingEventType,
} from '@/server/learning/tracking'

export async function POST(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await context.params

    const body = await request.json().catch(() => null)

    const eventType = body?.eventType as TrackingEventType | undefined

    if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { error: 'Invalid or missing eventType' },
        { status: 400 }
      )
    }

    const payload = body?.payload as TrackingEventPayload | undefined

    const result = await processTrackingEvent({
      itemId,
      eventType,
      payload,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof TrackingError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)

    return NextResponse.json(
      { error: 'Failed to process tracking event' },
      { status: 500 }
    )
  }
}
