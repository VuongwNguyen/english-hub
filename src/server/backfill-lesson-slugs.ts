/**
 * One-off migration: backfill `slug` for legacy Lesson documents.
 *
 * Context (Task B2): the Lesson model gained a required, unique `slug`
 * field as part of the external API data integration work. The live
 * database already held 105 lessons (seeded by the original MVP build)
 * with no `slug`, so building a unique index against them would fail
 * with E11000 (every doc with a missing field collides under a
 * non-sparse unique index).
 *
 * This script assigns a deterministic, unique slug to every lesson that
 * doesn't have one, then exits. It is safe to re-run: lessons that
 * already have a slug are left untouched, and any collisions are
 * resolved by appending the Mongo `_id` suffix.
 *
 * The slugify logic intentionally mirrors `toSlug()` from
 * `src/server/external/normalize.ts` (introduced in Task B3) so legacy
 * slugs look the same as newly generated ones.
 *
 * Run with: yarn tsx --env-file=.env.local src/server/backfill-lesson-slugs.ts
 */
import mongoose from 'mongoose'
import { connectMongo } from '@/lib/mongoose'
import { Lesson } from '@/models/Lesson'

function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function backfillLessonSlugs() {
  // Mongoose auto-builds indexes (including the new unique `slug` index)
  // shortly after a model is first connected. If that race wins before
  // this backfill finishes, the unique index build fails with E11000
  // because legacy docs are still missing `slug`. Disable autoIndex
  // globally for this process and build indexes explicitly once the
  // backfill has finished and every document has a unique slug.
  mongoose.set('autoIndex', false)

  await connectMongo()

  const lessons = await Lesson.find({
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
  })

  const seen = new Set<string>(
    (
      await Lesson.find({ slug: { $exists: true, $ne: null } }).select('slug')
    ).map((lesson) => lesson.slug as string)
  )

  let updated = 0

  for (const lesson of lessons) {
    const base = toSlug(`${lesson.type}-${lesson.title}`)
    let candidate = base || `lesson-${lesson._id}`

    if (seen.has(candidate)) {
      candidate = `${candidate}-${String(lesson._id).slice(-6)}`
    }

    seen.add(candidate)

    await Lesson.updateOne({ _id: lesson._id }, { $set: { slug: candidate } })
    updated += 1
  }

  // All documents now have a unique slug; safe to build the schema's
  // indexes (including the unique index on `slug`) explicitly.
  await Lesson.syncIndexes()

  return {
    scanned: lessons.length,
    updated,
  }
}

if (require.main === module) {
  backfillLessonSlugs()
    .then((result) => {
      console.log(result)
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
