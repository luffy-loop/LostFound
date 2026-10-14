# LostFound

> A campus lost-and-found experience for reporting, discovering, claiming, and safely returning items.

## Live Demo
[Open LostFound](https://lost-find-found.netlify.app/)

## Features
- Lost/found reports with search, category/status/location/date filters, and sorting.
- Similar-report suggestions ranked by category, location, description keywords, and date proximity.
- QR codes and shareable links for individual reports.
- Claims with private ownership clues, status tracking, comments, demo messaging, and in-app notifications.
- Moderation queue and location/recovery insights.
- OpenStreetMap location search, responsive layout, light/dark theme, and safe input escaping.
- Local demo automatically archives unresolved reports after 90 days; returned items remain in history.

## Stack
HTML5, CSS3, vanilla JavaScript ES modules, localStorage demo mode, Supabase PostgreSQL/Auth/Storage backend foundation, Supabase Edge Functions, Resend email, Netlify deployment.

## Project structure
```
LostFound/
├── index.html, login.html, post.html, myposts.html, notifications.html, admin.html
├── css/                 # responsive styles
├── js/                  # app, local demo store, backend adapter, enhancements
├── database/schema.sql  # production tables, indexes, RLS and expiry function
├── supabase/            # Edge Function and local Supabase config
├── tests/               # Node built-in tests
└── package.json
```

## Supabase setup (required before production)
The deployed UI still uses localStorage for its existing workflows. The backend schema and adapter are included, but the live app is **not automatically switched to Supabase**: each deployment needs a project URL, public anon key, institutional auth configuration, and an integration pass for every workflow.

1. Create a Supabase project and run [database/schema.sql](database/schema.sql) once in its SQL editor.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `js/config.js`. Never place a service-role key in browser code.
3. Configure institution-controlled authentication (approved campus SSO or verified email-domain rules). A roll number alone is not identity verification.
4. Assign the first administrator's `profiles.role = 'admin'` in the trusted SQL editor. Do not accept role changes or campus-ID verification from browser metadata.
5. Deploy `supabase/functions/notify-email` and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NOTIFICATION_WEBHOOK_SECRET`, `RESEND_API_KEY`, and `NOTIFICATION_FROM_EMAIL` as server-side secrets. Connect a database webhook using the `x-webhook-secret` header.
6. Schedule `select public.archive_stale_items();` daily with Supabase Cron. The SQL schema includes profiles/roles, items, claims, comments, messages, notifications, reports, indexes, RLS policies, storage policies, and a 90-day archival function.
7. Finish wiring every UI workflow to the backend adapter and test with two student accounts and an administrator account before directing users to production.

The adapter exposes Supabase Auth, report listing/creation, cloud image upload, claim submission, and messaging. Email delivery requires a Resend account and explicit server-side configuration. Public QR codes encode only the shareable report URL.

## Security notes
- The current login and moderation page remain demo-only and are not a security boundary.
- Claim proof should only be visible to the claimant and item owner. Never enter passwords, government ID numbers, or highly sensitive information as claim proof.
- The database schema restricts ownership, claims, message participants, notifications, reports, and admin actions with Row Level Security. Review policies against your institution's rules before production.
- The current OpenStreetMap link searches a location string; exact campus pins require trusted coordinates.
- Cloud image upload validates MIME type and a 2 MB size limit. Keep service-role credentials server-side.

## Tests
Use Node.js 18+ and run `npm test`.

## License
For educational and portfolio use.
