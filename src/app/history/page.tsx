'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { HistoryList } from '@/components/HistoryList'
import { LoadingState } from '@/components/LoadingState'
import type { HistoryEntryDTO } from '@/types/english'

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntryDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true

    async function run() {
      try {
        const response = await fetch('/api/history', {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Failed to load history')
        }

        const data: HistoryEntryDTO[] = await response.json()

        if (active) {
          setEntries(data)
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
          History
        </p>

        <h1 className="mt-2 text-3xl font-bold">Your last 30 days.</h1>

        <p className="mt-2 text-slate-300">
          A gentle record of what you have practiced.
        </p>
      </div>

      {loading && <LoadingState message="Loading your history..." />}

      {!loading && loadError && (
        <EmptyState
          title="Could not load your history."
          description="Please refresh the page."
        />
      )}

      {!loading && !loadError && entries.length === 0 && (
        <EmptyState
          title="No history yet."
          description="Come back after completing today's plan."
        />
      )}

      {!loading && !loadError && entries.length > 0 && (
        <HistoryList entries={entries} />
      )}
    </AppShell>
  )
}
