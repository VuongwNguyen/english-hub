# English Hub — Learning Experience Redesign

## 1. Context

English Hub is a daily English learning app.

Current direction:

```text
5 small lessons per day
No toxic streak
No manual pressure
Auto tracking
Daily stats
Content generated from MongoDB cache
```

Current daily lesson types:

```text
listening
vocab
speaking
writing
dev_english
```

Current data pipeline:

```text
topic taxonomy
→ sync_tasks
→ datamuse_expand
→ dictionary_enrich
→ tatoeba_sentence_search
→ words + example_sentences
→ generate lessons
→ /today
```

Important rule:

```text
/api/today must read from MongoDB only.
Do not call external APIs from /api/today.
```

---

# 2. Big Goal

Redesign the learning experience so the app feels like a real daily learning product, not just a task list.

The desired experience:

```text
Open app
→ See today's learning plan
→ Click Continue Learning
→ Enter Focus Learning Mode
→ Study one item at a time
→ App tracks progress automatically
→ App evaluates the answer/practice
→ App gives feedback
→ Completed automatically if passed
→ Next lesson
→ Daily summary
```

---

# 3. Four Problems to Solve

## Problem 1 — Learning UX is not learning-first

Current UX feels like:

```text
/today → list of cards → user decides what to do
```

This is too dashboard-like.

Target UX:

```text
/today → Continue Learning → Focus Mode → guided practice → next lesson → summary
```

## Problem 2 — Tracking exists but evaluation is missing

Tracking can answer:

```text
Did the user open the lesson?
How long did they study?
How far did they progress?
```

But it cannot answer:

```text
Did the user understand?
Was the answer good?
Was the speaking/writing acceptable?
Should the lesson be completed?
```

Need a new evaluation layer.

## Problem 3 — Listening and Speaking do not have a real practice loop

Listening should not complete just because audio played.

Speaking should not complete just because the page was open.

Need:

```text
Listen/Speak
→ Practice
→ Check
→ Feedback
→ Complete if passed
```

## Problem 4 — Content is growing but not intelligent enough

More data does not mean better learning.

Need quality and personalization:

```text
quality score
difficulty score
topic coverage
skill balance
weakness-based review
daily plan recommendation
```

---

# 4. Implementation Phases

Implement all phases in one coordinated effort, but keep code modular.

Recommended order:

```text
Phase 1: Learning UX / Focus Mode
Phase 2: Automatic tracking upgrade
Phase 3: Evaluation layer
Phase 4: Listening & Speaking practice loops
Phase 5: Content quality + personalization
Phase 6: Final polish + build
```

Do not run full data sync during implementation.

Allowed test command:

```bash
MAX_ROUNDS=1 SYNC_WORKER_BATCH_SIZE=5 SYNC_WORKER_CONCURRENCY=1 yarn sync:until-done
```

Required final command:

```bash
yarn build
```

---

# 5. Phase 1 — Learning UX / Focus Mode

## 5.1 Goal

Redesign `/today` into a Daily Learning Hub.

It should answer:

```text
What should I learn today?
How much have I completed?
What should I click next?
```

## 5.2 `/today` UI requirements

Create a calm Daily Learning Hub.

Required sections:

```text
Hero:
- Today's English
- short friendly subtitle
- daily progress count
- primary CTA: Continue Learning

Progress:
- 0/5 completed
- active minutes
- calm progress bar

Lesson list:
- compact cards
- status: pending / in_progress / completed / skipped
- type icon/label
- topic/title
- estimated time

Footer:
- no guilt
- no toxic streak language
```

Example copy:

```text
Today's English
Five small lessons. No pressure.

Continue Learning

Progress: 2 / 5 completed
Your progress is saved automatically.
```

## 5.3 Continue Learning behavior

When user clicks `Continue Learning`:

```text
1. Find first item with status in_progress.
2. If none, find first pending item.
3. If all completed/skipped, go to daily summary.
4. Navigate to /learn/[itemId].
```

## 5.4 Focus Learning screen

Add route:

```text
/learn/[itemId]
```

This route displays only one lesson item.

Layout:

