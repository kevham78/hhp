const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hhp.kevinhamilton.ca'
const LOGO_URL = `${APP_URL}/favicon.svg`

// ─────────────────────────────────────────────
// Base HTML wrapper — consistent branding
// ─────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hicks Hockey Pool</title>
</head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="text-align:center;padding:32px 0 24px;">
      <div style="display:inline-block;background:#0d2347;border:2px solid #d4a843;
                  border-radius:12px;padding:16px 32px;">
        <span style="font-size:28px;font-weight:900;color:#ffffff;
                     letter-spacing:4px;font-family:Arial Black,Arial,sans-serif;">
          HHP
        </span>
        <div style="color:#d4a843;font-size:11px;letter-spacing:2px;margin-top:2px;">
          HICKS HOCKEY POOL
        </div>
      </div>
    </div>

    <!-- Content -->
    <div style="background:#0d2347;border-radius:12px;border:1px solid #1a3a6b;
                padding:32px;margin-bottom:16px;">
      ${content}
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;">
      <p style="color:#1a3a6b;font-size:12px;margin:0;">
        Hicks Hockey Pool · Est. 2025 · Three Brothers, One Trophy 🏒
      </p>
      <p style="margin:8px 0 0;">
        <a href="${APP_URL}" style="color:#d4a843;font-size:12px;">
          Open HHP →
        </a>
      </p>
    </div>

  </div>
</body>
</html>
  `
}

// ─────────────────────────────────────────────
// Button helper
// ─────────────────────────────────────────────

function button(text: string, url: string, color = '#e8132a'): string {
  return `
    <div style="text-align:center;margin:24px 0;">
      <a href="${url}"
         style="display:inline-block;background:${color};color:#ffffff;
                padding:14px 32px;border-radius:8px;text-decoration:none;
                font-weight:bold;font-size:16px;">
        ${text}
      </a>
    </div>
  `
}

// ─────────────────────────────────────────────
// 1. Results + Picks Reminder
// Sent when commissioner confirms results
// ─────────────────────────────────────────────

export function resultsAndPicksEmail({
  weekNumber,
  winnerName,
  winnerPoints,
  isSplit,
  splitNames,
  prizeAmount,
  weekId,
  nextWeekId,
}: {
  weekNumber:   number
  winnerName:   string | null
  winnerPoints: number
  isSplit:      boolean
  splitNames:   string[]
  prizeAmount:  number
  weekId:       string
  nextWeekId?:  string
}): string {
  const winnerSection = isSplit
    ? `
      <div style="background:#1a3a6b;border-radius:8px;padding:20px;
                  text-align:center;margin:20px 0;">
        <div style="color:#d4a843;font-size:13px;font-weight:bold;
                    text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">
          Split Pot 🤝
        </div>
        <div style="color:#ffffff;font-size:20px;font-weight:900;">
          ${splitNames.join(' & ')}
        </div>
        <div style="color:#d4a843;font-size:16px;font-weight:bold;margin-top:8px;">
          Each wins $${prizeAmount.toFixed(2)}
        </div>
        <div style="color:#8899aa;font-size:14px;margin-top:4px;">
          ${winnerPoints} correct picks
        </div>
      </div>
    `
    : `
      <div style="background:#1a3a6b;border-radius:8px;padding:20px;
                  text-align:center;margin:20px 0;">
        <div style="color:#d4a843;font-size:13px;font-weight:bold;
                    text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">
          🏆 Week ${weekNumber} Winner
        </div>
        <div style="color:#ffffff;font-size:24px;font-weight:900;">
          ${winnerName}
        </div>
        <div style="color:#d4a843;font-size:18px;font-weight:bold;margin-top:8px;">
          $${prizeAmount.toFixed(2)}
        </div>
        <div style="color:#8899aa;font-size:14px;margin-top:4px;">
          ${winnerPoints} correct picks
        </div>
      </div>
    `

  const content = `
    <h1 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 8px;">
      Week ${weekNumber} Results Are In! 🎉
    </h1>
    <p style="color:#8899aa;font-size:14px;margin:0 0 24px;">
      Here's how Week ${weekNumber} wrapped up.
    </p>

    ${winnerSection}

    ${button('View Full Picks', `${APP_URL}/results/week?weekId=${weekId}`, '#1a3a6b')}

    <hr style="border:none;border-top:1px solid #1a3a6b;margin:24px 0;">

    <h2 style="color:#d4a843;font-size:18px;font-weight:900;margin:0 0 8px;">
      🏒 Time to Pick for This Week!
    </h2>
    <p style="color:#8899aa;font-size:14px;margin:0 0 20px;">
      This weekend's games are ready. Get your picks in before the Friday 2pm deadline!
    </p>

    ${button('Make Your Picks →', `${APP_URL}/picks`)}
  `

  return baseTemplate(content)
}

// ─────────────────────────────────────────────
// 2. Picks Reminder (Thursday + Friday)
// Sent to players who haven't submitted yet
// ─────────────────────────────────────────────

export function picksReminderEmail({
  playerName,
  isSecondReminder,
  deadline,
}: {
  playerName:       string
  isSecondReminder: boolean
  deadline:         string
}): string {
  const urgency = isSecondReminder
    ? '⚠️ Last Chance!'
    : '📋 Reminder'

  const message = isSecondReminder
    ? `This is your final reminder — picks lock at <strong style="color:#e8132a;">${deadline}</strong>. Don't get auto-picked!`
    : `You haven't submitted your picks yet this week. The deadline is <strong style="color:#d4a843;">${deadline}</strong>.`

  const content = `
    <h1 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 8px;">
      ${urgency} Make Your Picks
    </h1>
    <p style="color:#8899aa;font-size:14px;margin:0 0 20px;">
      Hi ${playerName},
    </p>
    <p style="color:#ccddee;font-size:15px;margin:0 0 24px;line-height:1.6;">
      ${message}
    </p>
    <p style="color:#8899aa;font-size:13px;margin:0 0 24px;">
      If you miss the deadline, picks will be randomly selected for you.
    </p>
    ${button('Make Your Picks Now →', `${APP_URL}/picks`)}
  `

  return baseTemplate(content)
}

