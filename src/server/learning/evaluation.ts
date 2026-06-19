/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Rule-based scoring for the evaluation layer (Phase 3, section 7.3 of
 * docs/LEARNING_EXPERIENCE_REDESIGN_AGENT.md).
 *
 * This module is intentionally simple/v1 and rule-based only. No external
 * APIs are called here (see section 13.2). It computes a 0-100 score, a
 * rubric breakdown, and calm feedback copy for each lessonType, given the
 * `input` the client sent to POST /api/today/items/:itemId/evaluate.
 *
 * IMPORTANT — lesson data shape assumptions (documented for later tasks):
 * The current Lesson model (src/models/Lesson.ts) does NOT store any
 * structured answer-key data (no quiz questions/correct answers) and no
 * structured target-vocabulary word list. `content` is a free-text string.
 * Because of that:
 *   - Listening: there is no stored "correct answer" to grade
 *     input.quizAnswers against today. This module accepts whatever shape
 *     the caller sends — an array of
 *     `{ questionId: string; answer: string }` (matching the section 7.3
 *     example) — and scores generically: if the item also supplies an
 *     `expectedAnswers` map (future-proofing for when the listening view
 *     generates quizzes with known correct answers, Phase 4), we grade
 *     against it; otherwise we fall back to a presence/completeness
 *     heuristic (answered all generated questions => high score). Phase 4's
 *     ListeningLessonView should align its quiz payload shape with
 *     `quizAnswers: { questionId, answer }[]` and, if it wants real
 *     correctness grading, include `expectedAnswers: Record<questionId,
 *     answer>` alongside `quizAnswers` in the evaluate request input.
 *   - Vocab: there is no stored target-word list either, so vocab's score
 *     mostly comes from the tracking-side completion path (practiceCount,
 *     see completion.ts) rather than this module. If selectedAnswers /
 *     quizAnswers are supplied, we score them the same generic way as
 *     listening as a smaller bonus path.
 */

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

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function countWords(text: string | undefined | null): number {
  if (!text) return 0
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}

function countSentences(text: string | undefined | null): number {
  if (!text) return 0
  const matches = text.match(/[.!?]+/g)
  return matches ? matches.length : 0
}

/**
 * Generic quiz scoring shared by listening + vocab.
 *
 * If `expectedAnswers` is provided, grade quizAnswers against it (% correct).
 * Otherwise fall back to a "did you answer something" completeness
 * heuristic: presence of any answers is treated as a partial pass, since we
 * have no answer key to check correctness against (see module doc comment).
 */
function scoreQuiz(input: EvaluationInput): {
  score: number
  totalQuestions: number
  answeredQuestions: number
  correctQuestions: number | null
} {
  const quizAnswers = Array.isArray(input.quizAnswers) ? input.quizAnswers : []
  const selectedAnswers = Array.isArray(input.selectedAnswers)
    ? input.selectedAnswers
    : []

  const totalQuestions = quizAnswers.length

  if (totalQuestions === 0) {
    // No structured quiz answers at all. Presence of selectedAnswers is a
    // weaker signal but still treated as a partial-completion heuristic.
    if (selectedAnswers.length > 0) {
      return {
        score: 70,
        totalQuestions: 0,
        answeredQuestions: selectedAnswers.length,
        correctQuestions: null,
      }
    }

    return {
      score: 0,
      totalQuestions: 0,
      answeredQuestions: 0,
      correctQuestions: null,
    }
  }

  const answeredQuestions = quizAnswers.filter(
    (qa) => qa && typeof qa.answer === 'string' && qa.answer.trim().length > 0
  ).length

  const expectedAnswers = input.expectedAnswers

  if (expectedAnswers && Object.keys(expectedAnswers).length > 0) {
    const correctQuestions = quizAnswers.filter(
      (qa) =>
        qa &&
        typeof qa.answer === 'string' &&
        expectedAnswers[qa.questionId] !== undefined &&
        expectedAnswers[qa.questionId] === qa.answer
    ).length

    const score = (correctQuestions / totalQuestions) * 100

    return {
      score,
      totalQuestions,
      answeredQuestions,
      correctQuestions,
    }
  }

  // No answer key available: degrade to a completeness heuristic — answering
  // all generated questions is treated as a pass-level score.
  const score = (answeredQuestions / totalQuestions) * 100

  return {
    score,
    totalQuestions,
    answeredQuestions,
    correctQuestions: null,
  }
}

function evaluateListening(input: EvaluationInput): ScoringResult {
  const quiz = scoreQuiz(input)
  const score = clampScore(quiz.score)

  const strengths: string[] = []
  const improvements: string[] = []

  if (quiz.totalQuestions === 0) {
    if (quiz.answeredQuestions > 0) {
      strengths.push('You answered the listening check.')
    } else {
      improvements.push('Try answering the quick check after listening.')
    }
  } else {
    if (quiz.correctQuestions !== null) {
      strengths.push(
        `You got ${quiz.correctQuestions}/${quiz.totalQuestions} quiz questions right.`
      )
      if (quiz.correctQuestions < quiz.totalQuestions) {
        improvements.push('Listen again for the parts you missed.')
      }
    } else if (quiz.answeredQuestions === quiz.totalQuestions) {
      strengths.push('You answered all the questions.')
    } else {
      improvements.push('Try answering all the questions before checking.')
    }
  }

  const summary =
    score >= 60
      ? 'Good listening. Your answers look solid.'
      : 'Good attempt. Try listening again for the details you missed.'

  return {
    score,
    rubric: { completion: score, accuracy: score },
    feedback: { summary, strengths, improvements },
  }
}

