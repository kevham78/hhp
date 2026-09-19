import { prisma } from '@/lib/db/prisma'
import { getWeekendResults } from '@/lib/api/nhl'

// ─────────────────────────────────────────────
// Live, per-game weekly results — computed from
// whatever the NHL API currently reports, not
// from the admin-confirmed (post-weekend) data.
//
// Used both by the admin results preview and by
// the player-facing Weekly Picks page, so a game
// that's already final shows its score/highlight
// right away instead of waiting for every game in
// the week to finish and the admin to confirm.
// ─────────────────────────────────────────────

function resolveTiebreaker(tiedPlayers: any[]): any | null {
  let remaining = [...tiedPlayers]
  for (const rank of [1, 2, 3]) {
    const withCorrect = remaining.filter(p => {
      const tb = p.pickDetails.find((d: any) => d.tiebreakerRank === rank)
      return tb?.correct === true
    })
    if (withCorrect.length === 1) return withCorrect[0]
    if (withCorrect.length > 1)  remaining = withCorrect
  }
  return null
}

export async function computeWeekResults(weekId: string) {
  const [week, settings, allPicks, suicidePicks, players] = await Promise.all([
    prisma.week.findUnique({
      where:   { id: weekId },
      include: { games: true },
    }),
    prisma.settings.findFirst({ where: { id: 'default' } }),
    prisma.pick.findMany({
      where:   { weekId, isDraft: false },
      include: { user: true },
    }),
    prisma.suicidePick.findMany({
      where:   { weekId, isDraft: false },
      include: { user: true },
    }),
    prisma.user.findMany({ where: { isActive: true } }),
  ])

  if (!week || !settings) return null

  const nhlResults = await getWeekendResults(
    new Date(week.saturdayDate),
    new Date(week.sundayDate)
  )

  const gameResults = week.games.map(game => {
    const nhlResult = nhlResults.find(r => r.nhlGameId === game.nhlGameId)
    const winner = nhlResult?.isFinal
      ? (nhlResult.homeScore > nhlResult.awayScore
          ? game.homeTeamCode
          : game.awayTeamCode)
      : null

    return {
      gameId:       game.id,
      nhlGameId:    game.nhlGameId,
      homeTeamCode: game.homeTeamCode,
      awayTeamCode: game.awayTeamCode,
      gameDay:      game.gameDay,
      gameTime:     game.gameTime,
      homeScore:    nhlResult?.homeScore ?? null,
      awayScore:    nhlResult?.awayScore ?? null,
      winner,
      isFinal:      nhlResult?.isFinal ?? false,
      isLive:       nhlResult?.isLive  ?? false,
    }
  })

  const allFinal   = gameResults.length > 0 && gameResults.every(g => g.isFinal)
  const anyLive    = gameResults.some(g => g.isLive)
  const finalGames = gameResults.filter(g => g.isFinal)

  const playerResults = players.map(player => {
    const playerPicks = allPicks.filter(p => p.userId === player.id)
    let points        = 0

    const pickDetails = gameResults.map(result => {
      const pick    = playerPicks.find(p => p.gameId === result.gameId)
      const picked  = pick?.pickedTeam ?? null
      const correct = result.isFinal && picked === result.winner
      if (correct) points++

      return {
        gameId:         result.gameId,
        homeTeamCode:   result.homeTeamCode,
        awayTeamCode:   result.awayTeamCode,
        homeScore:      result.homeScore,
        awayScore:      result.awayScore,
        winner:         result.winner,
        isFinal:        result.isFinal,
        isLive:         result.isLive,
        pickedTeam:     picked,
        correct:        result.isFinal ? correct : null,
        tiebreakerRank: pick?.tiebreakerRank ?? null,
        autoPicked:     pick?.isAutoPickd ?? false,
      }
    })

    const winnerSuicide = suicidePicks.find(
      s => s.userId === player.id && s.poolType === 'WINNER'
    )
    const loserSuicide = suicidePicks.find(
      s => s.userId === player.id && s.poolType === 'LOSER'
    )

    const suicideWinnerGame = winnerSuicide
      ? gameResults.find(g => g.homeTeamCode === winnerSuicide.pickedTeam || g.awayTeamCode === winnerSuicide.pickedTeam)
      : null
    const suicideLoserGame = loserSuicide
      ? gameResults.find(g => g.homeTeamCode === loserSuicide.pickedTeam || g.awayTeamCode === loserSuicide.pickedTeam)
      : null

    const suicideWinnerCorrect = winnerSuicide && suicideWinnerGame?.isFinal
      ? suicideWinnerGame.winner === winnerSuicide.pickedTeam
      : null
    const suicideLoserCorrect = loserSuicide && suicideLoserGame?.isFinal
      ? suicideLoserGame.winner !== loserSuicide.pickedTeam
      : null

    return {
      userId:    player.id,
      name:      player.name,
      image:     player.image,
      points,
      pickDetails,
      suicideWinner: winnerSuicide
        ? { team: winnerSuicide.pickedTeam, correct: suicideWinnerCorrect }
        : null,
      suicideLoser: loserSuicide
        ? { team: loserSuicide.pickedTeam, correct: suicideLoserCorrect }
        : null,
    }
  }).sort((a, b) => b.points - a.points)

  const topPoints = playerResults[0]?.points ?? 0
  const tied      = playerResults.filter(p => p.points === topPoints)
  let weeklyWinner: any = null
  let isSplit           = false

  if (tied.length === 1) {
    weeklyWinner = tied[0]
  } else if (tied.length > 1) {
    const resolved = resolveTiebreaker(tied)
    if (resolved) {
      weeklyWinner = resolved
    } else {
      isSplit = true
    }
  }

  return {
    weekId,
    weekNumber:   week.weekNumber,
    saturdayDate: week.saturdayDate,
    sundayDate:   week.sundayDate,
    picksPublished: week.picksPublished,
    gameResults,
    playerResults,
    weeklyWinner: isSplit ? null : weeklyWinner,
    isSplit,
    splitPlayers: isSplit ? tied : [],
    topPoints,
    allFinal,
    anyLive,
    prizes: {
      totalCollected: players.length * settings.weeklyDues,
      weeklyPrize:    isSplit ? settings.weeklyPrize / tied.length : settings.weeklyPrize,
      monthlyPot:     settings.monthlyPrize,
      suicideWinner:  settings.suicideWinnerPrize,
      suicideLoser:   settings.suicideLoserPrize,
    },
  }
}
