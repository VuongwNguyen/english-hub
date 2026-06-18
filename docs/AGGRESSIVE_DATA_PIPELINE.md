# English Hub — Aggressive Data Pipeline

## 1. Mục tiêu

Hiện tại English Hub đang bị giới hạn dữ liệu vì pipeline chỉ sync quanh một vài topic nhỏ như dev, API, debugging, testing, meeting.

Mục tiêu mới là mở rộng hệ thống thành một **data pipeline phủ rộng nhiều chủ đề/lĩnh vực**, không chỉ dev/code.

App cần có khả năng:

```text
- Lấy dữ liệu rộng từ nhiều chủ đề.
- Không bị giới hạn ở vài seed topic.
- Sync mạnh mẽ nhưng vẫn an toàn.
- Có thể resume nếu sync bị dừng.
- Không duplicate data.
- Không gọi API bên thứ 3 trong /api/today.
- Generate lesson đa dạng theo nhiều lĩnh vực.
- Daily rotation cân bằng topic/topicGroup.
```

---

## 2. Nguyên tắc kiến trúc

Không gọi API ngoài trực tiếp trong daily learning flow.

Luồng đúng:

```text
Topic Taxonomy lớn
        ↓
Sync Task Queue
        ↓
Datamuse expansion
        ↓
Dictionary enrichment
        ↓
words collection

Tatoeba API / bulk import
        ↓
example_sentences collection

words + example_sentences
        ↓
lesson generator
        ↓
lessons collection
        ↓
/api/today
```

Luồng sai:

```text
GET /api/today
→ gọi Datamuse
→ gọi Dictionary
→ gọi Tatoeba
→ generate plan live
```

`/api/today` chỉ được đọc từ MongoDB, cụ thể là collection:

```text
lessons
dailyplans
dailystats
```

---

## 3. External APIs

Pipeline có thể dùng 3 nguồn:

```text
1. Free Dictionary API
   - definition
   - phonetics
   - pronunciation audio URL nếu có

2. Datamuse API
   - related words
   - vocabulary expansion
   - topic-based word discovery

3. Tatoeba API
   - example sentences
   - short English sentence bank
```

Không scrape BBC, VOA, British Council.

Listening lesson chỉ lưu:

```text
sourceName
sourceUrl
task instruction
estimatedMinutes
```

Không copy full article/audio/script nếu chưa rõ license.

---

## 4. Chiến lược “lấy hết”

Không hiểu “lấy hết” là gọi API vô hạn một lần.

Hiểu đúng là:

```text
- Có taxonomy rất rộng.
- Có sync task queue.
- Có batch processing.
- Có retry.
- Có dedupe.
- Có resume.
- Có aggressive mode.
- Có thể chạy nhiều vòng để data ngày càng lớn.
```

Không bỏ giới hạn kỹ thuật của batch/concurrency, vì như vậy dễ làm API timeout/rate limit.

Thay vào đó:

```text
Không giới hạn tổng quy mô data.
Nhưng mỗi lần chạy xử lý theo batch an toàn.
```

---

## 5. Environment Config

Thêm cấu hình vào `.env.local` hoặc đọc từ process.env:

```env
SYNC_MODE=aggressive

SYNC_REFRESH_DAYS=365
SYNC_DATAMUSE_MAX=100
SYNC_TATOEBA_LIMIT=100

SYNC_WORKER_BATCH_SIZE=50
SYNC_WORKER_CONCURRENCY=3
SYNC_TASK_MAX_ATTEMPTS=3

SYNC_REQUEST_SLEEP_MS=150
```

Ý nghĩa:

```text
SYNC_MODE
- normal
- aggressive

SYNC_REFRESH_DAYS
- Nếu word đã fetch trong X ngày thì không gọi Dictionary lại.

SYNC_DATAMUSE_MAX
- Số word Datamuse trả về mỗi request.

SYNC_TATOEBA_LIMIT
- Số sentence Tatoeba trả về mỗi request.

SYNC_WORKER_BATCH_SIZE
- Mỗi lần worker lấy bao nhiêu task pending.

SYNC_WORKER_CONCURRENCY
- Số task xử lý song song.

SYNC_TASK_MAX_ATTEMPTS
- Số lần retry tối đa.

SYNC_REQUEST_SLEEP_MS
- Nghỉ nhẹ giữa các request.
```

Default logic:

```ts
export function getSyncConfig() {
  const mode = process.env.SYNC_MODE ?? 'normal'

  const isAggressive = mode === 'aggressive'

  return {
    mode,
    refreshDays: Number(
      process.env.SYNC_REFRESH_DAYS ?? (isAggressive ? 365 : 30)
    ),
    datamuseMax: Number(
      process.env.SYNC_DATAMUSE_MAX ?? (isAggressive ? 100 : 30)
    ),
    tatoebaLimit: Number(
      process.env.SYNC_TATOEBA_LIMIT ?? (isAggressive ? 100 : 30)
    ),
    workerBatchSize: Number(process.env.SYNC_WORKER_BATCH_SIZE ?? 50),
    workerConcurrency: Number(process.env.SYNC_WORKER_CONCURRENCY ?? 3),
    maxAttempts: Number(process.env.SYNC_TASK_MAX_ATTEMPTS ?? 3),
    requestSleepMs: Number(process.env.SYNC_REQUEST_SLEEP_MS ?? 150),
  }
}
```

