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
