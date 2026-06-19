import { AppShell } from '@/components/AppShell'
import { FocusLearningPage } from '@/components/learning/FocusLearningPage'

export default async function LearnItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>
}) {
  const { itemId } = await params

  return (
    <AppShell>
      <FocusLearningPage itemId={itemId} />
    </AppShell>
  )
}
