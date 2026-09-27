# Branded welcome email design

## Goal

Make the registration welcome email feel like a complete First Look message by including the brand mark and a clear way to visit the website.

## Design

- Preserve the approved subject and welcome copy.
- Send the welcome email as `multipart/alternative`: plain text remains available for compatible clients and accessibility, while an HTML alternative adds a restrained branded header, the existing koi logo, and a visible home-page link.
- Use `https://firstlooklab.cn` as the canonical home URL. The logo links to that URL; a text link is also included so the destination is clear even when remote images are blocked.
- Load the logo from the existing public asset at `https://firstlooklab.cn/koi-logo.png`; provide useful alt text and a text wordmark fallback.
- Keep the change inside the shared welcome-mail template so registration and any explicitly invoked backfill path stay consistent. Do not trigger or send a backfill as part of this change.
- Leave verification-code emails unchanged.

## Verification

- Inspect MIME headers and both alternative bodies in the generated message.
- Confirm HTML escaping and UTF-8 subject/body encoding remain valid.
- Run focused lint and the production build.
- Do not send a real email as a test and do not deploy unless separately requested.