Tạo file:

```text
src/server/external/config.ts
```

---

## 6. Topic Taxonomy rộng

Thay `seed-topics.ts` bằng:

```text
src/server/data/topic-taxonomy.ts
```

Mỗi topic gồm:

```ts
type TopicTaxonomyItem = {
  key: string
  group: string
  words: string[]
}
```

Yêu cầu:

```text
- Tối thiểu 50 topic.
- Mỗi topic có 8–15 seed words.
- Phủ nhiều lĩnh vực đời sống, xã hội, công việc, học tập, công nghệ.
```

Ví dụ:

```ts
export const topicTaxonomy = [
  {
    key: 'daily_life',
    group: 'life',
    words: [
      'home',
      'morning',
      'evening',
      'sleep',
      'food',
      'clean',
      'family',
      'friend',
      'weekend',
      'habit',
    ],
  },
  {
    key: 'food',
    group: 'life',
    words: [
      'breakfast',
      'lunch',
      'dinner',
      'cook',
      'taste',
      'restaurant',
      'coffee',
      'rice',
      'vegetable',
      'meat',
    ],
  },
  {
    key: 'travel',
    group: 'life',
    words: [
      'hotel',
      'airport',
      'ticket',
      'train',
      'bus',
      'map',
      'passport',
      'luggage',
      'restaurant',
      'trip',
    ],
  },
  {
    key: 'shopping',
    group: 'life',
    words: [
      'shop',
      'store',
      'order',
      'cart',
      'discount',
      'size',
      'color',
      'return',
      'delivery',
      'product',
    ],
  },
  {
    key: 'money',
    group: 'life',
    words: [
      'money',
      'price',
      'cost',
      'pay',
      'buy',
      'sell',
      'budget',
      'receipt',
      'expensive',
      'cheap',
    ],
  },
  {
    key: 'health',
    group: 'life',
    words: [
      'doctor',
      'medicine',
      'pain',
      'sleep',
      'exercise',
      'healthy',
      'sick',
      'hospital',
      'stress',
      'tired',
    ],
  },
  {
    key: 'emotion',
    group: 'life',
    words: [
      'happy',
      'sad',
      'angry',
      'worried',
      'excited',
      'calm',
      'tired',
      'afraid',
      'proud',
      'bored',
    ],
  },
  {
    key: 'relationships',
    group: 'social',
    words: [
      'friend',
      'family',
      'partner',
      'love',
      'trust',
      'help',
      'argue',
      'support',
      'care',
      'respect',
    ],
  },
  {
    key: 'communication',
    group: 'social',
    words: [
      'ask',
      'answer',
      'explain',
      'suggest',
      'agree',
      'disagree',
      'discuss',
      'message',
      'call',
      'reply',
    ],
  },
  {
    key: 'education',
    group: 'knowledge',
    words: [
      'school',
      'teacher',
      'student',
      'learn',
      'lesson',
      'exam',
      'homework',
      'practice',
      'skill',
      'knowledge',
    ],
  },
  {
    key: 'science',
    group: 'knowledge',
    words: [
      'energy',
      'matter',
      'space',
      'earth',
      'animal',
      'plant',
      'experiment',
      'research',
      'data',
      'theory',
    ],
  },
  {
    key: 'technology',
    group: 'work',
    words: [
      'computer',
      'phone',
      'internet',
      'software',
      'device',
      'data',
      'network',
      'system',
      'security',
      'cloud',
    ],
  },
  {
    key: 'business',
    group: 'work',
    words: [
      'company',
      'customer',
      'market',
      'sale',
      'contract',
      'project',
      'strategy',
      'meeting',
      'report',
      'growth',
    ],
  },
  {
    key: 'career',
    group: 'work',
    words: [
      'job',
      'career',
      'interview',
      'salary',
      'manager',
      'team',
      'task',
      'deadline',
      'performance',
      'promotion',
    ],
  },
  {
    key: 'law',
    group: 'society',
    words: [
      'law',
      'rule',
      'right',
      'court',
      'case',
      'legal',
      'contract',
      'policy',
      'evidence',
      'judge',
    ],
  },
  {
    key: 'environment',
    group: 'society',
    words: [
      'climate',
      'pollution',
      'energy',
      'water',
      'forest',
      'animal',
      'recycle',
      'waste',
      'plastic',
      'nature',
    ],
  },
  {
    key: 'culture',
    group: 'society',
    words: [
      'music',
      'movie',
      'book',
      'art',
      'history',
      'tradition',
      'festival',
      'language',
      'story',
      'culture',
    ],
  },
  {
    key: 'sports',
    group: 'life',
    words: [
      'football',
      'basketball',
      'run',
      'swim',
      'game',
      'team',
      'score',
      'coach',
      'player',
      'training',
    ],
  },
  {
    key: 'news',
    group: 'society',
    words: [
      'news',
      'report',
      'event',
      'government',
      'economy',
      'public',
      'issue',
      'policy',
      'change',
      'crisis',
    ],
  },
  {
    key: 'transportation',
    group: 'life',
    words: [
      'car',
      'bus',
      'train',
      'bike',
      'taxi',
      'road',
      'traffic',
      'station',
      'driver',
      'ticket',
    ],
  },
  {
    key: 'housing',
    group: 'life',
    words: [
      'house',
      'apartment',
      'rent',
      'room',
      'kitchen',
      'bathroom',
      'neighbor',
      'repair',
      'move',
      'furniture',
    ],
  },
  {
    key: 'weather',
    group: 'life',
    words: [
      'rain',
      'sunny',
      'cloud',
      'storm',
      'wind',
      'hot',
      'cold',
      'temperature',
      'forecast',
      'season',
    ],
  },
  {
    key: 'animals',
    group: 'nature',
    words: [
      'dog',
      'cat',
      'bird',
      'fish',
      'horse',
      'animal',
      'wild',
      'farm',
      'pet',
      'forest',
    ],
  },
  {
    key: 'nature',
    group: 'nature',
    words: [
      'tree',
      'river',
      'mountain',
      'sea',
      'flower',
      'forest',
      'island',
      'beach',
      'sky',
      'earth',
    ],
  },
  {
    key: 'hobbies',
    group: 'life',
    words: [
      'music',
      'game',
      'book',
      'movie',
      'draw',
      'photo',
      'garden',
      'cook',
      'dance',
      'travel',
    ],
  },
  {
    key: 'productivity',
    group: 'work',
    words: [
      'focus',
      'plan',
      'goal',
      'task',
      'habit',
      'schedule',
      'priority',
      'deadline',
      'finish',
      'progress',
    ],
  },
  {
    key: 'customer_service',
    group: 'work',
    words: [
      'customer',
      'support',
      'help',
      'problem',
      'refund',
      'order',
      'complaint',
      'service',
      'request',
      'response',
    ],
  },
  {
    key: 'emergency',
    group: 'life',
    words: [
      'help',
      'danger',
      'fire',
      'police',
      'hospital',
      'accident',
      'call',
      'urgent',
      'safe',
      'emergency',
    ],
  },
  {
    key: 'finance',
    group: 'business',
    words: [
      'bank',
      'account',
      'loan',
      'interest',
      'invest',
      'tax',
      'income',
      'expense',
      'profit',
      'loss',
    ],
  },
  {
    key: 'marketing',
    group: 'business',
    words: [
      'brand',
      'campaign',
      'audience',
      'content',
      'advertise',
      'market',
      'strategy',
      'customer',
      'traffic',
      'lead',
    ],
  },
  {
    key: 'sales',
    group: 'business',
    words: [
      'sell',
      'buyer',
      'deal',
      'price',
      'offer',
      'discount',
      'contract',
      'customer',
      'target',
      'revenue',
    ],
  },
  {
    key: 'management',
    group: 'business',
    words: [
      'team',
      'leader',
      'manager',
      'plan',
      'decision',
      'process',
      'meeting',
      'goal',
      'feedback',
      'performance',
    ],
  },
  {
    key: 'design',
    group: 'creative',
    words: [
      'design',
      'color',
      'layout',
      'image',
      'style',
      'font',
      'shape',
      'user',
      'simple',
      'beautiful',
    ],
  },
  {
    key: 'writing',
    group: 'language',
    words: [
      'write',
      'sentence',
      'paragraph',
      'story',
      'email',
      'note',
      'draft',
      'edit',
      'grammar',
      'idea',
    ],
  },
  {
    key: 'reading',
    group: 'language',
    words: [
      'read',
      'book',
      'article',
      'text',
      'meaning',
      'understand',
      'page',
      'paragraph',
      'title',
      'summary',
    ],
  },
  {
    key: 'speaking',
    group: 'language',
    words: [
      'speak',
      'talk',
      'say',
      'voice',
      'pronounce',
      'repeat',
      'conversation',
      'question',
      'answer',
      'fluency',
    ],
  },
  {
    key: 'listening',
    group: 'language',
    words: [
      'listen',
      'hear',
      'sound',
      'voice',
      'audio',
      'repeat',
      'understand',
      'word',
      'sentence',
      'conversation',
    ],
  },
  {
    key: 'grammar',
    group: 'language',
    words: [
      'grammar',
      'tense',
      'verb',
      'noun',
      'adjective',
      'sentence',
      'question',
      'past',
      'present',
      'future',
    ],
  },
  {
    key: 'pronunciation',
    group: 'language',
    words: [
      'pronounce',
      'sound',
      'stress',
      'accent',
      'syllable',
      'voice',
      'repeat',
      'listen',
      'mouth',
      'clear',
    ],
  },
  {
    key: 'debugging',
    group: 'dev',
    words: [
      'debug',
      'bug',
      'error',
      'crash',
      'fix',
      'issue',
      'log',
      'trace',
      'exception',
      'reproduce',
    ],
  },
  {
    key: 'api',
    group: 'dev',
    words: [
      'api',
      'request',
      'response',
      'server',
      'endpoint',
      'retry',
      'payload',
      'token',
      'status',
      'timeout',
    ],
  },
  {
    key: 'deployment',
    group: 'dev',
    words: [
      'deploy',
      'release',
      'build',
      'rollback',
      'production',
      'staging',
      'version',
      'pipeline',
      'config',
      'server',
    ],
  },
  {
    key: 'testing',
    group: 'dev',
    words: [
      'test',
      'verify',
      'check',
      'expected',
      'actual',
      'case',
      'unit',
      'integration',
      'coverage',
      'result',
    ],
  },
  {
    key: 'security',
    group: 'dev',
    words: [
      'security',
      'password',
      'token',
      'encrypt',
      'attack',
      'risk',
      'permission',
      'access',
      'safe',
      'protect',
    ],
  },
  {
    key: 'database',
    group: 'dev',
    words: [
      'database',
      'query',
      'index',
      'record',
      'collection',
      'table',
      'schema',
      'backup',
      'migration',
      'transaction',
    ],
  },
  {
    key: 'cloud',
    group: 'dev',
    words: [
      'cloud',
      'server',
      'storage',
      'compute',
      'region',
      'scale',
      'deploy',
      'instance',
      'network',
      'service',
    ],
  },
  {
    key: 'mobile',
    group: 'dev',
    words: [
      'mobile',
      'screen',
      'app',
      'device',
      'camera',
      'permission',
      'notification',
      'offline',
      'update',
      'release',
    ],
  },
  {
    key: 'frontend',
    group: 'dev',
    words: [
      'frontend',
      'button',
      'screen',
      'component',
      'layout',
      'state',
      'form',
      'click',
      'render',
      'style',
    ],
  },
  {
    key: 'backend',
    group: 'dev',
    words: [
      'backend',
      'server',
      'api',
      'database',
      'worker',
      'queue',
      'cache',
      'auth',
      'request',
      'response',
    ],
  },
] as const
```