```text
Header:
← Back to Today
Lesson type · Progress %

Main:
Lesson-specific content

Footer:
Progress saved automatically
Skip
Next Lesson
```

Rules:

```text
- Do not show all lessons here.
- Do not use Done as primary action.
- Show calm progress.
- Show feedback after evaluation.
- Show Next only when item is completed/skipped or after evaluation result.
```

## 5.5 Daily summary

After all 5 items are completed/skipped, show:

```text
Nice work.
You practiced English for X minutes today.

Completed:
✓ Vocabulary
✓ Writing
✓ Listening

Come back tomorrow for a fresh set.
```

Route can be:

```text
/today/summary
```

or embedded inside `/today`.

---

# 6. Phase 2 — Automatic Tracking Upgrade

## 6.1 Goal

Replace manual Done behavior with automatic tracking.

Manual Done can remain as fallback/debug, but must not be primary UI.

## 6.2 Required statuses

DailyPlan item should support:

```ts
status: "pending" | "in_progress" | "completed" | "skipped";
startedAt?: Date;
completedAt?: Date;
skippedAt?: Date;
activeSeconds?: number;
progressPercent?: number;
```

## 6.3 Add LearningSession model

Create model:

```text
src/models/LearningSession.ts
```

Suggested schema:

```ts
{
  userId?: string;
  anonymousId?: string;

  dateKey: string;
  dailyPlanId: ObjectId;
  itemId: string;
  lessonId: ObjectId;
  lessonType: "listening" | "vocab" | "speaking" | "writing" | "dev_english";

  status: "active" | "completed" | "abandoned";

  startedAt: Date;
  lastActiveAt: Date;
  completedAt?: Date;

  activeSeconds: number;
  progressPercent: number;

  eventCounts: {
    heartbeat: number;
    interaction: number;
    audioProgress: number;
    textChange: number;
    record: number;
    evaluation: number;
  };

  metrics: {
    audioProgressPercent?: number;
    viewedWordCount?: number;
    totalWordCount?: number;
    practiceCount?: number;
    recordedSeconds?: number;
    speechAttemptCount?: number;
    typedWordCount?: number;
    typedCharacterCount?: number;
    interactionCount?: number;
  };

  metadata?: Record<string, unknown>;
}
```

Indexes:

```ts
LearningSessionSchema.index({ dateKey: 1, itemId: 1 });
LearningSessionSchema.index({ dailyPlanId: 1, itemId: 1 }, { unique: true });
LearningSessionSchema.index({ userId: 1, dateKey: 1 });
LearningSessionSchema.index({ anonymousId: 1, dateKey: 1 });
```

## 6.4 Add tracking event API

Create endpoint:

```text
POST /api/today/items/:itemId/tracking/event
```

Request body:

```ts
{
  eventType:
    | "start"
    | "heartbeat"
    | "interaction"
    | "audio_progress"
    | "text_change"
    | "record_progress"
    | "evaluation";

  payload?: {
    activeSecondsDelta?: number;
    progressPercent?: number;

    audioProgressPercent?: number;
    currentTime?: number;
    duration?: number;

    viewedWordCount?: number;
    totalWordCount?: number;
    practiceCount?: number;

    recordedSeconds?: number;
    speechAttemptCount?: number;

    typedWordCount?: number;
    typedCharacterCount?: number;
    draftText?: string;

    interactionCount?: number;
  };
}
```

Server behavior:

```text
1. Get today's DailyPlan.
2. Find item by itemId.
3. Create/get LearningSession.
4. pending → in_progress on start/interact.
5. Update metrics.
6. Recalculate progressPercent.
7. Update DailyStats activeSeconds.
8. Return updated item/session/stats.
```

## 6.5 Heartbeat rules

Client sends heartbeat every 15 seconds only when:

```text
- tab is visible
- item detail is open
- browser is online
- user has interacted recently
```

Stop heartbeat when:

```text
- tab hidden
- route changed
- item closed
- window blur if needed
```

Server must cap:

```text
activeSecondsDelta max 30 seconds
```

---

# 7. Phase 3 — Evaluation Layer

## 7.1 Goal

Add evaluation so the app can judge learning quality.

