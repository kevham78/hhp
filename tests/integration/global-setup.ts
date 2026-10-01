import { execFileSync } from 'node:child_process'
import type { TestProject } from 'vitest/node'

// Integration tests run against a real, disposable Postgres:
//  - locally: a Docker container started (and removed) here
//  - in CI:   whatever TEST_DATABASE_URL points at (a service container)
// They never read DATABASE_URL or .env, so they can't touch real data.

const CONTAINER = 'hhp_vitest_pg'
const PORT      = 55439
let startedContainer = false

function assertSafe(url: string) {
  const u = new URL(url)
  const localHost = ['localhost', '127.0.0.1', 'postgres'].includes(u.hostname)
  const testDb    = u.pathname.replace('/', '').includes('test')
  if (!localHost || !testDb) {
    throw new Error(`Refusing to run integration tests against ${u.hostname}${u.pathname}: ` +
      'must be a local database whose name contains "test".')
  }
}

function docker(...args: string[]) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export default async function setup(project: TestProject) {
  let url = process.env.TEST_DATABASE_URL

  if (!url) {
    url = `postgresql://test:test@127.0.0.1:${PORT}/hhp_test`
    try { docker('rm', '-f', CONTAINER) } catch { /* not running */ }
    docker('run', '-d', '--name', CONTAINER, '-p', `${PORT}:5432`,
      '-e', 'POSTGRES_USER=test', '-e', 'POSTGRES_PASSWORD=test', '-e', 'POSTGRES_DB=hhp_test',
      'postgres:16-alpine')
    startedContainer = true
    for (let i = 0; ; i++) {
      try { docker('exec', CONTAINER, 'pg_isready', '-U', 'test', '-d', 'hhp_test', '-h', '127.0.0.1'); break }
      catch { if (i > 60) throw new Error('Test Postgres did not start'); await new Promise(r => setTimeout(r, 500)) }
    }
  }

  assertSafe(url)

  // Same migrations production runs on startup
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env:   { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  })

  project.provide('databaseUrl', url)

  return () => {
    if (startedContainer && !process.env.KEEP_TEST_DB) {
      try { docker('rm', '-f', CONTAINER) } catch { /* already gone */ }
    }
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}
