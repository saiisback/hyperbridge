import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // Subdomain routing: money.winfinity.com → /winfinity-money/*
  const isMoneySubdomain =
    hostname.startsWith('money.') ||
    hostname === 'money.localhost:3000'

  if (isMoneySubdomain) {
    // Don't rewrite if already on the winfinity-money path or API routes
    if (!pathname.startsWith('/winfinity-money') && !pathname.startsWith('/api/')) {
      const url = request.nextUrl.clone()
      url.pathname = `/winfinity-money${pathname}`
      return NextResponse.rewrite(url)
    }
  }

  // Only apply auth middleware to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Skip auth check for cron routes (they use CRON_SECRET)
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next()
  }

  // Public endpoint: withdrawal window status (no auth needed)
  if (pathname === '/api/withdraw-window') {
    return NextResponse.next()
  }

  // Public endpoint: exchange rates (no auth needed)
  if (pathname === '/api/winfinity-money/rates') {
    return NextResponse.next()
  }

  // Require Authorization header on all /api/* routes
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    // Match all paths for subdomain routing (exclude static assets)
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
