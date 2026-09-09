import { NextResponse } from 'next/server'
import { startScheduler } from '@/lib/cron/scheduler'

let schedulerStarted = false

export async function GET() {
  if (!schedulerStarted) {
    await startScheduler()
    schedulerStarted = true
  }
  return NextResponse.json({ status: 'Scheduler running' })
}