# Vietnamese Translation for Lesson Content

## Goal

Let learners see a Vietnamese translation of a lesson's English content while
in Focus Mode (`/learn/[itemId]`), so they can self-check comprehension
without leaving the app. Translation is opt-in (hidden by default) and scoped
to lesson content only — not UI labels.

## Scope

- **In scope:** the raw `item.content` text shown in each of the 5 lesson
  views (listening, vocab, speaking, writing, dev_english).
- **Out of scope:** UI chrome/labels (buttons, nav, headings), word
  definitions on the `Word` model, example sentences on `ExampleSentence`.
  Those can be tackled later as separate, smaller features if wanted.

## Translation source

The `claude` CLI (Claude Code), shelled out from the server process as a
child process — not the MyMemory API, and not the Anthropic SDK/API key.
This app has exactly one user (the developer themselves), running on a
machine already authenticated to Claude Code via OAuth/subscription login,
so shelling out to the locally-installed `claude` binary is acceptable and
needs no new credentials, env vars, or scale/concurrency handling.

Invocation: `claude -p --model haiku "<prompt>"` (confirmed working via live
test — do **not** add `--bare`, since that flag requires
`ANTHROPIC_API_KEY`/`apiKeyHelper` and ignores OAuth, which fails on this
machine with "Not logged in"). The whole lesson `content` is translated in a
single call (not per-line), with a 30 second timeout. On timeout, non-zero
exit, or empty output, the call is treated as a failure (see Error handling).

This reuses a shared low-level wrapper, `src/server/external/claude-cli.ts`,
also used by the AI-grading feature (see
`docs/superpowers/specs/2026-06-20-ai-grading-design.md`):

```ts
export async function runClaude(
  prompt: string,
  opts?: { model?: string; timeoutMs?: number }
): Promise<string>
```

Spawns `claude -p --model <model ?? 'haiku'> <prompt>`, kills the process and
throws `ClaudeCliError` if it exceeds `timeoutMs` (default 30000) or exits
non-zero, and returns trimmed stdout otherwise.

## Timing: on-demand, not pre-generated

Translation happens when the learner taps "Xem nghĩa tiếng Việt" in Focus
Mode, not during lesson generation/sync. This is a deliberate exception to
the existing rule that `/api/today` and learning-flow routes never call
external APIs — the team explicitly chose on-demand for this feature instead
of pre-translating during `generate-lessons-from-cache.ts`. The new
`/translate` endpoint is the only learning-flow route allowed to call out.

## Caching

First successful translation for a given `Lesson` is persisted on the
`Lesson` document (`translatedContent`, `translatedAt`). Subsequent views of
the same lesson — by anyone — reuse the cached value with no further API
calls. This keeps MyMemory's free-tier quota usage bounded to roughly one
call-burst per unique lesson, not per view.

**Exception — virtual fallback lessons:** `createVirtualFallbackLesson()`
(in `generate-lessons-from-cache.ts`) builds an in-memory lesson that is
never persisted to MongoDB (see existing comment in that file). When a
`DailyPlan` item points at one of these (no matching `Lesson` document
exists), the translate endpoint translates `item.content` directly and
returns it without attempting to cache, since there is no document to cache
it on.

## Data model change

`src/models/Lesson.ts` gains two optional fields, additive-only (existing
documents simply have them as `null`/absent until first translated):

```ts
translatedContent: { type: String, default: null },
translatedAt: { type: Date, default: null },
```

## Translation module

New file `src/server/translation/translate-content.ts`:

- `translateToVietnamese(text: string): Promise<string>` — calls
  `runClaude()` once with the whole `text` wrapped in a prompt instructing
  Claude to translate it to Vietnamese, preserve line breaks/structure, and
  reply with **only** the translation (no commentary, no markdown). Throws
  `TranslationFailedError` if `runClaude` throws (timeout/non-zero exit) or
  returns empty output.
- `getOrTranslateLessonContent(lessonId, fallbackContent): Promise<string>`:
  1. If `lessonId` resolves to a real `Lesson` doc with `translatedContent`
     already set, return it (no API call).
  2. If it resolves to a real `Lesson` doc without a cached translation,
     translate `fallbackContent` (the lesson's own `content`, read off the
     doc) and persist it via `findOneAndUpdate` (`translatedContent`,
     `translatedAt`), then return it.
  3. If no `Lesson` doc is found (virtual fallback case), translate
     `fallbackContent` (the `DailyPlan` item's `content`, passed in by the
     caller) and return it without persisting.

## API route

New file `src/app/api/today/items/[itemId]/translate/route.ts`, following
the existing thin-handler pattern (see `evaluate/route.ts`):

- `POST` only, async `params: Promise<{ itemId: string }>`.
- Looks up today's `DailyPlan` and the item matching `itemId` (same lookup
  pattern already used in `tracking.ts`/`evaluate-item.ts`) to get
  `lessonId` and the item's own `content` as the fallback text.
- Calls `getOrTranslateLessonContent(item.lessonId, item.content)`.
- Returns `{ translatedContent: string }`.
- Errors (item not found, MyMemory failure) return appropriate HTTP status
  codes with a generic message, following the existing `TrackingError` /
  `EvaluateItemError` pattern — introduce a small `TranslateError` class for
  this.

No changes to `/api/today` itself — it keeps returning only `content`, never
`translatedContent`, so the existing "never calls external APIs" guarantee
for that route is untouched.

## UI

New shared component `src/components/learning/TranslatableContent.tsx`,
replacing the five duplicated instances of:

```tsx
<p className="mt-3 whitespace-pre-wrap text-ink-soft">{item.content}</p>
```

across `ListeningLessonView.tsx`, `VocabLessonView.tsx`,
`SpeakingLessonView.tsx`, `WritingLessonView.tsx`, and
`DevEnglishLessonView.tsx`.

Props: `{ itemId: string; content: string }`.

Behavior:
- Always renders the English `content` paragraph (unchanged visually).
- Renders a small text button below it: "Xem nghĩa tiếng Việt".
- On first tap: shows a lightweight loading state, calls
  `POST /api/today/items/{itemId}/translate`, then renders the returned
  Vietnamese text in a second paragraph (visually distinguished — e.g.
  muted/italic) directly under the English text. Button label flips to
  "Ẩn nghĩa tiếng Việt".
- Result is cached in component state for the lesson's lifetime in Focus
  Mode — toggling hide/show again does not re-fetch.
- On fetch failure: button reverts to "Xem nghĩa tiếng Việt" and shows a
  small inline "Không dịch được, thử lại" message; tapping again retries.

## Error handling

- `claude` CLI failure (timeout, non-zero exit, empty output) → the whole
  translate call fails; the route returns 502 with `{ error: 'Failed to
  translate content' }`. The client shows the retry message above. No
  partial/garbled translations are cached.
- If `itemId` doesn't match today's plan → 404, same shape as the existing
  `evaluate`/`tracking` routes.

## Testing

- Unit test `runClaude`'s timeout/non-zero-exit handling (mock
  `child_process.spawn`).
- Unit test `getOrTranslateLessonContent`'s three branches (cached / needs
  translation / virtual fallback) with a mocked `Lesson` model and a mocked
  `translateToVietnamese`.
- Manual verification in browser: toggle button in each of the 5 lesson
  types, confirm cache behavior (second visit to the same lesson does not
  trigger a new `claude` call — verify via server log or by checking
  `Lesson.translatedAt` doesn't change).
