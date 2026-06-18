# English Daily Hub — External API Data Integration

## 0. Purpose

This document describes how to integrate open external APIs into **English Daily Hub**.

The goal is to avoid using meaningless placeholder seed data and instead build a local MongoDB learning database from external sources.

External APIs are used only for syncing, enriching, and generating learning data.

The app must not call external APIs directly inside the daily learning flow.

---

# 1. Architecture Principle

## 1.1. Correct data flow

```text
External APIs
→ Sync jobs
→ Normalize data
→ Deduplicate / upsert
→ Save to MongoDB cache
→ Generate lessons from cached data
→ Daily rotation reads lessons from MongoDB
→ User studies daily plan
```

## 1.2. Wrong data flow

Do not do this:

```text
GET /api/today
→ Call Dictionary API
→ Call Datamuse API
→ Call Tatoeba API
→ Generate daily plan live
```

This is not allowed because it creates many risks:

```text
External API is slow
External API is down
External API response shape changes
Rate limit affects user experience
User waits too long
Daily plan is not stable
```

## 1.3. MongoDB is the app source of truth

After sync, the app reads only from MongoDB.

The daily rotation engine must read from:

```text
lessons
```

It must not read directly from:

```text
Free Dictionary API
Datamuse API
Tatoeba API
```

---

# 2. External Data Sources

## 2.1. Free Dictionary API

Purpose:

```text
Definitions
Phonetics
Pronunciation audio URLs if available
Parts of speech
Example usage if available
```

Endpoint:

```http
GET https://api.dictionaryapi.dev/api/v2/entries/en/<word>
```

Example:

```http
GET https://api.dictionaryapi.dev/api/v2/entries/en/debug
```

Use this source to enrich:

```text
words
```

---

## 2.2. Datamuse API

Purpose:

```text
Related words
Similar meaning words
Topic-based vocabulary expansion
Autocomplete suggestions
Word metadata
```

Base URL:

```text
https://api.datamuse.com
```

Main endpoint:

```http
GET https://api.datamuse.com/words
```

Examples:

```http
GET https://api.datamuse.com/words?ml=debug&max=20
GET https://api.datamuse.com/words?topics=software,debugging&max=20
GET https://api.datamuse.com/words?ml=deploy&md=dpfr&ipa=1&max=20
```

Suggestion endpoint:

```http
GET https://api.datamuse.com/sug?s=deb&max=10
```

Use this source to discover candidate words, then optionally enrich those words using Free Dictionary API.

---

## 2.3. Tatoeba API

Purpose:

```text
Example sentences
Short sentence bank
Reading practice
Sentence-based vocabulary context
Dev English sentence practice
```

Base URL:

```text
https://api.tatoeba.org
```

Search endpoint:

```http
GET https://api.tatoeba.org/v1/sentences
```

Example:

```http
GET https://api.tatoeba.org/v1/sentences?lang=eng&q=work&word_count=3-12&limit=20
```

Audio warning:

```text
Do not download or reuse Tatoeba audio in MVP.
Only use text sentences unless the license clearly allows reuse.
```

---

# 3. Core Rule: Idempotent Sync

All external sync jobs must be idempotent.

That means:

```text
Running the same sync job 1 time, 10 times, or 100 times must not duplicate data.
```

Do not blindly insert.

Use:

```text
Unique indexes
Stable deduplication keys
updateOne / findOneAndUpdate
upsert: true
$set
$setOnInsert
$addToSet
```

---

# 4. Deduplication Rules

## 4.1. Word dedupe key

For words:

```text
normalizedWord
```

Example:

```text
Debug
debug
 DEBUG
```

All become:

```text
debug
```

Unique index:

```ts
WordSchema.index({ normalizedWord: 1 }, { unique: true })
```

---

## 4.2. Tatoeba sentence dedupe key

For Tatoeba sentences:

```text
sourceName + externalId
```

Example:

```text
sourceName = "tatoeba"
externalId = sentence.id
```

Unique index:

```ts
ExampleSentenceSchema.index(
  { sourceName: 1, externalId: 1 },
  { unique: true }
)
```

---

## 4.3. Sentence without external ID dedupe key

For external sources without stable IDs:

```text
sourceName + contentHash
```

Hash rule:

```text
sha256(sourceName + ":" + normalizedText)
```

---

## 4.4. Lesson dedupe key

For generated lessons:

```text
slug
```

Examples:

```text
vocab-debugging
vocab-api
speaking-debugging
writing-deployment
dev-english-testing
listening-voa-catch-3-words
```

Unique index:

```ts
LessonSchema.index({ slug: 1 }, { unique: true })
```

---

## 4.5. External source dedupe key

For external sources:

```text
key
```

Examples:

```text
free_dictionary_api
datamuse
tatoeba
```

Unique index:

```ts
ExternalSourceSchema.index({ key: 1 }, { unique: true })
```

---

## 4.6. Sync logs are not deduped

`api_sync_runs` should not be deduped.

Each sync run creates a new log record.

This is correct:

```text
sync run 1 → log 1
sync run 2 → log 2
sync run 3 → log 3
```

---

# 5. Data Collections

The app should have these collections:

```text
lessons
dailyplans
dailystats
external_sources
words
example_sentences
api_sync_runs
```

Existing app collections:

```text
lessons
dailyplans
dailystats
```

New external API collections:

```text
external_sources
words
example_sentences
api_sync_runs
```

---

# 6. Collection: external_sources

Stores metadata about external providers.

File:

```text
src/models/ExternalSource.ts
```

```ts
import { Schema, model, models } from 'mongoose'

const ExternalSourceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    baseUrl: {
      type: String,
      required: true,
    },
    docsUrl: {
      type: String,
      default: null,
    },
    licenseNote: {
      type: String,
      default: '',
    },
    attributionRequired: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

ExternalSourceSchema.index({ key: 1 }, { unique: true })

export const ExternalSource =
  models.ExternalSource || model('ExternalSource', ExternalSourceSchema)
```

Seed data:

```ts
export const externalSources = [
  {
    name: 'Free Dictionary API',
    key: 'free_dictionary_api',
    baseUrl: 'https://api.dictionaryapi.dev',
    docsUrl: 'https://dictionaryapi.dev/',
    licenseNote:
      'Used for English definitions, phonetics, and pronunciation audio URLs when available.',
    attributionRequired: false,
    isActive: true,
  },
  {
    name: 'Datamuse API',
    key: 'datamuse',
    baseUrl: 'https://api.datamuse.com',
    docsUrl: 'https://www.datamuse.com/api/',
    licenseNote:
      'Used for related words, vocabulary expansion, and word suggestions.',
    attributionRequired: true,
    isActive: true,
  },
  {
    name: 'Tatoeba API',
    key: 'tatoeba',
    baseUrl: 'https://api.tatoeba.org',
    docsUrl: 'https://api.tatoeba.org/',
    licenseNote:
      'Used for example sentences. Do not reuse audio unless license clearly allows it.',
    attributionRequired: true,
    isActive: true,
  },
]
```

