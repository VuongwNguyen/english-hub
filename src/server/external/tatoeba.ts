import { fetchJson } from './http'
import { createContentHash } from './hash'
import { normalizeText } from './normalize'

const BASE_URL = 'https://api.tatoeba.org/v1/sentences'

// Note: the live Tatoeba API (api.tatoeba.org/v1/sentences) returns `owner`
// as a plain username string and does not currently include an `audios`
// array on sentence objects, despite the docs example suggesting otherwise.
// Both fields are typed loosely/optionally here and handled defensively in
// the mapping below so this stays forward-compatible if the API adds them.
type TatoebaSentenceResponse = {
  data: Array<{
    id: number
    text: string
    lang: string
    license?: string
    owner?: string | { username?: string } | null
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
  // Required by the live API as of 2026; omitting it returns HTTP 400
  // ("Required parameter \"sort\" missing").
  searchParams.set('sort', 'relevance')

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
      attribution:
        typeof sentence.owner === 'string'
          ? sentence.owner
          : sentence.owner?.username ?? '',
      hasAudio: Boolean(sentence.audios?.length),
      audioReuseAllowed:
        sentence.audios?.some((audio) => Boolean(audio.license)) ?? false,
      fetchedAt: new Date(),
      isActive: true,
    }
  })
}
