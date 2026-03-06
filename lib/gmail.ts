const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

/**
 * Get a fresh Gmail access token using the stored refresh token.
 */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail OAuth2 credentials not configured')
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to refresh Gmail token: ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

interface GmailMessage {
  id: string
  snippet: string
  body: string
}

/**
 * Fetch unread bank credit notification emails from the last N minutes.
 * Uses Gmail search query to filter by sender (bank noreply addresses).
 */
export async function fetchUnreadBankEmails(senderFilter: string): Promise<GmailMessage[]> {
  const token = await getAccessToken()

  // Search for unread emails from bank sender
  const query = `from:(${senderFilter}) is:unread newer_than:1h`
  const listRes = await fetch(
    `${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!listRes.ok) {
    throw new Error(`Gmail list error: ${listRes.status}`)
  }

  const listData = await listRes.json()
  const messageIds: { id: string }[] = listData.messages || []

  if (messageIds.length === 0) return []

  const messages: GmailMessage[] = []

  for (const { id } of messageIds) {
    const msgRes = await fetch(
      `${GMAIL_API}/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!msgRes.ok) continue

    const msgData = await msgRes.json()
    const body = extractBody(msgData)

    messages.push({
      id,
      snippet: msgData.snippet || '',
      body,
    })
  }

  return messages
}

/**
 * Mark a Gmail message as read (remove UNREAD label).
 */
export async function markAsRead(messageId: string): Promise<void> {
  const token = await getAccessToken()

  await fetch(`${GMAIL_API}/messages/${messageId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      removeLabelIds: ['UNREAD'],
    }),
  })
}

/**
 * Extract plain text body from Gmail message payload.
 */
function extractBody(message: any): string {
  const payload = message.payload
  if (!payload) return message.snippet || ''

  // Simple text/plain part
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }

  // Multipart — find text/plain or text/html
  const parts = payload.parts || []
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data)
    }
  }

  // Fallback to HTML part
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return stripHtml(decodeBase64Url(part.body.data))
    }
  }

  // Nested multipart
  for (const part of parts) {
    if (part.parts) {
      for (const sub of part.parts) {
        if (sub.body?.data) {
          return sub.mimeType === 'text/html'
            ? stripHtml(decodeBase64Url(sub.body.data))
            : decodeBase64Url(sub.body.data)
        }
      }
    }
  }

  return message.snippet || ''
}

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(base64, 'base64').toString('utf-8')
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
