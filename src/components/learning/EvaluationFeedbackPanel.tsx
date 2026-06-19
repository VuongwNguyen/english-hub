'use client'

export type EvaluationFeedbackDTO = {
  score: number
  passed: boolean
  feedback: {
    summary: string
    strengths: string[]
    improvements: string[]
    correctedText?: string
  }
}

type Props = {
  evaluation: EvaluationFeedbackDTO
}

export function EvaluationFeedbackPanel({ evaluation }: Props) {
  const { score, passed, feedback } = evaluation

  return (
    <section
      className={`rounded-3xl border p-5 shadow-card sm:p-6 ${
        passed
          ? 'border-accent-tint bg-accent-tint/40'
          : 'border-gold-bright/40 bg-gold-soft/40'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.25em] text-gold">
          {passed ? 'Nice work' : 'Good attempt'}
        </p>
        <p className="font-display text-2xl font-medium text-ink">{score}/100</p>
      </div>

      <p className="mt-3 text-ink-soft">{feedback.summary}</p>

      {feedback.strengths.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink">What went well</p>
          <ul className="mt-1 grid gap-1 text-sm text-ink-soft">
            {feedback.strengths.map((strength, index) => (
              <li key={index}>· {strength}</li>
            ))}
          </ul>
        </div>
      )}

      {feedback.improvements.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink">Try this next time</p>
          <ul className="mt-1 grid gap-1 text-sm text-ink-soft">
            {feedback.improvements.map((improvement, index) => (
              <li key={index}>· {improvement}</li>
            ))}
          </ul>
        </div>
      )}

      {feedback.correctedText && (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink">Suggested version</p>
          <p className="mt-1 text-sm text-ink-soft">{feedback.correctedText}</p>
        </div>
      )}
    </section>
  )
}
