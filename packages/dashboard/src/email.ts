import type { Env } from './env.js';

/**
 * Sends a transactional email via Resend. Returns false (and logs) when no
 * RESEND_API_KEY is configured, so magic links and password resets degrade
 * gracefully instead of throwing.
 */
export async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.warn('[tadween] RESEND_API_KEY / EMAIL_FROM not set — email not sent');
    return false;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html }),
  });
  if (!response.ok) {
    console.warn(`[tadween] email send failed: ${response.status} ${await response.text()}`);
    return false;
  }
  return true;
}
