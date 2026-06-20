# AI-Powered Grading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `src/server/learning/evaluation.ts`'s rule-based scoring with `claude` CLI grading for all 5 lesson types, giving the learner a detailed, accuracy-aware explanation immediately after each submission instead of word-count/keyword heuristics.

**Architecture:** A new module (`src/server/grading/grade-with-claude.ts`) builds a per-lesson-type prompt, calls the `claude` CLI for a structured JSON verdict, and validates/clamps the result into the existing `ScoringResult` shape (`{score, rubric, feedback}`). `evaluate-item.ts` awaits this instead of calling the old synchronous `evaluateLesson`. There is no rule-based fallback: if grading fails, the evaluate call fails with a 502 and the learner resubmits (reusing the existing `needs_retry` UX). `evaluation.ts` is deleted once nothing imports from it.

**Tech Stack:** Next.js App Router, Mongoose, `claude` CLI (Claude Code) via the `runClaude` wrapper added in the translation plan (`src/server/external/claude-cli.ts`).

**Dependency:** This plan assumes `docs/superpowers/plans/2026-06-20-vietnamese-translation.md` Task 2 has already been completed — `src/server/external/claude-cli.ts` with `runClaude()` must already exist. If it doesn't exist yet, do that task first.

**No test framework note:** Same as the translation plan — this codebase has no Jest/Vitest configured. Verification is via `npx tsc --noEmit`, `yarn lint`, `yarn build`, and manual curl/browser checks.

**Deviations from the design spec (behavior-preserving):**
- The spec describes `gradeLesson(lessonType, lessonContent, input)` looking up the `Lesson` document inside `evaluate-item.ts` before calling it. This plan keeps that exact shape — the lookup happens once in `evaluate-item.ts` (which already needs `item.lessonId` for other things), not duplicated inside the grading module.
- The spec's `runClaudeJson<T>` helper is added to the *existing* `claude-cli.ts` file (created by the translation plan) rather than a new file, since it's a second function on the same low-level "talk to the CLI" responsibility, not a new domain.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/server/external/claude-cli.ts` (modify) | Add `runClaudeJson<T>()` + `ClaudeJsonParseError`, reusing the existing `runClaude()`. |
| `src/server/grading/grade-with-claude.ts` (create) | `gradeLesson()`, per-type prompt builders, response validation. Owns the types `LessonType`, `EvaluationInput`, `Rubric`, `Feedback`, `ScoringResult`, `PASSING_SCORE` (moved from `evaluation.ts`). |
| `src/server/learning/evaluate-item.ts` (modify) | Await `gradeLesson` instead of calling `evaluateLesson`; fetch `Lesson.content` for the prompt; wrap `GradingError` as `EvaluateItemError(502, ...)`. |
| `src/server/learning/completion.ts` (modify) | Update import of `PASSING_SCORE`/`LessonType` to the new module. |
| `src/app/api/today/items/[itemId]/evaluate/route.ts` (modify) | Update import of `EvaluationInput` to the new module. |
| `src/server/learning/evaluation.ts` (delete) | Dead after the above three files stop importing from it. |

---

### Task 1: Add `runClaudeJson` to the `claude` CLI wrapper

**Files:**
- Modify: `src/server/external/claude-cli.ts` (append to the file created by the translation plan)

- [ ] **Step 1: Add the JSON helper**

Append this to the end of `src/server/external/claude-cli.ts`:

```ts
export class ClaudeJsonParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClaudeJsonParseError'
  }
}

/**
 * Strips a leading/trailing markdown code fence if present. Confirmed via
 * live testing that the claude CLI sometimes wraps JSON output in
 * ```json ... ``` even when explicitly told not to add any extra
 * formatting, so this is a required defensive step before JSON.parse, not
 * speculative hardening.
 */
function stripMarkdownFence(text: string): string {
  const match = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/)
  return (match ? match[1] : text).trim()
}

