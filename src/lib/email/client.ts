import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_EMAIL = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
export const FROM_NAME  = process.env.EMAIL_FROM_NAME ?? 'Hicks Hockey Pool'

console.log('FROM_EMAIL:', FROM_EMAIL)

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to:      string | string[]
  subject: string
  html:    string
}) {
  if (!process.env.RESEND_API_KEY ||
      process.env.RESEND_API_KEY === 'your-resend-api-key') {
    console.log('=== EMAIL (Resend not configured) ===')
    console.log('To:', to)
    console.log('Subject:', subject)
    console.log('=====================================')
    return { success: true, simulated: true }
  }

  try {
    const { data, error } = await resend.emails.send({
      from:    `${FROM_NAME} <${FROM_EMAIL}>`,
      to:      Array.isArray(to) ? to : [to],
      subject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      throw new Error(error.message)
    }

    return { success: true, simulated: false, id: data?.id }
  } catch (err: any) {
    console.error('Email send failed:', err)
    throw new Error('Failed to send email')
  }
}