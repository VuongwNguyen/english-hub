# English Daily Hub — Full Implementation Guide for AI Agent

## 0. Role & Mission

You are an AI coding agent implementing a full MVP for **English Daily Hub**.

English Daily Hub is a calm daily English learning web app. It generates a small daily learning plan, rotates content every day, tracks daily/weekly stats, and avoids toxic streak mechanics.

The app must be implemented as a fullstack web app using:

```text
Next.js App Router
TypeScript
MongoDB
Mongoose
Tailwind CSS
yarn
```

Do not use Prisma.
Do not use SQLite.
Do not use Express.
Do not implement toxic streak mechanics.

---

# 1. Product Goal

Build a daily English learning app for a busy developer who wants to learn English every day without using Duolingo or toxic streak-based apps.

The app should feel calm, useful, and forgiving.

Core product idea:

```text
Every day, the app creates a small English learning plan.
The user can complete or skip items.
The app tracks progress and stats.
The app never punishes the user for missing a day.
```

Product philosophy:

```text
Learn English like watering a plant.
Do not learn English like paying a debt.
```

---

# 2. Core MVP Features

The MVP must include:

```text
1. Daily lesson rotation
2. Today’s learning plan
3. Done / Skip per item
4. Daily stats
5. Weekly stats
6. History page
7. MongoDB persistence
8. Seed data with at least 100 lessons
9. Calm UI with no toxic streak copy
```

---

# 3. Non-Negotiable Product Rules

## 3.1. No toxic streaks

Do not use wording like:

```text
You lost your streak!
You failed today!
Your streak is broken!
You missed your lesson!
```

Use positive comeback language instead:

```text
Welcome back.
Comeback +1.
Rest is allowed.
You can continue today.
No angry owl here.
```

## 3.2. Skip is allowed

Each daily item can be:

```text
pending
done
skipped
```

Skipping is not failure. It is simply recorded.

## 3.3. Daily plan must be small

Each daily plan must contain exactly 5 learning items:

```text
1 listening
1 vocab
1 speaking
1 writing
1 dev_english
```

Target study time:

```text
20–30 minutes per day
```

## 3.4. Daily content must rotate

Avoid repeating the same lesson within the last 7 days.

If there are not enough unused lessons, fallback gracefully and reuse older lessons.

## 3.5. Daily plan should be stable

Calling:

```http
GET /api/today
```

multiple times on the same date must return the same daily plan, not regenerate a new one.

---

# 4. Tech Stack

Use:

```text
Next.js App Router
TypeScript
MongoDB
Mongoose
Tailwind CSS
yarn
```

Do not use:

```text
Prisma
SQLite
Express
Supabase
PostgreSQL
Firebase
```

MVP should run locally and be deployable to a VPS later.

---

# 5. Project Setup

Create a Next.js project:

```bash
pnpm create next-app@latest english-daily-hub --yes
cd english-daily-hub
```

Install dependencies:

```bash
pnpm add mongoose zod
pnpm add -D tsx
```

Use Tailwind from the Next.js setup.

---

# 6. Environment Variables

Create:

```text
.env.local
```

Content:

```env
MONGODB_URI="mongodb://127.0.0.1:27017/english_daily_hub"
```

Use `127.0.0.1`, not `localhost`, to avoid local IPv6 resolution issues.

---

# 7. Local MongoDB with Docker

Add this file:

```text
docker-compose.yml
```

Content:

```yaml
services:
  mongo:
    image: mongo:latest
    container_name: english-daily-hub-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - english_daily_hub_mongo_data:/data/db

volumes:
  english_daily_hub_mongo_data:
```

Run:

```bash
docker compose up -d
```

---

# 8. Folder Structure

Implement this structure:

```text
english-daily-hub/
  docker-compose.yml
  package.json
  .env.local

  src/
    app/
      layout.tsx
      page.tsx

      today/
        page.tsx

      stats/
        page.tsx

      history/
        page.tsx

      api/
        today/
          route.ts

        today/
          items/
            [itemId]/
              done/
                route.ts
              skip/
                route.ts
              pending/
                route.ts

        stats/
          daily/
            route.ts
          weekly/
            route.ts

        history/
          route.ts

        seed/
          route.ts

    components/
      AppShell.tsx
      NavBar.tsx
      ProgressCard.tsx
      LessonCard.tsx
      StatsCard.tsx
      HistoryList.tsx
      EmptyState.tsx
      LoadingState.tsx

    lib/
      mongoose.ts
      api.ts
      date.ts

    models/
      Lesson.ts
      DailyPlan.ts
      DailyStats.ts

    server/
      rotation.ts
      stats.ts
      history.ts
      seed.ts
      serializers.ts

    types/
      english.ts
      mongoose.d.ts
```

---

# 9. TypeScript Domain Types

Create:

```text
src/types/english.ts
```

Content:

```ts
export const LESSON_TYPES = [
  'listening',
  'vocab',
  'speaking',
  'writing',
  'dev_english',
] as const

export type LessonType = (typeof LESSON_TYPES)[number]

export const LESSON_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

export type LessonLevel = (typeof LESSON_LEVELS)[number]

export const ITEM_STATUSES = ['pending', 'done', 'skipped'] as const

export type ItemStatus = (typeof ITEM_STATUSES)[number]

export type TodayProgress = {
  total: number
  done: number
  skipped: number
  pending: number
  minutesSpent: number
  wordsLearned: number
  speakingMinutes: number
  writingSentences: number
}

export type DailyPlanItemDTO = {
  id: string
  lessonId: string
  type: LessonType
  title: string
  content: string
  sourceUrl?: string | null
  estimatedMinutes: number
  wordsCount: number
  speakingMinutes: number
  writingSentences: number
  status: ItemStatus
  completedAt?: string | null
}

export type DailyPlanDTO = {
  id: string
  date: string
  theme?: string | null
  progress: TodayProgress
  items: DailyPlanItemDTO[]
  createdAt: string
  updatedAt: string
}
```

