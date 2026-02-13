export async function adminFetch(
  url: string,
  accessToken: string,
  options: RequestInit = {}
) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('Content-Type', 'application/json')

  const response = await fetch(url, {
    ...options,
    headers,
  })

  return response
}
