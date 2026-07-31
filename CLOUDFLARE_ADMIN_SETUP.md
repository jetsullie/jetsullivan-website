# Secure owner admin setup

The admin dashboard is designed for one owner only:

`jetsullivan1@gmail.com`

The application fails closed when Cloudflare Access is not configured. Do not
replace the Access middleware with a browser-only password check.

## 1. Create the storage resources

In the Cloudflare dashboard:

1. Create a Workers KV namespace for editable text.
2. Bind it to the Pages project with the variable name `CONTENT_KV`.
3. Create a private R2 bucket for portfolio media.
4. Bind it to the Pages project with the variable name `MEDIA_BUCKET`.
5. Add both bindings to Production and Preview if the admin will be tested on
   preview deployments.

Use separate Preview KV and R2 resources whenever possible. Sharing Production
resources with Preview means that a preview test can edit or remove live
portfolio entries.

The R2 bucket should remain private. Public files are served through
`/api/media/*`, which applies controlled response headers.

## 2. Create the Cloudflare Access application

In **Zero Trust → Access controls → Applications**:

1. Add a self-hosted application.
2. Protect `jetsullivan.com/admin*`.
3. If previews will be used for admin testing, add the exact Pages preview
   hostname as another public hostname in the same Access application.
4. Create one Allow policy:
   - Selector: **Emails**
   - Value: `jetsullivan1@gmail.com`
5. Do not use **Everyone**, **Emails ending in**, or **Login Methods** as the
   Allow selector.
6. Use the Cloudflare identity provider restricted to your Cloudflare account,
   or a trusted Google identity provider.
7. Require multi-factor authentication on the identity account.
8. Use a short Access session duration, such as 8 hours.

## 3. Configure server-side token validation

In the Pages project's Production and Preview environment variables, add:

- `CF_ACCESS_DOMAIN`: the full Access team URL, for example
  `https://your-team-name.cloudflareaccess.com`
- `CF_ACCESS_AUD`: the Access application's Audience (AUD) tag

These are configuration values, not passwords. The middleware validates the
Access signature, issuer, expiration, and audience. It then separately requires
the token email to equal `jetsullivan1@gmail.com`.

## 4. Deploy and verify before entering content

After deployment:

1. Open `https://jetsullivan.com/admin/` in a private browser window.
2. Confirm Cloudflare prompts for authentication.
3. Confirm a different email receives a denial.
4. Confirm `jetsullivan1@gmail.com` can open the dashboard.
5. Save the biography and refresh `/about/`.
6. Add a small Press test entry and refresh `/media/press/`.
7. Add a Behind the Scenes test entry with a photo and refresh
   `/media/behind-the-scenes/`.
8. Add an Acting, Film, or Video test post with an attachment and confirm that
   images, browser-playable video/audio, and PDFs display inside the post.
9. Edit the entries, replace or remove an attachment, then delete the test
   entries from the dashboard.

## Security notes

- `/admin/*` is protected both by Cloudflare Access and by server-side JWT
  validation.
- Write responses use `Cache-Control: no-store`.
- The biography has a 5,000-character limit.
- Media entries are stored as structured records in KV and appear publicly after
  a short cache delay of up to roughly one minute.
- Behind-the-scenes entry photos accept JPEG, PNG, WebP, or AVIF files up to
  15 MB. They are stored in the private R2 bucket and served through
  `/api/media/*`.
- Acting, Film, and Video posts accept one optional attachment up to 100 MB.
  Images, browser-playable video/audio, and PDFs display inside the post; text,
  Office, and ZIP files are served as downloads.
- Uploads use generated object names and a MIME-type allowlist. Executable web
  formats such as HTML, JavaScript, and SVG are not accepted.
- Cloudflare account request limits may be lower than the application’s 100 MB
  attachment limit.
- Entry deletions require confirmation and permanently remove the public entry.
  Replaced and deleted managed entry files are retained for a later cleanup pass
  so a cached page never points to a file that has already disappeared.
- Export or copy the `media-entry:*` KV records regularly, and enable R2 object
  versioning or backups before storing irreplaceable media.
- Keep the Cloudflare account recovery methods and MFA devices secure.
