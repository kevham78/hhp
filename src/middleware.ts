import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn   = !!session
  const isAuthPage   = nextUrl.pathname.startsWith('/login') ||
                       nextUrl.pathname.startsWith('/register')
  const isApiAuth    = nextUrl.pathname.startsWith('/api/auth')

  if (isApiAuth) return NextResponse.next()
  if (isLoggedIn && isAuthPage) return NextResponse.redirect(new URL('/picks', nextUrl))
  if (!isLoggedIn && !isAuthPage) {
    const loginUrl = new URL('/login', nextUrl)
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon).*)'],
}