---

# 10. Date Handling

The app should use Vietnam local date for daily rotation.

Create:

```text
src/lib/date.ts
```

Content:

```ts
export function getVietnamTodayDate(input: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(input)
}

export function addDaysToDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00+07:00`)
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getDateRangeForLastDays(today: string, days: number) {
  return {
    from: addDaysToDateString(today, -days),
    to: today,
  }
}

export function getCurrentWeekRange(today: string) {
  const current = new Date(`${today}T00:00:00+07:00`)
  const day = current.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const monday = new Date(current)
  monday.setDate(current.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  function format(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return {
    from: format(monday),
    to: format(sunday),
  }
}
```

---

# 11. MongoDB Connection

Create:

```text
src/lib/mongoose.ts
```

Content:

```ts
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI')
}

type CachedMongoose = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseCache?: CachedMongoose
}

let cached = globalWithMongoose.mongooseCache

if (!cached) {
  cached = globalWithMongoose.mongooseCache = {
    conn: null,
    promise: null,
  }
}

export async function connectMongo() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongooseInstance) => {
      return mongooseInstance
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}
```

Create:

```text
src/types/mongoose.d.ts
```

Content:

```ts
import type mongoose from 'mongoose'

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache:
    | {
        conn: typeof mongoose | null
        promise: Promise<typeof mongoose> | null
      }
    | undefined
}

export {}
```

---

# 12. MongoDB Data Design

Use 3 collections:

```text
lessons
dailyplans
dailystats
```

Important design decision:

```text
DailyPlan.items must embed a snapshot of lesson fields.
```

Why:

If a lesson is edited later, past daily plans should still show the exact lesson content that was assigned that day.

Each item should keep:

```text
lessonId reference
title snapshot
content snapshot
type snapshot
sourceUrl snapshot
estimatedMinutes snapshot
wordsCount snapshot
speakingMinutes snapshot
writingSentences snapshot
```

---

# 13. Mongoose Models

## 13.1. Lesson Model

Create:

```text
src/models/Lesson.ts
```

Content:

```ts
import { Schema, model, models } from 'mongoose'

const LessonSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2'],
      default: 'A2',
    },
    type: {
      type: String,
      required: true,
      enum: ['listening', 'vocab', 'speaking', 'writing', 'dev_english'],
    },
    content: {
      type: String,
      required: true,
    },
    sourceUrl: {
      type: String,
      default: null,
    },
    estimatedMinutes: {
      type: Number,
      default: 5,
      min: 1,
    },
    wordsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    speakingMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    writingSentences: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

LessonSchema.index({ type: 1, isActive: 1 })
LessonSchema.index({ topic: 1 })
LessonSchema.index({ createdAt: -1 })

export const Lesson = models.Lesson || model('Lesson', LessonSchema)
```

---

## 13.2. DailyPlan Model

Create:

```text
src/models/DailyPlan.ts
```

Content:

```ts
import { Schema, model, models } from 'mongoose'

const DailyPlanItemSchema = new Schema(
  {
    lessonId: {
      type: Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['listening', 'vocab', 'speaking', 'writing', 'dev_english'],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    sourceUrl: {
      type: String,
      default: null,
    },
    estimatedMinutes: {
      type: Number,
      default: 5,
      min: 1,
    },
    wordsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    speakingMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    writingSentences: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'done', 'skipped'],
      default: 'pending',
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  }
)

const DailyPlanSchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    theme: {
      type: String,
      default: null,
    },
    items: {
      type: [DailyPlanItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

DailyPlanSchema.index({ date: 1 }, { unique: true })

export const DailyPlan =
  models.DailyPlan || model('DailyPlan', DailyPlanSchema)
```

---

## 13.3. DailyStats Model

Create:

```text
src/models/DailyStats.ts
```

Content:

```ts
import { Schema, model, models } from 'mongoose'

const DailyStatsSchema = new Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    totalItems: {
      type: Number,
      default: 0,
    },
    doneItems: {
      type: Number,
      default: 0,
    },
    skippedItems: {
      type: Number,
      default: 0,
    },
    pendingItems: {
      type: Number,
      default: 0,
    },
    minutesSpent: {
      type: Number,
      default: 0,
    },
    wordsLearned: {
      type: Number,
      default: 0,
    },
    speakingMinutes: {
      type: Number,
      default: 0,
    },
    writingSentences: {
      type: Number,
      default: 0,
    },
    comeback: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
)

DailyStatsSchema.index({ date: 1 }, { unique: true })

export const DailyStats =
  models.DailyStats || model('DailyStats', DailyStatsSchema)
```

---

# 14. Serialization

Create:

```text
src/server/serializers.ts
```

Content:

```ts
export function serializeDailyPlan(plan: any) {
  const items = plan.items.map((item: any) => ({
    id: item._id.toString(),
    lessonId: item.lessonId.toString(),
    type: item.type,
    title: item.title,
    content: item.content,
    sourceUrl: item.sourceUrl ?? null,
    estimatedMinutes: item.estimatedMinutes,
    wordsCount: item.wordsCount,
    speakingMinutes: item.speakingMinutes,
    writingSentences: item.writingSentences,
    status: item.status,
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
  }))

  const doneItems = items.filter((item: any) => item.status === 'done')
  const skippedItems = items.filter((item: any) => item.status === 'skipped')
  const pendingItems = items.filter((item: any) => item.status === 'pending')

  const progress = {
    total: items.length,
    done: doneItems.length,
    skipped: skippedItems.length,
    pending: pendingItems.length,
    minutesSpent: doneItems.reduce(
      (sum: number, item: any) => sum + item.estimatedMinutes,
      0
    ),
    wordsLearned: doneItems.reduce(
      (sum: number, item: any) => sum + item.wordsCount,
      0
    ),
    speakingMinutes: doneItems.reduce(
      (sum: number, item: any) => sum + item.speakingMinutes,
      0
    ),
    writingSentences: doneItems.reduce(
      (sum: number, item: any) => sum + item.writingSentences,
      0
    ),
  }

  return {
    id: plan._id.toString(),
    date: plan.date,
    theme: plan.theme ?? null,
    progress,
    items,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
}
```

---

# 15. Daily Rotation Logic

Create:

```text
src/server/rotation.ts
```

Responsibilities:

```text
1. Get today's plan if it exists.
2. Generate today's plan if missing.
3. Pick 5 lessons.
4. Avoid lessons used in the last 7 days.
5. Snapshot lesson fields into daily plan items.
```

Content:

```ts
import { connectMongo } from '@/lib/mongoose'
import { getDateRangeForLastDays } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { Lesson } from '@/models/Lesson'
import { recalculateDailyStats } from '@/server/stats'

const DAILY_TYPES = [
  'listening',
  'vocab',
  'speaking',
  'writing',
  'dev_english',
] as const

async function getRecentLessonIds(today: string, days = 7) {
  const range = getDateRangeForLastDays(today, days)

  const recentPlans = await DailyPlan.find({
    date: {
      $gte: range.from,
      $lt: today,
    },
  }).lean()

  const ids = new Set<string>()

  for (const plan of recentPlans) {
    for (const item of plan.items ?? []) {
      if (item.lessonId) {
        ids.add(item.lessonId.toString())
      }
    }
  }

  return Array.from(ids)
}

async function pickLesson(type: string, excludeIds: string[]) {
  const excludeObjectIds = excludeIds

  const freshCandidates = await Lesson.aggregate([
    {
      $match: {
        type,
        isActive: true,
        _id: {
          $nin: excludeObjectIds.map((id) => {
            const mongoose = require('mongoose')
            return new mongoose.Types.ObjectId(id)
          }),
        },
      },
    },
    { $sample: { size: 1 } },
  ])

  if (freshCandidates[0]) {
    return freshCandidates[0]
  }

  const fallbackCandidates = await Lesson.aggregate([
    {
      $match: {
        type,
        isActive: true,
      },
    },
    { $sample: { size: 1 } },
  ])

  if (!fallbackCandidates[0]) {
    throw new Error(`No active lesson found for type: ${type}`)
  }

  return fallbackCandidates[0]
}

function snapshotLesson(lesson: any) {
  return {
    lessonId: lesson._id,
    type: lesson.type,
    title: lesson.title,
    content: lesson.content,
    sourceUrl: lesson.sourceUrl ?? null,
    estimatedMinutes: lesson.estimatedMinutes ?? 5,
    wordsCount: lesson.wordsCount ?? 0,
    speakingMinutes: lesson.speakingMinutes ?? 0,
    writingSentences: lesson.writingSentences ?? 0,
    status: 'pending',
    completedAt: null,
  }
}

function pickThemeFromLessons(lessons: any[]) {
  const topicCount = new Map<string, number>()

  for (const lesson of lessons) {
    const topic = lesson.topic || 'Daily English'
    topicCount.set(topic, (topicCount.get(topic) || 0) + 1)
  }

  const sorted = Array.from(topicCount.entries()).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? 'Daily English'
}

export async function getOrCreateTodayPlan(date: string) {
  await connectMongo()

  const existingPlan = await DailyPlan.findOne({ date })

  if (existingPlan) {
    return existingPlan
  }

  const recentLessonIds = await getRecentLessonIds(date, 7)

  const selectedLessons = []

  for (const type of DAILY_TYPES) {
    const lesson = await pickLesson(type, recentLessonIds)
    selectedLessons.push(lesson)
  }

  const theme = pickThemeFromLessons(selectedLessons)

  try {
    const plan = await DailyPlan.create({
      date,
      theme,
      items: selectedLessons.map(snapshotLesson),
    })

    await recalculateDailyStats(date)

    return plan
  } catch (error: any) {
    if (error.code === 11000) {
      const plan = await DailyPlan.findOne({ date })
      if (plan) return plan
    }

    throw error
  }
}
```

Important improvement:

Avoid `require('mongoose')` inside `pickLesson` if possible. Prefer importing `Types` from mongoose:

```ts
import { Types } from 'mongoose'
```

Then convert:

```ts
excludeIds.map((id) => new Types.ObjectId(id))
```

Use clean TypeScript if possible.

---

# 16. Stats Logic

Create:

```text
src/server/stats.ts
```

Responsibilities:

```text
1. Recalculate daily stats from daily plan items.
2. Do not increment manually when possible.
3. Make stats derived from source of truth.
4. Provide weekly aggregate stats.
5. Track comeback count.
```

Definition:

```text
DailyPlan is source of truth.
DailyStats is derived summary.
```

Content:

```ts
import { connectMongo } from '@/lib/mongoose'
import { getCurrentWeekRange } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { DailyStats } from '@/models/DailyStats'

export async function recalculateDailyStats(date: string) {
  await connectMongo()

  const plan = await DailyPlan.findOne({ date })

  if (!plan) {
    return null
  }

  const items = plan.items ?? []

  const doneItems = items.filter((item: any) => item.status === 'done')
  const skippedItems = items.filter((item: any) => item.status === 'skipped')
  const pendingItems = items.filter((item: any) => item.status === 'pending')

  const minutesSpent = doneItems.reduce(
    (sum: number, item: any) => sum + (item.estimatedMinutes ?? 0),
    0
  )

  const wordsLearned = doneItems.reduce(
    (sum: number, item: any) => sum + (item.wordsCount ?? 0),
    0
  )

  const speakingMinutes = doneItems.reduce(
    (sum: number, item: any) => sum + (item.speakingMinutes ?? 0),
    0
  )

  const writingSentences = doneItems.reduce(
    (sum: number, item: any) => sum + (item.writingSentences ?? 0),
    0
  )

  return DailyStats.findOneAndUpdate(
    { date },
    {
      $set: {
        totalItems: items.length,
        doneItems: doneItems.length,
        skippedItems: skippedItems.length,
        pendingItems: pendingItems.length,
        minutesSpent,
        wordsLearned,
        speakingMinutes,
        writingSentences,
      },
    },
    {
      upsert: true,
      new: true,
    }
  )
}

export async function getDailyStats(from?: string, to?: string) {
  await connectMongo()

  const query: Record<string, any> = {}

  if (from || to) {
    query.date = {}

    if (from) query.date.$gte = from
    if (to) query.date.$lte = to
  }

  return DailyStats.find(query).sort({ date: 1 }).lean()
}

export async function getWeeklyStats(today: string) {
  await connectMongo()

  const range = getCurrentWeekRange(today)

  const stats = await DailyStats.find({
    date: {
      $gte: range.from,
      $lte: range.to,
    },
  }).lean()

  const activeDays = stats.filter((day) => day.doneItems > 0).length

  return {
    from: range.from,
    to: range.to,
    activeDays,
    totalMinutes: stats.reduce((sum, day) => sum + (day.minutesSpent ?? 0), 0),
    completedLessons: stats.reduce((sum, day) => sum + (day.doneItems ?? 0), 0),
    skippedLessons: stats.reduce((sum, day) => sum + (day.skippedItems ?? 0), 0),
    wordsLearned: stats.reduce((sum, day) => sum + (day.wordsLearned ?? 0), 0),
    speakingMinutes: stats.reduce(
      (sum, day) => sum + (day.speakingMinutes ?? 0),
      0
    ),
    writingSentences: stats.reduce(
      (sum, day) => sum + (day.writingSentences ?? 0),
      0
    ),
    comebackCount: stats.reduce((sum, day) => sum + (day.comeback ?? 0), 0),
  }
}
```

---

# 17. Comeback Logic

Implement comeback in a simple way.

Definition:

```text
A comeback happens when the user marks an item done or skipped today
and the previous active day was more than 1 day before today.
```

Active day means:

```text
doneItems > 0 OR skippedItems > 0
```

Example:

```text
Last active day: 2026-06-10
Today: 2026-06-12
=> comeback +1 for 2026-06-12
```

Create helper in:

```text
src/server/stats.ts
```

```ts
import { addDaysToDateString } from '@/lib/date'

export async function maybeRecordComeback(today: string) {
  await connectMongo()

  const todayStats = await DailyStats.findOne({ date: today })

  if (todayStats?.comeback > 0) {
    return todayStats
  }

  const previousActiveDay = await DailyStats.findOne({
    date: { $lt: today },
    $or: [{ doneItems: { $gt: 0 } }, { skippedItems: { $gt: 0 } }],
  })
    .sort({ date: -1 })
    .lean()

  if (!previousActiveDay) {
    return todayStats
  }

  const yesterday = addDaysToDateString(today, -1)

  if (previousActiveDay.date < yesterday) {
    return DailyStats.findOneAndUpdate(
      { date: today },
      { $inc: { comeback: 1 } },
      { new: true, upsert: true }
    )
  }

  return todayStats
}
```

Call `maybeRecordComeback(today)` after first user action of the day.

Important:

Do not count comeback just because the user opens the app. Count it when the user interacts with the lesson.

---

# 18. API Routes

All API routes must return JSON.

Use consistent error shape:

```json
{
  "error": "Human readable error message"
}
```

---

## 18.1. GET /api/today

File:

```text
src/app/api/today/route.ts
```

Behavior:

```text
1. Get Vietnam today date.
2. Get or create today's plan.
3. Serialize response.
```

Content:

```ts
import { NextResponse } from 'next/server'
import { getVietnamTodayDate } from '@/lib/date'
import { getOrCreateTodayPlan } from '@/server/rotation'
import { serializeDailyPlan } from '@/server/serializers'

export async function GET() {
  try {
    const today = getVietnamTodayDate()
    const plan = await getOrCreateTodayPlan(today)

    return NextResponse.json(serializeDailyPlan(plan))
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to load today plan',
      },
      { status: 500 }
    )
  }
}
```

---

## 18.2. POST /api/today/items/[itemId]/done

File:

```text
src/app/api/today/items/[itemId]/done/route.ts
```

Behavior:

```text
1. Get today date.
2. Find today plan.
3. Find item by subdocument _id.
4. Set status = done.
5. Set completedAt = now.
6. Save.
7. Recalculate stats.
8. Maybe record comeback.
9. Return updated plan.
```

Implementation:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { connectMongo } from '@/lib/mongoose'
import { getVietnamTodayDate } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import {
  maybeRecordComeback,
  recalculateDailyStats,
} from '@/server/stats'
import { serializeDailyPlan } from '@/server/serializers'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    await connectMongo()

    const { itemId } = await context.params
    const today = getVietnamTodayDate()

    const plan = await DailyPlan.findOne({ date: today })

    if (!plan) {
      return NextResponse.json(
        { error: 'Today plan not found' },
        { status: 404 }
      )
    }

    const item = plan.items.id(itemId)

    if (!item) {
      return NextResponse.json(
        { error: 'Daily plan item not found' },
        { status: 404 }
      )
    }

    const wasInactiveToday = !plan.items.some((i: any) =>
      ['done', 'skipped'].includes(i.status)
    )

    item.status = 'done'
    item.completedAt = new Date()

    await plan.save()
    await recalculateDailyStats(today)

    if (wasInactiveToday) {
      await maybeRecordComeback(today)
    }

    const updatedPlan = await DailyPlan.findOne({ date: today })

    return NextResponse.json(serializeDailyPlan(updatedPlan))
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to mark item as done',
      },
      { status: 500 }
    )
  }
}
```

