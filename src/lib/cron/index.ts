import { startScheduler } from './scheduler'

console.log('[Cron] HHP Cron Service starting...')

startScheduler().catch(err => {
  console.error('[Cron] Failed to start scheduler:', err)
  process.exit(1)
})

// Keep the process alive
process.on('SIGTERM', () => {
  console.log('[Cron] Shutting down...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[Cron] Shutting down...')
  process.exit(0)
})