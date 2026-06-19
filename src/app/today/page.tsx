'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { DailyLearningHub } from '@/components/learning/DailyLearningHub'
import type { DailyPlanDTO } from '@/types/english'

export default function TodayPage() {
  const [plan, setPlan] = useState<DailyPlanDTO | null>(null)
  const [loading, setLoading] = useState(true)

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

  async function updateItem(itemId: string, action: 'skip' | 'pending') {
    try {
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
      <DailyLearningHub plan={plan} loading={loading} onItemAction={updateItem} />
    </AppShell>
  )
}
