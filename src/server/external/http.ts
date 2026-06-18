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
