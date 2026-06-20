'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { StatsCard } from '@/components/StatsCard'
import { HistoryList } from '@/components/HistoryList'
import type { HistoryEntryDTO } from '@/types/english'

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

export default function StatsPage() {
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null)
  const [history, setHistory] = useState<HistoryEntryDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true

    async function run() {
      try {
        const [weeklyResponse, historyResponse] = await Promise.all([
          fetch('/api/stats/weekly', { cache: 'no-store' }),
          fetch('/api/history', { cache: 'no-store' }),
        ])

        if (!weeklyResponse.ok) {
          throw new Error('Failed to load weekly stats')
        }

        if (!historyResponse.ok) {
          throw new Error('Failed to load history')
        }

        const weeklyData: WeeklyStats = await weeklyResponse.json()
        const historyData: HistoryEntryDTO[] = await historyResponse.json()

        if (active) {
          setWeekly(weeklyData)
          setHistory(historyData)
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
        <p className="text-sm uppercase tracking-[0.3em] text-gold">
          Stats
        </p>

        <h1 className="mt-2 font-display text-3xl font-medium text-ink">Your progress so far.</h1>

        <p className="mt-2 text-ink-soft">
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
          <section className="rounded-3xl border border-t-2 border-hairline border-t-gold-bright bg-surface p-6 shadow-card">
            <p className="text-sm text-muted">
              This week: {weekly.from} to {weekly.to}
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

          <section className="rounded-3xl border border-t-2 border-hairline border-t-gold-bright bg-surface p-6 shadow-card">
            <h2 className="font-display text-lg font-medium text-ink">Your last 30 days</h2>

            <p className="mt-1 text-sm text-ink-soft">
              A gentle record of what you have practiced.
            </p>

            {history.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No history yet.</p>
            ) : (
              <div className="mt-4">
                <HistoryList entries={history} />
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  )
}
