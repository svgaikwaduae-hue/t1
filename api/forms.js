const MAX_FIELD_LENGTH = 4000;
const FORM_SUBJECTS = {
  'Partner Application': 'New Partner Application - DailyWealth4You',
  'Investor Contact': 'New Investor Enquiry - DailyWealth4You',
  'Newsletter Signup': 'New Newsletter Signup - DailyWealth4You'
};

function safeValue(value) {
  return String(value ?? '').trim().slice(0, MAX_FIELD_LENGTH);
}

function escapeHtml(value) {
  return safeValue(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function normalizeRedirect(target) {
  if (!target) return '/thanks.html';
  try {
    const url = new URL(target, 'https://dailywealth4you.com');
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (_error) {
    return '/thanks.html';
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeValue(value));
}

function buildOrderedFields(body) {
  const formType = safeValue(body.form_type);
  const orderedKeysByForm = {
    'Partner Application': [
      'name',
      'email',
      'phone',
      'country',
      'referral_plan',
      'monthly_referrals',
      'page_url'
    ],
    'Investor Contact': [
      'name',
      'email',
      'phone',
      'country',
      'service_interest',
      'capital_range',
      'message',
      'lead_source',
      'page_url'
    ],
    'Newsletter Signup': [
      'email',
      'page_url'
    ]
  };

  const labels = {
    name: 'Full Name',
    email: 'Email',
    phone: 'WhatsApp / Phone',
    country: 'Country / Region',
    referral_plan: 'Referral Plan',
    monthly_referrals: 'Estimated Monthly Referrals',
    service_interest: 'Service Interest',
    capital_range: 'Capital Range',
    message: 'Message',
    lead_source: 'Lead Source',
    page_url: 'Page URL',
    form_type: 'Form Type'
  };

  const preferredKeys = orderedKeysByForm[formType] || ['name', 'email', 'message', 'page_url'];
  const fields = preferredKeys
    .filter((key) => safeValue(body[key]))
    .map((key) => ({
      label: labels[key] || key,
      value: safeValue(body[key])
    }));

  if (!fields.find((field) => field.label === 'Form Type')) {
    fields.unshift({
      label: 'Form Type',
      value: formType || 'Website Form'
    });
  }

  return fields;
}

function buildHtmlEmail(fields) {
  const rows = fields
    .map(
      (field) => `
        <tr>
          <td style="padding:10px 14px;border:1px solid #e8dcc0;font-weight:600;background:#fff8ea;color:#3a2b10;width:220px;">${escapeHtml(field.label)}</td>
          <td style="padding:10px 14px;border:1px solid #e8dcc0;color:#221a0d;line-height:1.6;">${escapeHtml(field.value)}</td>
        </tr>`
    )
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;background:#f7f1e5;padding:24px;color:#221a0d;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e8dcc0;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 24px;background:linear-gradient(90deg,#8b6914 0%,#b8952a 50%,#d4af37 100%);color:#ffffff;font-size:22px;font-weight:700;">
          DailyWealth4You Website Submission
        </div>
        <div style="padding:24px;">
          <table style="width:100%;border-collapse:collapse;">
            ${rows}
          </table>
        </div>
      </div>
    </div>`;
}

function buildTextEmail(fields) {
  return fields.map((field) => `${field.label}: ${field.value}`).join('\n');
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

function htmlErrorResponse(message, status = 500) {
  return new Response(
    `<!DOCTYPE html><html lang="en"><body style="font-family:Arial,sans-serif;padding:24px;background:#f7f1e5;color:#221a0d"><h1>Form delivery error</h1><p>${escapeHtml(message)}</p></body></html>`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8'
      }
    }
  );
}

function wantsHtml(request) {
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html') && !accept.includes('application/json');
}

async function readRequestBody(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await request.json();
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const formData = await request.formData();
    const body = {};
    formData.forEach((value, key) => {
      body[key] = typeof value === 'string' ? value : '';
    });
    return body;
  }

  return {};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = normalizeBody(req);

    const formType = safeValue(body.form_type) || 'Website Form';
    const fields = buildOrderedFields(body);
    const userEmail = safeValue(body.email);
    const subject = safeValue(body._subject) || FORM_SUBJECTS[formType];

    const mailTo = process.env.MAIL_TO;
    const mailFromName = process.env.MAIL_FROM_NAME;
    const mailFromAddress = process.env.MAIL_FROM;
    const resendApiKey = process.env.RESEND_API_KEY;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: Bearer ${resendApiKey},
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: "${mailFromName}" <${mailFromAddress}>,
        to: [mailTo],
        subject,
        text: buildTextEmail(fields),
        html: buildHtmlEmail(fields),
        ...(isValidEmail(userEmail) ? { reply_to: userEmail } : {})
      })
    });

    const data = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(data.message || 'Email failed');
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('MAIL_SEND_FAILED:', error);
    return res.status(500).json({ error: error.message });
  }
}
