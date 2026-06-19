# English Hub — Expand Topic Taxonomy

## 1. Mục tiêu

Project English Hub hiện đã có pipeline sync data:

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

Hiện topic còn hơi ít và thiên về dev/work. Cần bổ sung thêm nhiều topic đời sống để app học tiếng Anh đa dạng hơn, gồm:

```text
- daily life
- social life
- travel
- food
- health
- money
- education
- career
- communication
- entertainment
- society
- environment
- emotion
- thinking
- technology
- nature
```

Mục tiêu cuối cùng là khi chạy:

```bash
yarn sync:tasks:seed
```

hệ thống sẽ sinh thêm nhiều `datamuse_expand` và `tatoeba_sentence_search` task mới, từ đó tạo thêm `dictionary_enrich` task và mở rộng dữ liệu `words`, `example_sentences`, `lessons`.

---

## 2. File cần sửa

Kiểm tra file topic hiện tại:

```text
src/server/data/topic-taxonomy.ts
```

Không được xóa topic cũ.

Chỉ được append thêm topic mới hoặc refactor nhẹ để dễ maintain.

---

## 3. Quy tắc quan trọng

Không được:

```text
- Không xóa topic cũ.
- Không đổi schema nếu không cần.
- Không hardcode tiếng Việt vào seedKeywords.
- Không dùng keyword quá dài.
- Không dùng keyword quá obscure.
- Không chạy full sync trong lúc implement.
- Không gọi external APIs trong /api/today.
- Không sửa worker theo hướng phá idempotent/upsert hiện có.
```

Được phép:

```text
- Thêm topic mới.
- Thêm group mới nếu cần.
- Dedupe topic id.
- Dedupe seed keyword.
- Thêm helper nhỏ để validate taxonomy nếu hữu ích.
- Chạy yarn sync:tasks:seed để kiểm tra seed idempotent.
- Chạy smoke sync 1 round nhỏ để kiểm tra không crash.
```

---

## 4. Schema cần tuân thủ

Trước khi code, mở file:

```text
src/server/data/topic-taxonomy.ts
```

và xem schema hiện tại.

Có thể project đang dùng một trong các dạng sau:

```ts
{
  id: "daily_life",
  group: "life",
  label: "Daily Life",
  seedKeywords: ["home", "food", "work"]
}
```

hoặc:

```ts
{
  topic: "daily_life",
  topicGroup: "life",
  keywords: ["home", "food", "work"]
}
```

Agent phải giữ đúng schema hiện tại.

Nếu schema hiện tại là `id/group/label/seedKeywords`, dùng đúng dạng đó.

Nếu schema hiện tại là `topic/topicGroup/keywords`, chuyển danh sách topic bên dưới sang đúng field name.

---

## 5. Topic mới cần bổ sung

Thêm các topic sau vào taxonomy.

Lưu ý:

```text
- id phải unique.
- seedKeywords phải unique trong từng topic.
- Keywords là tiếng Anh.
- Keywords nên ngắn, phổ biến, dễ lấy dữ liệu từ Datamuse/Dictionary/Tatoeba.
```

