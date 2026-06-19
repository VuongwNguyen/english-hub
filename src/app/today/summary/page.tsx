'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { DailySummary } from '@/components/learning/DailySummary'
import type { DailyPlanDTO } from '@/types/english'

function isPlanAllDone(plan: DailyPlanDTO): boolean {
  return plan.items.every(
    (item) => item.status === 'completed' || item.status === 'skipped',
  )
}

export default function TodaySummaryPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<DailyPlanDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function run() {
      try {
        const response = await fetch('/api/today', { cache: 'no-store' })

        if (!response.ok) {
          throw new Error('Failed to load today plan')
        }

        const data: DailyPlanDTO = await response.json()
        if (active) setPlan(data)
      } catch (error) {
        console.error(error)
      } finally {
        if (active) setLoading(false)
      }
    }

    run()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!loading && plan && !isPlanAllDone(plan)) {
      router.replace('/today')
    }
  }, [loading, plan, router])

  if (!loading && plan && !isPlanAllDone(plan)) {
    return null
  }

  return (
    <AppShell>
      <DailySummary plan={plan} loading={loading} />
    </AppShell>
  )
}
