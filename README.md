# Thornhill Corporation — Link Hub (staff only)

Address: https://link-hub.thornhillcorporation.co.uk

- The first thing anyone sees is the staff sign-in. Use the same full name and special code as the main admin panel.
- **Documents** tab: share Google Docs/Sheets/Slides/Drive files or PDFs. Each gets a random link like `/d/k7m2x9qa`. Document links are public so customers can open them, but nothing else on this site is.
- **Redirects** tab: short links such as `redirects.thornhillcorporation.co.uk/Roblox/Thornhill` that forward to any web address, with click counts.

Setup: run `supabase/redirects.sql` once in Supabase → SQL Editor. (`documents.sql` and the `google-pdf` function are already set up from the main site.)
`assets/js/config.js` already contains your Supabase details.