```ts
const EXTRA_TOPIC_TAXONOMY = [
  // =========================
  // Daily life
  // =========================
  {
    id: "morning_routine",
    group: "daily_life",
    label: "Morning Routine",
    seedKeywords: ["wake", "breakfast", "shower", "commute", "routine", "prepare", "schedule", "habit"],
  },
  {
    id: "night_routine",
    group: "daily_life",
    label: "Night Routine",
    seedKeywords: ["sleep", "relax", "dinner", "bedtime", "tired", "rest", "dream", "quiet"],
  },
  {
    id: "home_chores",
    group: "daily_life",
    label: "Home Chores",
    seedKeywords: ["clean", "wash", "laundry", "sweep", "cook", "organize", "trash", "repair"],
  },
  {
    id: "personal_care",
    group: "daily_life",
    label: "Personal Care",
    seedKeywords: ["haircut", "shave", "skin", "bath", "toothbrush", "soap", "mirror", "hygiene"],
  },
  {
    id: "time_management",
    group: "daily_life",
    label: "Time Management",
    seedKeywords: ["deadline", "calendar", "schedule", "delay", "early", "late", "plan", "priority"],
  },

  // =========================
  // Social life
  // =========================
  {
    id: "family_life",
    group: "social",
    label: "Family Life",
    seedKeywords: ["parent", "child", "sibling", "relative", "home", "care", "support", "family"],
  },
  {
    id: "friendship",
    group: "social",
    label: "Friendship",
    seedKeywords: ["friend", "trust", "invite", "hangout", "chat", "share", "support", "promise"],
  },
  {
    id: "dating_relationships",
    group: "social",
    label: "Dating & Relationships",
    seedKeywords: ["date", "love", "partner", "feeling", "relationship", "breakup", "trust", "romance"],
  },
  {
    id: "conflict_resolution",
    group: "social",
    label: "Conflict Resolution",
    seedKeywords: ["argue", "apologize", "forgive", "misunderstand", "conflict", "calm", "listen", "respect"],
  },
  {
    id: "small_talk",
    group: "communication",
    label: "Small Talk",
    seedKeywords: ["weather", "weekend", "hobby", "nice", "meet", "chat", "conversation", "question"],
  },

  // =========================
  // Career and work
  // =========================
  {
    id: "office_life",
    group: "career",
    label: "Office Life",
    seedKeywords: ["office", "colleague", "meeting", "desk", "manager", "email", "report", "task"],
  },
  {
    id: "job_interview",
    group: "career",
    label: "Job Interview",
    seedKeywords: ["interview", "resume", "experience", "strength", "weakness", "salary", "hire", "candidate"],
  },
  {
    id: "workplace_feedback",
    group: "career",
    label: "Workplace Feedback",
    seedKeywords: ["feedback", "improve", "performance", "review", "suggestion", "mistake", "growth", "skill"],
  },
  {
    id: "remote_work",
    group: "career",
    label: "Remote Work",
    seedKeywords: ["remote", "online", "workspace", "meeting", "timezone", "focus", "message", "productivity"],
  },
  {
    id: "freelancing",
    group: "career",
    label: "Freelancing",
    seedKeywords: ["client", "project", "invoice", "contract", "deadline", "proposal", "freelance", "payment"],
  },

  // =========================
  // Money and practical life
  // =========================
  {
    id: "personal_finance",
    group: "money",
    label: "Personal Finance",
    seedKeywords: ["budget", "save", "spend", "income", "expense", "debt", "invest", "cash"],
  },
  {
    id: "banking",
    group: "money",
    label: "Banking",
    seedKeywords: ["bank", "account", "transfer", "withdraw", "deposit", "card", "fee", "balance"],
  },
  {
    id: "insurance",
    group: "money",
    label: "Insurance",
    seedKeywords: ["insurance", "claim", "policy", "coverage", "risk", "accident", "health", "payment"],
  },
  {
    id: "renting_house",
    group: "housing",
    label: "Renting a House",
    seedKeywords: ["rent", "landlord", "tenant", "deposit", "contract", "room", "apartment", "move"],
  },
  {
    id: "buying_selling",
    group: "shopping",
    label: "Buying & Selling",
    seedKeywords: ["buy", "sell", "price", "discount", "order", "delivery", "refund", "exchange"],
  },

  // =========================
  // Health
  // =========================
  {
    id: "doctor_visit",
    group: "health",
    label: "Doctor Visit",
    seedKeywords: ["doctor", "appointment", "symptom", "pain", "medicine", "fever", "cough", "clinic"],
  },
  {
    id: "mental_wellbeing",
    group: "health",
    label: "Mental Wellbeing",
    seedKeywords: ["stress", "anxiety", "calm", "mind", "emotion", "rest", "therapy", "balance"],
  },
  {
    id: "fitness",
    group: "health",
    label: "Fitness",
    seedKeywords: ["exercise", "gym", "run", "stretch", "strength", "muscle", "training", "healthy"],
  },
  {
    id: "nutrition",
    group: "health",
    label: "Nutrition",
    seedKeywords: ["food", "diet", "protein", "vegetable", "fruit", "calorie", "meal", "healthy"],
  },
  {
    id: "first_aid",
    group: "emergency",
    label: "First Aid",
    seedKeywords: ["injury", "bleeding", "bandage", "burn", "help", "emergency", "pain", "care"],
  },

  // =========================
  // Travel and public places
  // =========================
  {
    id: "airport",
    group: "travel",
    label: "Airport",
    seedKeywords: ["airport", "flight", "passport", "luggage", "ticket", "boarding", "gate", "delay"],
  },
  {
    id: "hotel",
    group: "travel",
    label: "Hotel",
    seedKeywords: ["hotel", "room", "checkin", "checkout", "reservation", "key", "service", "guest"],
  },
  {
    id: "restaurant",
    group: "food",
    label: "Restaurant",
    seedKeywords: ["menu", "order", "dish", "waiter", "bill", "taste", "spicy", "reservation"],
  },
  {
    id: "public_transport",
    group: "transportation",
    label: "Public Transport",
    seedKeywords: ["bus", "train", "station", "ticket", "route", "traffic", "commute", "arrive"],
  },
  {
    id: "directions",
    group: "travel",
    label: "Asking for Directions",
    seedKeywords: ["direction", "street", "left", "right", "near", "far", "map", "location"],
  },

  // =========================
  // Education
  // =========================
  {
    id: "school_life",
    group: "education",
    label: "School Life",
    seedKeywords: ["school", "student", "teacher", "class", "homework", "exam", "lesson", "grade"],
  },
  {
    id: "university",
    group: "education",
    label: "University",
    seedKeywords: ["university", "campus", "lecture", "degree", "major", "research", "professor", "student"],
  },
  {
    id: "self_learning",
    group: "education",
    label: "Self Learning",
    seedKeywords: ["learn", "practice", "study", "habit", "goal", "progress", "review", "memory"],
  },
  {
    id: "online_learning",
    group: "education",
    label: "Online Learning",
    seedKeywords: ["course", "video", "lesson", "online", "quiz", "certificate", "platform", "skill"],
  },
  {
    id: "exam_preparation",
    group: "education",
    label: "Exam Preparation",
    seedKeywords: ["exam", "test", "score", "practice", "question", "answer", "review", "prepare"],
  },

  // =========================
  // Entertainment and media
  // =========================
  {
    id: "movies",
    group: "entertainment",
    label: "Movies",
    seedKeywords: ["movie", "actor", "scene", "story", "cinema", "character", "director", "review"],
  },
  {
    id: "music",
    group: "entertainment",
    label: "Music",
    seedKeywords: ["music", "song", "listen", "singer", "concert", "melody", "album", "rhythm"],
  },
  {
    id: "books",
    group: "entertainment",
    label: "Books",
    seedKeywords: ["book", "novel", "chapter", "author", "story", "read", "page", "library"],
  },
  {
    id: "games",
    group: "entertainment",
    label: "Games",
    seedKeywords: ["game", "player", "level", "score", "team", "challenge", "win", "lose"],
  },
  {
    id: "social_media",
    group: "media",
    label: "Social Media",
    seedKeywords: ["post", "comment", "share", "follow", "profile", "message", "trend", "online"],
  },

  // =========================
  // Society
  // =========================
  {
    id: "community",
    group: "society",
    label: "Community",
    seedKeywords: ["community", "neighbor", "support", "volunteer", "local", "event", "help", "group"],
  },
  {
    id: "public_service",
    group: "society",
    label: "Public Service",
    seedKeywords: ["government", "service", "document", "office", "apply", "form", "license", "citizen"],
  },
  {
    id: "law_basic",
    group: "society",
    label: "Basic Law",
    seedKeywords: ["law", "rule", "right", "contract", "legal", "police", "court", "evidence"],
  },
  {
    id: "news_discussion",
    group: "media",
    label: "News Discussion",
    seedKeywords: ["news", "report", "event", "issue", "source", "fact", "opinion", "update"],
  },
  {
    id: "environment_action",
    group: "environment",
    label: "Environmental Action",
    seedKeywords: ["recycle", "waste", "plastic", "climate", "energy", "pollution", "green", "protect"],
  },

  // =========================
  // Emotion and thinking
  // =========================
  {
    id: "feelings",
    group: "emotion",
    label: "Feelings",
    seedKeywords: ["happy", "sad", "angry", "afraid", "excited", "lonely", "proud", "nervous"],
  },
  {
    id: "decision_making",
    group: "thinking",
    label: "Decision Making",
    seedKeywords: ["decide", "choice", "option", "risk", "reason", "compare", "select", "judge"],
  },
  {
    id: "problem_solving",
    group: "thinking",
    label: "Problem Solving",
    seedKeywords: ["problem", "solution", "cause", "effect", "analyze", "fix", "improve", "result"],
  },
  {
    id: "critical_thinking",
    group: "thinking",
    label: "Critical Thinking",
    seedKeywords: ["logic", "evidence", "argument", "bias", "assumption", "reason", "claim", "question"],
  },
  {
    id: "creativity",
    group: "thinking",
    label: "Creativity",
    seedKeywords: ["idea", "create", "design", "imagine", "inspire", "art", "original", "experiment"],
  },

  // =========================
  // Communication skills
  // =========================
  {
    id: "email_writing",
    group: "communication",
    label: "Email Writing",
    seedKeywords: ["email", "subject", "reply", "request", "confirm", "attach", "regards", "followup"],
  },
  {
    id: "phone_call",
    group: "communication",
    label: "Phone Call",
    seedKeywords: ["call", "phone", "answer", "hold", "message", "speak", "hear", "number"],
  },
  {
    id: "presentation",
    group: "communication",
    label: "Presentation",
    seedKeywords: ["present", "slide", "audience", "explain", "topic", "summary", "question", "introduce"],
  },
  {
    id: "negotiation",
    group: "communication",
    label: "Negotiation",
    seedKeywords: ["negotiate", "offer", "agree", "deal", "price", "condition", "compromise", "benefit"],
  },
  {
    id: "storytelling",
    group: "communication",
    label: "Storytelling",
    seedKeywords: ["story", "beginning", "event", "character", "happen", "describe", "memory", "ending"],
  },

  // =========================
  // Technology
  // =========================
  {
    id: "ai_tools",
    group: "technology",
    label: "AI Tools",
    seedKeywords: ["ai", "prompt", "tool", "chatbot", "automation", "model", "generate", "assistant"],
  },
  {
    id: "internet_safety",
    group: "technology",
    label: "Internet Safety",
    seedKeywords: ["password", "privacy", "account", "scam", "secure", "login", "verify", "protect"],
  },
  {
    id: "smartphone",
    group: "technology",
    label: "Smartphone",
    seedKeywords: ["phone", "app", "battery", "screen", "camera", "message", "notification", "setting"],
  },
  {
    id: "computer_basics",
    group: "technology",
    label: "Computer Basics",
    seedKeywords: ["computer", "file", "folder", "screen", "keyboard", "mouse", "install", "update"],
  },
  {
    id: "online_payment",
    group: "technology",
    label: "Online Payment",
    seedKeywords: ["payment", "wallet", "transfer", "card", "checkout", "qr", "transaction", "receipt"],
  },

  // =========================
  // Nature and world
  // =========================
  {
    id: "weather_events",
    group: "nature",
    label: "Weather Events",
    seedKeywords: ["rain", "storm", "wind", "flood", "heat", "cold", "cloud", "forecast"],
  },
  {
    id: "animals_pets",
    group: "nature",
    label: "Animals & Pets",
    seedKeywords: ["dog", "cat", "pet", "animal", "feed", "care", "wild", "friendly"],
  },
  {
    id: "plants_gardening",
    group: "nature",
    label: "Plants & Gardening",
    seedKeywords: ["plant", "flower", "garden", "water", "soil", "grow", "seed", "leaf"],
  },
  {
    id: "city_life",
    group: "society",
    label: "City Life",
    seedKeywords: ["city", "street", "traffic", "building", "crowd", "noise", "market", "public"],
  },
  {
    id: "countryside",
    group: "society",
    label: "Countryside",
    seedKeywords: ["village", "farm", "field", "quiet", "river", "nature", "local", "harvest"],
  },
];
```

