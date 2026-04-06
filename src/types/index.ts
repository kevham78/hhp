import type { User, Week, Game, Pick, SuicidePick, Season, Settings } from '@prisma/client'

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
export type UserRole = 'PLAYER' | 'ADMIN'

declare module 'next-auth' {
  interface User {
    role: UserRole
  }
  interface Session {
    user: {
      id:    string
      email: string
      name:  string
      image: string
      role:  UserRole
    }
  }
}

// ─────────────────────────────────────────────
// Games & Picks
// ─────────────────────────────────────────────
export type GameWithPick = Game & {
  picks: Pick[]
}

export type WeekWithGames = Week & {
  games: GameWithPick[]
}

export type PickPhase = 'PICKS' | 'TIEBREAKERS' | 'SUICIDE'

export type DraftPicks = {
  // gameId -> team code
  picks:        Record<string, string>
  // gameId -> tiebreaker rank (1, 2, 3)
  tiebreakers:  Record<string, number>
  // suicide picks
  suicide: {
    winner: string | null  // team code
    loser:  string | null
  }
}

// ─────────────────────────────────────────────
// Standings & Stats
// ─────────────────────────────────────────────
export type PlayerStanding = {
  userId:       string
  name:         string
  image:        string | null
  totalPoints:  number
  weeklyWins:   number
  monthlyWins:  number
  weeklyPoints: number  // current week
}

export type WeekResult = {
  weekId:     string
  weekNumber: number
  satDate:    Date
  sunDate:    Date
  winner:     { name: string; points: number } | null
  isSplit:    boolean
  splitWinners: { name: string; points: number }[]
  prizeAmount: number
}

// ─────────────────────────────────────────────
// Suicide Pool
// ─────────────────────────────────────────────
export type SuicidePoolType = 'WINNER' | 'LOSER'

export type SuicidePlayerStatus = {
  userId:       string
  name:         string
  image:        string | null
  isEliminated: boolean
  strikes:      number
  teamsUsed:    string[]
}

// ─────────────────────────────────────────────
// NHL API
// ─────────────────────────────────────────────
export type NHLTeam = {
  code:       string
  name:       string
  city:       string
  logo:       string
  conference: string
  division:   string
}

export type NHLGame = {
  id:           number
  homeTeam:     string
  awayTeam:     string
  homeTeamCode: string
  awayTeamCode: string
  gameTime:     string  // ISO string
  status:       string
}

export type NHLStanding = {
  teamCode:     string
  teamName:     string
  wins:         number
  losses:       number
  otLosses:     number
  points:       number
  gamesPlayed:  number
  last10:       string   // e.g. "7-2-1"
  streak:       string   // e.g. "W3"
}

export type HeadToHead = {
  season:     string
  teamA:      string
  teamB:      string
  teamAWins:  number
  teamBWins:  number
  games:      {
    date:       string
    homeTeam:   string
    awayTeam:   string
    homeScore:  number
    awayScore:  number
  }[]
}

// ─────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────
export type PlayerFinancials = {
  userId:       string
  name:         string
  totalDues:    number
  totalPaid:    number
  totalWon:     number
  balance:      number  // negative = owes money, positive = commissioner owes player
  payments:     PaymentRecord[]
}

export type PaymentRecord = {
  id:          string
  date:        Date
  type:        string
  amount:      number
  description: string
}

// ─────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────
export type AppSettings = Settings
