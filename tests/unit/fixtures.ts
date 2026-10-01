import { readFileSync } from 'node:fs'
import path from 'node:path'

// Recorded NHL API responses. Returns a fresh copy so tests can modify it.
export function loadFixture(name: string): any {
  return JSON.parse(readFileSync(path.join(import.meta.dirname, '..', 'fixtures', 'nhl', name), 'utf8'))
}
