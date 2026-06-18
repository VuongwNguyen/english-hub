import { NextResponse } from 'next/server'
import { connectMongo } from '@/lib/mongoose'
import { Lesson } from '@/models/Lesson'
import { Word } from '@/models/Word'
import { ExampleSentence } from '@/models/ExampleSentence'
import { ExternalSource } from '@/models/ExternalSource'
import { ApiSyncRun } from '@/models/ApiSyncRun'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Data health route is disabled in production' },
      { status: 403 }
    )
  }

  await connectMongo()

  const [
    lessonCount,
    wordCount,
    sentenceCount,
    sourceCount,
    latestSyncRuns,
    lessonTypeCounts,
  ] = await Promise.all([
    Lesson.countDocuments(),
    Word.countDocuments(),
    ExampleSentence.countDocuments(),
    ExternalSource.countDocuments(),
    ApiSyncRun.find({}).sort({ createdAt: -1 }).limit(10).lean(),
    Lesson.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]),
  ])

  return NextResponse.json({
    lessonCount,
    wordCount,
    sentenceCount,
    sourceCount,
    lessonTypeCounts,
    latestSyncRuns,
  })
}