---

# 7. Collection: words

Stores normalized vocabulary records.

File:

```text
src/models/Word.ts
```

```ts
import { Schema, model, models } from 'mongoose'

const WordDefinitionSchema = new Schema(
  {
    partOfSpeech: {
      type: String,
      default: '',
    },
    definition: {
      type: String,
      required: true,
    },
    example: {
      type: String,
      default: '',
    },
    synonyms: {
      type: [String],
      default: [],
    },
    antonyms: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
)

const WordSchema = new Schema(
  {
    word: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedWord: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phonetic: {
      type: String,
      default: '',
    },
    phonetics: {
      type: [
        {
          text: { type: String, default: '' },
          audio: { type: String, default: '' },
        },
      ],
      default: [],
    },
    definitions: {
      type: [WordDefinitionSchema],
      default: [],
    },
    relatedWords: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2'],
      default: 'A2',
    },
    topics: {
      type: [String],
      default: [],
    },
    sourceNames: {
      type: [String],
      default: [],
    },
    sourceUrls: {
      type: [String],
      default: [],
    },
    fetchedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

WordSchema.index({ normalizedWord: 1 }, { unique: true })
WordSchema.index({ topics: 1 })
WordSchema.index({ level: 1 })
WordSchema.index({ isActive: 1 })

export const Word = models.Word || model('Word', WordSchema)
```

Important:

```text
sourceNames and sourceUrls are arrays because the same word can come from multiple sources.
```

---

# 8. Collection: example_sentences

Stores example sentences from Tatoeba or future sources.

File:

```text
src/models/ExampleSentence.ts
```

```ts
import { Schema, model, models } from 'mongoose'

const ExampleSentenceSchema = new Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedText: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    contentHash: {
      type: String,
      required: true,
      trim: true,
    },
    lang: {
      type: String,
      default: 'eng',
    },
    wordCount: {
      type: Number,
      default: 0,
    },
    keywords: {
      type: [String],
      default: [],
    },
    topics: {
      type: [String],
      default: [],
    },
    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2'],
      default: 'A2',
    },
    sourceName: {
      type: String,
      required: true,
      trim: true,
    },
    sourceUrl: {
      type: String,
      default: '',
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
    },
    license: {
      type: String,
      default: '',
    },
    attribution: {
      type: String,
      default: '',
    },
    hasAudio: {
      type: Boolean,
      default: false,
    },
    audioReuseAllowed: {
      type: Boolean,
      default: false,
    },
    fetchedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

ExampleSentenceSchema.index(
  { sourceName: 1, externalId: 1 },
  { unique: true }
)

ExampleSentenceSchema.index({ sourceName: 1, contentHash: 1 })
ExampleSentenceSchema.index({ keywords: 1 })
ExampleSentenceSchema.index({ topics: 1 })
ExampleSentenceSchema.index({ level: 1 })
ExampleSentenceSchema.index({ isActive: 1 })

export const ExampleSentence =
  models.ExampleSentence ||
  model('ExampleSentence', ExampleSentenceSchema)
```

---

# 9. Collection: api_sync_runs

Stores sync history.

File:

```text
src/models/ApiSyncRun.ts
```

```ts
import { Schema, model, models } from 'mongoose'

const ApiSyncRunSchema = new Schema(
  {
    sourceKey: {
      type: String,
      required: true,
      trim: true,
    },
    jobName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['running', 'success', 'failed'],
      default: 'running',
    },
    params: {
      type: Schema.Types.Mixed,
      default: {},
    },
    insertedCount: {
      type: Number,
      default: 0,
    },
    updatedCount: {
      type: Number,
      default: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: '',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

ApiSyncRunSchema.index({ sourceKey: 1, createdAt: -1 })
ApiSyncRunSchema.index({ jobName: 1, createdAt: -1 })
ApiSyncRunSchema.index({ status: 1, createdAt: -1 })

export const ApiSyncRun =
  models.ApiSyncRun || model('ApiSyncRun', ApiSyncRunSchema)
```

---

# 10. Update Lesson model

The existing `Lesson` model must include fields for idempotent generation and usage tracking.

Add these fields:

```ts
slug: {
  type: String,
  required: true,
  unique: true,
  trim: true,
  lowercase: true,
},
generatedFrom: {
  type: String,
  default: '',
},
sourceNames: {
  type: [String],
  default: [],
},
sourceUrls: {
  type: [String],
  default: [],
},
useCount: {
  type: Number,
  default: 0,
},
lastUsedAt: {
  type: Date,
  default: null,
},
lastUsedDate: {
  type: String,
  default: null,
},
regeneratedAt: {
  type: Date,
  default: null,
},
```

Add indexes:

```ts
LessonSchema.index({ slug: 1 }, { unique: true })
LessonSchema.index({ type: 1, isActive: 1 })
LessonSchema.index({ useCount: 1, lastUsedAt: 1 })
```

Reason:

```text
slug prevents duplicate generated lessons.
useCount and lastUsedAt help fallback rotation.
```

---

# 11. Folder Structure

Add:

```text
src/
  models/
    ExternalSource.ts
    Word.ts
    ExampleSentence.ts
    ApiSyncRun.ts

  server/
    external/
      http.ts
      normalize.ts
      hash.ts
      dictionary.ts
      datamuse.ts
      tatoeba.ts
      sync-sources.ts
      sync-words.ts
      sync-sentences.ts
      generate-lessons-from-cache.ts

    data/
      seed-topics.ts
      listening-lessons.ts

  app/
    api/
      external-sync/
        sources/
          route.ts
        words/
          route.ts
        sentences/
          route.ts
        generate-lessons/
          route.ts
        bootstrap/
          route.ts

      admin/
        data-health/
          route.ts
```

---

# 12. Normalize and Hash Helpers

## 12.1. Normalize helper

File:

```text
src/server/external/normalize.ts
```

```ts
export function normalizeWord(input: string) {
  return input.trim().toLowerCase()
}

export function normalizeText(input: string) {
  return input.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

## 12.2. Hash helper

File:

```text
src/server/external/hash.ts
```

```ts
import crypto from 'crypto'

