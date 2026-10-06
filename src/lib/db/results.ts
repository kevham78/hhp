import { prisma } from '@/lib/db/prisma'
import { getWeekendResults } from '@/lib/api/nhl'
import { STRIKES_TO_ELIMINATE } from '@/lib/suicide'
import { monthKey, monthLabel } from '@/lib/months'

// ─────────────────────────────────────────────
// Confirm a week's results: fetch final NHL
// scores, grade picks, compute stats/payments,
// resolve suicide pools, and mark the week
// COMPLETED. Shared by the admin "Confirm"
// button and the Monday auto-approve cron job.
// ─────────────────────────────────────────────

export type ConfirmResult =
  | { success: true }
  | { success: false; error: string }

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

// ─────────────────────────────────────────────
// Close finished months: the top points total for
// the month wins the monthly pot (monthly prize x
// weeks played that month); a tie splits it and
// each tied player gets a monthly win.
//
// A month is finished once the week on its last
// Saturday is confirmed, or the season ends. Any
// earlier month that never closed (e.g. its last
// weekend had no games) closes with it.
// ─────────────────────────────────────────────

async function closeFinishedMonths(
  week: { id: string; saturdayDate: Date },
  season: { id: string; endDate: Date },
  monthlyPrize: number,
  adminId: string | null,
) {
  const nextSaturday = new Date(week.saturdayDate.getTime() + 7 * 86_400_000)
  const lastOfMonth  = monthKey(nextSaturday) !== monthKey(week.saturdayDate)
                    || nextSaturday > season.endDate

  const completed = await prisma.week.findMany({
    where:   { seasonId: season.id, status: 'COMPLETED' },
    orderBy: { saturdayDate: 'asc' },
  })
  const thisMonth = monthKey(week.saturdayDate)
  const months = [...new Set(completed.map(w => monthKey(w.saturdayDate)))]
    .filter(m => m < thisMonth || (m === thisMonth && lastOfMonth))

  for (const month of months) {
    const [year, mon] = month.split('-').map(Number)
    const closed = await prisma.monthlyResult.count({ where: { seasonId: season.id, year, month: mon } })
    if (closed > 0) continue

    const monthWeeks = completed.filter(w => monthKey(w.saturdayDate) === month)
    const stats = await prisma.weeklyStat.findMany({ where: { weekId: { in: monthWeeks.map(w => w.id) } } })
    const points: Record<string, number> = {}
    for (const s of stats) points[s.userId] = (points[s.userId] ?? 0) + s.points

    const top       = Math.max(...Object.values(points), 0)
    const winnerIds = Object.keys(points).filter(id => points[id] === top)
    const isSplit   = winnerIds.length > 1
    const pot       = monthlyPrize * monthWeeks.length
    const share     = winnerIds.length > 0 ? pot / winnerIds.length : 0
    const lastWeek  = monthWeeks[monthWeeks.length - 1]

    for (const [userId, total] of Object.entries(points)) {
      const isWinner = winnerIds.includes(userId)
      await prisma.monthlyResult.create({
        data: {
          seasonId: season.id, userId, year, month: mon, points: total,
          isWinner, isSplit: isWinner && isSplit, prizeAmount: isWinner ? share : 0,
        },
      })
    }

    for (const userId of winnerIds) {
      // Attached to the month's last week so it counts toward the season's winnings
      await prisma.payment.create({
        data: {
          seasonId:    season.id,
          playerId:    userId,
          weekId:      lastWeek.id,
          type:        'MONTHLY_WINNING',
          amount:      share,
          description: isSplit
            ? `${monthLabel(month)} prize (split ${winnerIds.length} ways)`
            : `${monthLabel(month)} winner`,
          recipientId: userId,
          createdBy:   adminId ?? userId,
        },
      })
      await prisma.seasonStat.update({
        where: { userId_seasonId: { userId, seasonId: season.id } },
        data:  { monthlyWins: { increment: 1 } },
      })
    }
  }
}

