# AI-Powered Grading and Explanation

## Goal

Replace the current rule-based scoring in `src/server/learning/evaluation.ts`
(word-count/keyword/quiz heuristics, criticized as too simplistic) with real
AI grading via the `claude` CLI. Immediately after a learner submits an
item, Claude grades the submission and returns a score plus a detailed
explanation (what was right, what to improve, optionally a corrected
version), for all 5 lesson types (listening, vocab, speaking, writing,
dev_english).

## Scope

- **In scope:** the grading call inside `evaluateItem()` (currently
  `evaluateLesson()` in `evaluation.ts`), for all 5 lesson types.
- **Out of scope:** the periodic/aggregate "how am I doing overall" coaching
  report the user mentioned — that's a separate, larger feature (cross-lesson
  trend analysis) and needs its own spec if pursued later. This spec covers
  only per-submission grading.
- **Out of scope:** rule-based `evaluation.ts` is deleted, not kept as a
  fallback (see Error handling below) — there is no hybrid mode.

## Source: `claude` CLI, model `haiku`

Same constraint as translation: single user, OAuth-authenticated machine,
shell out to the local `claude` binary. Uses `--model haiku` (confirmed
adequate quality/speed in live testing) and the shared wrapper from the
translation feature:

```ts
// src/server/external/claude-cli.ts
export async function runClaude(
  prompt: string,
  opts?: { model?: string; timeoutMs?: number }
): Promise<string>
```

Grading needs structured output (score + rubric + feedback), so this spec
adds a second helper on top of `runClaude` in the same file:

```ts
export class ClaudeCliError extends Error {}
export class ClaudeJsonParseError extends Error {}

export async function runClaudeJson<T>(
  prompt: string,
  opts?: { model?: string; timeoutMs?: number }
): Promise<T>
```

`runClaudeJson` calls `runClaude`, then strips a leading/trailing markdown
code fence if present (confirmed via live testing that Claude sometimes
wraps JSON output in ` ```json ... ``` ` even when told not to, regardless
of `--output-format`), then `JSON.parse`s the result. Throws
`ClaudeJsonParseError` if parsing still fails after stripping. Both
`translateItem` (plain text) and grading (structured JSON) share the same
`runClaude`/`runClaudeJson` pair, so there is exactly one place that knows
how to invoke the CLI and handle its quirks.

## Grading flow

New file `src/server/grading/grade-with-claude.ts`, replacing
`evaluation.ts`:

```ts
export type LessonType = /* same union, moved here */
export type Rubric = { completion?: number; accuracy?: number; vocabulary?: number; structure?: number; clarity?: number; pronunciation?: number }
export type Feedback = { summary: string; strengths: string[]; improvements: string[]; correctedText?: string }
export type ScoringResult = { score: number; rubric: Rubric; feedback: Feedback }
export const PASSING_SCORE = 60

export class GradingError extends Error {}

export async function gradeLesson(
  lessonType: LessonType,
  lessonContent: string,
  input: EvaluationInput
): Promise<ScoringResult>
```

`gradeLesson` keeps the exact same `ScoringResult` shape `evaluation.ts`
already produces, so `evaluate-item.ts` and `EvaluationFeedbackPanel.tsx`
need no changes beyond awaiting the call — `correctedText` is already
rendered by the panel today even though nothing currently sets it.

It builds one prompt per lesson type (a `buildPrompt(lessonType, ...)`
function), each instructing Claude to:
- Act as an English tutor grading a Vietnamese learner's submission.
- Be given the lesson content/prompt the learner was responding to, and
  their submission (`input.text`/`input.transcript`/`input.quizAnswers` —
  whichever field that lesson type uses, same as today).
