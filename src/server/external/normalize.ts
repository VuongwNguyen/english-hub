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