export async function confirmWeekResults(weekId: string): Promise<ConfirmResult> {
  const [week, settings, allPicks, suicidePicks, players] = await Promise.all([
    prisma.week.findUnique({
      where:   { id: weekId },
      include: { games: true },
    }),
    prisma.settings.findFirst({ where: { id: 'default' } }),
    prisma.pick.findMany({ where: { weekId } }),
    prisma.suicidePick.findMany({ where: { weekId } }),
    prisma.user.findMany({ where: { isActive: true } }),
  ])

  if (!week || !settings) {
    return { success: false, error: 'Week or settings not found' }
  }

  if (week.status === 'COMPLETED') {
    return { success: false, error: 'Results for this week have already been confirmed' }
  }

  const season = await prisma.season.findFirst({ where: { isActive: true } })
  if (!season) {
    return { success: false, error: 'No active season' }
  }

  const nhlResults = await getWeekendResults(
    new Date(week.saturdayDate),
    new Date(week.sundayDate)
  )

  const gameResults = week.games.map(game => {
    const nhl    = nhlResults.find(r => r.nhlGameId === game.nhlGameId)
    const winner = nhl?.isFinal
      ? (nhl.homeScore > nhl.awayScore ? game.homeTeamCode : game.awayTeamCode)
      : null
    return {
      gameId:       game.id,
      homeTeamCode: game.homeTeamCode,
      awayTeamCode: game.awayTeamCode,
      homeScore:    nhl?.homeScore ?? 0,
      awayScore:    nhl?.awayScore ?? 0,
      winner,
      isFinal:      nhl?.isFinal ?? false,
    }
  })

  if (!gameResults.every(g => g.isFinal)) {
    return { success: false, error: 'Not all games are final yet' }
  }

  // ── Claim the week ─────────────────────────
  // Only one confirm may process a week. Without this, a double-click
  // or the commissioner confirming while the Monday auto-approve runs
  // would pay prizes, add points and resolve suicide pools twice.
  const claimed = await prisma.week.updateMany({
    where: { id: weekId, status: { not: 'COMPLETED' } },
    data:  { status: 'COMPLETED' },
  })
  if (claimed.count === 0) {
    return { success: false, error: 'Results for this week have already been confirmed' }
  }

  try {
    // ── Update game scores ─────────────────────
    for (const result of gameResults) {
      await prisma.game.update({
        where: { id: result.gameId },
        data:  {
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          winner:    result.winner,
          status:    'FINAL',
        },
      })
    }

    // ── Build winners map ──────────────────────
    const gameWinners: Record<string, string> = {}
    for (const r of gameResults) {
      if (r.winner) gameWinners[r.gameId] = r.winner
    }

    // ── Mark picks correct/incorrect ───────────
    for (const pick of allPicks) {
      await prisma.pick.update({
        where: { id: pick.id },
        data:  {
          isCorrect: gameWinners[pick.gameId] === pick.pickedTeam,
          isDraft:   false,
        },
      })
    }

    // ── Calculate points ───────────────────────
    const playerPoints: Record<string, number> = {}
    for (const player of players) {
      const picks  = allPicks.filter(p => p.userId === player.id)
      let points   = 0
      for (const pick of picks) {
        if (gameWinners[pick.gameId] === pick.pickedTeam) points++
      }
      playerPoints[player.id] = points
    }

    // ── Determine winner ───────────────────────
    const sortedPlayers = players
      .map(p => ({
        userId: p.id,
        points: playerPoints[p.id] ?? 0,
        pickDetails: allPicks
          .filter(pick => pick.userId === p.id)
          .map(pick => ({
            gameId:         pick.gameId,
            correct:        gameWinners[pick.gameId] === pick.pickedTeam,
            tiebreakerRank: pick.tiebreakerRank,
          })),
      }))
      .sort((a, b) => b.points - a.points)

    const topPoints      = sortedPlayers[0]?.points ?? 0
    const tiedWithDetail = sortedPlayers.filter(p => p.points === topPoints)

    let winnerIds: string[] = []
    let isSplit             = false

    if (tiedWithDetail.length === 1) {
      winnerIds = [tiedWithDetail[0].userId]
    } else {
      const resolved = resolveTiebreaker(tiedWithDetail)
      if (resolved) {
        winnerIds = [resolved.userId]
      } else {
        isSplit   = true
        winnerIds = tiedWithDetail.map(p => p.userId)
      }
    }

    // ── Save weekly stats ──────────────────────
    for (const player of players) {
      const points   = playerPoints[player.id] ?? 0
      const isWinner = winnerIds.includes(player.id)

      await prisma.weeklyStat.upsert({
        where:  { userId_weekId: { userId: player.id, weekId } },
        update: { points, correctPicks: points, isWinner, isTied: isSplit },
        create: {
          userId:       player.id,
          weekId,
          seasonId:     season.id,
          points,
          totalPicks:   week.games.length,
          correctPicks: points,
          isWinner,
          isTied:       isSplit,
        },
      })

      await prisma.seasonStat.upsert({
        where:  { userId_seasonId: { userId: player.id, seasonId: season.id } },
        update: {
          totalPoints:   { increment: points },
          weeklyWins:    { increment: isWinner ? 1 : 0 },
          monthlyPoints: { increment: points },
        },
        create: {
          userId:        player.id,
          seasonId:      season.id,
          totalPoints:   points,
          weeklyWins:    isWinner ? 1 : 0,
          monthlyPoints: points,
        },
      })
    }

    // ── Log prize payments ─────────────────────
    const prizeAmount = isSplit
      ? settings.weeklyPrize / winnerIds.length
      : settings.weeklyPrize

    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })

    for (const winnerId of winnerIds) {
      await prisma.payment.create({
        data: {
          seasonId:    season.id,
          playerId:    winnerId,
          weekId,
          type:        'WEEKLY_WINNING',
          amount:      prizeAmount,
          description: isSplit
            ? `Week ${week.weekNumber} prize (split ${winnerIds.length} ways)`
            : `Week ${week.weekNumber} winner`,
          recipientId: winnerId,
          createdBy:   adminUser?.id ?? winnerId,
        },
      })
    }

    // ── Process suicide pools ──────────────────
    const suicidePoolStates = await prisma.suicidePoolState.findMany({
      where: { seasonId: season.id },
    })

    for (const poolType of ['WINNER', 'LOSER'] as const) {
      const poolState = suicidePoolStates.find(p => p.poolType === poolType)
      if (!poolState || !poolState.isActive) continue

      const poolPicks = suicidePicks.filter(p => p.poolType === poolType)

      const activeStatuses = await prisma.suicideStatus.findMany({
        where: {
          seasonId: season.id,
          ...(poolType === 'WINNER'
            ? { winnerPoolEliminated: false }
            : { loserPoolEliminated: false }),
        },
      })

      for (const status of activeStatuses) {
        const pick = poolPicks.find(p => p.userId === status.userId)

        if (!pick) {
          // No pick — counts as a strike
          const strikes = poolType === 'WINNER'
            ? status.winnerPoolStrikes + 1
            : status.loserPoolStrikes + 1
          const eliminated = strikes >= STRIKES_TO_ELIMINATE[poolType]

          await prisma.suicideStatus.update({
            where: { id: status.id },
            data: poolType === 'WINNER' ? {
              winnerPoolStrikes:    strikes,
              winnerPoolEliminated: eliminated,
            } : {
              loserPoolStrikes:    strikes,
              loserPoolEliminated: eliminated,
            },
          })
          continue
        }

        // Find the game for this pick
        const game = week.games.find(g =>
          g.homeTeamCode === pick.pickedTeam ||
          g.awayTeamCode === pick.pickedTeam
        )

        let isCorrect = false
        if (game) {
          isCorrect = poolType === 'WINNER'
            ? gameWinners[game.id] === pick.pickedTeam
            : gameWinners[game.id] !== pick.pickedTeam
        }

        await prisma.suicidePick.update({
          where: { id: pick.id },
          data:  { isCorrect, isDraft: false },
        })

        if (isCorrect) {
          // Survivor — add team to used list
          await prisma.suicideStatus.update({
            where: { id: status.id },
            data: poolType === 'WINNER' ? {
              winnerTeamsUsed: [...status.winnerTeamsUsed, pick.pickedTeam],
            } : {
              loserTeamsUsed: [...status.loserTeamsUsed, pick.pickedTeam],
            },
          })
        } else {
          // Wrong — a strike; out once the pool's limit is reached
          const strikes = poolType === 'WINNER'
            ? status.winnerPoolStrikes + 1
            : status.loserPoolStrikes + 1
          const eliminated = strikes >= STRIKES_TO_ELIMINATE[poolType]

          await prisma.suicideStatus.update({
            where: { id: status.id },
            data: poolType === 'WINNER' ? {
              winnerPoolStrikes:    strikes,
              winnerPoolEliminated: eliminated,
              winnerTeamsUsed:      [...status.winnerTeamsUsed, pick.pickedTeam],
            } : {
              loserPoolStrikes:    strikes,
              loserPoolEliminated: eliminated,
              loserTeamsUsed:      [...status.loserTeamsUsed, pick.pickedTeam],
            },
          })
        }
      }

      // Add this week's contribution to pot
      const newPot = poolState.currentPot + (
        poolType === 'WINNER' ? settings.suicideWinnerPrize : settings.suicideLoserPrize
      )

      // Check remaining survivors
      const remainingStatuses = await prisma.suicideStatus.findMany({
        where: {
          seasonId: season.id,
          ...(poolType === 'WINNER'
            ? { winnerPoolEliminated: false }
            : { loserPoolEliminated: false }),
        },
      })

      const remaining = remainingStatuses.length

      if (remaining === 1) {
        // Winner!
        const winnerId = remainingStatuses[0].userId

        await prisma.payment.create({
          data: {
            seasonId:    season.id,
            playerId:    winnerId,
            weekId,
            type:        'SUICIDE_WINNING',
            amount:      newPot,
            description: `Suicide ${poolType} pool winner`,
            recipientId: winnerId,
            createdBy:   adminUser?.id ?? winnerId,
          },
        })

        // Reset pool
        await prisma.suicideStatus.updateMany({
          where: { seasonId: season.id },
          data: poolType === 'WINNER' ? {
            winnerPoolEliminated: false,
            winnerPoolStrikes:    0,
            winnerTeamsUsed:      [],
          } : {
            loserPoolEliminated: false,
            loserPoolStrikes:    0,
            loserTeamsUsed:      [],
          },
        })

        await prisma.suicidePoolState.update({
          where: { id: poolState.id },
          data:  { currentPot: 0, weekId },
        })

      } else if (remaining === 0) {
        // All eliminated — split
        const splitAmount = activeStatuses.length > 0
          ? newPot / activeStatuses.length
          : 0

        for (const status of activeStatuses) {
          await prisma.payment.create({
            data: {
              seasonId:    season.id,
              playerId:    status.userId,
              weekId,
              type:        'SUICIDE_WINNING',
              amount:      splitAmount,
              description: `Suicide ${poolType} pool split`,
              recipientId: status.userId,
              createdBy:   adminUser?.id ?? status.userId,
            },
          })
        }

        // Reset pool
        await prisma.suicideStatus.updateMany({
          where: { seasonId: season.id },
          data: poolType === 'WINNER' ? {
            winnerPoolEliminated: false,
            winnerPoolStrikes:    0,
            winnerTeamsUsed:      [],
          } : {
            loserPoolEliminated: false,
            loserPoolStrikes:    0,
            loserTeamsUsed:      [],
          },
        })

        await prisma.suicidePoolState.update({
          where: { id: poolState.id },
          data:  { currentPot: 0, weekId },
        })

      } else {
        // Pool continues
        await prisma.suicidePoolState.update({
          where: { id: poolState.id },
          data:  { currentPot: newPot, weekId },
        })
      }
    }

    // ── Monthly prize, if this finishes a month ──
    await closeFinishedMonths(week, season, settings.monthlyPrize, adminUser?.id ?? null)

    // ── Mark week complete ─────────────────────
    await prisma.week.update({
      where: { id: weekId },
      data:  { status: 'COMPLETED', picksPublished: true },
    })
  } catch (err) {
    // Release the claim so the week can be confirmed again
    await prisma.week.update({ where: { id: weekId }, data: { status: week.status } })
    throw err
  }

  // ── Send results email ─────────────────────
  try {
    const stats = await prisma.weeklyStat.findMany({
      where:   { weekId },
      include: { user: true },
      orderBy: { points: 'desc' },
    })
    const winners      = stats.filter(s => s.isWinner)
    const isSplitEmail = winners.length > 1
    const prizeEmail   = isSplitEmail
      ? settings.weeklyPrize / winners.length
      : settings.weeklyPrize
    const topPts = stats[0]?.points ?? 0

    const allPlayers = await prisma.user.findMany({
      where:  { isActive: true },
      select: { email: true, name: true, notifyByEmail: true },
    })

    const { sendEmail }            = await import('@/lib/email/client')
    const { resultsAndPicksEmail } = await import('@/lib/email/templates')

    for (const player of allPlayers) {
      if (!player.email || !player.notifyByEmail) continue
      try {
        await sendEmail({
          to:      player.email,
          subject: `🏒 HHP Week ${week.weekNumber} Results`,
          html:    resultsAndPicksEmail({
            weekNumber:   week.weekNumber,
            winnerName:   isSplitEmail ? null : (winners[0]?.user?.name ?? null),
            winnerPoints: topPts,
            isSplit:      isSplitEmail,
            splitNames:   winners.map(w => w.user?.name ?? ''),
            prizeAmount:  prizeEmail,
            weekId,
          }),
        })
      } catch (emailErr) {
        console.error('Failed to send results email:', emailErr)
      }
    }
  } catch (emailErr) {
    console.error('Email sending error:', emailErr)
  }

  return { success: true }
}