export function createContentHash(input: string) {
  return crypto
    .createHash('sha256')
    .update(input.trim().toLowerCase())
    .digest('hex')
}
```

---

# 13. HTTP Helper

File:

```text
src/server/external/http.ts
```

```ts
type FetchJsonOptions = {
  timeoutMs?: number
  headers?: Record<string, string>
}

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 15000
  )

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} when fetching ${url}`)
    }

    return response.json() as Promise<T>
  } finally {
    clearTimeout(timeout)
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

---

# 14. Free Dictionary Client

File:

```text
src/server/external/dictionary.ts
```

```ts
import { fetchJson } from './http'
import { normalizeWord } from './normalize'

const BASE_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en'

type DictionaryApiResponse = Array<{
  word: string
  phonetic?: string
  phonetics?: Array<{
    text?: string
    audio?: string
  }>
  meanings?: Array<{
    partOfSpeech?: string
    definitions?: Array<{
      definition?: string
      example?: string
      synonyms?: string[]
      antonyms?: string[]
    }>
    synonyms?: string[]
    antonyms?: string[]
  }>
}>

export async function fetchDictionaryWord(word: string) {
  const normalized = normalizeWord(word)
  const url = `${BASE_URL}/${encodeURIComponent(normalized)}`

  const data = await fetchJson<DictionaryApiResponse>(url)

  const first = data[0]

  if (!first) {
    return null
  }

  const definitions =
    first.meanings?.flatMap((meaning) => {
      return (
        meaning.definitions?.map((definition) => ({
          partOfSpeech: meaning.partOfSpeech ?? '',
          definition: definition.definition ?? '',
          example: definition.example ?? '',
          synonyms: definition.synonyms ?? meaning.synonyms ?? [],
          antonyms: definition.antonyms ?? meaning.antonyms ?? [],
        })) ?? []
      )
    }) ?? []

  return {
    word: first.word,
    normalizedWord: normalized,
    phonetic: first.phonetic ?? '',
    phonetics:
      first.phonetics?.map((item) => ({
        text: item.text ?? '',
        audio: item.audio ?? '',
      })) ?? [],
    definitions: definitions.filter((item) => item.definition),
    sourceName: 'free_dictionary_api',
    sourceUrl: url,
    fetchedAt: new Date(),
  }
}
```

---

# 15. Datamuse Client

File:

```text
src/server/external/datamuse.ts
```

```ts
import { fetchJson } from './http'

const BASE_URL = 'https://api.datamuse.com'

type DatamuseWord = {
  word: string
  score?: number
  tags?: string[]
  defs?: string[]
  numSyllables?: number
}

export async function fetchRelatedWords(params: {
  meaningLike?: string
  topics?: string[]
  max?: number
}) {
  const searchParams = new URLSearchParams()

  if (params.meaningLike) {
    searchParams.set('ml', params.meaningLike)
  }

  if (params.topics?.length) {
    searchParams.set('topics', params.topics.join(','))
  }

  searchParams.set('max', String(params.max ?? 20))
  searchParams.set('md', 'dpf')
  searchParams.set('ipa', '1')

  const url = `${BASE_URL}/words?${searchParams.toString()}`

  const data = await fetchJson<DatamuseWord[]>(url)

  return data.map((item) => ({
    word: item.word,
    score: item.score ?? 0,
    tags: item.tags ?? [],
    definitions: item.defs ?? [],
    sourceName: 'datamuse',
    sourceUrl: url,
    fetchedAt: new Date(),
  }))
}

export async function fetchWordSuggestions(prefix: string, max = 10) {
  const searchParams = new URLSearchParams()

  searchParams.set('s', prefix)
  searchParams.set('max', String(max))

  const url = `${BASE_URL}/sug?${searchParams.toString()}`

  return fetchJson<DatamuseWord[]>(url)
}
```

---

# 16. Tatoeba Client

File:

```text
src/server/external/tatoeba.ts
```

```ts
import { fetchJson } from './http'
import { createContentHash } from './hash'
import { normalizeText } from './normalize'

const BASE_URL = 'https://api.tatoeba.org/v1/sentences'

type TatoebaSentenceResponse = {
  data: Array<{
    id: number
    text: string
    lang: string
    license?: string
    owner?: {
      username?: string
    }
    audios?: Array<{
      id?: number
      license?: string
      attribution_url?: string
    }>
  }>
  paging?: {
    total?: number
    has_next?: boolean
    next?: string
  }
}