---

## 6. Cách implement

### Option A — append trực tiếp vào taxonomy hiện tại

Nếu file hiện tại export array như:

```ts
export const TOPIC_TAXONOMY = [
  // existing topics
];
```

thì append topic mới vào cuối array đó.

### Option B — tách file riêng cho dễ maintain

Có thể tạo file:

```text
src/server/data/extra-topic-taxonomy.ts
```

rồi export:

```ts
export const EXTRA_TOPIC_TAXONOMY = [
  // topics above
];
```

Sau đó trong `topic-taxonomy.ts`:

```ts
import { EXTRA_TOPIC_TAXONOMY } from "./extra-topic-taxonomy";

export const TOPIC_TAXONOMY = [
  ...BASE_TOPIC_TAXONOMY,
  ...EXTRA_TOPIC_TAXONOMY,
];
```

Chỉ dùng Option B nếu không làm rối code hiện tại.

---

## 7. Validation cần thêm

Thêm helper validate nhẹ nếu project chưa có.

Mục tiêu:

```text
- Không trùng topic id.
- Không topic nào thiếu keyword.
- Không keyword rỗng.
- Không keyword quá dài.
```

Ví dụ:

```ts
export function validateTopicTaxonomy(topics: TopicTaxonomyItem[]) {
  const ids = new Set<string>();

  for (const topic of topics) {
    if (ids.has(topic.id)) {
      throw new Error(`Duplicate topic id: ${topic.id}`);
    }

    ids.add(topic.id);

    if (!topic.seedKeywords?.length) {
      throw new Error(`Topic has no seedKeywords: ${topic.id}`);
    }

    for (const keyword of topic.seedKeywords) {
      if (!keyword.trim()) {
        throw new Error(`Empty keyword in topic: ${topic.id}`);
      }

      if (keyword.length > 32) {
        throw new Error(`Keyword too long in topic ${topic.id}: ${keyword}`);
      }
    }
  }
}
```