Agent có thể bổ sung thêm topic nếu muốn, nhưng không được xóa các topic trên nếu không có lý do.

---

## 7. Sync Task Queue

Thêm model:

```text
src/models/SyncTask.ts
```

Schema:

```ts
import { Schema, model, models } from 'mongoose'

const SyncTaskSchema = new Schema(
  {
    taskKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'datamuse_expand',
        'dictionary_enrich',
        'tatoeba_sentence_search',
      ],
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'failed'],
      default: 'pending',
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    topicGroup: {
      type: String,
      required: true,
      trim: true,
    },
    keyword: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    priority: {
      type: Number,
      default: 0,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
)

SyncTaskSchema.index({ taskKey: 1 }, { unique: true })
SyncTaskSchema.index({ status: 1, priority: -1, createdAt: 1 })
SyncTaskSchema.index({ type: 1, status: 1 })
SyncTaskSchema.index({ topic: 1 })
SyncTaskSchema.index({ topicGroup: 1 })

export const SyncTask = models.SyncTask || model('SyncTask', SyncTaskSchema)
```

---

## 8. Seed Sync Tasks

Tạo file:

```text
src/server/external/seed-sync-tasks.ts
```

Nhiệm vụ:

```text
- Đọc topicTaxonomy.
- Với mỗi topic word, tạo task:
  - datamuse_expand
  - tatoeba_sentence_search
- Dùng upsert theo taskKey.
- Không tạo duplicate task nếu chạy lại.
```