export async function searchTatoebaSentences(params: {
  keyword: string
  lang?: string
  minWords?: number
  maxWords?: number
  limit?: number
  hasAudio?: boolean
}) {
  const searchParams = new URLSearchParams()

  searchParams.set('lang', params.lang ?? 'eng')
  searchParams.set('q', params.keyword)
  searchParams.set(
    'word_count',
    `${params.minWords ?? 3}-${params.maxWords ?? 12}`
  )
  searchParams.set('limit', String(params.limit ?? 20))
  searchParams.set('is_unapproved', 'no')
  searchParams.set('showtrans', 'none')

  if (params.hasAudio) {
    searchParams.set('has_audio', 'yes')
  }

  const url = `${BASE_URL}?${searchParams.toString()}`
  const response = await fetchJson<TatoebaSentenceResponse>(url)

  return response.data.map((sentence) => {
    const normalizedText = normalizeText(sentence.text)
    const wordCount = sentence.text.split(/\s+/).filter(Boolean).length

    return {
      text: sentence.text,
      normalizedText,
      contentHash: createContentHash(`tatoeba:${normalizedText}`),
      lang: sentence.lang,
      wordCount,
      keywords: [params.keyword.toLowerCase()],
      sourceName: 'tatoeba',
      sourceUrl: url,
      externalId: String(sentence.id),
      license: sentence.license ?? '',
      attribution: sentence.owner?.username ?? '',
      hasAudio: Boolean(sentence.audios?.length),
      audioReuseAllowed:
        sentence.audios?.some((audio) => Boolean(audio.license)) ?? false,
      fetchedAt: new Date(),
      isActive: true,
    }
  })
}
```

---

# 17. Seed Topics

File:

```text
src/server/data/seed-topics.ts
```

```ts
export const seedTopics = [
  {
    key: 'debugging',
    words: ['debug', 'bug', 'error', 'crash', 'fix', 'issue', 'log'],
  },
  {
    key: 'api',
    words: ['api', 'request', 'response', 'server', 'endpoint', 'retry'],
  },
  {
    key: 'deployment',
    words: ['deploy', 'release', 'build', 'rollback', 'production'],
  },
  {
    key: 'testing',
    words: ['test', 'bug', 'verify', 'check', 'expected', 'actual'],
  },
  {
    key: 'meeting',
    words: ['meeting', 'discuss', 'explain', 'question', 'update'],
  },
  {
    key: 'daily',
    words: ['today', 'tomorrow', 'work', 'learn', 'practice'],
  },
]
```

---

# 18. Listening Lessons

Listening is special.

Do not scrape BBC, VOA, or British Council content.

Only store:

```text
sourceUrl
sourceName
short task instruction
estimatedMinutes
```

File:

```text
src/server/data/listening-lessons.ts
```

```ts
export const listeningLessons = [
  {
    slug: 'listening-bbc-catch-3-words',
    title: 'BBC Listening: Catch 3 words',
    topic: 'listening',
    level: 'A2',
    type: 'listening',
    content: [
      'Open the source link.',
      'Listen for 5 minutes.',
      'Write down 3 words you hear.',
      'Do not worry about understanding everything.',
    ].join('\n'),
    sourceNames: ['bbc_learning_english'],
    sourceUrls: ['https://www.bbc.co.uk/learningenglish'],
    estimatedMinutes: 5,
    isActive: true,
  },
  {
    slug: 'listening-voa-shadow-1-sentence',
    title: 'VOA Listening: Shadow 1 sentence',
    topic: 'listening',
    level: 'A2',
    type: 'listening',
    content: [
      'Open the source link.',
      'Listen for 5 minutes.',
      'Pick 1 sentence you can hear.',
      'Repeat it out loud 3 times.',
    ].join('\n'),
    sourceNames: ['voa_learning_english'],
    sourceUrls: ['https://learningenglish.voanews.com/'],
    estimatedMinutes: 5,
    isActive: true,
  },
  {
    slug: 'listening-british-council-save-1-phrase',
    title: 'British Council Listening: Save 1 phrase',
    topic: 'listening',
    level: 'A2',
    type: 'listening',
    content: [
      'Open the source link.',
      'Choose one short listening activity.',
      'Listen once without pausing.',
      'Save one useful phrase.',
    ].join('\n'),
    sourceNames: ['british_council'],
    sourceUrls: ['https://learnenglish.britishcouncil.org/'],
    estimatedMinutes: 10,
    isActive: true,
  },
]
```

---

# 19. Sync External Sources

File:

```text
src/server/external/sync-sources.ts
```

```ts
import { connectMongo } from '@/lib/mongoose'
import { ExternalSource } from '@/models/ExternalSource'

const externalSources = [
  {
    name: 'Free Dictionary API',
    key: 'free_dictionary_api',
    baseUrl: 'https://api.dictionaryapi.dev',
    docsUrl: 'https://dictionaryapi.dev/',
    licenseNote:
      'Used for English definitions, phonetics, and pronunciation audio URLs when available.',
    attributionRequired: false,
    isActive: true,
  },
  {
    name: 'Datamuse API',
    key: 'datamuse',
    baseUrl: 'https://api.datamuse.com',
    docsUrl: 'https://www.datamuse.com/api/',
    licenseNote:
      'Used for related words, vocabulary expansion, and word suggestions.',
    attributionRequired: true,
    isActive: true,
  },
  {
    name: 'Tatoeba API',
    key: 'tatoeba',
    baseUrl: 'https://api.tatoeba.org',
    docsUrl: 'https://api.tatoeba.org/',
    licenseNote:
      'Used for example sentences. Do not reuse audio unless license clearly allows it.',
    attributionRequired: true,
    isActive: true,
  },
]

export async function syncExternalSources() {
  await connectMongo()

  let insertedCount = 0
  let updatedCount = 0

  for (const source of externalSources) {
    const result = await ExternalSource.updateOne(
      { key: source.key },
      {
        $set: source,
      },
      { upsert: true }
    )

    if (result.upsertedCount > 0) insertedCount++
    else updatedCount++
  }

  return {
    insertedCount,
    updatedCount,
  }
}
```

---

# 20. Sync Words

File:

```text
src/server/external/sync-words.ts
```

```ts
import { connectMongo } from '@/lib/mongoose'
import { Word } from '@/models/Word'
import { ApiSyncRun } from '@/models/ApiSyncRun'
import { seedTopics } from '@/server/data/seed-topics'
import { fetchDictionaryWord } from './dictionary'
import { fetchRelatedWords } from './datamuse'
import { normalizeWord } from './normalize'
import { sleep } from './http'

export async function syncWordsFromExternalApis() {
  await connectMongo()

  const run = await ApiSyncRun.create({
    sourceKey: 'dictionary_datamuse',
    jobName: 'sync_words',
    status: 'running',
    params: {
      topics: seedTopics.map((topic) => topic.key),
    },
    startedAt: new Date(),
  })

  let insertedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  try {
    const wordsToSync = new Map<
      string,
      {
        topics: string[]
        relatedWords: string[]
        tags: string[]
        sourceUrls: string[]
      }
    >()

    for (const topic of seedTopics) {
      for (const word of topic.words) {
        const normalized = normalizeWord(word)
        const existing = wordsToSync.get(normalized)

        wordsToSync.set(normalized, {
          topics: Array.from(new Set([...(existing?.topics ?? []), topic.key])),
          relatedWords: existing?.relatedWords ?? [],
          tags: existing?.tags ?? [],
          sourceUrls: existing?.sourceUrls ?? [],
        })
      }

      try {
        const related = await fetchRelatedWords({
          meaningLike: topic.key,
          topics: [topic.key],
          max: 20,
        })

        for (const item of related) {
          const normalized = normalizeWord(item.word)
          const existing = wordsToSync.get(normalized)

          wordsToSync.set(normalized, {
            topics: Array.from(
              new Set([...(existing?.topics ?? []), topic.key])
            ),
            relatedWords: Array.from(
              new Set([...(existing?.relatedWords ?? []), item.word])
            ),
            tags: Array.from(new Set([...(existing?.tags ?? []), ...item.tags])),
            sourceUrls: Array.from(
              new Set([...(existing?.sourceUrls ?? []), item.sourceUrl])
            ),
          })
        }
      } catch (error) {
        errorCount++
      }
    }

    for (const [word, meta] of wordsToSync.entries()) {
      try {
        const dictionaryData = await fetchDictionaryWord(word)

        if (!dictionaryData) {
          skippedCount++
          continue
        }

        const result = await Word.updateOne(
          { normalizedWord: word },
          {
            $set: {
              word: dictionaryData.word,
              normalizedWord: word,
              phonetic: dictionaryData.phonetic,
              phonetics: dictionaryData.phonetics,
              definitions: dictionaryData.definitions,
              fetchedAt: new Date(),
              isActive: true,
            },
            $addToSet: {
              topics: { $each: meta.topics },
              relatedWords: { $each: meta.relatedWords },
              tags: { $each: meta.tags },
              sourceNames: {
                $each: ['free_dictionary_api', 'datamuse'],
              },
              sourceUrls: {
                $each: [dictionaryData.sourceUrl, ...meta.sourceUrls],
              },
            },
          },
          { upsert: true }
        )

        if (result.upsertedCount > 0) insertedCount++
        else updatedCount++

        await sleep(150)
      } catch (error) {
        errorCount++
      }
    }

    await ApiSyncRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'success',
          insertedCount,
          updatedCount,
          skippedCount,
          errorCount,
          finishedAt: new Date(),
        },
      }
    )

    return {
      insertedCount,
      updatedCount,
      skippedCount,
      errorCount,
    }
  } catch (error: any) {
    await ApiSyncRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'failed',
          errorMessage: error.message,
          insertedCount,
          updatedCount,
          skippedCount,
          errorCount,
          finishedAt: new Date(),
        },
      }
    )

    throw error
  }
}
```

Important sync behavior:

```text
Words are deduped by normalizedWord.
Topics are merged using $addToSet.
Source names are merged using $addToSet.
Existing words are updated, not duplicated.
```

---

# 21. Sync Sentences

File:

```text
src/server/external/sync-sentences.ts
```

```ts
import { connectMongo } from '@/lib/mongoose'
import { ExampleSentence } from '@/models/ExampleSentence'
import { ApiSyncRun } from '@/models/ApiSyncRun'
import { seedTopics } from '@/server/data/seed-topics'
import { searchTatoebaSentences } from './tatoeba'
import { normalizeText } from './normalize'
import { sleep } from './http'

