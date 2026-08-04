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
8. Under the application's authentication settings, turn off **Accept all
   available identity providers** and select exactly one identity provider.
9. Turn on **Apply instant authentication**. This skips Cloudflare's provider
   selection page and sends the owner directly to the selected sign-in method.
10. Set both the application session and the owner policy session to **1 month**
    on a trusted personal device. Use 7 days instead if more frequent
    reauthentication is preferred.

The website's public `/login/` page is the branded entry screen. It links into
the protected `/admin/` route, while Cloudflare Access continues to perform the
actual identity and MFA checks behind it. Do not add `/login*` to the protected
Access hostname; it must remain public so the branded page can render.

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

1. Open `https://jetsullivan.com/login/` in a private browser window and
   confirm the branded login page
   renders without an Access prompt.
2. Select **Enter admin** and confirm that authentication goes directly to the
   one configured identity provider instead of the Access provider chooser.
3. Confirm a different email receives a denial.
4. Confirm `jetsullivan1@gmail.com` can open the dashboard.
5. Refresh `/admin/` and confirm the active Access session opens it directly.
6. Use **Sign out** in the admin header and confirm the application session is
   cleared.
7. Save the biography and refresh `/about/`.
8. Create at least two Film Credits categories and two Acting Credits categories
   with different colors. Add multiple titles (including an optional HTTPS link,
   a single date, and a date range), reorder both the categories and titles, and
   confirm each public credits page follows its own order without showing the
   other page's credits. Edit one category in each section and then delete the
   test categories.
9. Add a small Press test entry and refresh `/media/press/`.
10. Add a Behind the Scenes test entry with a photo and refresh
   `/media/behind-the-scenes/`.
11. Add an Acting, Film, or Video test post with an attachment and confirm that
   images, browser-playable video/audio, and PDFs display inside the post.
12. Star a Press, Interviews, or Behind the Scenes post and confirm the original
   post also appears in `/media/featured/`; un-star it and confirm it disappears.
13. Edit the entries, replace or remove an attachment, then delete the test
   entries from the dashboard.

## Security notes

- `/admin/*` is protected both by Cloudflare Access and by server-side JWT
  validation.
- `/login/` contains no credentials and grants no access by itself. It is a
  branded entry point to the Access-protected dashboard.
- The **Sign out** link uses Cloudflare's application-domain Access logout
  endpoint. Access may take roughly 20–30 seconds to reject every previously
  issued token after logout.
- Write responses use `Cache-Control: no-store`.
- The biography has a 5,000-character limit.
- Film and Acting credit categories are isolated in the `content:credits` and
  `content:acting-credits` KV records, respectively. Their ordered title lists
  use the same schema. Category colors use the `#RRGGBB` format, and optional
  title links must use HTTPS. Dates are optional; a title may have a single
  `dateFrom` value or a `dateFrom`/`dateTo` range in `YYYY-MM-DD` format. Public
  credit changes can take up to roughly one minute to pass through the public
  API cache.
- Media entries are stored as structured records in KV and appear publicly after
  a short cache delay of up to roughly one minute.
- Behind-the-scenes entry photos accept JPEG, PNG, WebP, or AVIF files up to
  15 MB. They are stored in the private R2 bucket and served through
  `/api/media/*`.
- Every post section accepts one optional attachment up to 100 MB. Images,
  browser-playable video/audio, and PDFs display inside the post; text, Office,
  and ZIP files are served as downloads.
- Uploads use generated object names and a MIME-type allowlist. Executable web
  formats such as HTML, JavaScript, and SVG are not accepted.
- Cloudflare account request limits may be lower than the application’s 100 MB
  attachment limit.
- Entry deletions require confirmation and permanently remove the public entry.
  Replaced and deleted managed entry files are retained for a later cleanup pass
  so a cached page never points to a file that has already disappeared. These
  files appear as stored orphans in the Website Media Library and can be
  permanently removed there.
- The Website Media Library lists every R2 upload. Renaming changes its
  user-facing/download name without changing the stable storage URL. Permanent
  deletion clears any post references before removing the R2 object.
- Export or copy the `content:credits`, `content:acting-credits`, and
  `media-entry:*` KV records regularly, and enable R2 object versioning or
  backups before storing irreplaceable media.
- Keep the Cloudflare account recovery methods and MFA devices secure.
