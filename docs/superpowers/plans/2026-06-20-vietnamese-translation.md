# Vietnamese Lesson Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let learners toggle a Vietnamese translation of a lesson's English content while in Focus Mode (`/learn/[itemId]`), translated on-demand via the local `claude` CLI and cached on the `Lesson` document after first use.

**Architecture:** A new low-level wrapper (`src/server/external/claude-cli.ts`) shells out to the locally-installed `claude` binary (this app has exactly one user, on a machine already authenticated via OAuth — no API keys, no scale concerns). A new orchestrator (`src/server/learning/translate-item.ts`) resolves `itemId` → today's `DailyPlan` item → `Lesson`, returns a cached translation if one exists, otherwise calls `claude` for a translation and caches it (skipping the cache step for virtual fallback lessons, which have no DB document). A thin route (`POST /api/today/items/[itemId]/translate`) exposes this. A new shared component (`TranslatableContent`) replaces the five duplicated `<p>{item.content}</p>` lines across the lesson views and owns the toggle/fetch/error UI.

**Tech Stack:** Next.js App Router (async route params), Mongoose, `claude` CLI (Claude Code, shelled out via `node:child_process`), React client components.

**No test framework note:** This codebase has no Jest/Vitest/etc. configured — `package.json` only has `lint`/`build`/`seed`/sync scripts. The rest of the app (including the entire prior Focus Mode redesign) was verified via `yarn build`, `npx tsc --noEmit`, and manual curl/browser checks, not unit tests. This plan follows that existing precedent rather than introducing a new test framework as an unrelated side effect. Each task instead has a concrete type-check and/or manual verification step.

**Deviations from the design spec (behavior-preserving):**
- The spec described a single `src/server/translation/translate-content.ts` module. This plan instead puts the generic, reusable `claude` CLI wrapper in `src/server/external/claude-cli.ts` (matching the existing one-file-per-provider convention: `datamuse.ts`, `tatoeba.ts`, `dictionary.ts` — `claude-cli.ts` is the "provider" here, also reused by the separate AI-grading feature) and folds the one-line `translateToVietnamese` prompt/call directly into the orchestrator `src/server/learning/translate-item.ts` (matching the existing `evaluate-item.ts` / `tracking.ts` orchestrator convention, and avoiding a single-function file). Same behavior, file boundaries that match this codebase's existing folder semantics.
- The cache-miss-but-lesson-exists branch translates the `content` string passed in by the caller (the `DailyPlan` item's own content snapshot) rather than re-reading `lesson.content` off the DB document. These are always the same text in practice (the item snapshot is copied from the lesson at plan-generation time), and translating exactly what's rendered on screen removes any chance of the two diverging.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/models/Lesson.ts` (modify) | Add `translatedContent` / `translatedAt` cache fields. |
| `src/server/external/claude-cli.ts` (create) | Generic `claude` CLI wrapper: `runClaude(prompt, opts)`, no DB access, no translation/grading-specific logic. Reused by the AI-grading feature. |
| `src/server/learning/translate-item.ts` (create) | Orchestrator: `translateItem({ itemId })` — DailyPlan/item lookup, Lesson cache read/write, builds the translation prompt and calls `runClaude`. |
| `src/app/api/today/items/[itemId]/translate/route.ts` (create) | Thin POST handler. |
| `src/components/learning/TranslatableContent.tsx` (create) | Toggle button + English/Vietnamese display + fetch/error state. |
| `src/components/learning/views/WritingLessonView.tsx` (modify) | Replace content `<p>` with `<TranslatableContent>`. |
| `src/components/learning/views/ListeningLessonView.tsx` (modify) | Same. |
| `src/components/learning/views/SpeakingLessonView.tsx` (modify) | Same (uses `mt-1` spacing variant). |
| `src/components/learning/views/VocabLessonView.tsx` (modify) | Same. |
| `src/components/learning/views/DevEnglishLessonView.tsx` (modify) | Same. |

---

### Task 1: Add translation cache fields to the Lesson model

**Files:**
- Modify: `src/models/Lesson.ts:90-97` (the existing Phase 5 personalization block, right before the closing of the schema fields object)

- [ ] **Step 1: Add the two fields**

In `src/models/Lesson.ts`, find this block (it's the last set of fields before the schema options object):

```ts
    reviewPriority: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
)
```

Replace it with:

```ts
    reviewPriority: {
      type: Number,
      default: 0,
    },
    // Vietnamese translation cache (on-demand, see
    // src/server/learning/translate-item.ts). Additive-only optional
    // fields — existing documents simply have them as null until the first
    // learner toggles "Xem nghĩa tiếng Việt" for that lesson.
    translatedContent: {
      type: String,
      default: null,
    },
    translatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/models/Lesson.ts