Code:

```ts
import { connectMongo } from '@/lib/mongoose'
import { SyncTask } from '@/models/SyncTask'
import { topicTaxonomy } from '@/server/data/topic-taxonomy'
import { normalizeWord, toSlug } from './normalize'

export async function seedSyncTasks() {
  await connectMongo()

  let insertedCount = 0
  let updatedCount = 0

  for (const topic of topicTaxonomy) {
    for (const rawKeyword of topic.words) {
      const keyword = normalizeWord(rawKeyword)

      const taskInputs = [
        {
          type: 'datamuse_expand',
          taskKey: `datamuse-${toSlug(topic.key)}-${toSlug(keyword)}`,
        },
        {
          type: 'tatoeba_sentence_search',
          taskKey: `tatoeba-${toSlug(topic.key)}-${toSlug(keyword)}`,
        },
      ]

      for (const input of taskInputs) {
        const result = await SyncTask.updateOne(
          { taskKey: input.taskKey },
          {
            $setOnInsert: {
              taskKey: input.taskKey,
              type: input.type,
              status: 'pending',
              topic: topic.key,
              topicGroup: topic.group,
              keyword,
              attempts: 0,
              priority: 0,
              lockedAt: null,
              finishedAt: null,
              lastError: '',
            },
          },
          { upsert: true }
        )

        if (result.upsertedCount > 0) insertedCount++
        else updatedCount++
      }
    }
  }

  return {
    insertedCount,
    updatedCount,
  }
}
```

---

## 9. Run Sync Task Worker

Tạo file:

```text
src/server/external/run-sync-worker.ts
```

Nhiệm vụ:

```text
- Lấy batch pending tasks.
- Lock task.
- Process theo type.
- Upsert data vào MongoDB.
- Không crash toàn bộ nếu một task fail.
- Retry tối đa SYNC_TASK_MAX_ATTEMPTS.
```

Pseudo:

```ts
import { connectMongo } from '@/lib/mongoose'
import { SyncTask } from '@/models/SyncTask'
import { getSyncConfig } from './config'
import { processSyncTask } from './sync-task-processor'

export async function runSyncWorker() {
  await connectMongo()

  const config = getSyncConfig()

  const tasks = await SyncTask.find({
    status: { $in: ['pending', 'failed'] },
    attempts: { $lt: config.maxAttempts },
  })
    .sort({ priority: -1, createdAt: 1 })
    .limit(config.workerBatchSize)

  let successCount = 0
  let failedCount = 0

  const chunks = chunk(tasks, config.workerConcurrency)

  for (const group of chunks) {
    await Promise.all(
      group.map(async (task) => {
        try {
          const locked = await SyncTask.findOneAndUpdate(
            {
              _id: task._id,
              status: { $in: ['pending', 'failed'] },
            },
            {
              $set: {
                status: 'running',
                lockedAt: new Date(),
                lastError: '',
              },
              $inc: {
                attempts: 1,
              },
            },
            { new: true }
          )

          if (!locked) return

          await processSyncTask(locked)

          await SyncTask.updateOne(
            { _id: locked._id },
            {
              $set: {
                status: 'success',
                finishedAt: new Date(),
                lockedAt: null,
              },
            }
          )

          successCount++
        } catch (error: any) {
          await SyncTask.updateOne(
            { _id: task._id },
            {
              $set: {
                status: 'failed',
                lockedAt: null,
                lastError: error.message ?? 'Unknown error',
              },
            }
          )

          failedCount++
        }
      })
    )
  }

  return {
    pickedCount: tasks.length,
    successCount,
    failedCount,
  }
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = []

  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }

  return result
}
```

---

## 10. Process Sync Task

Tạo file:

```text
src/server/external/sync-task-processor.ts
```

Nhiệm vụ:

```text
datamuse_expand
→ gọi Datamuse
→ upsert related words
→ tạo dictionary_enrich task cho word mới

dictionary_enrich
→ gọi Free Dictionary API nếu word cũ quá refreshDays hoặc chưa có definition
→ update Word

tatoeba_sentence_search
→ gọi Tatoeba
→ upsert ExampleSentence
```

Code skeleton:

```ts
import { SyncTask } from '@/models/SyncTask'
import { Word } from '@/models/Word'
import { ExampleSentence } from '@/models/ExampleSentence'
import { fetchRelatedWords } from './datamuse'
import { fetchDictionaryWord } from './dictionary'
import { searchTatoebaSentences } from './tatoeba'
import { getSyncConfig } from './config'
import { normalizeWord, normalizeText, toSlug } from './normalize'
import { sleep } from './http'

export async function processSyncTask(task: any) {
  if (task.type === 'datamuse_expand') {
    return processDatamuseExpandTask(task)
  }

  if (task.type === 'dictionary_enrich') {
    return processDictionaryEnrichTask(task)
  }

  if (task.type === 'tatoeba_sentence_search') {
    return processTatoebaSentenceSearchTask(task)
  }

  throw new Error(`Unknown sync task type: ${task.type}`)
}

async function processDatamuseExpandTask(task: any) {
  const config = getSyncConfig()

  const related = await fetchRelatedWords({
    meaningLike: task.keyword,
    topics: [task.topic],
    max: config.datamuseMax,
  })

  for (const item of related) {
    const normalizedWord = normalizeWord(item.word)

    await Word.updateOne(
      { normalizedWord },
      {
        $setOnInsert: {
          word: item.word,
          normalizedWord,
          phonetic: '',
          phonetics: [],
          definitions: [],
          fetchedAt: null,
          isActive: true,
        },
        $addToSet: {
          topics: task.topic,
          topicGroups: task.topicGroup,
          relatedWords: { $each: [task.keyword] },
          tags: { $each: item.tags ?? [] },
          sourceNames: 'datamuse',
          sourceUrls: item.sourceUrl,
        },
      },
      { upsert: true }
    )

    await SyncTask.updateOne(
      {
        taskKey: `dictionary-${toSlug(normalizedWord)}`,
      },
      {
        $setOnInsert: {
          taskKey: `dictionary-${toSlug(normalizedWord)}`,
          type: 'dictionary_enrich',
          status: 'pending',
          topic: task.topic,
          topicGroup: task.topicGroup,
          keyword: normalizedWord,
          attempts: 0,
          priority: 0,
          lockedAt: null,
          finishedAt: null,
          lastError: '',
        },
        $addToSet: {},
      },
      { upsert: true }
    )
  }

  await sleep(config.requestSleepMs)
}

async function processDictionaryEnrichTask(task: any) {
  const config = getSyncConfig()
  const normalizedWord = normalizeWord(task.keyword)

  const existing = await Word.findOne({ normalizedWord }).lean()

  const isFresh =
    existing?.fetchedAt &&
    Date.now() - new Date(existing.fetchedAt).getTime() <
      config.refreshDays * 24 * 60 * 60 * 1000

  if (isFresh && existing?.definitions?.length > 0) {
    await Word.updateOne(
      { normalizedWord },
      {
        $addToSet: {
          topics: task.topic,
          topicGroups: task.topicGroup,
          sourceNames: 'free_dictionary_api',
        },
      }
    )

    return
  }

  const dictionaryData = await fetchDictionaryWord(normalizedWord)

  if (!dictionaryData) {
    return
  }

  await Word.updateOne(
    { normalizedWord },
    {
      $set: {
        word: dictionaryData.word,
        normalizedWord,
        phonetic: dictionaryData.phonetic,
        phonetics: dictionaryData.phonetics,
        definitions: dictionaryData.definitions,
        fetchedAt: new Date(),
        isActive: true,
      },
      $addToSet: {
        topics: task.topic,
        topicGroups: task.topicGroup,
        sourceNames: 'free_dictionary_api',
        sourceUrls: dictionaryData.sourceUrl,
      },
    },
    { upsert: true }
  )

  await sleep(config.requestSleepMs)
}

async function processTatoebaSentenceSearchTask(task: any) {
  const config = getSyncConfig()

  const sentences = await searchTatoebaSentences({
    keyword: task.keyword,
    lang: 'eng',
    minWords: 3,
    maxWords: 14,
    limit: config.tatoebaLimit,
  })

  for (const sentence of sentences) {
    if (!isGoodSentence(sentence.text)) {
      continue
    }

    await ExampleSentence.updateOne(
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
          topics: task.topic,
          topicGroups: task.topicGroup,
          keywords: task.keyword,
        },
      },
      { upsert: true }
    )
  }

  await sleep(config.requestSleepMs)
}

function isGoodSentence(text: string) {
  const trimmed = text.trim()

  if (trimmed.length < 10) return false
  if (trimmed.length > 180) return false
  if (/[\[\]{}<>]/.test(trimmed)) return false
  if (trimmed.split(/\s+/).length > 18) return false

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

Lưu ý: nếu model `Word` chưa có `topicGroups`, cần thêm field đó.

---

## 11. Update Word Model

Thêm field:

```ts
topicGroups: {
  type: [String],
  default: [],
},
```

Index:

```ts
WordSchema.index({ topicGroups: 1 })
```

---

## 12. Update ExampleSentence Model

Thêm field:

```ts
topicGroups: {
  type: [String],
  default: [],
},
```

Index:

```ts
ExampleSentenceSchema.index({ topicGroups: 1 })
```

---

## 13. Update Lesson Model

Thêm field:

```ts
topicGroup: {
  type: String,
  default: '',
},
qualityScore: {
  type: Number,
  default: 0,
},
difficultyScore: {
  type: Number,
  default: 0,
},
```

Index:

```ts
LessonSchema.index({ topicGroup: 1 })
LessonSchema.index({ type: 1, topicGroup: 1, isActive: 1 })
LessonSchema.index({ qualityScore: -1 })
```

---

## 14. Generate Lessons đa dạng

Update file:

```text
src/server/external/generate-lessons-from-cache.ts
```

Yêu cầu:

```text
- Generate lesson theo mọi topic có trong Word/ExampleSentence.
- Không chỉ generate dev English.
- Mỗi topic nên có:
  - vocab lesson
  - sentence practice lesson
  - speaking prompt
  - writing prompt
- Listening lesson vẫn là static safe source links.
- Deduplicate bằng slug.
```

Lesson types cần duy trì:

```text
listening
vocab
speaking
writing
dev_english
```

Rule:

```text
vocab
→ lấy từ Word

dev_english
→ đổi tên concept thành sentence/context practice
→ lấy từ ExampleSentence
→ vẫn giữ type dev_english để không phá app cũ

speaking
→ prompt theo topic

writing
→ prompt theo topic

listening
→ static task source links
```

Pseudo:

```ts
const topics = await Word.distinct('topics')