Tracking answers:

```text
Did the learner do something?
```

Evaluation answers:

```text
Did the learner do it well enough?
```

## 7.2 Add LessonEvaluation model

Create:

```text
src/models/LessonEvaluation.ts
```

Suggested schema:

```ts
{
  dateKey: string;
  dailyPlanId: ObjectId;
  itemId: string;
  lessonId: ObjectId;
  lessonType: "listening" | "vocab" | "speaking" | "writing" | "dev_english";

  status: "pending" | "evaluated" | "needs_retry";

  score: number; // 0-100
  passed: boolean;

  rubric: {
    completion?: number;
    accuracy?: number;
    vocabulary?: number;
    structure?: number;
    clarity?: number;
    pronunciation?: number;
  };

  answers?: unknown;

  userInput?: {
    text?: string;
    transcript?: string;
    selectedAnswers?: string[];
  };

  feedback: {
    summary: string;
    strengths: string[];
    improvements: string[];
    correctedText?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}
```

Indexes:

```ts
LessonEvaluationSchema.index(
  { dailyPlanId: 1, itemId: 1 },
  { unique: true }
);
LessonEvaluationSchema.index({ dateKey: 1, lessonType: 1 });
```

## 7.3 Add evaluation API

Create:

```text
POST /api/today/items/:itemId/evaluate
```

Request examples:

Listening:

```ts
{
  lessonType: "listening",
  input: {
    selectedAnswers: ["a", "c"],
    quizAnswers: [
      { questionId: "main_idea", answer: "a" },
      { questionId: "detail_1", answer: "c" }
    ]
  }
}
```

Writing:

```ts
{
  lessonType: "writing",
  input: {
    text: "Today I want to improve my English because..."
  }
}
```

Speaking:

```ts
{
  lessonType: "speaking",
  input: {
    recordedSeconds: 22,
    speechAttemptCount: 1,
    transcript: "This morning I planned my work..."
  }
}
```

Response:

```ts
{
  ok: true,
  evaluation: {
    score: 78,
    passed: true,
    feedback: {
      summary: "Good work. Your answer is clear enough.",
      strengths: ["You wrote enough words."],
      improvements: ["Try to use more specific vocabulary."]
    }
  },
  item: {
    status: "completed",
    progressPercent: 100
  }
}
```

## 7.4 Completion rule

Item should be completed when:

```text
tracking progress is enough
AND evaluation passes
```

Some simple v1 rules:

```text
Listening:
audioProgressPercent >= 75 AND quiz score >= 60

Vocab:
practiceCount >= 5 OR quiz score >= 60

Speaking:
recordedSeconds >= 20 OR speechAttemptCount >= 2
If transcript exists, check target keywords/phrases.

Writing:
score >= 60

Dev English:
score >= 60
```

Do not double count completed items.

If item already completed:

```text
- keep completed
- update evaluation if needed
- do not increment DailyStats completedItems again
```

---

# 8. Phase 4 — Listening and Speaking Practice Loops

## 8.1 ListeningLessonView

Create or update:

```text
ListeningLessonView
```

Required behavior:

```text
- Show audio player if audioUrl exists.
- Track onPlay as interaction.
- Track onTimeUpdate as audio_progress.
- Track onEnded as audio_progress 100.
- Throttle audio_progress to every 3–5 seconds.
- After audio progress >= 75%, show mini quiz.
- Evaluate quiz answers.
- Complete only if quiz passed.
```

UI:

```text
Listen to this short audio.

[Audio Player]

Progress: 45%

After listening:
Question 1: What is the main idea?
Question 2: Which phrase did you hear?

[Check Answer]
```

No primary Done button.

## 8.2 Listening evaluation

If lesson has no quiz data, generate simple quiz from lesson content if possible.

Fallback:

```text
- one main idea question
- one phrase recognition question
```

Do not call external APIs.

Use only lesson data already stored in MongoDB.

## 8.3 SpeakingLessonView

Create or update:

```text
SpeakingLessonView
```

Use:

```ts
navigator.mediaDevices.getUserMedia({ audio: true })
MediaRecorder
```

Required behavior:

