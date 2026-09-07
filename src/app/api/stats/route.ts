import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getGameStats } from '@/lib/api/nhlStats'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const home = searchParams.get('home')
    const away = searchParams.get('away')

    if (!home || !away) {
      return NextResponse.json(
        { error: 'Missing home or away team code' },
        { status: 400 }
      )
    }

    const stats = await getGameStats(home, away)

    if (!stats) {
      return NextResponse.json(
        { error: 'Could not load stats for this matchup' },
        { status: 404 }
      )
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error('GET /api/stats error:', err)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}