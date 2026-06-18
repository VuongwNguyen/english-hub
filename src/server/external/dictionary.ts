import { fetchJson, HttpError } from './http'
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

  let data: DictionaryApiResponse
  try {
    data = await fetchJson<DictionaryApiResponse>(url)
  } catch (error) {
    // The Free Dictionary API responds with HTTP 404 when a word is not
    // found (rather than a 200 with an empty array). For a sync job that
    // iterates over many candidate words, "word not found" is an expected,
    // non-exceptional outcome, so we treat it as such and return null.
    // Any other failure (network error, timeout, 5xx, etc.) propagates so
    // callers can distinguish real failures from "not found".
    if (error instanceof HttpError && error.status === 404) {
      return null
    }
    throw error
  }

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