```text
- Start recording
- Track interaction
- Track record_progress every 1 second
- Stop recording
- Stop microphone tracks
- Show recordedSeconds
- Optional transcript if browser supports Web Speech API
- Evaluate attempt
```

Safety:

```text
- If MediaRecorder unsupported, show fallback message.
- If mic permission denied, show helpful message.
- Do not crash.
```

UI:

```text
Speak for 20 seconds.

Prompt:
Talk about your plan today.

Tip:
Start with "Today, I plan to..."

[Start Recording]
Recording: 12 / 20 seconds
[Stop]

Feedback after evaluation.
```

## 8.4 Speaking evaluation

V1 should be simple.

Pass if:

```text
recordedSeconds >= 20
OR speechAttemptCount >= 2
```

If transcript exists, improve score by checking:

```text
- enough words
- contains target keywords
- related to prompt
```

Feedback example:

```text
Good attempt. You spoke long enough.
Try to use the phrase: "I plan to..."
```

---

# 9. Phase 5 — Content Quality and Personalization

## 9.1 Problem

The app may have many words/sentences, but daily lessons can still feel random.

Need quality and personalization layer.

## 9.2 Add fields to Lesson model if missing

Suggested fields:

```ts
qualityScore?: number; // 0-100
difficultyScore?: number; // 0-100
topicGroup?: string;
topics?: string[];
targetSkills?: Array<"listening" | "vocab" | "speaking" | "writing" | "dev_english">;
estimatedMinutes?: number;
reviewPriority?: number;
```

Do not break existing data.

Use optional fields and backfill safely.

## 9.3 Quality scoring

Create helper:

```text
src/server/lesson-quality.ts
```

Score lesson based on:

```text
+ has title
+ has clear instruction
+ has examples
+ has enough words/sentences
+ has target vocabulary
+ has quiz/evaluation data
- too short
- missing content
- duplicate/near-duplicate
```

Example rough logic:

```text
base 50
+10 has examples
+10 has target words
+10 has clear prompt
+10 has evaluation questions
+10 reasonable length
cap 100
```

## 9.4 Difficulty scoring

Create helper:

```text
src/server/lesson-difficulty.ts
```

V1 difficulty can be rule-based:

```text
short/common words → easier
longer text → harder
more target words → harder
writing/speaking prompts with abstract topic → harder
```

Difficulty range:

```text
0-30 beginner
31-70 intermediate
71-100 advanced
```

## 9.5 Personalization source

Use existing stats/evaluations:

```text
DailyStats
LearningSession
LessonEvaluation
DailyPlan history
```

Compute weak skills:

```text
- skill with low average score
- skill often skipped
- skill with low completion
- recently failed evaluation
```

## 9.6 Daily rotation update

Update daily plan selection to consider:

```text
- avoid recently used lessons
- avoid repeating same topic group too much
- prefer qualityScore high
- match difficulty to user performance
- include weak skill review
- always keep 5 lesson types
```

Daily plan must still include:

```text
listening
vocab
speaking
writing
dev_english
```

Suggested priority:

```text
1. item for weak skill if exists
2. high quality lesson
3. topic not used recently
4. difficulty suitable
5. fallback to existing rotation
```

## 9.7 Review recommendations

If evaluation failed:

```text
- mark item needs_retry
- increase reviewPriority for related lesson/topic/skill
- future daily plan should include similar but not identical practice
```

---

# 10. UI Components Required

Create or update:

```text
DailyLearningHub
DailyProgressHero
LessonStatusCard
ContinueLearningButton
FocusLearningPage
LessonProgressHeader
ListeningLessonView
VocabLessonView
SpeakingLessonView
WritingLessonView
DevEnglishLessonView
EvaluationFeedbackPanel
DailySummary
```

## 10.1 Shared lesson view props

Use a consistent interface:

```ts
type LessonViewProps = {
  item: DailyPlanItem;
  lesson: Lesson;
  session?: LearningSession;
  evaluation?: LessonEvaluation;
  onTrackingEvent: (eventType: string, payload?: unknown) => Promise<void>;
  onEvaluate: (input: unknown) => Promise<void>;
  onSkip: () => Promise<void>;
  onNext: () => void;
};
```