export async function runClaudeJson<T>(
  prompt: string,
  opts?: { model?: string; timeoutMs?: number }
): Promise<T> {
  const raw = await runClaude(prompt, opts)
  const stripped = stripMarkdownFence(raw)

  try {
    return JSON.parse(stripped) as T
  } catch {
    throw new ClaudeJsonParseError(
      `claude CLI returned invalid JSON: ${stripped.slice(0, 200)}`
    )
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test — confirm fence-stripping actually works against the real CLI**

```bash
npx tsx -e "
import { runClaudeJson } from './src/server/external/claude-cli'
runClaudeJson('Reply with strictly this JSON and nothing else: {\"score\": 85, \"summary\": \"ok\"}').then(console.log).catch(console.error)
"
```
Expected: prints `{ score: 85, summary: 'ok' }` (a parsed object, not a string with backticks in it) — this confirms the fence-stripping handles the real-world wrapping behavior observed during design, whether or not this particular call happens to fence it.

- [ ] **Step 4: Commit**

```bash
git add src/server/external/claude-cli.ts
git commit -m "feat(external): add runClaudeJson with markdown-fence stripping"
```

---

### Task 2: Grading module — types, prompts, and `gradeLesson`

**Files:**
- Create: `src/server/grading/grade-with-claude.ts`

- [ ] **Step 1: Write the module**

```ts
/**
 * AI-powered grading via the claude CLI, replacing the old rule-based
 * evaluation.ts. Produces the same ScoringResult shape evaluation.ts did
 * ({score, rubric, feedback}), so evaluate-item.ts and
 * EvaluationFeedbackPanel.tsx need no changes beyond the call site.
 *
 * No rule-based fallback: if the claude CLI fails (timeout, non-zero exit,
 * bad JSON), gradeLesson throws GradingError and the caller surfaces a 502
 * — the learner resubmits, reusing the existing needs_retry UX. This is a
 * deliberate choice (not an oversight): the team decided per-submission
 * accuracy from a real grader outweighs always returning *some* score.
 */
import { runClaudeJson, ClaudeCliError, ClaudeJsonParseError } from '@/server/external/claude-cli'

export type LessonType =
  | 'listening'
  | 'vocab'
  | 'speaking'
  | 'writing'
  | 'dev_english'

export type QuizAnswer = {
  questionId: string
  answer: string
}

export type EvaluationInput = {
  text?: string
  transcript?: string
  selectedAnswers?: string[]
  quizAnswers?: QuizAnswer[]
  expectedAnswers?: Record<string, string>
  recordedSeconds?: number
  speechAttemptCount?: number
  practiceCount?: number
  [key: string]: unknown
}

export type Rubric = {
  completion?: number
  accuracy?: number
  vocabulary?: number
  structure?: number
  clarity?: number
  pronunciation?: number
}

export type Feedback = {
  summary: string
  strengths: string[]
  improvements: string[]
  correctedText?: string
}

export type ScoringResult = {
  score: number
  rubric: Rubric
  feedback: Feedback
}

export const PASSING_SCORE = 60

export class GradingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GradingError'
  }
}

function clampScore(value: unknown): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(0, Math.min(100, Math.round(num)))
}

const RUBRIC_KEYS: (keyof Rubric)[] = [
  'completion',
  'accuracy',
  'vocabulary',
  'structure',
  'clarity',
  'pronunciation',
]

function sanitizeRubric(raw: unknown): Rubric {
  if (!raw || typeof raw !== 'object') return {}

  const rubric: Rubric = {}
  for (const key of RUBRIC_KEYS) {
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      rubric[key] = clampScore(value)
    }
  }
  return rubric
}

function sanitizeFeedback(raw: unknown): Feedback {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const summary = typeof obj.summary === 'string' && obj.summary.trim()
    ? obj.summary
    : 'No summary was returned.'

  const strengths = Array.isArray(obj.strengths)
    ? obj.strengths.filter((s): s is string => typeof s === 'string')
    : []

  const improvements = Array.isArray(obj.improvements)
    ? obj.improvements.filter((s): s is string => typeof s === 'string')
    : []

  const feedback: Feedback = { summary, strengths, improvements }

  if (typeof obj.correctedText === 'string' && obj.correctedText.trim()) {
    feedback.correctedText = obj.correctedText
  }

  return feedback
}

const JSON_INSTRUCTIONS = `Reply with STRICTLY a single JSON object and nothing else — no markdown, no code fences, no commentary before or after it. The JSON must have this exact shape:
{"score": <number 0-100>, "rubric": {"completion"?: <0-100>, "accuracy"?: <0-100>, "vocabulary"?: <0-100>, "structure"?: <0-100>, "clarity"?: <0-100>, "pronunciation"?: <0-100>}, "feedback": {"summary": "<one or two sentences>", "strengths": ["<short point>", ...], "improvements": ["<short point>", ...], "correctedText"?: "<an improved version of the learner's text, only if there are clear errors worth fixing>"}}
Only include rubric keys that are relevant to this lesson type. Write feedback in plain, encouraging English.`

function buildPrompt(
  lessonType: LessonType,
  lessonContent: string,
  input: EvaluationInput
): string {
  const intro = `You are an English tutor grading a Vietnamese learner's submission for a "${lessonType}" lesson. The lesson prompt/content the learner was responding to:\n"""\n${lessonContent}\n"""\n`

  switch (lessonType) {
    case 'listening':
    case 'vocab': {
      const quizAnswers = input.quizAnswers ?? []
      const expectedAnswers = input.expectedAnswers ?? {}
      return `${intro}\nThe learner's quiz answers: ${JSON.stringify(quizAnswers)}\nKnown correct answers (if any — empty means none are known, judge completeness/relevance instead): ${JSON.stringify(expectedAnswers)}\nGrade accuracy if correct answers are known; otherwise grade based on whether the answers are relevant and complete.\n${JSON_INSTRUCTIONS}`
    }
    case 'speaking': {
      const transcript = input.transcript ?? ''
      const recordedSeconds = input.recordedSeconds ?? 0
      return `${intro}\nThe learner's spoken transcript: "${transcript}"\nRecorded duration: ${recordedSeconds} seconds.\nGrade fluency, relevance to the prompt, and clarity — not just length.\n${JSON_INSTRUCTIONS}`
    }
    case 'writing':
    case 'dev_english': {
      const text = input.text ?? ''
      return `${intro}\nThe learner's written submission: """${text}"""\nGrade grammar, vocabulary use, and relevance to the prompt. If there are clear grammar/vocabulary errors, include an improved version in "correctedText".\n${JSON_INSTRUCTIONS}`
    }
  }
}

type RawGradingResponse = {
  score?: unknown
  rubric?: unknown
  feedback?: unknown
}

export async function gradeLesson(
  lessonType: LessonType,
  lessonContent: string,
  input: EvaluationInput
): Promise<ScoringResult> {
  const prompt = buildPrompt(lessonType, lessonContent, input)

  let raw: RawGradingResponse

  try {
    raw = await runClaudeJson<RawGradingResponse>(prompt, {
      model: 'haiku',
      timeoutMs: 30000,
    })
  } catch (error) {
    if (error instanceof ClaudeCliError || error instanceof ClaudeJsonParseError) {
      throw new GradingError(`Grading failed: ${error.message}`)
    }
    throw error
  }

  return {
    score: clampScore(raw.score),
    rubric: sanitizeRubric(raw.rubric),
    feedback: sanitizeFeedback(raw.feedback),
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test — writing prompt against the real CLI**

```bash
npx tsx -e "
import { gradeLesson } from './src/server/grading/grade-with-claude'
gradeLesson('writing', 'Write 3 sentences about your morning routine.', { text: 'I wake up at 7. I eat breakfast. I go to work by bus.' }).then((r) => console.log(JSON.stringify(r, null, 2)))
"
```
Expected: a printed object with `score` (a number 0-100), `rubric` (an object with at least `completion`/`structure` keys), and `feedback.summary`/`strengths`/`improvements` all populated with real English sentences referencing the submission — not placeholders, not a thrown error.

- [ ] **Step 4: Manual smoke test — malformed input doesn't crash**

```bash
npx tsx -e "
import { gradeLesson } from './src/server/grading/grade-with-claude'
gradeLesson('writing', 'Write 3 sentences about your morning routine.', {}).then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => console.error('threw:', e.message))
"
```
Expected: either a low score with feedback about the empty submission, or (if the CLI truly fails) a `GradingError` message printed via the `threw:` branch — in both cases the process exits cleanly, no unhandled exception/stack trace dump.

- [ ] **Step 5: Commit**

```bash
git add src/server/grading/grade-with-claude.ts
git commit -m "feat(grading): add claude CLI-based gradeLesson for all 5 lesson types"
```

---

### Task 3: Wire `gradeLesson` into `evaluate-item.ts`

**Files:**
- Modify: `src/server/learning/evaluate-item.ts:1-95`

- [ ] **Step 1: Update imports**

In `src/server/learning/evaluate-item.ts`, replace:

```ts
import {
  evaluateLesson,
  PASSING_SCORE,
  type EvaluationInput,
  type LessonType,
} from '@/server/learning/evaluation'
```

with:

```ts
import {
  gradeLesson,
  GradingError,
  PASSING_SCORE,
  type EvaluationInput,
  type LessonType,
  type ScoringResult,
} from '@/server/grading/grade-with-claude'
import { Lesson } from '@/models/Lesson'
```

- [ ] **Step 2: Fetch lesson content and await `gradeLesson`**

Replace this line (currently right after the `safeInput` declaration):

```ts
  const safeInput: EvaluationInput = input ?? {}

  // Run rule-based scoring (no external API calls).
  const { score, rubric, feedback } = evaluateLesson(lessonType, safeInput)
  const passed = score >= PASSING_SCORE
```

with:

```ts
  const safeInput: EvaluationInput = input ?? {}

  const lesson = item.lessonId ? await Lesson.findById(item.lessonId) : null
  const lessonContent = lesson?.content ?? item.content

  let gradingResult: ScoringResult

  try {
    gradingResult = await gradeLesson(lessonType, lessonContent, safeInput)
  } catch (error) {
    if (error instanceof GradingError) {
      throw new EvaluateItemError('Failed to grade submission, please try again', 502)
    }
    throw error
  }

  const { score, rubric, feedback } = gradingResult
  const passed = score >= PASSING_SCORE
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/learning/evaluate-item.ts
git commit -m "feat(grading): wire gradeLesson into evaluateItem, replacing rule-based scoring"
```

---

### Task 4: Update remaining imports from `evaluation.ts`

**Files:**
- Modify: `src/server/learning/completion.ts:24`
- Modify: `src/app/api/today/items/[itemId]/evaluate/route.ts:6`

- [ ] **Step 1: `completion.ts`**

Replace:

```ts
import { PASSING_SCORE, type LessonType } from '@/server/learning/evaluation'
```

with:

```ts
import { PASSING_SCORE, type LessonType } from '@/server/grading/grade-with-claude'
```

- [ ] **Step 2: `evaluate/route.ts`**

Replace:

```ts
import type { EvaluationInput } from '@/server/learning/evaluation'
```

with:

```ts
import type { EvaluationInput } from '@/server/grading/grade-with-claude'
```

- [ ] **Step 3: Confirm no remaining imports from the old module**

```bash
grep -rn "from '@/server/learning/evaluation'" src
```
Expected: no output (empty).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/learning/completion.ts src/app/api/today/items/\[itemId\]/evaluate/route.ts
git commit -m "refactor(grading): point completion.ts and evaluate route at grade-with-claude"
```

---

### Task 5: Delete `evaluation.ts`

**Files:**
- Delete: `src/server/learning/evaluation.ts`

- [ ] **Step 1: Delete the file**

```bash
rm src/server/learning/evaluation.ts
```

- [ ] **Step 2: Confirm nothing references it**

```bash
grep -rn "learning/evaluation" src
```
Expected: no output (empty).

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && yarn lint && yarn build`
Expected: all three pass with no errors.

- [ ] **Step 4: Commit**

```bash
git add -u src/server/learning/evaluation.ts
git commit -m "refactor(grading): remove rule-based evaluation.ts, fully replaced by claude grading"
```

---

### Task 6: End-to-end verification across all 5 lesson types

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run (background): `yarn dev`
Wait for `- Local: http://localhost:3000` in the output.

- [ ] **Step 2: Get today's plan and pick one itemId per lesson type**

```bash
curl -s http://localhost:3000/api/today | npx tsx -e "
let data = ''
process.stdin.on('data', d => data += d)
process.stdin.on('end', () => {
  const plan = JSON.parse(data)
  console.log(plan.items.map((i: any) => ({ id: i.id, type: i.type })))
})
"
```
Expected: a printed list of 5 `{ id, type }` pairs. Keep this list handy for the next step.

- [ ] **Step 3: Submit a real evaluation for the writing item**

```bash
curl -s -X POST http://localhost:3000/api/today/items/<writing-item-id>/evaluate \
  -H "Content-Type: application/json" \
  -d '{"lessonType":"writing","input":{"text":"I wake up at 7 every morning. I eat breakfast and go to work by bus. I usually arrive at 8."}}'
```
Expected: JSON with `ok: true`, `evaluation.score` a real number, `evaluation.feedback.summary`/`strengths`/`improvements` containing real sentences about the submitted text (not generic word-count copy like "You wrote enough words").

- [ ] **Step 4: Repeat for the other 4 lesson types**

```bash
curl -s -X POST http://localhost:3000/api/today/items/<dev-english-item-id>/evaluate \
  -H "Content-Type: application/json" \
  -d '{"lessonType":"dev_english","input":{"text":"The function returns a promise that resolve when fetch is done."}}'

curl -s -X POST http://localhost:3000/api/today/items/<speaking-item-id>/evaluate \
  -H "Content-Type: application/json" \
  -d '{"lessonType":"speaking","input":{"transcript":"Today I plan to finish my project and go for a walk.","recordedSeconds":25}}'

curl -s -X POST http://localhost:3000/api/today/items/<listening-item-id>/evaluate \
  -H "Content-Type: application/json" \
  -d '{"lessonType":"listening","input":{"quizAnswers":[{"questionId":"q1","answer":"the man is running"}]}}'

curl -s -X POST http://localhost:3000/api/today/items/<vocab-item-id>/evaluate \
  -H "Content-Type: application/json" \
  -d '{"lessonType":"vocab","input":{"selectedAnswers":["accomplish"]}}'
```
Expected: each returns `ok: true` with a sensible `score` and non-generic `feedback` text. The `dev_english` example deliberately contains a grammar error ("resolve" should be "resolves") — confirm the feedback or `correctedText` mentions it, which is the concrete proof this is real AI grading and not the old word-count heuristic (the old heuristic would have scored this fine and never mentioned grammar at all).

- [ ] **Step 5: Confirm a CLI failure surfaces as 502, not a crash**

Temporarily rename the `claude` binary's PATH entry to force a failure, or simulate by checking error handling logically: submit an evaluate request while disconnected from the `claude` CLI's auth (skip if you can't safely simulate this — if so, just confirm by code review that `GradingError` → `EvaluateItemError(502, ...)` → route's `error instanceof EvaluateItemError` branch all line up, and move on).

- [ ] **Step 6: Stop the dev server**

```bash
pkill -f "next dev"
```

- [ ] **Step 7: Use superpowers:finishing-a-development-branch to wrap up**