- Return **strictly** a JSON object: `{"score": number 0-100, "rubric": {...same keys as today's Rubric...}, "feedback": {"summary": string, "strengths": string[], "improvements": string[], "correctedText"?: string}}`, with feedback in plain English (matching the app's existing English-language feedback copy) and nothing else in the response.

Type-specific prompt content:
- **listening / vocab:** include `quizAnswers` + `expectedAnswers` if
  present (same data `scoreQuiz` used); otherwise ask Claude to judge
  completeness from whatever was submitted.
- **speaking:** include the `transcript` and `recordedSeconds`; ask Claude
  to grade fluency/relevance to the prompt, not just length.
- **writing / dev_english:** include `text`; ask Claude to grade grammar,
  vocabulary, and relevance to the prompt — this is the main quality
  upgrade over the old word-count-only heuristic — and to fill
  `correctedText` with an improved version when the writing has clear
  errors.

`gradeLesson` calls `runClaudeJson<RawGradingResponse>(prompt, { model: 'haiku', timeoutMs: 30000 })`, validates the shape (score is a number, clamps to 0-100, defaults missing rubric/feedback arrays to `{}`/`[]`), and returns it as `ScoringResult`.

## Wiring into `evaluate-item.ts`

`src/server/learning/evaluate-item.ts:94` currently calls:

```ts
const { score, rubric, feedback } = evaluateLesson(lessonType, safeInput)
```

This becomes:

```ts
const lesson = item.lessonId ? await Lesson.findById(item.lessonId) : null
const lessonContent = lesson?.content ?? item.content
const { score, rubric, feedback } = await gradeLesson(lessonType, lessonContent, safeInput)
```

`evaluateItem()` is already `async`, so this is just adding an `await` and
importing from the new module instead of `evaluation.ts`. The rest of the
function (idempotent upsert, completion check, stats recalculation) is
unchanged — it only consumes `{score, rubric, feedback}`, which keeps the
same shape.

## Error handling

Per the explicit decision to not keep a rule-based fallback: if
`gradeLesson` throws (CLI timeout/non-zero exit/JSON parse failure),
`evaluateItem()` lets it propagate as a `GradingError`, which the route
handler (`src/app/api/today/items/[itemId]/evaluate/route.ts`) maps to a 502
response: `{ error: 'Failed to grade submission, please try again' }`. No
`LessonEvaluation` record is written and no completion/stats side effects
run for that attempt — the learner re-submits (resubmitting is already the
existing UX for `needs_retry` evaluations, so this reuses an existing path
rather than adding a new one).

## Data model

No schema changes needed — `LessonEvaluation.rubric`/`feedback` already
store whatever shape `evaluation.ts` produces today (loosely-typed
sub-documents), so AI-produced rubrics/feedback fit the same fields.

## Removing `evaluation.ts`

Since there is no fallback path, `src/server/learning/evaluation.ts`
becomes dead code once `evaluate-item.ts` is switched over, and is deleted
in the same change (not left unused) per the project's "no unused code"
convention. Its exported types (`LessonType`, `EvaluationInput`, `Rubric`,
`Feedback`, `ScoringResult`, `PASSING_SCORE`) move to
`src/server/grading/grade-with-claude.ts`. Three other files import from
`evaluation.ts` today and need their import path updated to the new module
(no type/value changes needed otherwise):
`src/server/learning/evaluate-item.ts` (`evaluateLesson` → `gradeLesson`,
`PASSING_SCORE`, `LessonType`), `src/server/learning/completion.ts`
(`PASSING_SCORE`, `LessonType`), and
`src/app/api/today/items/[itemId]/evaluate/route.ts` (`EvaluationInput`).
Note `src/server/learning/personalization.ts` defines its own separate
`LessonType` — unrelated, do not touch.

## Testing

- Unit test `runClaudeJson`'s fence-stripping (mock `runClaude` returning
  fenced/unfenced JSON, confirm both parse).
- Unit test `gradeLesson`'s shape validation/clamping (mock `runClaudeJson`
  returning various partial/malformed payloads).
- Manual verification: submit a real answer for each of the 5 lesson types
  in the browser, confirm a sensible score + feedback appears, confirm a
  deliberately bad/empty submission still gets feedback (not a crash), and
  confirm `evaluation.ts` is fully removed (no remaining imports).