Adapt names to existing code.

---

# 11. UI Copy Guidelines

Tone:

```text
calm
encouraging
practical
no guilt
no toxic streak
```

Use:

```text
Your progress is saved automatically.
Good attempt.
Try this next time.
Nice work today.
```

Avoid:

```text
You failed.
You lost your streak.
You are behind.
Come back or lose progress.
```

---

# 12. Backward Compatibility

Keep existing APIs if already present:

```text
POST /api/today/items/:id/done
POST /api/today/items/:id/skip
```

But:

```text
- Done must not be primary UI.
- Skip must remain visible.
- Existing daily stats should not break.
- Existing daily plans should still render.
```

---

# 13. Important Technical Rules

## 13.1 Idempotency

Must be safe if same event is sent multiple times.

Rules:

```text
- Same session should not duplicate.
- Completed item should not increment stats twice.
- Evaluation should update existing record for same dailyPlanId + itemId.
- Heartbeat activeSecondsDelta must be capped.
```

## 13.2 No external API inside learning flow

Do not call:

```text
Dictionary API
Datamuse
Tatoeba
OpenAI
other external APIs
```

from:

```text
/api/today
/api/today/items/:itemId/tracking/event
/api/today/items/:itemId/evaluate
/learn/[itemId]
```

Evaluation v1 must be rule-based and use existing lesson data only.

AI evaluation can be added later, but not in this implementation.

## 13.3 Do not run full sync

Agent must not run:

```bash
yarn sync:until-done:aggressive
yarn sync:until-done
```

unless with:

```bash
MAX_ROUNDS=1
```

Allowed:

```bash
yarn build
MAX_ROUNDS=1 SYNC_WORKER_BATCH_SIZE=5 SYNC_WORKER_CONCURRENCY=1 yarn sync:until-done
```

---

# 14. Suggested File Structure

Adapt to existing repo.

Suggested additions:

```text
src/models/LearningSession.ts
src/models/LessonEvaluation.ts

src/server/learning/tracking.ts
src/server/learning/evaluation.ts
src/server/learning/progress.ts
src/server/learning/completion.ts
src/server/learning/quality.ts
src/server/learning/difficulty.ts
src/server/learning/personalization.ts

src/app/api/today/items/[itemId]/tracking/event/route.ts
src/app/api/today/items/[itemId]/evaluate/route.ts

src/app/learn/[itemId]/page.tsx

src/components/learning/DailyLearningHub.tsx
src/components/learning/DailyProgressHero.tsx
src/components/learning/LessonStatusCard.tsx
src/components/learning/FocusLearningPage.tsx
src/components/learning/EvaluationFeedbackPanel.tsx

src/components/learning/views/ListeningLessonView.tsx
src/components/learning/views/VocabLessonView.tsx
src/components/learning/views/SpeakingLessonView.tsx
src/components/learning/views/WritingLessonView.tsx
src/components/learning/views/DevEnglishLessonView.tsx
```

If project has different folders, follow existing conventions.

---

# 15. Acceptance Criteria

## Learning UX

```text
[ ] /today has hero, progress, Continue Learning CTA.
[ ] Continue Learning opens first in-progress/pending item.
[ ] /learn/[itemId] exists.
[ ] Focus screen shows one lesson only.
[ ] Done button removed from primary UI.
[ ] Skip still works.
[ ] Daily summary appears when all items are done/skipped.
```

## Tracking

```text
[ ] Opening lesson sends start event.
[ ] Heartbeat runs only when active/visible.
[ ] Heartbeat stops when hidden/route change.
[ ] DailyPlan item becomes in_progress automatically.
[ ] activeSeconds updates.
[ ] progressPercent updates.
[ ] No double counting.
```

## Evaluation

```text
[ ] LessonEvaluation model exists.
[ ] POST /api/today/items/:itemId/evaluate exists.
[ ] Writing evaluation works.
[ ] Dev English evaluation works.
[ ] Vocab evaluation works.
[ ] Listening quiz evaluation works.
[ ] Speaking basic evaluation works.
[ ] Feedback panel displays score/summary/strengths/improvements.
[ ] Completed only after tracking + evaluation pass where applicable.
```

