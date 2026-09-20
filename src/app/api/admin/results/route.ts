import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { computeWeekResults } from '@/lib/db/weeklyResults'
import { confirmWeekResults } from '@/lib/db/results'
import { z } from 'zod'

const confirmSchema = z.object({
  weekId: z.string(),
})

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body   = await req.json()
    const action = body.action as 'preview' | 'confirm'

    if (action === 'preview') return handlePreview(body)
    if (action === 'confirm') return handleConfirm(body)

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/admin/results error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

async function handlePreview(body: any) {
  const { weekId } = body
  if (!weekId) {
    return NextResponse.json({ error: 'Missing weekId' }, { status: 400 })
  }

  const result = await computeWeekResults(weekId)
  if (!result) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}

async function handleConfirm(body: any) {
  const parsed = confirmSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  const result = await confirmWeekResults(parsed.data.weekId)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, weekId: parsed.data.weekId })
}
