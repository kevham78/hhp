import sgMail from '@sendgrid/mail'

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

export const FROM_EMAIL = process.env.EMAIL_FROM!
export const FROM_NAME  = process.env.EMAIL_FROM_NAME ?? 'Hicks Hockey Pool'

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to:      string | string[]
  subject: string
  html:    string
}) {
  if (!process.env.SENDGRID_API_KEY ||
      process.env.SENDGRID_API_KEY === 'your-sendgrid-api-key') {
    console.log('=== EMAIL (SendGrid not configured) ===')
    console.log('To:', to)
    console.log('Subject:', subject)
    console.log('=======================================')
    return { success: true, simulated: true }
  }

  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      html,
    })
    return { success: true, simulated: false }
  } catch (err: any) {
    console.error('SendGrid error:', err?.response?.body ?? err)
    throw new Error('Failed to send email')
  }
}