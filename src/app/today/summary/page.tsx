'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { DailySummary } from '@/components/learning/DailySummary'
import type { DailyPlanDTO } from '@/types/english'

export default function TodaySummaryPage() {
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

  return (
    <AppShell>
      <DailySummary plan={plan} loading={loading} />
    </AppShell>
  )
}