export async function syncSentencesFromTatoeba() {
  await connectMongo()

  const run = await ApiSyncRun.create({
    sourceKey: 'tatoeba',
    jobName: 'sync_sentences',
    status: 'running',
    params: {
      topics: seedTopics.map((topic) => topic.key),
    },
    startedAt: new Date(),
  })

  let insertedCount = 0
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  try {
    for (const topic of seedTopics) {
      for (const keyword of topic.words) {
        try {
          const sentences = await searchTatoebaSentences({
            keyword,
            lang: 'eng',
            minWords: 3,
            maxWords: 12,
            limit: 20,
          })

          for (const sentence of sentences) {
            if (!isGoodSentence(sentence.text)) {
              skippedCount++
              continue
            }

            const result = await ExampleSentence.updateOne(
              {
                sourceName: sentence.sourceName,
                externalId: sentence.externalId,
              },
              {
                $set: {
                  text: sentence.text,
                  normalizedText: normalizeText(sentence.text),
                  contentHash: sentence.contentHash,
                  lang: sentence.lang,
                  wordCount: sentence.wordCount,
                  sourceUrl: sentence.sourceUrl,
                  license: sentence.license,
                  attribution: sentence.attribution,
                  hasAudio: sentence.hasAudio,
                  audioReuseAllowed: sentence.audioReuseAllowed,
                  fetchedAt: new Date(),
                  isActive: true,
                  level: guessSentenceLevel(sentence.text),
                },
                $addToSet: {
                  topics: topic.key,
                  keywords: keyword.toLowerCase(),
                },
              },
              { upsert: true }
            )

            if (result.upsertedCount > 0) insertedCount++
            else updatedCount++
          }

          await sleep(200)
        } catch (error) {
          errorCount++
        }
      }
    }

    await ApiSyncRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'success',
          insertedCount,
          updatedCount,
          skippedCount,
          errorCount,
          finishedAt: new Date(),
        },
      }
    )

    return {
      insertedCount,
      updatedCount,
      skippedCount,
      errorCount,
    }
  } catch (error: any) {
    await ApiSyncRun.updateOne(
      { _id: run._id },
      {
        $set: {
          status: 'failed',
          errorMessage: error.message,
          insertedCount,
          updatedCount,
          skippedCount,
          errorCount,
          finishedAt: new Date(),
        },
      }
    )

    throw error
  }
}

function isGoodSentence(text: string) {
  const trimmed = text.trim()

  if (trimmed.length < 10) return false
  if (trimmed.length > 180) return false
  if (/[\[\]{}<>]/.test(trimmed)) return false
  if (trimmed.split(/\s+/).length > 16) return false

  return true
}

function guessSentenceLevel(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length

  if (words <= 6) return 'A1'
  if (words <= 10) return 'A2'
  if (words <= 14) return 'B1'

  return 'B2'
}
```

Important sync behavior:

```text
Tatoeba sentences are deduped by sourceName + externalId.
Topics and keywords are merged using $addToSet.
Same sentence can belong to multiple topics.
```

---

# 22. Generate Lessons From Cached Data

File:

```text
src/server/external/generate-lessons-from-cache.ts
```

```ts
import { connectMongo } from '@/lib/mongoose'
import { Word } from '@/models/Word'
import { ExampleSentence } from '@/models/ExampleSentence'
import { Lesson } from '@/models/Lesson'
import { listeningLessons } from '@/server/data/listening-lessons'
import { toSlug } from './normalize'

export async function generateLessonsFromCachedData() {
  await connectMongo()

  const listeningResult = await upsertListeningLessons()
  const vocabResult = await generateVocabLessons()
  const sentenceResult = await generateSentenceLessons()
  const speakingResult = await generateSpeakingLessons()
  const writingResult = await generateWritingLessons()

  return {
    listeningResult,
    vocabResult,
    sentenceResult,
    speakingResult,
    writingResult,
  }
}

async function upsertListeningLessons() {
  let inserted = 0
  let updated = 0

  for (const lesson of listeningLessons) {
    const result = await Lesson.updateOne(
      { slug: lesson.slug },
      {
        $set: {
          ...lesson,
          generatedFrom: 'static_listening_tasks',
          regeneratedAt: new Date(),
        },
        $setOnInsert: {
          useCount: 0,
          lastUsedAt: null,
          lastUsedDate: null,
        },
      },
      { upsert: true }
    )

    if (result.upsertedCount > 0) inserted++
    else updated++
  }

  return { inserted, updated }
}

