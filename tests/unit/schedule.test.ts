import { describe, it, expect, afterEach, vi } from 'vitest'
import { getPicksDeadline, getDuesOwedTime, isPastDeadline, isPicksWindowOpen } from '@/lib/db/weeks'
import { toCron, isWithinJobWindow } from '@/lib/cron/scheduler'

const sat = (d: string) => new Date(`${d}T00:00:00Z`)

afterEach(() => vi.useRealTimers())

describe('picks deadline (Friday, Eastern time)', () => {
  it('is Friday 2pm EDT in October', () => {
    expect(getPicksDeadline(sat('2026-10-03'), '14:00').toISOString()).toBe('2026-10-02T18:00:00.000Z')
  })

  it('stays 2pm local after clocks change in November (EST)', () => {
    // Clocks fall back Sun Nov 1, 2026
    expect(getPicksDeadline(sat('2026-11-07'), '14:00').toISOString()).toBe('2026-11-06T19:00:00.000Z')
  })

  it('handles a weekend that starts a new month (Friday is the 31st)', () => {
    expect(getPicksDeadline(sat('2026-08-01'), '14:00').toISOString()).toBe('2026-07-31T18:00:00.000Z')
  })

  it('dues start accruing Friday 8am Eastern', () => {
    expect(getDuesOwedTime(sat('2026-10-03')).toISOString()).toBe('2026-10-02T12:00:00.000Z')
  })

  it('window is open up to the deadline and closed after it', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const week = { picksDeadline: new Date('2026-10-02T18:00:00Z') }
    vi.setSystemTime(new Date('2026-10-02T17:59:59Z'))
    expect([isPicksWindowOpen(week), isPastDeadline(week)]).toEqual([true, false])
    vi.setSystemTime(new Date('2026-10-02T18:00:01Z'))
    expect([isPicksWindowOpen(week), isPastDeadline(week)]).toEqual([false, true])
  })
})

describe('cron jobs', () => {
  it('converts the settings day/time into a cron expression (Eastern wall clock)', () => {
    expect(toCron('Thursday', '15:00')).toBe('0 15 * * 4')
    expect(toCron('Friday', '08:30')).toBe('30 8 * * 5')
    expect(toCron('Sunday', '09:00')).toBe('0 9 * * 0')
  })

  it('only runs weekly jobs within 7 days of the week\'s games', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-25T12:00:00Z'))
    expect(isWithinJobWindow({ saturdayDate: sat('2026-10-03') })).toBe(false)
    vi.setSystemTime(new Date('2026-09-26T00:00:00Z'))
    expect(isWithinJobWindow({ saturdayDate: sat('2026-10-03') })).toBe(true)
  })
})
