# VeriRoll backend — draft

Node.js + Express + Prisma (Postgres). Matches the mockup's roles and flow:

- **Admin** creates course units, syncs the roster from the portal (with
  manual add/remove as an override, not a second parallel path), and
  creates lecturer accounts.
- **Lecturer** starts/stops sessions (one open session per unit at a time,
  auto-closes after 20 minutes if forgotten), manages the live roster, and
  can retroactively fix a past session's attendance.
- **Student** signs in once with Google/Microsoft (persists — not re-done
  every lecture), sees their attendance as "present ÷ lessons held so far"
  (not the full semester total), and can only register while a session is
  open for their unit.

Every manual add/remove/correction writes an `AuditLog` row — who changed
what, and when — for dispute resolution ("I emailed the lecturer, why am I
still marked absent?").

## What's real vs. stubbed here

This is a structural draft, not a finished backend:

- `middleware/auth.js` — `verifyGoogleToken` / `verifyMicrosoftToken` are
  stubs. Wire up `google-auth-library` and `@azure/msal-node` (or a JWKS
  check) before this touches real users.
- `routes/admin.js` — `fetchPortalRoster()` is a stub. Replace with
  whatever the school portal actually offers (an API, or a scheduled CSV
  import).
- No input validation library wired in yet (recommend `zod` on route bodies).
- No tests yet.

## Setup

```
npm install
# set DATABASE_URL and JWT_SECRET in a .env file
npx prisma migrate dev --name init
npm run dev
```

## Endpoint map

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | /auth/google, /auth/microsoft | anyone | sign in, issue app JWT |
| GET | /me/course-units | student | enrolled units + pie stats |
| POST | /course-units/:id/sessions | lecturer/admin | start a session |
| PATCH | /sessions/:id/close | lecturer/admin | stop a session |
| POST | /sessions/:id/register | student | self check-in |
| GET | /sessions/:id/roster | lecturer/admin | live roster |
| PATCH | /sessions/:id/roster/:studentId | lecturer/admin | mark/correct present or absent — works on closed sessions too |
| GET | /course-units/:id/sessions | lecturer/admin | session history |
| POST | /admin/course-units | admin | create a unit |
| POST | /admin/course-units/:id/enrollments/sync | admin | pull roster from portal |
| POST/DELETE | /admin/course-units/:id/enrollments | admin | manual roster override |
| POST | /admin/lecturers | admin | create/assign a lecturer |
| GET | /admin/audit-logs | admin | trail of manual edits |
