import nodemailer from 'nodemailer';

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

export async function POST(request) {
  const body = await readRequestBody(request);
  const honey = safeValue(body._honey);
  if (honey) {
    const redirectPath = normalizeRedirect(body._next);
    return wantsHtml(request)
      ? Response.redirect(new URL(redirectPath, request.url), 303)
      : jsonResponse({ ok: true, redirect: redirectPath });
  }

  const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missingEnv = requiredEnv.filter((key) => !safeValue(process.env[key]));
  if (missingEnv.length) {
    return wantsHtml(request)
      ? htmlErrorResponse('Email backend is not configured yet. Please add the SMTP settings in Vercel.')
      : jsonResponse({
      ok: false,
      error: 'Email backend is not configured yet. Please add the SMTP settings in Vercel.'
    }, 500);
  }

  const formType = safeValue(body.form_type) || 'Website Form';
  const fields = buildOrderedFields(body);
  const userEmail = safeValue(body.email);
  const subject = safeValue(body._subject) || FORM_SUBJECTS[formType] || `New Website Submission - ${formType}`;
  const mailTo = safeValue(process.env.MAIL_TO) || safeValue(process.env.SMTP_USER) || 'support@dailywealth4you.com';
  const mailFromName = safeValue(process.env.MAIL_FROM_NAME) || 'DailyWealth4You';
  const mailFromAddress = safeValue(process.env.MAIL_FROM) || safeValue(process.env.SMTP_USER);

  const transporter = nodemailer.createTransport({
    host: safeValue(process.env.SMTP_HOST),
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: {
      user: safeValue(process.env.SMTP_USER),
      pass: safeValue(process.env.SMTP_PASS)
    }
  });

  try {
    await transporter.sendMail({
      from: `"${mailFromName.replace(/"/g, '')}" <${mailFromAddress}>`,
      to: mailTo,
      replyTo: isValidEmail(userEmail) ? userEmail : undefined,
      subject,
      text: buildTextEmail(fields),
      html: buildHtmlEmail(fields)
    });

    const redirectPath = normalizeRedirect(body._next);
    return wantsHtml(request)
      ? Response.redirect(new URL(redirectPath, request.url), 303)
      : jsonResponse({
          ok: true,
          redirect: redirectPath
        });
  } catch (error) {
    console.error('MAIL_SEND_FAILED', error);
    return wantsHtml(request)
      ? htmlErrorResponse('We could not send your form right now. Please try again or use WhatsApp while we check the mailbox connection.')
      : jsonResponse({
          ok: false,
          error: 'We could not send your form right now. Please try again or use WhatsApp while we check the mailbox connection.'
        }, 500);
  }
}