Nếu schema khác, adapt field name cho đúng.

Không bắt buộc tạo validation nếu project đã có build/typecheck đủ tốt.

---

## 8. Commands sau khi implement

Không chạy full sync trong lúc agent implement.

Chỉ chạy:

```bash
yarn build
```

Sau đó seed task:

```bash
yarn sync:tasks:seed
```

Check task đã tăng chưa:

```bash
mongosh "$MONGODB_URI" --quiet --eval '
  db.sync_tasks.aggregate([
    {
      $group: {
        _id: {
          status: "$status",
          type: "$type"
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]).toArray()
'
```

Smoke test worker một round nhỏ:

```bash
MAX_ROUNDS=1 \
SYNC_WORKER_BATCH_SIZE=5 \
SYNC_WORKER_CONCURRENCY=1 \
SYNC_REQUEST_SLEEP_MS=3000 \
yarn sync:until-done
```

Không chạy:

```bash
yarn sync:until-done:aggressive
```

trong lúc agent implement.

---

## 9. Cách chạy thật sau khi merge

Sau khi user đã kiểm tra code ổn, chạy trên VPS bằng PM2.

Do Dictionary API đang bị rate limit `HTTP 429`, không chạy quá nhanh.

Khuyến nghị:

```bash
pm2 delete english-sync || true

pm2 start bash \
  --name english-sync \
  --cwd /root/app/english-hub \
  --no-autorestart \
  --time \
  -- -lc 'set -a; source .env.local; set +a; SYNC_MODE=aggressive SYNC_WORKER_BATCH_SIZE=20 SYNC_WORKER_CONCURRENCY=1 SYNC_REQUEST_SLEEP_MS=4000 yarn sync:until-done'
```

