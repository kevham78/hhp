import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStandings } from '@/lib/api/nhl'

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const standings = await getStandings()

    return NextResponse.json({
      teams: [...standings].sort((a, b) => a.leagueSequence - b.leagueSequence),
    })
  } catch (err) {
    console.error('GET /api/nhl-standings error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