for (const topic of topics) {
  const words = await Word.find({ topics: topic, isActive: true }).limit(5)
  const topicGroup = words[0]?.topicGroups?.[0] ?? 'general'

  await Lesson.updateOne(
    { slug: `vocab-${toSlug(topic)}` },
    {
      $set: {
        slug: `vocab-${toSlug(topic)}`,
        title: `Vocabulary pack: ${topic}`,
        topic,
        topicGroup,
        type: 'vocab',
        content,
        level: 'A2',
        estimatedMinutes: 5,
        wordsCount: words.length,
        generatedFrom: 'words_cache',
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
}
```

---

## 15. Update Daily Rotation

Daily rotation cần đa dạng hơn.

Rule mới:

```text
1. Tránh lesson đã dùng trong 7 ngày gần nhất.
2. Tránh topic đã dùng quá gần.
3. Ưu tiên topicGroup ít xuất hiện trong tuần này.
4. Ưu tiên lesson useCount thấp.
5. Ưu tiên qualityScore cao.
6. Nếu hết fresh lesson, fallback sang least-used.
7. Nếu không có lesson cho type, dùng virtual fallback.
```

Pseudo:

```ts
async function pickLesson(type: string, date: string) {
  const recentLessonIds = await getRecentLessonIds(date, 7)
  const recentTopicGroups = await getRecentTopicGroups(date, 7)

  const fresh = await Lesson.find({
    type,
    isActive: true,
    _id: { $nin: recentLessonIds },
    topicGroup: { $nin: recentTopicGroups.slice(0, 3) },
  })
    .sort({
      useCount: 1,
      qualityScore: -1,
      lastUsedAt: 1,
    })
    .limit(20)
    .lean()

  if (fresh.length > 0) {
    return randomPick(fresh)
  }

  const fallback = await Lesson.findOne({
    type,
    isActive: true,
  })
    .sort({
      useCount: 1,
      lastUsedAt: 1,
      qualityScore: -1,
    })
    .lean()

  if (fallback) return fallback

  return createVirtualFallbackLesson(type)
}
```

Sau khi tạo daily plan:

```ts
await Lesson.updateMany(
  { _id: { $in: selectedRealLessonIds } },
  {
    $inc: { useCount: 1 },
    $set: {
      lastUsedAt: new Date(),
      lastUsedDate: today,
    },
  }
)
```

---

## 16. Data Health API

Update:

```text
GET /api/admin/data-health
```

Response cần có:

```text
- total words
- total sentences
- total lessons
- words by topic
- words by topicGroup
- sentences by topic
- sentences by topicGroup
- lessons by type
- lessons by topicGroup
- lessons by topic
- sync tasks by status
- sync tasks by type
- latest sync runs
```

Pseudo aggregation:

```ts
const wordCountByTopic = await Word.aggregate([
  { $unwind: '$topics' },
  { $group: { _id: '$topics', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
])

const sentenceCountByTopic = await ExampleSentence.aggregate([
  { $unwind: '$topics' },
  { $group: { _id: '$topics', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
])

const lessonCountByType = await Lesson.aggregate([
  { $group: { _id: '$type', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
])

const taskCountByStatus = await SyncTask.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } },
])
```

---

## 17. Package Scripts

Update `package.json`:

```json
{
  "scripts": {
    "sync:sources": "tsx src/server/run-sync-sources.ts",
    "sync:tasks:seed": "tsx src/server/run-seed-sync-tasks.ts",
    "sync:tasks:run": "tsx src/server/run-sync-worker.ts",
    "generate:lessons": "tsx src/server/run-generate-lessons.ts",
    "data:bootstrap": "pnpm sync:sources && pnpm sync:tasks:seed && pnpm sync:tasks:run && pnpm generate:lessons",
    "data:bootstrap:aggressive": "SYNC_MODE=aggressive pnpm sync:sources && SYNC_MODE=aggressive pnpm sync:tasks:seed && SYNC_MODE=aggressive pnpm sync:tasks:run && SYNC_MODE=aggressive pnpm generate:lessons"
  }
}
```

Nếu project dùng `yarn`, đổi `pnpm` thành `yarn`.

---

## 18. Runner Files

Tạo:

```text
src/server/run-seed-sync-tasks.ts
```

```ts
import { seedSyncTasks } from './external/seed-sync-tasks'

seedSyncTasks()
  .then((result) => {
    console.log(result)
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
```

Tạo:

```text
src/server/run-sync-worker.ts
```

```ts
import { runSyncWorker } from './external/run-sync-worker'

runSyncWorker()
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

## 19. Run Flow

Chạy lần đầu:

```bash
docker compose up -d

pnpm install

pnpm sync:sources
pnpm sync:tasks:seed
SYNC_MODE=aggressive pnpm sync:tasks:run
pnpm generate:lessons

pnpm dev
```

Nếu muốn sync nhiều vòng:

```bash
for i in {1..20}; do
  SYNC_MODE=aggressive pnpm sync:tasks:run
done
```

Sau đó generate lại lesson:

```bash
pnpm generate:lessons
```

Kiểm tra:

```text
/api/admin/data-health
/api/today
/today
/stats
/history
```

---

## 20. Cron gợi ý

Sau này có thể cho worker chạy định kỳ:

```cron
0 */2 * * * cd /path/english-hub && SYNC_MODE=aggressive pnpm sync:tasks:run && pnpm generate:lessons
```

---

## 21. Tatoeba Bulk Import

MVP vẫn có thể dùng Tatoeba API search theo task.

Nhưng nếu muốn lấy rất rộng, nên thêm hướng bulk import sau:

```text
- Download Tatoeba sentences file.
- Chỉ import lang = eng.
- Lọc câu ngắn 3–18 words.
- Lọc câu quá dài/rác.
- Upsert bằng sourceName + externalId.
```

Tạo placeholder script:

```text
src/server/external/import-tatoeba-download.ts
```

Chưa cần implement full nếu MVP chưa dùng file download.

Rule:

```text
Không reuse Tatoeba audio nếu license không rõ.
Text sentence thì lưu kèm license/attribution nếu có.
```

---

## 22. Acceptance Criteria

## 22.1. Topic Coverage

```text
[ ] Có topic-taxonomy.ts với ít nhất 50 topic.
[ ] Các topic phủ nhiều lĩnh vực, không chỉ dev.
[ ] Mỗi topic có 8–15 seed words.
[ ] Sync jobs dùng topicTaxonomy thay cho seedTopics.
```

## 22.2. Sync Task Queue

```text
[ ] Có model SyncTask.
[ ] Có script sync:tasks:seed.
[ ] Có script sync:tasks:run.
[ ] Task seed idempotent, chạy lại không duplicate.
[ ] Worker có lock task.
[ ] Worker có retry.
[ ] Worker không crash toàn bộ nếu một task lỗi.
```

## 22.3. External Data

```text
[ ] Datamuse task tạo/merge words.
[ ] Dictionary task enrich words.
[ ] Tatoeba task tạo/merge example_sentences.
[ ] Duplicate word không bị insert lại.
[ ] Duplicate sentence không bị insert lại.
[ ] Topics/topicGroups được merge bằng $addToSet.
```

## 22.4. Lesson Generation

```text
[ ] Generate vocab lessons từ words.
[ ] Generate sentence/context lessons từ example_sentences.
[ ] Generate speaking prompts theo nhiều topic.
[ ] Generate writing prompts theo nhiều topic.
[ ] Listening lessons không scrape content.
[ ] Lesson dedupe bằng slug.
[ ] Lesson có topicGroup.
```

## 22.5. Daily Rotation

```text
[ ] /api/today không gọi API ngoài.
[ ] /api/today đọc từ lessons.
[ ] Daily plan vẫn có 5 item:
    - listening
    - vocab
    - speaking
    - writing
    - dev_english
[ ] Rotation tránh lesson dùng trong 7 ngày gần nhất.
[ ] Rotation đa dạng topicGroup.
[ ] Fallback least-used hoạt động.
[ ] Virtual fallback hoạt động nếu thiếu data.
```

## 22.6. Data Health

```text
[ ] /api/admin/data-health trả về count tổng.
[ ] Có word count by topic.
[ ] Có sentence count by topic.
[ ] Có lesson count by type.
[ ] Có lesson count by topicGroup.
[ ] Có sync task count by status.
[ ] Có latest sync runs.
```

---

## 23. Critical Rules

Không được vi phạm:

```text
- Không dùng Prisma.
- Không dùng SQLite.
- Không gọi external APIs trong /api/today.
- Không scrape BBC/VOA/British Council content.
- Không reuse Tatoeba audio nếu license chưa rõ.
- Không insert duplicate data.
- Sync phải idempotent.
- Dùng unique indexes + upsert.
- Dùng $addToSet cho topics, topicGroups, keywords, sourceNames, sourceUrls.
- Không phá no-toxic-streak product rule.
```

---

## 24. Prompt cho AI Agent

Dùng prompt này:

```text
Read docs/AI_AGENT_IMPLEMENTATION.md, docs/API_DATA_INTEGRATION.md, and docs/AGGRESSIVE_DATA_PIPELINE.md.

Upgrade the English Hub data pipeline to support aggressive broad-topic data collection.

Current issue:
The app is limited to a few dev/work topics. I want broad English learning coverage across many domains: life, work, society, business, science, travel, health, culture, language, and dev.

Implement:
1. topic-taxonomy.ts with at least 50 topic entries.
2. SyncTask model.
3. sync:tasks:seed script.
4. sync:tasks:run worker.
5. Datamuse expansion tasks.
6. Dictionary enrichment tasks.
7. Tatoeba sentence search tasks.
8. Idempotent upsert/deduplication.
9. Lesson generation across all topic groups.
10. Improved daily rotation diversity.
11. Improved /api/admin/data-health.
12. Updated package scripts.

Rules:
- /api/today must not call external APIs.
- Sync must be resumable and idempotent.
- Do not duplicate data.
- Use MongoDB + Mongoose.
- Do not use Prisma.
- Do not use SQLite.
- Do not scrape BBC/VOA/British Council.
- Do not reuse Tatoeba audio unless license clearly allows it.
- Run build and fix all errors.

After implementation:
- Run pnpm install or yarn install depending on current project.
- Run docker compose up -d.
- Run sync:sources.
- Run sync:tasks:seed.
- Run SYNC_MODE=aggressive sync:tasks:run.
- Run generate:lessons.
- Test /api/admin/data-health.
- Test /api/today.
- Run build.
```

---

## 25. Definition of Done

Hoàn thành khi:

```text
- Data không còn bị bó quanh dev/code.
- Có topic taxonomy rộng.
- Có sync task queue.
- Có thể chạy sync nhiều vòng mà không duplicate.
- Có thể resume nếu sync bị ngắt.
- MongoDB có words/sentences/lessons đa dạng.
- /api/today sinh bài học đa dạng hơn.
- App vẫn chạy được khi external APIs offline.
```
