import { NextRequest, NextResponse } from 'next/server'
import { requireAdminKey } from '@/lib/adminAuth'
import { connectMongo } from '@/lib/mongoose'
import { Lesson } from '@/models/Lesson'
import { Word } from '@/models/Word'
import { ExampleSentence } from '@/models/ExampleSentence'
import { ExternalSource } from '@/models/ExternalSource'
import { ApiSyncRun } from '@/models/ApiSyncRun'
import { SyncTask } from '@/models/SyncTask'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Data health route is disabled in production' },
      { status: 403 }
    )
  }

  const authError = requireAdminKey(request)
  if (authError) return authError

  await connectMongo()

  const [
    lessonCount,
    wordCount,
    sentenceCount,
    sourceCount,
    latestSyncRuns,
    lessonTypeCounts,
    lessonTopicGroupCounts,
    wordTopicCounts,
    wordTopicGroupCounts,
    sentenceTopicCounts,
    sentenceTopicGroupCounts,
    syncTaskStatusCounts,
    syncTaskTypeCounts,
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
    Lesson.aggregate([
      {
        $group: {
          _id: '$topicGroup',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Word.aggregate([
      { $unwind: '$topics' },
      { $group: { _id: '$topics', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Word.aggregate([
      { $unwind: '$topicGroups' },
      { $group: { _id: '$topicGroups', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ExampleSentence.aggregate([
      { $unwind: '$topics' },
      { $group: { _id: '$topics', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    ExampleSentence.aggregate([
      { $unwind: '$topicGroups' },
      { $group: { _id: '$topicGroups', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    SyncTask.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    SyncTask.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
  ])

  return NextResponse.json({
    lessonCount,
    wordCount,
    sentenceCount,
    sourceCount,
    lessonTypeCounts,
    lessonTopicGroupCounts,
    wordTopicCounts,
    wordTopicGroupCounts,
    sentenceTopicCounts,
    sentenceTopicGroupCounts,
    syncTaskStatusCounts,
    syncTaskTypeCounts,
    latestSyncRuns,
  })
}