## Listening / Speaking

```text
[ ] Listening tracks audio_progress.
[ ] Listening throttles audio progress events.
[ ] Listening shows quiz after enough progress.
[ ] Speaking uses MediaRecorder if supported.
[ ] Speaking tracks recordedSeconds.
[ ] Speaking stops mic tracks after recording.
[ ] Speaking handles permission denied.
```

## Content intelligence

```text
[ ] Lesson qualityScore is computed or safely defaulted.
[ ] difficultyScore is computed or safely defaulted.
[ ] Daily rotation prefers quality lessons.
[ ] Daily rotation avoids too much topic repetition.
[ ] Daily rotation considers weak skill/retry if data exists.
[ ] Existing daily plan generation still works.
```

## Build

```text
[ ] yarn build passes.
[ ] No full sync was run.
[ ] No external APIs are called from learning routes.
```

---

# 16. Manual Test Plan

## Test 1 — Today page

```text
1. Open /today.
2. See hero and progress.
3. Click Continue Learning.
4. Should navigate to /learn/[itemId].
```

## Test 2 — Tracking

```text
1. Open a lesson.
2. Wait 20 seconds while tab visible.
3. Check item status is in_progress.
4. Hide tab.
5. Heartbeat should stop.
```

## Test 3 — Writing

```text
1. Open writing lesson.
2. Type 30+ words.
3. Click Check my answer.
4. See feedback.
5. If passed, item becomes completed.
```

## Test 4 — Listening

```text
1. Open listening lesson.
2. Play audio.
3. Reach 75% progress.
4. Answer quiz.
5. Passed quiz completes item.
```

## Test 5 — Speaking

```text
1. Open speaking lesson.
2. Start recording.
3. Record 20 seconds.
4. Stop.
5. See feedback.
6. Item completes if passed.
```

## Test 6 — Summary

```text
1. Complete/skip all 5 items.
2. Go back to /today.
3. See daily summary.
```

---

# 17. Final Agent Prompt

Use this prompt:

```text
Read docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md and implement all phases.

Goal:
Upgrade English Hub from a task-list learning app into a real guided daily learning experience.

Implement:
1. Daily Learning Hub redesign for /today.
2. Continue Learning CTA.
3. Focus Learning route /learn/[itemId].
4. Automatic tracking with LearningSession model.
5. Tracking event API.
6. LessonEvaluation model.
7. Evaluation API.
8. Listening practice loop with audio progress + quiz.
9. Speaking practice loop with MediaRecorder + feedback.
10. Writing and Dev English evaluation.
11. Vocab evaluation.
12. Feedback UI.
13. Daily summary.
14. Content qualityScore/difficultyScore helpers.
15. Rotation improvements using quality, topic coverage, and weak-skill review.

Rules:
- Do not remove existing topics/data.
- Do not delete existing APIs unless replaced safely.
- Do not call external APIs from /api/today or learning routes.
- Do not run full sync.
- Keep Skip.
- Remove Done as primary UI.
- Keep calm UX, no toxic streak/guilt language.
- Ensure idempotency.
- Run yarn build and fix all errors.

Testing:
- You may run:
  MAX_ROUNDS=1 SYNC_WORKER_BATCH_SIZE=5 SYNC_WORKER_CONCURRENCY=1 yarn sync:until-done
- You must run:
  yarn build

After implementation, summarize:
- files changed
- models added
- APIs added
- UI routes/components added
- tracking behavior
- evaluation behavior
- build result
```

---

# 18. Notes for Agent

If a lesson does not have enough data for a perfect experience, use safe fallback UI.

Examples:

```text
No audioUrl:
- Show listening text/phrases
- Use interaction + quiz if available
- Do not crash

No quiz:
- Generate local rule-based simple questions from stored lesson content
- Or show "Check understanding" with available phrases

No MediaRecorder:
- Show unsupported message
- Allow text transcript fallback for speaking practice

No evaluation data:
- Rule-based score from user input length, keywords, and structure
```

The app must remain usable even with imperfect generated lessons.