// ─────────────────────────────────────────────
// 3. Picks Reveal
// Sent when all picks are in (or deadline hit)
// ─────────────────────────────────────────────

export function picksRevealEmail({
  weekNumber,
  weekId,
}: {
  weekNumber: number
  weekId:     string
}): string {
  const content = `
    <h1 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 8px;">
      All Picks Are In! 🏒
    </h1>
    <p style="color:#8899aa;font-size:14px;margin:0 0 20px;">
      Week ${weekNumber} picks have been locked and revealed.
      See what everyone picked for this weekend!
    </p>
    <p style="color:#ccddee;font-size:15px;margin:0 0 24px;line-height:1.6;">
      Check the full picks grid to see the matchups, tiebreakers,
      and suicide pool selections for all players.
    </p>
    ${button('View This Week\'s Picks →', `${APP_URL}/results/week?weekId=${weekId}`)}
    <p style="color:#8899aa;font-size:13px;text-align:center;margin:0;">
      Good luck everyone! 🤞
    </p>
  `

  return baseTemplate(content)
}

// ─────────────────────────────────────────────
// 4. Commissioner Sunday Nudge
// Remind commissioner to confirm results
// ─────────────────────────────────────────────

export function commissionerNudgeEmail({
  commissionerName,
  weekNumber,
  weekId,
}: {
  commissionerName: string
  weekNumber:       number
  weekId:           string
}): string {
  const content = `
    <h1 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 8px;">
      Time to Review Results 📋
    </h1>
    <p style="color:#8899aa;font-size:14px;margin:0 0 20px;">
      Hi ${commissionerName},
    </p>
    <p style="color:#ccddee;font-size:15px;margin:0 0 24px;line-height:1.6;">
      Week ${weekNumber} games should be wrapping up.
      Head to the admin panel to review the scores,
      preview the results, and confirm the weekly winner!
    </p>
    <p style="color:#8899aa;font-size:13px;margin:0 0 24px;">
      Once you confirm, results will be sent to all players automatically.
    </p>
    ${button('Review & Confirm Results →', `${APP_URL}/admin/results`, '#d4a843')}
  `

  return baseTemplate(content)
}

// ─────────────────────────────────────────────
// 5. Invite Email (already used in players API)
// Keeping here for consistency
// ─────────────────────────────────────────────

export function inviteEmail({
  name,
  inviteUrl,
}: {
  name:      string
  inviteUrl: string
}): string {
  const content = `
    <h1 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 8px;">
      You're Invited! 🏒
    </h1>
    <p style="color:#8899aa;font-size:14px;margin:0 0 20px;">
      Hi ${name},
    </p>
    <p style="color:#ccddee;font-size:15px;margin:0 0 24px;line-height:1.6;">
      You've been invited to join the <strong style="color:#d4a843;">Hicks Hockey Pool</strong>
      for the 2026-27 NHL season!
      Click below to create your account and start picking.
    </p>
    ${button('Accept Invite & Join HHP →', inviteUrl)}
    <p style="color:#8899aa;font-size:13px;text-align:center;margin:16px 0 0;">
      This link expires in 7 days.
    </p>
  `

  return baseTemplate(content)
}