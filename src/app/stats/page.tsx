'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { StatsCard } from '@/components/StatsCard'

type WeeklyStats = {
  from: string
  to: string
  activeDays: number
  totalMinutes: number
  completedLessons: number
  skippedLessons: number
  wordsLearned: number
  speakingMinutes: number
  writingSentences: number
  comebackCount: number
}

type DailyStats = {
  date: string
  totalItems: number
  doneItems: number
  skippedItems: number
  pendingItems: number
  minutesSpent: number
  wordsLearned: number
  speakingMinutes: number
  writingSentences: number
  comeback: number
  note?: string
}

export default function StatsPage() {
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null)
  const [daily, setDaily] = useState<DailyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true

    async function run() {
      try {
        const weeklyResponse = await fetch('/api/stats/weekly', {
          cache: 'no-store',
        })

        if (!weeklyResponse.ok) {
          throw new Error('Failed to load weekly stats')
        }

        const weeklyData: WeeklyStats = await weeklyResponse.json()

        const dailyResponse = await fetch(
          `/api/stats/daily?from=${weeklyData.from}&to=${weeklyData.to}`,
          { cache: 'no-store' }
        )

        if (!dailyResponse.ok) {
          throw new Error('Failed to load daily stats')
        }

        const dailyData: DailyStats[] = await dailyResponse.json()

        if (active) {
          setWeekly(weeklyData)
          setDaily(dailyData)
        }
      } catch (error) {
        console.error(error)

        if (active) {
          setLoadError(true)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    run()

    return () => {
      active = false
    }
  }, [])

  return (
    <AppShell>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
          Stats
        </p>

        <h1 className="mt-2 text-3xl font-bold">Your week so far.</h1>

        <p className="mt-2 text-slate-300">
          A calm look back. Every bit of progress counts.
        </p>
      </div>

      {loading && <LoadingState message="Loading your stats..." />}

      {!loading && loadError && (
        <EmptyState
          title="Could not load your stats."
          description="Please refresh the page."
        />
      )}

      {!loading && !loadError && weekly && (
        <div className="grid gap-6">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm text-slate-400">
              {weekly.from} to {weekly.to}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <StatsCard label="active days" value={weekly.activeDays} />
              <StatsCard label="total minutes" value={weekly.totalMinutes} />
              <StatsCard
                label="completed lessons"
                value={weekly.completedLessons}
              />
              <StatsCard
                label="skipped lessons"
                value={weekly.skippedLessons}
              />
              <StatsCard label="phrases learned" value={weekly.wordsLearned} />
              <StatsCard
                label="speaking minutes"
                value={weekly.speakingMinutes}
              />
              <StatsCard
                label="writing sentences"
                value={weekly.writingSentences}
              />
              <StatsCard label="comeback count" value={weekly.comebackCount} />
            </div>
          </section>

          {daily.length > 0 && (
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-lg font-semibold">Day by day</h2>

              <div className="mt-4 grid gap-2">
                {daily.map((day) => (
                  <div
                    key={day.date}
                    className="flex flex-col gap-1 rounded-2xl bg-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="font-medium text-slate-50">{day.date}</p>

                    <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                      <span>{day.doneItems} done</span>
                      <span>{day.skippedItems} skipped</span>
                      <span>{day.minutesSpent} minutes</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </AppShell>
  )
}
