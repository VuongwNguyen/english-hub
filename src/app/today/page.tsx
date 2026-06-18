'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { EmptyState } from '@/components/EmptyState'
import { LessonCard } from '@/components/LessonCard'
import { LoadingState } from '@/components/LoadingState'
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
    } catch (error) {
      console.error(error)
    } finally {
      setActingItemId(null)
    }
  }

  useEffect(() => {
    let active = true

    async function run() {
      try {
        await loadToday()
      } catch (error) {
        console.error(error)
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
          Today
        </p>

        <h1 className="mt-2 font-display text-3xl font-medium text-ink">
          No angry owl here.
        </h1>

        <p className="mt-2 text-ink-soft">
          One tiny step is enough. Skip is allowed.
        </p>
      </div>

      {loading && <LoadingState message="Loading today's plan..." />}

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

      {!loading && !plan && (
        <EmptyState
          title="Could not load today's plan."
          description="Please refresh the page."
        />
      )}
    </AppShell>
  )
}