function evaluateVocab(input: EvaluationInput): ScoringResult {
  const hasQuizInput =
    (Array.isArray(input.quizAnswers) && input.quizAnswers.length > 0) ||
    (Array.isArray(input.selectedAnswers) && input.selectedAnswers.length > 0)

  const strengths: string[] = []
  const improvements: string[] = []

  let score: number

  if (hasQuizInput) {
    const quiz = scoreQuiz(input)
    score = clampScore(quiz.score)

    if (score >= 60) {
      strengths.push('You recognized the practiced words well.')
    } else {
      improvements.push('Review the word list again before the quiz.')
    }
  } else {
    // No quiz input at all: vocab completion mostly relies on the
    // tracking-side practiceCount handled in completion.ts. Here we give a
    // modest baseline score so the evaluation record is not meaningless,
    // documented as a smaller bonus path per the task brief.
    score = 50
    improvements.push('Practice a few more words, then check again.')
  }

  const summary =
    score >= 60
      ? 'Nice work reviewing your vocabulary.'
      : 'Good attempt. A bit more practice will help these stick.'

  return {
    score,
    rubric: { completion: score, vocabulary: score },
    feedback: { summary, strengths, improvements },
  }
}

const SPEAKING_KEYWORDS = ['plan', 'today', 'i', 'work', 'morning', 'because']

function evaluateSpeaking(input: EvaluationInput): ScoringResult {
  const recordedSeconds = input.recordedSeconds ?? 0
  const speechAttemptCount = input.speechAttemptCount ?? 0
  const transcript = input.transcript ?? ''

  const strengths: string[] = []
  const improvements: string[] = []

  const lengthOk = recordedSeconds >= 20 || speechAttemptCount >= 2

  let score = lengthOk ? 65 : 35

  if (lengthOk) {
    strengths.push('You spoke long enough.')
  } else {
    improvements.push('Try to speak for at least 20 seconds next time.')
  }

  if (transcript && transcript.trim().length > 0) {
    const wordCount = countWords(transcript)
    const lower = transcript.toLowerCase()
    const keywordHits = SPEAKING_KEYWORDS.filter((kw) =>
      lower.includes(kw)
    ).length

    if (wordCount >= 15) {
      score += 15
      strengths.push('You gave a good amount of detail.')
    } else {
      improvements.push('Try to say a bit more next time.')
    }

    if (keywordHits > 0) {
      score += 10
    } else {
      improvements.push('Try to use the phrase: "I plan to..."')
    }
  }

  score = clampScore(score)

  const summary =
    score >= 60
      ? 'Good attempt. You spoke long enough.'
      : 'Good attempt. Try this next time: speak a little longer.'

  return {
    score,
    rubric: { completion: score, clarity: score, pronunciation: null as any },
    feedback: { summary, strengths, improvements },
  }
}

/**
 * Shared writing/dev_english heuristic: word count baseline + a light
 * structure check (multiple sentences / punctuation present). No required
 * keyword list, since none is specified in lesson data (see module doc
 * comment and Lesson.ts — content is free text with no rubric fields).
 */
function evaluateWrittenText(input: EvaluationInput): ScoringResult {
  const text = input.text ?? ''
  const wordCount = countWords(text)
  const sentenceCount = countSentences(text)

  const strengths: string[] = []
  const improvements: string[] = []

  // Word count component: 0 words -> 0, 30+ words -> full marks for this
  // component, scaled linearly in between.
  const lengthScore = Math.min(100, (wordCount / 30) * 100)

  // Structure component: reward having more than one sentence and some
  // punctuation, as a cheap proxy for structured writing.
  let structureScore = 0
  if (sentenceCount >= 2) {
    structureScore = 100
  } else if (sentenceCount === 1) {
    structureScore = 60
  } else {
    structureScore = wordCount > 0 ? 30 : 0
  }

  const score = clampScore(lengthScore * 0.7 + structureScore * 0.3)

  if (wordCount >= 30) {
    strengths.push('You wrote enough words.')
  } else if (wordCount > 0) {
    improvements.push('Try to write a bit more next time.')
  } else {
    improvements.push('Try writing a few sentences before checking.')
  }

  if (sentenceCount >= 2) {
    strengths.push('Your writing has clear sentence structure.')
  } else {
    improvements.push('Try splitting your ideas into a few sentences.')
  }

  if (improvements.length === 0) {
    improvements.push('Try to use more specific vocabulary.')
  }

  const summary =
    score >= 60
      ? 'Good work. Your answer is clear enough.'
      : 'Good attempt. A little more detail will help.'

  return {
    score,
    rubric: { completion: lengthScore, structure: structureScore },
    feedback: { summary, strengths, improvements },
  }
}

export function evaluateLesson(
  lessonType: LessonType,
  input: EvaluationInput
): ScoringResult {
  switch (lessonType) {
    case 'listening':
      return evaluateListening(input)
    case 'vocab':
      return evaluateVocab(input)
    case 'speaking':
      return evaluateSpeaking(input)
    case 'writing':
    case 'dev_english':
      return evaluateWrittenText(input)
    default:
      return {
        score: 0,
        rubric: {},
        feedback: {
          summary: 'Unable to evaluate this lesson type yet.',
          strengths: [],
          improvements: [],
        },
      }
  }
}
