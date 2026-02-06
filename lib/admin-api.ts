export async function adminFetch(
  url: string,
  privyId: string,
  options: RequestInit = {}
) {
  const headers = new Headers(options.headers)
  headers.set('x-privy-id', privyId)
  headers.set('Content-Type', 'application/json')

  const response = await fetch(url, {
    ...options,
    headers,
  })

  return response
}
