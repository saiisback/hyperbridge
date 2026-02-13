export async function authFetch(url: string, accessToken: string, options?: RequestInit) {
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  })
}