git commit -m "feat(lesson): add translatedContent/translatedAt cache fields"
```

---

### Task 2: `claude` CLI wrapper

**Files:**
- Create: `src/server/external/claude-cli.ts`

- [ ] **Step 1: Write the wrapper**

```ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Generic wrapper around the locally-installed `claude` CLI (Claude Code).
 * This app has exactly one user, on a machine already authenticated via
 * OAuth/subscription login — no API key is configured, so callers must
 * never pass `--bare` (it requires ANTHROPIC_API_KEY/apiKeyHelper and
 * ignores OAuth; confirmed it fails with "Not logged in" on this machine).
 *
 * Shared by both the translation feature (translate-item.ts) and the
 * AI-grading feature (grade-with-claude.ts) — this file knows nothing about
 * either domain, just how to invoke the binary and surface failures.
 */
export class ClaudeCliError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClaudeCliError'
  }
}

export async function runClaude(
  prompt: string,
  opts: { model?: string; timeoutMs?: number } = {}
): Promise<string> {
  const { model = 'haiku', timeoutMs = 30000 } = opts

  let stdout: string

  try {
    const result = await execFileAsync(
      'claude',
      ['-p', '--model', model, prompt],
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
    )
    stdout = result.stdout
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new ClaudeCliError(`claude CLI invocation failed: ${message}`)
  }

  const trimmed = stdout.trim()

  if (!trimmed) {
    throw new ClaudeCliError('claude CLI returned empty output')
  }

  return trimmed
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test against the real CLI**

Run:
```bash
npx tsx -e "
import { runClaude } from './src/server/external/claude-cli'
runClaude('Translate this to Vietnamese, reply with ONLY the translation, no commentary: \"Open the source link. Listen for 5 minutes.\"').then(console.log)
"
```
Expected: a single line/short block of Vietnamese text printed, e.g. something like:
```
Mở liên kết nguồn. Nghe trong 5 phút.
```
This takes a few seconds (it's a real CLI invocation). If it throws a
`ClaudeCliError` mentioning "Not logged in", the `claude` CLI on this
machine isn't authenticated — run `claude /login` once outside this app and
retry.

- [ ] **Step 4: Commit**

```bash
git add src/server/external/claude-cli.ts
git commit -m "feat(external): add claude CLI wrapper for shelling out to claude -p"
```

---

### Task 3: Translate orchestrator with Lesson-level caching

**Files:**
- Create: `src/server/learning/translate-item.ts`

- [ ] **Step 1: Write the orchestrator**

```ts
/**
 * Orchestration for POST /api/today/items/:itemId/translate.
 *
 * Looks up today's DailyPlan + item (same lookup pattern as
 * evaluate-item.ts / tracking.ts), then resolves a Vietnamese translation
 * of the item's content: reuse a cached Lesson.translatedContent if one
 * exists, otherwise translate via the claude CLI (claude-cli.ts) and cache
 * it.
 *
 * Virtual fallback lessons (see createVirtualFallbackLesson in
 * generate-lessons-from-cache.ts) are never persisted to MongoDB, so
 * item.lessonId for those points at an ObjectId with no matching Lesson
 * document. Lesson.findById returns null for them, which this module
 * treats as "translate but don't cache" rather than an error.
 */
import { connectMongo } from '@/lib/mongoose'
import { getVietnamTodayDate } from '@/lib/date'
import { DailyPlan } from '@/models/DailyPlan'
import { Lesson } from '@/models/Lesson'
import { runClaude, ClaudeCliError } from '@/server/external/claude-cli'

export class TranslateItemError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Translates the whole `text` in a single claude call (not per-line — the
 * model can preserve structure on its own), instructing it to reply with
 * only the translation. Wraps ClaudeCliError as TranslateItemError(502) so
 * the route handler doesn't need to know about the CLI layer at all.
 */
async function translateToVietnamese(text: string): Promise<string> {
  const prompt = `Translate the following English text to Vietnamese. Preserve the original line breaks and structure exactly. Reply with ONLY the Vietnamese translation — no commentary, no markdown, no quotes around it.\n\n${text}`

  try {
    return await runClaude(prompt, { model: 'haiku', timeoutMs: 30000 })
  } catch (error) {
    if (error instanceof ClaudeCliError) {
      throw new TranslateItemError('Failed to translate content', 502)
    }
    throw error
  }
}

export async function translateItem({ itemId }: { itemId: string }) {
  await connectMongo()

  const today = getVietnamTodayDate()

  const plan = await DailyPlan.findOne({ date: today })

  if (!plan) {
    throw new TranslateItemError('Today plan not found', 404)
  }

  const item = plan.items.id(itemId)

  if (!item) {
    throw new TranslateItemError('Daily plan item not found', 404)
  }

  const lesson = item.lessonId ? await Lesson.findById(item.lessonId) : null

  if (lesson?.translatedContent) {
    return { translatedContent: lesson.translatedContent as string }
  }

  const translatedContent = await translateToVietnamese(item.content)

  if (lesson) {
    await Lesson.findOneAndUpdate(
      { _id: lesson._id },
      { $set: { translatedContent, translatedAt: new Date() } }
    )
  }

  return { translatedContent }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/learning/translate-item.ts
git commit -m "feat(translation): add translateItem orchestrator with Lesson caching"
```

---

### Task 4: API route + end-to-end + caching verification

**Files:**
- Create: `src/app/api/today/items/[itemId]/translate/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from 'next/server'
import {
  translateItem,
  TranslateItemError,
} from '@/server/learning/translate-item'

export async function POST(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await context.params

    const result = await translateItem({ itemId })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof TranslateItemError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error(error)

    return NextResponse.json(
      { error: 'Failed to translate content' },
      { status: 502 }
    )
  }
}
```

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && yarn build`
Expected: both succeed; the route list printed by `yarn build` includes `/api/today/items/[itemId]/translate`.

- [ ] **Step 3: Start the dev server**

Run (background): `yarn dev`
Wait for `- Local: http://localhost:3000` in the output.

- [ ] **Step 4: Get today's plan and pick a real itemId**

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
Expected: a printed list of 5 `{ id, type }` pairs (one per lesson type: listening, vocab, speaking, writing, dev_english). Copy one `id` for the next step.

- [ ] **Step 5: First call — exercises the translate-and-cache path**

```bash
time curl -s -X POST http://localhost:3000/api/today/items/<paste-id-here>/translate | head -c 500
```
Expected: JSON body `{"translatedContent":"...Vietnamese text..."}` with line structure matching the original content's line count. Note the `real` time printed by `time` (this call shells out to `claude`, so it should take a few seconds — roughly the same ballpark as the Task 2 smoke test).

- [ ] **Step 6: Second call — exercises the cache-hit path**

```bash
time curl -s -X POST http://localhost:3000/api/today/items/<same-id>/translate | head -c 500
```
Expected: identical `translatedContent` to Step 5, and a noticeably faster `real` time (no `claude` CLI round trip — single DB read).

- [ ] **Step 7: Confirm the cache actually wrote to Mongo, not just request-level memoization**

```bash
npx tsx --env-file=.env.local -e "
import { connectMongo } from './src/lib/mongoose'
import { DailyPlan } from './src/models/DailyPlan'
import { Lesson } from './src/models/Lesson'
import { getVietnamTodayDate } from './src/lib/date'

async function run() {
  await connectMongo()
  const plan = await DailyPlan.findOne({ date: getVietnamTodayDate() })
  const item = plan!.items.id('<same-id>')
  const lesson = await Lesson.findById(item!.lessonId)
  console.log({ translatedAt: lesson?.translatedAt, hasContent: !!lesson?.translatedContent })
  process.exit(0)
}

run()
"
```
Expected: `translatedAt` is a real timestamp and `hasContent: true`. (If the itemId you picked happens to be a virtual fallback lesson, `lesson` will print `null` here — that's the expected "don't cache" path; pick a different item to verify the caching path specifically, since on a populated DB virtual fallbacks are rare.)

- [ ] **Step 8: Error path — bogus itemId returns 404**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/today/items/000000000000000000000000/translate
```
Expected: `404`

- [ ] **Step 9: Stop the dev server**

```bash
kill %1 2>/dev/null || pkill -f "next dev"
```

- [ ] **Step 10: Commit**

```bash
git add src/app/api/today/items/\[itemId\]/translate/route.ts
git commit -m "feat(translation): add POST /api/today/items/:itemId/translate route"
```

---

### Task 5: TranslatableContent component

**Files:**
- Create: `src/components/learning/TranslatableContent.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'

type Props = {
  itemId: string
  content: string
  className?: string
}

type Status = 'idle' | 'loading' | 'shown' | 'error'

export function TranslatableContent({
  itemId,
  content,
  className = 'mt-3',
}: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [translatedContent, setTranslatedContent] = useState<string | null>(
    null
  )

  async function handleToggle() {
    if (status === 'shown') {
      setStatus('idle')
      return
    }

    if (translatedContent) {
      setStatus('shown')
      return
    }

    setStatus('loading')

    try {
      const response = await fetch(
        `/api/today/items/${itemId}/translate`,
        { method: 'POST' }
      )

      if (!response.ok) {
        throw new Error('Failed to translate content')
      }

      const data: { translatedContent: string } = await response.json()

      setTranslatedContent(data.translatedContent)
      setStatus('shown')
    } catch (error) {
      console.error(error)
      setStatus('error')
    }
  }

  return (
    <div>
      <p className={`${className} whitespace-pre-wrap text-ink-soft`}>
        {content}
      </p>

      {status === 'shown' && translatedContent && (
        <p className="mt-2 whitespace-pre-wrap text-sm italic text-muted">
          {translatedContent}
        </p>
      )}

      <button
        type="button"
        onClick={handleToggle}
        disabled={status === 'loading'}
        className="mt-2 text-sm font-medium text-ink-soft transition-colors hover:text-accent disabled:opacity-50"
      >
        {status === 'loading'
          ? 'Đang dịch...'
          : status === 'shown'
            ? 'Ẩn nghĩa tiếng Việt'
            : 'Xem nghĩa tiếng Việt'}
      </button>

      {status === 'error' && (
        <p className="mt-1 text-xs text-terracotta">
          Không dịch được, thử lại.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: both pass with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/learning/TranslatableContent.tsx
git commit -m "feat(translation): add TranslatableContent toggle component"
```

---

### Task 6: Wire TranslatableContent into all 5 lesson views

**Files:**
- Modify: `src/components/learning/views/WritingLessonView.tsx:1-5,36`
- Modify: `src/components/learning/views/ListeningLessonView.tsx:259`
- Modify: `src/components/learning/views/SpeakingLessonView.tsx:321`
- Modify: `src/components/learning/views/VocabLessonView.tsx:89`
- Modify: `src/components/learning/views/DevEnglishLessonView.tsx:1-5,34`

- [ ] **Step 1: WritingLessonView.tsx**

Add the import near the top (alongside the existing imports):

```tsx
import { TranslatableContent } from '../TranslatableContent'
```

Replace:

```tsx
      <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>
```

with:

```tsx
      <TranslatableContent itemId={item.id} content={item.content} />
```

- [ ] **Step 2: ListeningLessonView.tsx**

Add the same import line near the top.

Replace (inside the `else` branch around line 259):

```tsx
          <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>
```

with:

```tsx
          <TranslatableContent itemId={item.id} content={item.content} />
```

- [ ] **Step 3: SpeakingLessonView.tsx**

Add the same import line near the top.

Replace (this one uses `mt-1`, pass it through via `className`):

```tsx
        <p className="mt-1 whitespace-pre-wrap text-ink-soft">{item.content}</p>
```

with:

```tsx
        <TranslatableContent
          itemId={item.id}
          content={item.content}
          className="mt-1"
        />
```

- [ ] **Step 4: VocabLessonView.tsx**

Add the same import line near the top.

Replace (inside the `entries.length === 0` branch around line 89):

```tsx
        <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>
```

with:

```tsx
        <TranslatableContent itemId={item.id} content={item.content} />
```

- [ ] **Step 5: DevEnglishLessonView.tsx**

Add the same import line near the top.

Replace:

```tsx
      <p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>
```

with:

```tsx
      <TranslatableContent itemId={item.id} content={item.content} />
```

- [ ] **Step 6: Type-check, lint, build**

Run: `npx tsc --noEmit && yarn lint && yarn build`
Expected: all three pass with no errors.

- [ ] **Step 7: Manual browser verification across all 5 lesson types**

Run: `yarn dev` (background), then in a browser:

1. Open `http://localhost:3000/today`.
2. Click into a **vocab** lesson via "Continue Learning" (or navigate directly to `/learn/<itemId>` for a vocab item's id from Task 4 Step 4). Confirm "Xem nghĩa tiếng Việt" appears under the prompt. Click it — confirm a loading state briefly appears, then Vietnamese text appears below the English content. Click again — confirm it hides (button reverts to "Xem nghĩa tiếng Việt") without a second network request (check the Network tab: only one POST to `/translate` for that item across both clicks).
3. Repeat step 2 for a **writing**, **speaking**, **listening**, and **dev_english** item — confirm the toggle appears and works in each of the 5 views, with the speaking view rendering it inside its "Prompt" box at the original tighter `mt-1` spacing.
4. Reload the page and re-open the same item — confirm clicking the toggle again returns the *same* Vietnamese text instantly (cache hit, confirmed in Task 4's verification at the API layer; this step confirms it end-to-end through the UI).

- [ ] **Step 8: Stop the dev server**

```bash
pkill -f "next dev"
```

- [ ] **Step 9: Commit**

```bash
git add src/components/learning/views/WritingLessonView.tsx \
        src/components/learning/views/ListeningLessonView.tsx \
        src/components/learning/views/SpeakingLessonView.tsx \
        src/components/learning/views/VocabLessonView.tsx \
        src/components/learning/views/DevEnglishLessonView.tsx
git commit -m "feat(translation): wire TranslatableContent into all 5 lesson views"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full build**

Run: `npx tsc --noEmit && yarn lint && yarn build`
Expected: all pass cleanly, route list includes `/api/today/items/[itemId]/translate`.

- [ ] **Step 2: Confirm `/api/today` is unaffected**

```bash
yarn dev &
sleep 3
curl -s http://localhost:3000/api/today | grep -o "translatedContent" || echo "OK: no translatedContent field leaked into /api/today"
pkill -f "next dev"
```
Expected: `OK: no translatedContent field leaked into /api/today` — confirms `/api/today` still never returns translation data and still makes no external calls itself (only the new dedicated route does).

- [ ] **Step 3: Use superpowers:finishing-a-development-branch to wrap up**