Check Next.js version. If route context params are not Promise in the installed version, use:

```ts
context: { params: { itemId: string } }
```

and:

```ts
const { itemId } = context.params
```

Use the style that matches the installed Next.js version.

---

## 18.3. POST /api/today/items/[itemId]/skip

File:

```text
src/app/api/today/items/[itemId]/skip/route.ts
```

Same as done route, except:

```ts
item.status = 'skipped'
item.completedAt = null
```

Return updated plan.

---

## 18.4. POST /api/today/items/[itemId]/pending

File:

```text
src/app/api/today/items/[itemId]/pending/route.ts
```

Purpose:

Allow undo.

Behavior:

```text
1. Set item status back to pending.
2. Set completedAt = null.
3. Recalculate stats.
4. Return updated plan.
```

This route is useful if the user accidentally clicks Done or Skip.

---

## 18.5. GET /api/stats/daily

File:

```text
src/app/api/stats/daily/route.ts
```

Query params:

```text
from
to
```

Example:

```http
GET /api/stats/daily?from=2026-06-01&to=2026-06-17
```

Implementation:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getDailyStats } from '@/server/stats'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const from = searchParams.get('from') ?? undefined
    const to = searchParams.get('to') ?? undefined

    const stats = await getDailyStats(from, to)

    return NextResponse.json(stats)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to load daily stats',
      },
      { status: 500 }
    )
  }
}
```

---

## 18.6. GET /api/stats/weekly

File:

```text
src/app/api/stats/weekly/route.ts
```

Implementation:

```ts
import { NextResponse } from 'next/server'
import { getVietnamTodayDate } from '@/lib/date'
import { getWeeklyStats } from '@/server/stats'

