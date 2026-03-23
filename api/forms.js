const MAX_FIELD_LENGTH = 4000;

function safeValue(value) {
  return String(value ?? '').trim().slice(0, MAX_FIELD_LENGTH);
}

function normalizeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    return Object.fromEntries(new URLSearchParams(req.body));
  }
  if (Buffer.isBuffer(req.body)) {
    return Object.fromEntries(new URLSearchParams(req.body.toString('utf8')));
  }
  return req.body;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeValue(value));
}

function buildTextEmail(body) {
  return Object.entries(body)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = normalizeBody(req);

    const userEmail = safeValue(body.email);

    const resendApiKey = process.env.RESEND_API_KEY;
    const mailTo = process.env.MAIL_TO;
    const mailFrom = process.env.MAIL_FROM;
    const mailFromName = process.env.MAIL_FROM_NAME;

    if (!resendApiKey || !mailTo || !mailFrom) {
      throw new Error('Missing environment variables');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `"${mailFromName}" <${mailFrom}>`,
        to: [mailTo],
        subject: 'New Form Submission',
        text: buildTextEmail(body),
        ...(isValidEmail(userEmail) ? { reply_to: userEmail } : {})
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Email failed');
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('MAIL_SEND_FAILED:', error);
    return res.status(500).json({ error: error.message });
  }
}
