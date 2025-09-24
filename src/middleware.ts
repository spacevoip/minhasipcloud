import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public paths that do not require auth
const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/api/health',
]);

// Assets and Next internals prefixes
const PUBLIC_PREFIXES = ['/public/', '/_next/', '/favicon', '/img/', '/icons/', '/fonts/'];
// Static asset extensions served from /public at the root path
const STATIC_EXT_RE = /\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt|json|woff2?|ttf|eot|mp4|webm|ogg)$/i;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    STATIC_EXT_RE.test(pathname) // allow files like /logo.svg, /file.png, etc
  ) {
    return NextResponse.next();
  }

  // Check simple auth cookie set by frontend login (temporary until HttpOnly cookies)
  const hasAuthCookie = req.cookies.get('auth')?.value === '1';

  if (!hasAuthCookie) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    // Preserve intended destination to redirect after login
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths except API routes you explicitly want public; adjust as needed
  matcher: ['/((?!api/auth|api/public).*)'],
};
