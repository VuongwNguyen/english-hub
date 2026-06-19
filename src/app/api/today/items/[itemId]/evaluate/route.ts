import { NextResponse } from 'next/server'
import {
  evaluateItem,
  EvaluateItemError,
} from '@/server/learning/evaluate-item'
import type { EvaluationInput } from '@/server/learning/evaluation'

export async function POST(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await context.params

    const body = await request.json().catch(() => null)

    const lessonType = body?.lessonType as string | undefined
    const input = body?.input as EvaluationInput | undefined

    const result = await evaluateItem({ itemId, lessonType, input })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof EvaluateItemError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)

    return NextResponse.json(
      { error: 'Failed to evaluate item' },
      { status: 500 }
    )
  }
}