export async function GET() {
  try {
    const today = getVietnamTodayDate()
    const stats = await getWeeklyStats(today)

    return NextResponse.json(stats)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to load weekly stats',
      },
      { status: 500 }
    )
  }
}
```

---

## 18.7. GET /api/history

File:

```text
src/app/api/history/route.ts
```

Behavior:

```text
Return latest daily plans with summary.
```

Create:

```text
src/server/history.ts
```

Content:

```ts
import { connectMongo } from '@/lib/mongoose'
import { DailyPlan } from '@/models/DailyPlan'

export async function getHistory(limit = 30) {
  await connectMongo()

  const plans = await DailyPlan.find({}).sort({ date: -1 }).limit(limit).lean()

  return plans.map((plan: any) => {
    const items = plan.items ?? []

    const doneItems = items.filter((item: any) => item.status === 'done')
    const skippedItems = items.filter((item: any) => item.status === 'skipped')

    return {
      id: plan._id.toString(),
      date: plan.date,
      theme: plan.theme ?? null,
      totalItems: items.length,
      doneItems: doneItems.length,
      skippedItems: skippedItems.length,
      minutesSpent: doneItems.reduce(
        (sum: number, item: any) => sum + (item.estimatedMinutes ?? 0),
        0
      ),
    }
  })
}
```

Route:

```ts
import { NextResponse } from 'next/server'
import { getHistory } from '@/server/history'

export async function GET() {
  try {
    const history = await getHistory(30)

    return NextResponse.json(history)
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      {
        error: 'Failed to load history',
      },
      { status: 500 }
    )
  }
}
```

---

# 19. Seed Data

MVP must include at least 100 lessons:

```text
20 listening
20 vocab
20 speaking
20 writing
20 dev_english
```

Create:

```text
src/server/seed.ts
```

Seed function:

```ts
import { connectMongo } from '@/lib/mongoose'
import { Lesson } from '@/models/Lesson'

const lessons = [
  {
    title: 'Debugging phrases',
    topic: 'dev',
    level: 'A2',
    type: 'vocab',
    content: [
      'The app keeps crashing.',
      'I need to check the logs.',
      'The API returned the wrong data.',
      'I fixed the bug.',
      'I will test it again.',
    ].join('\n'),
    estimatedMinutes: 5,
    wordsCount: 5,
  },
  {
    title: 'Talk about a bug',
    topic: 'dev',
    level: 'A2',
    type: 'speaking',
    content: 'Talk for 1 minute: What bug did you fix today?',
    estimatedMinutes: 5,
    speakingMinutes: 1,
  },
  {
    title: 'Write about your workday',
    topic: 'work',
    level: 'A2',
    type: 'writing',
    content: [
      'Write 3 sentences:',
      '1. Today I worked on...',
      '2. I had a problem with...',
      '3. Tomorrow I will...',
    ].join('\n'),
    estimatedMinutes: 5,
    writingSentences: 3,
  },
  {
    title: 'BBC Learning English short listening',
    topic: 'listening',
    level: 'A2',
    type: 'listening',
    content: 'Open the listening source and listen for 5 minutes. Write down one sentence you understand.',
    sourceUrl: 'https://www.bbc.co.uk/learningenglish',
    estimatedMinutes: 5,
  },
  {
    title: 'API error phrases',
    topic: 'dev',
    level: 'A2',
    type: 'dev_english',
    content: [
      'The request failed.',
      'The server returned an error.',
      'The response is empty.',
      'I need to retry the request.',
      'The endpoint is not working.',
    ].join('\n'),
    estimatedMinutes: 5,
    wordsCount: 5,
  },
]

export async function seedLessons() {
  await connectMongo()

  const count = await Lesson.countDocuments()

  if (count > 0) {
    return {
      inserted: 0,
      skipped: true,
      reason: 'Lessons already exist',
    }
  }

  const generatedLessons = generateLessons()

  await Lesson.insertMany(generatedLessons)

  return {
    inserted: generatedLessons.length,
    skipped: false,
  }
}

