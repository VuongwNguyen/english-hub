/**
 * Rule-based content difficulty scoring (Phase 5, section 9.4 of
 * docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md).
 *
 * V1 is intentionally lightweight and rule-based — no NLP classifier, no
 * external API calls (section 13.2). It combines a few cheap textual
 * signals into a single 0-100 score:
 *
 *   - average word length: longer average word length is treated as a
 *     proxy for less common/more advanced vocabulary (short/common words
 *     read as easier, per the spec).
 *   - average sentence length (words per sentence): longer sentences are
 *     harder to parse, so they push difficulty up.
 *   - content length: more total content roughly correlates with more to
 *     process, but this is a smaller factor than the per-sentence signals
 *     above (a long lesson made of short simple sentences should not score
 *     as "advanced").
 *   - type/topic heuristic: writing and speaking prompts that reference
 *     abstract/opinion topics (e.g. "opinion", "believe", "future",
 *     "society", "imagine", "should") are bumped up, since forming an
 *     opinion about an abstract topic is harder than describing something
 *     concrete. This is a keyword-spotting heuristic, not a real topic
 *     classifier, by design (spec explicitly says "keep this lightweight").
 *
 * Difficulty range per section 9.4:
 *   0-30  beginner
 *   31-70 intermediate
 *   71-100 advanced
 *
 * Pure function, no DB access.
 */

export type DifficultyScoringLesson = {
  type?: string | null
  content?: string | null
  title?: string | null
}

const ABSTRACT_TOPIC_KEYWORDS = [
  'opinion',
  'believe',
  'future',
  'society',
  'imagine',
  'should',
  'environment',
  'culture',
  'technology',
  'government',
  'economy',
  'philosophy',
  'ethic',
  'global',
]

function getWords(content: string | null | undefined): string[] {
  if (!content) return []
  return content
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 0)
}

function getSentences(content: string | null | undefined): string[] {
  if (!content) return []
  return content
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}

function averageWordLength(words: string[]): number {
  if (words.length === 0) return 0
  const totalLength = words.reduce((sum, word) => sum + word.length, 0)
  return totalLength / words.length
}

function averageSentenceLength(content: string | null | undefined): number {
  const sentences = getSentences(content)
  if (sentences.length === 0) return 0

  const totalWords = sentences.reduce(
    (sum, sentence) => sum + getWords(sentence).length,
    0
  )
  return totalWords / sentences.length
}

function hasAbstractTopicSignal(lesson: DifficultyScoringLesson): boolean {
  const haystack = `${lesson.title ?? ''} ${lesson.content ?? ''}`.toLowerCase()
  return ABSTRACT_TOPIC_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

/**
 * Computes a 0-100 difficulty score for a lesson, per section 9.4.
 *
 * Combines:
 *   - average word length (0-30 points): scaled so ~3 letters/word -> 0,
 *     ~8+ letters/word -> full 30.
 *   - average sentence length (0-35 points): scaled so ~4 words/sentence
 *     -> 0, ~20+ words/sentence -> full 35.
 *   - content length (0-15 points): more total words -> slightly harder,
 *     capped so this never dominates the score.
 *   - abstract topic / writing+speaking bump (0-20 points): writing or
 *     speaking prompts that reference abstract/opinion topics get a flat
 *     bump, since producing free-form opinion content is harder than
 *     reciting concrete vocabulary.
 */
export function computeDifficultyScore(lesson: DifficultyScoringLesson): number {
  const words = getWords(lesson.content)

  const wordLengthScore = Math.max(
    0,
    Math.min(30, ((averageWordLength(words) - 3) / 5) * 30)
  )

  const sentenceLengthScore = Math.max(
    0,
    Math.min(35, ((averageSentenceLength(lesson.content) - 4) / 16) * 35)
  )

  const contentLengthScore = Math.max(0, Math.min(15, (words.length / 60) * 15))

  let abstractTopicScore = 0
  if (
    (lesson.type === 'writing' || lesson.type === 'speaking') &&
    hasAbstractTopicSignal(lesson)
  ) {
    abstractTopicScore = 20
  }

  const score =
    wordLengthScore + sentenceLengthScore + contentLengthScore + abstractTopicScore

  return Math.max(0, Math.min(100, Math.round(score)))
}
