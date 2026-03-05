# ChurchFlow ChMS

Enterprise-grade, multi-tenant Church Management System built with:

- Next.js (App Router, Server Components, Server Actions)
- React + TypeScript
- PostgreSQL + Prisma ORM
- NextAuth credentials authentication
- Role-Based Access Control (RBAC)
- Tailwind CSS + Recharts

## Core Capabilities

- Multi-tenant church isolation (`churchId` on all domain records)
- Secure email/password auth with bcrypt hashing
- Role-aware routing and backend authorization
- Church hierarchy: Church -> Region -> Zone -> Homecell -> Members
- Membership module with:
  - Smart search/filter
  - Profile tabs (overview, attendance, giving, LTV, notes)
  - Soft delete (archive)
  - Draft autosave on create form
- Attendance module with:
  - Service creation
  - Bulk mark, search and mark
  - Mark all present
  - Required absence reason
- Homecell weekly reporting:
  - Prefilled member list
  - Auto totals
  - Duplicate submission protection
  - Supervisor unlock
- Visitor pipeline tracking and follow-up management
- Finance tracking with audit trail hooks
- Automated monthly LTV recalculation endpoint
- Analytics dashboards with Recharts
- Notifications center and reminder generation
- CSV exports for members, attendance, finance, homecell reports, visitors

## Project Structure

```text
app/
  api/
    auth/[...nextauth]/
    attendance/
    churches/
    exports/
    ltv/recalculate/
    members/
    notifications/generate/
    upload/profile-photo/
  dashboard/
    admin/churches/
    analytics/
    attendance/
    exports/
    finance/
    hierarchy/
    homecells/reports/
    members/[id]/
    notifications/
    visitors/
  login/
components/
  admin/
  analytics/
  attendance/
  auth/
  dashboard/
  finance/
  homecells/
  layout/
  members/
  notifications/
  providers/
  ui/
lib/
  auth/
  services/
  validations/
  db.ts
  rbac.ts
  tenant.ts
prisma/
  schema.prisma
  seed.ts
types/
  next-auth.d.ts
proxy.ts
vercel.json
```

## Roles

- `SUPER_ADMIN`
- `PASTOR`
- `OVERSEER`
- `SUPERVISOR`
- `COORDINATOR`
- `HOMECELL_LEADER`
- `CHURCH_ADMIN`
- `FINANCE_ADMIN`

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Update `.env` with your PostgreSQL connection.

4. Run migrations and generate client:

```bash
npm run prisma:migrate
npm run prisma:generate
```

5. Seed the database:

```bash
npm run prisma:seed
```

6. Start development:

```bash
npm run dev
```

## Seed Credentials

- Super Admin: `superadmin@churchflow.com` / `Password123!`
- Pastor: `pastor@gracecentral.com` / `Password123!`
- Finance Admin: `finance@gracecentral.com` / `Password123!`

## Security Notes

- All protected pages are guarded in `proxy.ts`.
- API routes and Server Actions perform explicit role checks.
- Tenant access is enforced using authenticated `churchId`.
- Sensitive operations (finance, reports, member changes) write audit logs.

## Useful Commands

- `npm run dev`
- `npm run lint`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:studio`
- `npm run prisma:seed`

## Production Notes

- Profile photo uploads use Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set.
- Use HTTPS and secure session cookies in deployment.
- Set a strong `NEXTAUTH_SECRET`.
- Add background/cron scheduling for recurring reminder and LTV jobs.

## Vercel Deployment

1. Push this repository to GitHub/GitLab/Bitbucket and import it in Vercel.
2. Set the project root to this folder (`Structure`) if your repo contains other folders.
3. Add these environment variables in Vercel:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (use your Vercel production URL)
   - `BLOB_READ_WRITE_TOKEN` (required for profile photo uploads on Vercel)
4. Keep the build command as configured in `vercel.json`:

```bash
npx prisma generate && npm run build
```

5. Run production migrations against your hosted PostgreSQL database:

```bash
npx prisma migrate deploy
```
