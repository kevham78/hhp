// A week belongs to the month its Saturday falls in. Saturdays are stored
// as UTC midnight, so read the month in UTC (local time can slip to the
// previous day, and month).

/** "YYYY-MM" for the month a week's Saturday falls in */
export const monthKey = (saturday: Date) =>
  `${saturday.getUTCFullYear()}-${String(saturday.getUTCMonth() + 1).padStart(2, '0')}`

/** "October 2026" */
export const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 15))
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
