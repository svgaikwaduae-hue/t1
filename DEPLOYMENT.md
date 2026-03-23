# DailyWealth4You Deployment

This website is ready to be hosted on Vercel with a Resend-powered serverless email backend.

## Files to deploy

- `index.html`
- `thanks.html`
- `assets/`
- `api/`
- `package.json`

## Hosting options

This project is now designed for Vercel because the forms post to a Vercel API route.

- Vercel

## Form handling

All website forms submit through the Vercel backend route:

- `/api/forms`

Configured forms:

- Investor contact form
- Partner application form
- Newsletter signup form

Important:

- Add the Resend environment variables in Vercel before testing.
- The backend sends submissions directly to your mailbox using the Resend Email API.
- No FormSubmit activation step is needed anymore.
- For production sending, verify your domain in Resend and use a sender address on `dailywealth4you.com`.

## Required Vercel environment variables

- `RESEND_API_KEY`
- `MAIL_TO`
- `MAIL_FROM`
- `MAIL_FROM_NAME`

## Live widgets

The market widgets use TradingView embeds, so they require browser internet access to load:

- ticker tape
- market overview
- live chart
- symbol snapshot
- technical analysis
- live session board logic

## Before going live

1. Upload all files while keeping the `assets` folder path unchanged.
2. Open the hosted `index.html` URL in a browser.
3. Add the Resend environment variables in the Vercel project settings.
4. Redeploy after saving the environment variables.
5. Submit the investor form once to confirm inbox delivery.
6. Submit the partner form and newsletter form to confirm redirects work.
7. Check WhatsApp and email links from desktop and mobile.

## Resend setup notes

1. Create a Resend account and generate an API key.
2. Add your domain or a sending subdomain in Resend.
3. Add the DNS records Resend gives you and wait for verification.
4. Use a verified sender address in `MAIL_FROM`.
5. Keep `MAIL_TO=support@dailywealth4you.com` so all form submissions arrive in that mailbox.

## Optional next improvements

- connect a custom domain
- add Google Analytics or Meta Pixel
- add privacy policy and terms pages
- replace placeholder business details with final approved copy
