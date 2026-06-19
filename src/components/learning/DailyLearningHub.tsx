'use client'

import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import type { DailyPlanDTO } from '@/types/english'
import { DailyProgressHero } from './DailyProgressHero'
import { LessonStatusCard } from './LessonStatusCard'

type Props = {
  plan: DailyPlanDTO | null
  loading: boolean
  onItemAction: (
    itemId: string,
    action: 'skip' | 'pending',
  ) => Promise<void> | void
}

export function DailyLearningHub({ plan, loading, onItemAction }: Props) {
  const [actingItemId, setActingItemId] = useState<string | null>(null)

  async function handleAction(itemId: string, action: 'skip' | 'pending') {
    try {
      setActingItemId(itemId)
      await onItemAction(itemId, action)
    } finally {
      setActingItemId(null)
    }
  }

  if (loading) {
    return <LoadingState message="Loading today's plan..." />
  }

  if (!plan) {
    return (
      <EmptyState
        title="Could not load today's plan."
        description="Please refresh the page."
      />
    )
  }

  return (
    <div className="grid gap-6">
      <DailyProgressHero
        progress={plan.progress}
        items={plan.items}
        theme={plan.theme}
      />

      <div className="grid gap-3">
        {plan.items.map((item) => (
          <LessonStatusCard
            key={item.id}
            item={item}
            isLoading={actingItemId === item.id}
            onSkip={() => handleAction(item.id, 'skip')}
            onUndo={() => handleAction(item.id, 'pending')}
          />
        ))}
      </div>

      <footer className="px-2 text-center text-sm text-muted">
        Your progress is saved automatically.
      </footer>
    </div>
  )
}