async function generateVocabLessons() {
  const topics = await Word.distinct('topics')

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const topic of topics) {
    const words = await Word.find({
      topics: topic,
      isActive: true,
    })
      .limit(5)
      .lean()

    if (words.length < 3) {
      skipped++
      continue
    }

    const content = words
      .map((word: any) => {
        const firstDefinition = word.definitions?.[0]?.definition ?? ''
        return `- ${word.word}: ${firstDefinition}`
      })
      .join('\n')

    const slug = `vocab-${toSlug(topic)}`

    const result = await Lesson.updateOne(
      { slug },
      {
        $set: {
          slug,
          title: `Vocabulary pack: ${topic}`,
          topic,
          level: 'A2',
          type: 'vocab',
          content,
          estimatedMinutes: 5,
          wordsCount: words.length,
          speakingMinutes: 0,
          writingSentences: 0,
          sourceNames: ['free_dictionary_api', 'datamuse'],
          sourceUrls: ['https://dictionaryapi.dev/', 'https://www.datamuse.com/api/'],
          isActive: true,
          generatedFrom: 'words_cache',
          regeneratedAt: new Date(),
        },
        $setOnInsert: {
          useCount: 0,
          lastUsedAt: null,
          lastUsedDate: null,
        },
      },
      { upsert: true }
    )

    if (result.upsertedCount > 0) inserted++
    else updated++
  }

  return { inserted, updated, skipped }
}

async function generateSentenceLessons() {
  const topics = await ExampleSentence.distinct('topics')

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const topic of topics) {
    const sentences = await ExampleSentence.find({
      topics: topic,
      isActive: true,
    })
      .limit(5)
      .lean()

    if (sentences.length < 3) {
      skipped++
      continue
    }

    const content = [
      'Read these sentences out loud:',
      '',
      ...sentences.map((sentence: any) => `- ${sentence.text}`),
    ].join('\n')

    const slug = `dev-english-sentences-${toSlug(topic)}`

    const result = await Lesson.updateOne(
      { slug },
      {
        $set: {
          slug,
          title: `Sentence practice: ${topic}`,
          topic,
          level: 'A2',
          type: 'dev_english',
          content,
          estimatedMinutes: 5,
          wordsCount: 0,
          speakingMinutes: 0,
          writingSentences: 0,
          sourceNames: ['tatoeba'],
          sourceUrls: ['https://api.tatoeba.org/'],
          isActive: true,
          generatedFrom: 'example_sentences_cache',
          regeneratedAt: new Date(),
        },
        $setOnInsert: {
          useCount: 0,
          lastUsedAt: null,
          lastUsedDate: null,
        },
      },
      { upsert: true }
    )

    if (result.upsertedCount > 0) inserted++
    else updated++
  }

  return { inserted, updated, skipped }
}

async function generateSpeakingLessons() {
  const topics = ['debugging', 'api', 'deployment', 'testing', 'meeting', 'daily']

  let inserted = 0
  let updated = 0

  for (const topic of topics) {
    const slug = `speaking-${toSlug(topic)}`

    const content = [
      `Speak for 1 minute about ${topic}.`,
      'Use simple sentences.',
      'Try to use at least 3 words from today’s vocabulary.',
    ].join('\n')

    const result = await Lesson.updateOne(
      { slug },
      {
        $set: {
          slug,
          title: `Speaking prompt: ${topic}`,
          topic,
          level: 'A2',
          type: 'speaking',
          content,
          estimatedMinutes: 5,
          wordsCount: 0,
          speakingMinutes: 1,
          writingSentences: 0,
          sourceNames: ['internal'],
          sourceUrls: [],
          isActive: true,
          generatedFrom: 'internal_template',
          regeneratedAt: new Date(),
        },
        $setOnInsert: {
          useCount: 0,
          lastUsedAt: null,
          lastUsedDate: null,
        },
      },
      { upsert: true }
    )

    if (result.upsertedCount > 0) inserted++
    else updated++
  }

  return { inserted, updated }
}