Theo dõi:

```bash
pm2 logs english-sync --lines 100
```

---

## 10. Expected result

Sau khi chạy `yarn sync:tasks:seed`, `sync_tasks` sẽ có thêm task mới, chủ yếu là:

```text
datamuse_expand
tatoeba_sentence_search
```

Sau khi `datamuse_expand` chạy, nó sẽ tạo thêm:

```text
dictionary_enrich
```

Sau khi worker chạy xong, data nên tăng ở:

```text
words
example_sentences
lessons
```

Sau khi sync xong hoặc gần xong, chạy:

```bash
yarn generate:lessons
```

---

## 11. Acceptance Criteria

Hoàn thành khi:

```text
[ ] Đã bổ sung nhiều topic mới vào taxonomy.
[ ] Không xóa topic cũ.
[ ] Không trùng topic id.
[ ] Không có topic thiếu seedKeywords.
[ ] Keywords là tiếng Anh.
[ ] yarn build pass.
[ ] yarn sync:tasks:seed chạy được.
[ ] Seed task không tạo duplicate taskKey.
[ ] Có thêm task mới nếu topic/keyword mới chưa từng tồn tại.
[ ] Không chạy full sync trong quá trình implement.
```

---

## 12. Final Agent Prompt

Dùng prompt này cho coding agent:

```text
Read docs/EXPAND_TOPIC_TAXONOMY_AGENT.md and implement it.

Goal:
Expand English Hub topic taxonomy to make learning data more diverse and richer.

Requirements:
1. Inspect src/server/data/topic-taxonomy.ts and follow the existing schema.
2. Add all extra topics from the docs.
3. Do not remove existing topics.
4. Do not create duplicate topic ids.
5. Do not create empty seedKeywords.
6. Keep keywords short, common, and in English.
7. Keep seed task generation idempotent.
8. Do not call external APIs inside /api/today.
9. Do not run full sync.
10. Run yarn build.
11. Run yarn sync:tasks:seed only to verify task creation.
12. Run only a tiny smoke sync if needed:
    MAX_ROUNDS=1 SYNC_WORKER_BATCH_SIZE=5 SYNC_WORKER_CONCURRENCY=1 SYNC_REQUEST_SLEEP_MS=3000 yarn sync:until-done

After implementation, summarize:
- files changed
- number of topics added
- any schema adaptation made
- build result
- seed result
```
