/**
 * Client-side rule-based listening quiz generator
 * (docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md section 8.2).
 *
 * There is no stored quiz/answer-key data on the Lesson model (content is
 * free text — see evaluation.ts's module doc comment), so this builds a
 * small multiple-choice quiz directly from item.content:
 *
 *   1. Main-idea question: the longest sentence in the content is treated
 *      as the "main idea" (a simple, cheap proxy — the longest sentence
 *      tends to carry the most information in these short lesson texts).
 *      Other sentences become distractors.
 *   2. Phrase-recognition question: a short word/phrase that actually
 *      appears in the content is the correct answer, with fabricated
 *      distractor words that do not appear anywhere in the content.
 *
 * Because we (the client) construct both the question and the correct
 * option, we also know the right answer up front. That lets the view send
 * `expectedAnswers` along with the evaluate request, so the server's
 * generic `scoreQuiz` (src/server/learning/evaluation.ts) can do real
 * correct/incorrect grading instead of falling back to its
 * completeness-only heuristic.
 *
 * Degrades gracefully per section 18 ("must remain usable even with
 * imperfect generated lessons"): if content is too short/sparse to build
 * proper distractors, questions are dropped rather than crashing or
 * showing broken options.
 */

export type QuizOption = {
  value: string
  label: string
}

export type QuizQuestion = {
  id: string
  prompt: string
  options: QuizOption[]
  correctValue: string
}

const FABRICATED_DISTRACTOR_WORDS = [
  'umbrella',
  'spaceship',
  'volcano',
  'tractor',
  'penguin',
  'trumpet',
]

function splitSentences(content: string): string[] {
  return content
    .split(/[.!?\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}

function splitWords(content: string): string[] {
  return content
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z']/g, ''))
    .filter((word) => word.length >= 4)
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildMainIdeaQuestion(sentences: string[]): QuizQuestion | null {
  if (sentences.length === 0) return null

  const sorted = [...sentences].sort((a, b) => b.length - a.length)
  const correct = sorted[0]
  const distractors = sorted.slice(1, 3)

  if (distractors.length === 0) {
    // Not enough real sentences for distractors: degrade to a simple
    // true/false-style question instead of a broken multiple choice.
    return {
      id: 'main_idea',
      prompt: 'Did the lesson talk about this?',
      options: [
        { value: 'yes', label: `Yes — "${correct}"` },
        { value: 'no', label: 'No, something else entirely' },
      ],
      correctValue: 'yes',
    }
  }

  const options = shuffle([
    { value: correct, label: correct },
    ...distractors.map((sentence) => ({ value: sentence, label: sentence })),
  ])

  return {
    id: 'main_idea',
    prompt: 'What is the main idea?',
    options,
    correctValue: correct,
  }
}

function buildPhraseQuestion(content: string, words: string[]): QuizQuestion | null {
  if (words.length === 0) return null

  const lowerContent = content.toLowerCase()
  const correct = words[Math.floor(Math.random() * words.length)]

  const distractors = FABRICATED_DISTRACTOR_WORDS.filter(
    (word) => !lowerContent.includes(word.toLowerCase())
  ).slice(0, 2)

  if (distractors.length === 0) {
    return {
      id: 'phrase_recognition',
      prompt: 'Did you see this word?',
      options: [
        { value: 'yes', label: `Yes — "${correct}"` },
        { value: 'no', label: 'No, I did not see it' },
      ],
      correctValue: 'yes',
    }
  }

  const options = shuffle([
    { value: correct, label: correct },
    ...distractors.map((word) => ({ value: word, label: word })),
  ])

  return {
    id: 'phrase_recognition',
    prompt: 'Which word/phrase appeared in the lesson?',
    options,
    correctValue: correct,
  }
}

export function generateListeningQuiz(content: string): QuizQuestion[] {
  const sentences = splitSentences(content)
  const words = splitWords(content)

  const questions = [
    buildMainIdeaQuestion(sentences),
    buildPhraseQuestion(content, words),
  ].filter((question): question is QuizQuestion => question !== null)

  return questions
}