async function generateWritingLessons() {
  const topics = ['debugging', 'api', 'deployment', 'testing', 'meeting', 'daily']

  let inserted = 0
  let updated = 0

  for (const topic of topics) {
    const slug = `writing-${toSlug(topic)}`

    const content = [
      `Write 3 sentences about ${topic}:`,
      '1. Today I...',
      '2. I had a problem with...',
      '3. Tomorrow I will...',
    ].join('\n')

    const result = await Lesson.updateOne(
      { slug },
      {
        $set: {
          slug,
          title: `Writing prompt: ${topic}`,
          topic,
          level: 'A2',
          type: 'writing',
          content,
          estimatedMinutes: 5,
          wordsCount: 0,
          speakingMinutes: 0,
          writingSentences: 3,
          sourceNames: ['internal'],
          sourceUrls: [],
          isActive: true,
          generatedFrom: 'internal_template',
          regeneratedAt: new Date(),
        },
        $setOnInsert: {
          useCount: 0,
          lastUsedAt: null,
          lastUsedDate: null,
        },
      },
      { upsert: true }
    )

    if (result.upsertedCount > 0) inserted++
    else updated++
  }

  return { inserted, updated }
}
```

---

# 23. Rotation Fallback Update

Update daily rotation logic so it has a fallback when all lessons are recently used.

Rule:

```text
1. Prefer active lessons not used in last 7 days.
2. If no fresh lesson exists, pick active lesson with lowest useCount and oldest lastUsedAt.
3. If no lesson exists for a type, use virtual built-in fallback.
```

Pseudo code:

```ts
async function pickLesson(type: string, excludeIds: string[]) {
  const fresh = await Lesson.aggregate([
    {
      $match: {
        type,
        isActive: true,
        _id: { $nin: excludeIds.map((id) => new Types.ObjectId(id)) },
      },
    },
    { $sample: { size: 1 } },
  ])

  if (fresh[0]) return fresh[0]

  const leastUsed = await Lesson.findOne({
    type,
    isActive: true,
  })
    .sort({
      useCount: 1,
      lastUsedAt: 1,
      createdAt: 1,
    })
    .lean()

  if (leastUsed) return leastUsed

  return createVirtualFallbackLesson(type)
}
```

After creating daily plan, update selected lesson usage:

```ts
await Lesson.updateMany(
  { _id: { $in: selectedLessonIds } },
  {
    $inc: { useCount: 1 },
    $set: {
      lastUsedAt: new Date(),
      lastUsedDate: today,
    },
  }
)
```

Important:

```text
Only update usage for real database lessons.
Do not update usage for virtual fallback lessons.
```

---

# 24. Virtual Fallback Lessons

Create fallback lessons for emergency only.

```ts
function createVirtualFallbackLesson(type: string) {
  const base = {
    _id: `virtual-${type}-${Date.now()}`,
    slug: `virtual-${type}`,
    topic: 'fallback',
    level: 'A2',
    type,
    estimatedMinutes: 5,
    wordsCount: 0,
    speakingMinutes: 0,
    writingSentences: 0,
    sourceNames: ['internal_fallback'],
    sourceUrls: [],
    isActive: true,
    isVirtualFallback: true,
  }

  if (type === 'listening') {
    return {
      ...base,
      title: '5-minute listening practice',
      content: [
        'Open any English listening source you like.',
        'Listen for 5 minutes.',
        'Write down 3 words you hear.',
        'Repeat 1 sentence out loud.',
      ].join('\n'),
      sourceUrls: ['https://www.bbc.co.uk/learningenglish'],
    }
  }

  if (type === 'vocab') {
    return {
      ...base,
      title: 'Basic vocabulary practice',
      content: [
        '- work: something you do as a job or task',
        '- learn: to get knowledge or skill',
        '- practice: to do something repeatedly to improve',
      ].join('\n'),
      wordsCount: 3,
    }
  }

  if (type === 'speaking') {
    return {
      ...base,
      title: 'Simple speaking practice',
      content: 'Speak for 1 minute about what you did today.',
      speakingMinutes: 1,
    }
  }

  if (type === 'writing') {
    return {
      ...base,
      title: 'Simple writing practice',
      content: [
        'Write 3 sentences:',
        '1. Today I...',
        '2. I learned...',
        '3. Tomorrow I will...',
      ].join('\n'),
      writingSentences: 3,
    }
  }

  return {
    ...base,
    title: 'Simple dev English practice',
    content: [
      'I fixed a bug.',
      'I checked the logs.',
      'I tested the app again.',
    ].join('\n'),
    wordsCount: 3,
  }
}
```

---

# 25. API Routes for Sync

All sync routes must be disabled in production unless proper admin auth is added.

## 25.1. POST /api/external-sync/sources

```ts
import { NextResponse } from 'next/server'
import { syncExternalSources } from '@/server/external/sync-sources'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'External source sync is disabled in production' },
      { status: 403 }
    )
  }

  try {
    const result = await syncExternalSources()
    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to sync external sources' },
      { status: 500 }
    )
  }
}
```

## 25.2. POST /api/external-sync/words

```ts
import { NextResponse } from 'next/server'
import { syncWordsFromExternalApis } from '@/server/external/sync-words'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Word sync is disabled in production' },
      { status: 403 }
    )
  }

  try {
    const result = await syncWordsFromExternalApis()
    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to sync words' },
      { status: 500 }
    )
  }
}
```

## 25.3. POST /api/external-sync/sentences

```ts
import { NextResponse } from 'next/server'
import { syncSentencesFromTatoeba } from '@/server/external/sync-sentences'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Sentence sync is disabled in production' },
      { status: 403 }
    )
  }

  try {
    const result = await syncSentencesFromTatoeba()
    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to sync sentences' },
      { status: 500 }
    )
  }
}
```

## 25.4. POST /api/external-sync/generate-lessons

```ts
import { NextResponse } from 'next/server'
import { generateLessonsFromCachedData } from '@/server/external/generate-lessons-from-cache'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Lesson generation is disabled in production' },
      { status: 403 }
    )
  }

  try {
    const result = await generateLessonsFromCachedData()
    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to generate lessons' },
      { status: 500 }
    )
  }
}
```

## 25.5. POST /api/external-sync/bootstrap

Runs the full data pipeline:

```text
sync external sources
sync words
sync sentences
generate lessons
```

```ts
import { NextResponse } from 'next/server'
import { syncExternalSources } from '@/server/external/sync-sources'
import { syncWordsFromExternalApis } from '@/server/external/sync-words'
import { syncSentencesFromTatoeba } from '@/server/external/sync-sentences'
import { generateLessonsFromCachedData } from '@/server/external/generate-lessons-from-cache'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Bootstrap is disabled in production' },
      { status: 403 }
    )
  }

  try {
    const sources = await syncExternalSources()
    const words = await syncWordsFromExternalApis()
    const sentences = await syncSentencesFromTatoeba()
    const lessons = await generateLessonsFromCachedData()

    return NextResponse.json({
      sources,
      words,
      sentences,
      lessons,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to bootstrap external data' },
      { status: 500 }
    )
  }
}
```

---

# 26. CLI Scripts

Add package scripts:

```json
{
  "scripts": {
    "sync:sources": "tsx src/server/run-sync-sources.ts",
    "sync:words": "tsx src/server/run-sync-words.ts",
    "sync:sentences": "tsx src/server/run-sync-sentences.ts",
    "generate:lessons": "tsx src/server/run-generate-lessons.ts",
    "data:bootstrap": "pnpm sync:sources && pnpm sync:words && pnpm sync:sentences && pnpm generate:lessons"
  }
}
```

## 26.1. run-sync-sources

```ts
import { syncExternalSources } from './external/sync-sources'

