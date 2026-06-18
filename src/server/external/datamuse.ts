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
