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

export type HistoryEntryDTO = {
  id: string
  date: string
  theme: string | null
  totalItems: number
  doneItems: number
  skippedItems: number
  minutesSpent: number
}