syncExternalSources()
  .then((result) => {
    console.log(result)
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
```

## 26.2. run-sync-words

```ts
import { syncWordsFromExternalApis } from './external/sync-words'

syncWordsFromExternalApis()
  .then((result) => {
    console.log(result)
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
```

## 26.3. run-sync-sentences

```ts
import { syncSentencesFromTatoeba } from './external/sync-sentences'

syncSentencesFromTatoeba()
  .then((result) => {
    console.log(result)
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
```

## 26.4. run-generate-lessons

```ts
import { generateLessonsFromCachedData } from './external/generate-lessons-from-cache'

generateLessonsFromCachedData()
  .then((result) => {
    console.log(result)
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
```

---

# 27. Data Health API

Create:

```text
GET /api/admin/data-health
```

File:

```text
src/app/api/admin/data-health/route.ts
```

```ts
import { NextResponse } from 'next/server'
import { connectMongo } from '@/lib/mongoose'
import { Lesson } from '@/models/Lesson'
import { Word } from '@/models/Word'
import { ExampleSentence } from '@/models/ExampleSentence'
import { ExternalSource } from '@/models/ExternalSource'
import { ApiSyncRun } from '@/models/ApiSyncRun'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Data health route is disabled in production' },
      { status: 403 }
    )
  }

  await connectMongo()

  const [
    lessonCount,
    wordCount,
    sentenceCount,
    sourceCount,
    latestSyncRuns,
    lessonTypeCounts,
  ] = await Promise.all([
    Lesson.countDocuments(),
    Word.countDocuments(),
    ExampleSentence.countDocuments(),
    ExternalSource.countDocuments(),
    ApiSyncRun.find({}).sort({ createdAt: -1 }).limit(10).lean(),
    Lesson.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]),
  ])

  return NextResponse.json({
    lessonCount,
    wordCount,
    sentenceCount,
    sourceCount,
    lessonTypeCounts,
    latestSyncRuns,
  })
}
```

---

# 28. Bootstrap Flow

Run:

```bash
docker compose up -d
pnpm install
pnpm data:bootstrap
pnpm dev
```

Expected result:

```text
external_sources has records.
words has records.
example_sentences has records.
lessons has generated lessons.
GET /api/admin/data-health returns counts.
GET /api/today returns daily plan.
```

---

# 29. Handling Duplicate Sync Data

## 29.1. Words

When the same word appears again:

```text
Do not insert duplicate.
Update definitions and metadata.
Merge topics.
Merge source names.
Merge source URLs.
Refresh fetchedAt.
```

Use:

```ts
await Word.updateOne(
  { normalizedWord },
  {
    $set: {
      word,
      definitions,
      phonetic,
      phonetics,
      fetchedAt: new Date(),
      isActive: true,
    },
    $addToSet: {
      topics: { $each: topics },
      sourceNames: { $each: sourceNames },
      sourceUrls: { $each: sourceUrls },
    },
  },
  { upsert: true }
)
```

## 29.2. Sentences

When the same Tatoeba sentence appears again:

```text
Do not insert duplicate.
Update sentence metadata.
Merge topics.
Merge keywords.
Refresh fetchedAt.
```

Use:

```ts
await ExampleSentence.updateOne(
  {
    sourceName: 'tatoeba',
    externalId: sentenceId,
  },
  {
    $set: {
      text,
      normalizedText,
      contentHash,
      license,
      attribution,
      fetchedAt: new Date(),
      isActive: true,
    },
    $addToSet: {
      topics: topic,
      keywords: keyword,
    },
  },
  { upsert: true }
)
```

## 29.3. Lessons

When generated lesson already exists:

```text
Do not insert duplicate.
Update content.
Keep slug stable.
Refresh regeneratedAt.
Keep usage fields.
```

Use:

```ts
await Lesson.updateOne(
  { slug },
  {
    $set: {
      title,
      content,
      topic,
      type,
      regeneratedAt: new Date(),
      isActive: true,
    },
    $setOnInsert: {
      useCount: 0,
      lastUsedAt: null,
      lastUsedDate: null,
    },
  },
  { upsert: true }
)
```

---

# 30. Source Attribution

For MVP, show attribution only in data/admin pages or docs.

Later, if app becomes public, add a small footer:

```text
Some word data is enriched using Free Dictionary API and Datamuse.
Some example sentences are sourced from Tatoeba.
```

Keep exact source metadata in MongoDB.

---

# 31. Production Warning

These routes must not be open publicly in production without authentication:

```text
/api/external-sync/sources
/api/external-sync/words
/api/external-sync/sentences
/api/external-sync/generate-lessons
/api/external-sync/bootstrap
/api/admin/data-health
```

In MVP:

```text
Disable them when NODE_ENV === "production".
```

Later:

```text
Protect them with admin authentication.
```

---

# 32. Acceptance Criteria

## External clients

```text
[ ] Free Dictionary client exists.
[ ] Datamuse client exists.
[ ] Tatoeba client exists.
[ ] HTTP helper has timeout.
[ ] Sync jobs do not crash entire run when one item fails.
```

## Database models

```text
[ ] ExternalSource model exists.
[ ] Word model exists.
[ ] ExampleSentence model exists.
[ ] ApiSyncRun model exists.
[ ] Lesson model has slug.
[ ] Lesson model has useCount and lastUsedAt.
```

## Idempotent sync

```text
[ ] Running sync:words twice does not duplicate words.
[ ] Running sync:sentences twice does not duplicate sentences.
[ ] Running generate:lessons twice does not duplicate lessons.
[ ] topics are merged using $addToSet.
[ ] keywords are merged using $addToSet.
[ ] source names and source URLs are merged.
```

## Data pipeline

```text
[ ] pnpm sync:sources works.
[ ] pnpm sync:words works.
[ ] pnpm sync:sentences works.
[ ] pnpm generate:lessons works.
[ ] pnpm data:bootstrap works.
[ ] /api/admin/data-health returns useful counts.
```

## Daily app behavior

```text
[ ] /api/today does not call external APIs.
[ ] /api/today reads only from Lesson collection.
[ ] /api/today works even if external APIs are offline.
[ ] Daily rotation fallback works if fresh lessons are exhausted.
[ ] Virtual fallback works if no lesson exists for a type.
```

## Safety and licensing

```text
[ ] No BBC/VOA/British Council content is scraped.
[ ] Listening lessons only store source links and task instructions.
[ ] Tatoeba audio is not reused in MVP.
[ ] Source metadata is stored.
```

---

# 33. Final Agent Prompt

Use this prompt for the coding agent:

```text
Read docs/AI_AGENT_IMPLEMENTATION.md and docs/API_DATA_INTEGRATION.md.

Implement the external API data integration fully.

Use:
- Next.js App Router
- TypeScript
- MongoDB
- Mongoose
- Tailwind CSS
- pnpm

External APIs:
- Free Dictionary API for definitions and phonetics.
- Datamuse API for related words and vocabulary expansion.
- Tatoeba API for example sentences.

Critical rules:
- Do not call external APIs inside /api/today.
- Sync external data into MongoDB first.
- Generate lessons from cached MongoDB data.
- Daily rotation reads from Lesson collection only.
- All sync jobs must be idempotent.
- Do not insert duplicates.
- Use unique indexes and upsert.
- Use $addToSet for topics, keywords, sourceNames, and sourceUrls.
- Deduplicate words by normalizedWord.
- Deduplicate Tatoeba sentences by sourceName + externalId.
- Deduplicate generated lessons by slug.
- Do not scrape BBC/VOA/British Council content.
- Do not reuse Tatoeba audio unless license clearly allows it.
- Keep no-toxic-streak product rule.

After implementation:
1. Run pnpm install.
2. Run docker compose up -d.
3. Run pnpm data:bootstrap.
4. Test /api/admin/data-health.
5. Test /api/today.
6. Run pnpm build.
7. Fix all TypeScript and build errors.
```

---

# 34. Definition of Done

This integration is complete when:

```text
External APIs can be synced into MongoDB.
Duplicate sync does not create duplicate documents.
Lessons can be generated from cached words and sentences.
Daily plan uses generated lessons from MongoDB.
The app still works if all external APIs are offline.
```