function generateLessons() {
  const listening = Array.from({ length: 20 }).map((_, index) => ({
    title: `Listening Practice ${index + 1}`,
    topic: index % 2 === 0 ? 'daily' : 'work',
    level: 'A2',
    type: 'listening',
    content:
      'Listen for 5 minutes. Write down one phrase you can understand. Do not worry about understanding everything.',
    sourceUrl:
      index % 2 === 0
        ? 'https://www.bbc.co.uk/learningenglish'
        : 'https://learningenglish.voanews.com/',
    estimatedMinutes: 5,
    wordsCount: 0,
    speakingMinutes: 0,
    writingSentences: 0,
    isActive: true,
  }))

  const vocabTopics = [
    'debugging',
    'daily life',
    'meetings',
    'API',
    'deployment',
    'testing',
    'planning',
    'errors',
    'communication',
    'work',
  ]

  const vocab = Array.from({ length: 20 }).map((_, index) => ({
    title: `Vocabulary Pack ${index + 1}`,
    topic: vocabTopics[index % vocabTopics.length],
    level: 'A2',
    type: 'vocab',
    content: [
      'I need to check this.',
      'This issue is annoying.',
      'Let me try again.',
      'The result looks wrong.',
      'I found the problem.',
    ].join('\n'),
    estimatedMinutes: 5,
    wordsCount: 5,
    speakingMinutes: 0,
    writingSentences: 0,
    isActive: true,
  }))

  const speaking = Array.from({ length: 20 }).map((_, index) => ({
    title: `Speaking Prompt ${index + 1}`,
    topic: index % 2 === 0 ? 'work' : 'daily',
    level: 'A2',
    type: 'speaking',
    content:
      'Speak for 1 minute. Use simple sentences. Topic: What did you do today?',
    estimatedMinutes: 5,
    wordsCount: 0,
    speakingMinutes: 1,
    writingSentences: 0,
    isActive: true,
  }))

  const writing = Array.from({ length: 20 }).map((_, index) => ({
    title: `Writing Prompt ${index + 1}`,
    topic: index % 2 === 0 ? 'journal' : 'work',
    level: 'A2',
    type: 'writing',
    content: [
      'Write 3 simple sentences:',
      '1. Today I...',
      '2. I had a problem with...',
      '3. Tomorrow I will...',
    ].join('\n'),
    estimatedMinutes: 5,
    wordsCount: 0,
    speakingMinutes: 0,
    writingSentences: 3,
    isActive: true,
  }))

  const devEnglish = Array.from({ length: 20 }).map((_, index) => ({
    title: `Dev English ${index + 1}`,
    topic: ['debugging', 'API', 'deploy', 'testing'][index % 4],
    level: 'A2',
    type: 'dev_english',
    content: [
      'I am debugging the login flow.',
      'The API response is incorrect.',
      'I need to check the server logs.',
      'The app works on my machine.',
      'I will test it again before release.',
    ].join('\n'),
    estimatedMinutes: 5,
    wordsCount: 5,
    speakingMinutes: 0,
    writingSentences: 0,
    isActive: true,
  }))

  return [...lessons, ...listening, ...vocab, ...speaking, ...writing, ...devEnglish]
}
```

This will generate more than 100 lessons. That is acceptable.

---

## 19.1. Seed API

Create:

```text
src/app/api/seed/route.ts
```

Content:

```ts
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
```

---

## 19.2. Seed Script

Add script to `package.json`:

```json
{
  "scripts": {
    "seed": "tsx src/server/run-seed.ts"
  }
}
```

Create:

```text
src/server/run-seed.ts
```

Content:

```ts
import { seedLessons } from './seed'

seedLessons()
  .then((result) => {
    console.log(result)
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
```

---

# 20. Frontend Pages

Use server components or client components where appropriate.

For simpler MVP, pages can be client components that fetch API routes.

Use clean, calm UI.

No aggressive red warnings.

---

## 20.1. Root Page

File:

```text
src/app/page.tsx
```

Behavior:

Redirect or link to `/today`.

Simple implementation:

```tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-20">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
          English Daily Hub
        </p>

        <h1 className="text-4xl font-bold tracking-tight">
          Learn English without the angry owl.
        </h1>

        <p className="text-lg text-slate-300">
          A calm daily English routine for busy developers. No toxic streaks.
          No guilt. Just small progress.
        </p>

        <Link
          href="/today"
          className="w-fit rounded-2xl bg-slate-50 px-5 py-3 font-medium text-slate-950"
        >
          Open today&apos;s lesson
        </Link>
      </section>
    </main>
  )
}
```

---

## 20.2. AppShell

Create:

```text
src/components/AppShell.tsx
```

```tsx
import { NavBar } from './NavBar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <NavBar />

      <section className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </section>
    </main>
  )
}
```

---

## 20.3. NavBar

Create:

```text
src/components/NavBar.tsx
```

```tsx
import Link from 'next/link'

export function NavBar() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/today" className="font-semibold">
          English Daily Hub
        </Link>

        <div className="flex gap-4 text-sm text-slate-300">
          <Link href="/today">Today</Link>
          <Link href="/stats">Stats</Link>
          <Link href="/history">History</Link>
        </div>
      </nav>
    </header>
  )
}
```

---

## 20.4. Today Page

File:

```text
src/app/today/page.tsx
```

Make this a client component.

Behavior:

```text
1. Fetch /api/today.
2. Show progress.
3. Show 5 lesson cards.
4. Allow Done / Skip / Undo.
5. Refresh state after every action.
```

UI copy:

```text
No angry owl here.
One tiny step is enough.
Skip is allowed.
```

Implementation idea:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { LessonCard } from '@/components/LessonCard'
import { ProgressCard } from '@/components/ProgressCard'
import type { DailyPlanDTO } from '@/types/english'

export default function TodayPage() {
  const [plan, setPlan] = useState<DailyPlanDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [actingItemId, setActingItemId] = useState<string | null>(null)

  async function loadToday() {
    const response = await fetch('/api/today', {
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error('Failed to load today plan')
    }

    const data = await response.json()
    setPlan(data)
  }

  async function updateItem(itemId: string, action: 'done' | 'skip' | 'pending') {
    try {
      setActingItemId(itemId)

      const response = await fetch(`/api/today/items/${itemId}/${action}`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Failed to mark item as ${action}`)
      }

      const data = await response.json()
      setPlan(data)
    } finally {
      setActingItemId(null)
    }
  }

  useEffect(() => {
    loadToday()
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
          Today
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          No angry owl here.
        </h1>

        <p className="mt-2 text-slate-300">
          One tiny step is enough. Skip is allowed.
        </p>
      </div>

      {loading && <p className="text-slate-400">Loading today&apos;s plan...</p>}

      {!loading && plan && (
        <div className="grid gap-6">
          <ProgressCard progress={plan.progress} theme={plan.theme} />

          <div className="grid gap-4">
            {plan.items.map((item) => (
              <LessonCard
                key={item.id}
                item={item}
                isLoading={actingItemId === item.id}
                onDone={() => updateItem(item.id, 'done')}
                onSkip={() => updateItem(item.id, 'skip')}
                onUndo={() => updateItem(item.id, 'pending')}
              />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  )
}
```

---

## 20.5. ProgressCard

Create:

```text
src/components/ProgressCard.tsx
```

```tsx
import type { TodayProgress } from '@/types/english'

type Props = {
  progress: TodayProgress
  theme?: string | null
}

export function ProgressCard({ progress, theme }: Props) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">Today&apos;s theme</p>
          <h2 className="text-2xl font-semibold">
            {theme ?? 'Daily English'}
          </h2>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-3xl font-bold">
            {progress.done}/{progress.total}
          </p>
          <p className="text-sm text-slate-400">items done</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-2xl font-semibold">{progress.minutesSpent}</p>
          <p className="text-sm text-slate-400">minutes</p>
        </div>

        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-2xl font-semibold">{progress.wordsLearned}</p>
          <p className="text-sm text-slate-400">phrases</p>
        </div>

        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-2xl font-semibold">{progress.speakingMinutes}</p>
          <p className="text-sm text-slate-400">speaking min</p>
        </div>

        <div className="rounded-2xl bg-slate-800 p-4">
          <p className="text-2xl font-semibold">{progress.writingSentences}</p>
          <p className="text-sm text-slate-400">sentences</p>
        </div>
      </div>
    </section>
  )
}
```

---

## 20.6. LessonCard

Create:

```text
src/components/LessonCard.tsx
```

```tsx
import type { DailyPlanItemDTO } from '@/types/english'

type Props = {
  item: DailyPlanItemDTO
  isLoading?: boolean
  onDone: () => void
  onSkip: () => void
  onUndo: () => void
}

export function LessonCard({
  item,
  isLoading,
  onDone,
  onSkip,
  onUndo,
}: Props) {
  const statusLabel = {
    pending: 'Pending',
    done: 'Done',
    skipped: 'Skipped',
  }[item.status]

  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
            {item.type.replace('_', ' ')}
          </p>

          <h3 className="mt-2 text-xl font-semibold">
            {item.title}
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            {item.estimatedMinutes} minutes · {statusLabel}
          </p>
        </div>

        <span className="w-fit rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">
          {statusLabel}
        </span>
      </div>

      <pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
        {item.content}
      </pre>

      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm text-slate-300 underline"
        >
          Open source
        </a>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          disabled={isLoading}
          onClick={onDone}
          className="rounded-2xl bg-slate-50 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
        >
          Done
        </button>

        <button
          disabled={isLoading}
          onClick={onSkip}
          className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 disabled:opacity-50"
        >
          Skip
        </button>

        {item.status !== 'pending' && (
          <button
            disabled={isLoading}
            onClick={onUndo}
            className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 disabled:opacity-50"
          >
            Undo
          </button>
        )}
      </div>
    </article>
  )
}
```

---

# 21. Stats Page

File:

```text
src/app/stats/page.tsx
```

Behavior:

```text
1. Fetch /api/stats/weekly.
2. Fetch /api/stats/daily for current week.
3. Show calm weekly summary.
```

UI should display:

```text
Active days
Total minutes
Completed lessons
Skipped lessons
Phrases learned
Speaking minutes
Writing sentences
Comeback count
```

Do not display:

```text
Streak
Failed days
Lost streak
```

---

# 22. History Page

File:

```text
src/app/history/page.tsx
```

Behavior:

```text
1. Fetch /api/history.
2. Show last 30 daily plans.
3. Each row/card shows:
   - date
   - theme
   - done / total
   - skipped
   - minutes spent
```

---

# 23. Package Scripts

Update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "seed": "tsx src/server/run-seed.ts"
  }
}
```

---

# 24. API Contract Summary

## GET /api/today

Returns:

```json
{
  "id": "plan_id",
  "date": "2026-06-17",
  "theme": "debugging",
  "progress": {
    "total": 5,
    "done": 2,
    "skipped": 1,
    "pending": 2,
    "minutesSpent": 10,
    "wordsLearned": 5,
    "speakingMinutes": 1,
    "writingSentences": 3
  },
  "items": [
    {
      "id": "item_id",
      "lessonId": "lesson_id",
      "type": "vocab",
      "title": "Debugging phrases",
      "content": "The app keeps crashing.",
      "sourceUrl": null,
      "estimatedMinutes": 5,
      "wordsCount": 5,
      "speakingMinutes": 0,
      "writingSentences": 0,
      "status": "pending",
      "completedAt": null
    }
  ],
  "createdAt": "2026-06-17T00:00:00.000Z",
  "updatedAt": "2026-06-17T00:00:00.000Z"
}
```

## POST /api/today/items/:itemId/done

Returns updated daily plan.

## POST /api/today/items/:itemId/skip

Returns updated daily plan.

## POST /api/today/items/:itemId/pending

Returns updated daily plan.

## GET /api/stats/daily?from=YYYY-MM-DD&to=YYYY-MM-DD

Returns array of daily stats.

## GET /api/stats/weekly

Returns weekly aggregate.

## GET /api/history

Returns last 30 daily plan summaries.

---

# 25. Error Handling

Every API route should:

```text
1. Catch errors.
2. Log error to console.
3. Return JSON with { error: string }.
4. Use correct status codes.
```

Status rules:

```text
200 success
201 created if needed
400 invalid request
404 not found
500 internal error
```

---

# 26. Validation

Use basic validation:

```text
- itemId must exist.
- Today plan must exist for item mutation.
- Lesson type must be one of the allowed types.
- Status must be one of pending/done/skipped.
```

Using `zod` is allowed but not required for all routes.

---

# 27. UI Copywriting Rules

Use calm copy:

```text
No angry owl here.
One tiny step is enough.
Skip is allowed.
Rest is allowed.
Welcome back.
Small progress counts.
```

Avoid:

```text
Failed
Lost
Broken streak
Punishment
You missed
```

---

# 28. Visual Style

Use Tailwind.

Style direction:

```text
Dark calm dashboard
Rounded cards
Soft contrast
No red warning-heavy UI
Readable typography
Mobile-friendly layout
```

Primary UI:

```text
Background: slate-950
Cards: slate-900
Inner panels: slate-800
Text: slate-50 / slate-300 / slate-400
Buttons: slate-50 text-slate-950
```

Do not overdesign. MVP should be clean and usable.

---

# 29. Acceptance Criteria

The MVP is complete when all checks pass:

## Setup

```text
[ ] App runs with pnpm dev.
[ ] MongoDB runs via docker compose.
[ ] App connects to MongoDB.
[ ] Seed script inserts at least 100 lessons.
```

## Daily Plan

```text
[ ] GET /api/today creates today's plan if missing.
[ ] GET /api/today returns same plan on repeated calls.
[ ] Today's plan contains exactly 5 items.
[ ] Today's plan contains one item for each type:
    - listening
    - vocab
    - speaking
    - writing
    - dev_english
[ ] DailyPlan item stores lesson snapshot fields.
```

## Rotation

```text
[ ] Lessons used in the last 7 days are avoided.
[ ] If no unused lesson exists for a type, fallback still picks an active lesson.
[ ] No API crashes because of exhausted lesson pool.
```

## Item Actions

```text
[ ] User can mark item as Done.
[ ] User can mark item as Skip.
[ ] User can Undo back to Pending.
[ ] UI updates after each action.
[ ] Daily stats update after each action.
```

## Stats

```text
[ ] Daily stats calculates:
    - totalItems
    - doneItems
    - skippedItems
    - pendingItems
    - minutesSpent
    - wordsLearned
    - speakingMinutes
    - writingSentences
[ ] Weekly stats aggregates current week.
[ ] Comeback count works when user returns after missing at least one full day.
[ ] No toxic streak appears anywhere.
```

## UI

```text
[ ] /today shows daily plan.
[ ] /stats shows weekly stats.
[ ] /history shows last 30 days.
[ ] Mobile layout is usable.
[ ] Empty/loading states exist.
```

---

# 30. Implementation Order

The AI agent should implement in this order:

```text
1. Project setup
2. MongoDB connection
3. Mongoose models
4. Seed data
5. Date helpers
6. Rotation logic
7. Stats logic
8. API routes
9. Serialization
10. Today UI
11. Stats UI
12. History UI
13. Polish
14. Manual testing
15. Fix TypeScript/lint/build errors
```

Do not start with UI before the backend works.

---

# 31. Manual Test Plan

After implementation:

## 31.1. Start MongoDB

```bash
docker compose up -d
```

## 31.2. Install dependencies

```bash
pnpm install
```

## 31.3. Seed lessons

```bash
pnpm seed
```

## 31.4. Run app

```bash
pnpm dev
```

## 31.5. Test APIs

Open:

```text
http://localhost:3000/api/today
```

Expected:

```text
JSON daily plan with 5 items.
```

Click Done/Skip in UI.

Check:

```text
http://localhost:3000/api/stats/weekly
http://localhost:3000/api/history
```

---

# 32. Future Features Not Required in MVP

Do not implement these yet:

```text
User authentication
Multi-device sync
AI writing correction
Voice recording
Speech recognition
Pronunciation scoring
Push notifications
Email reminders
Admin lesson editor
Public SaaS billing
Import from YouTube API
Mobile app
```

Keep MVP focused.

---

# 33. Final Agent Prompt

Use this prompt when asking an AI coding agent to implement:

```text
Read docs/AI_AGENT_IMPLEMENTATION.md carefully.

Implement the full English Daily Hub MVP exactly as specified.

Use:
- Next.js App Router
- TypeScript
- MongoDB
- Mongoose
- Tailwind CSS
- pnpm

Do not use:
- Prisma
- SQLite
- Express
- toxic streak mechanics

Implementation priority:
1. Backend correctness
2. Data model correctness
3. Daily rotation and stats
4. Functional UI
5. Clean code and build passing

After implementation:
- Run pnpm lint if available
- Run pnpm build
- Fix all TypeScript and build errors
- Make sure the app works locally with MongoDB docker compose
```

---

# 34. Definition of Done

The project is done when:

```text
The user can open /today, get a daily English plan, complete or skip items, see daily/weekly stats, and review history.

The app stores data in MongoDB.

The app rotates lessons daily.

The app never uses toxic streak language.
```
