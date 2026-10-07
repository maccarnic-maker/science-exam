# Workers migration

Next.js 15.5.27 / OpenNext Cloudflare 1.20.8. React 18 is retained.
The existing D1 `science-exam-db` and R2 `science-exam-files` are shared unchanged.
No database migration is required for this runtime update.

## Current state

- Workers candidate: https://science-exam.maccarnic.workers.dev
- Production uses the Workers Custom Domain `onlinetest.bankruaschool.ac.th`.
- On 2026-10-07, the user approved permanent removal of the old Pages project.
  Its custom domain/CNAME and temporary Worker route were removed after the
  direct Custom Domain was connected. D1 and R2 remain unchanged.
- Workers Git build `059fe9a` succeeded; Pages automatic production and preview
  builds were disabled before the Pages project was retired.
- Workers has a new random `NEXTAUTH_SECRET`; never commit or display its value.
- Workers has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as encrypted secrets.
- Rollback now uses Workers deployment history; Pages deployments are no longer
  available. Never delete D1 or R2 as part of application cleanup.
- Missing authentication settings fail closed (OAuth returns 503).
- Teachers will need to sign in again after cutover because the old signing key
  cannot be exported from Pages. Student sessions and answers remain in D1.

## Finish safely

1. In Google Auth Platform, select the existing OAuth web client for this app.
   The user enters its client ID and client secret directly in the Workers
   Variables and Secrets settings. Do not paste credentials into chat.
2. Preserve the redirect URI:
   `https://onlinetest.bankruaschool.ac.th/api/auth/google`.
3. Verify the secrets exist by name only and inspect the OAuth redirect without
   sending a test authorization code or writing test records to production D1.
4. Configure Workers Git builds for the existing repository: build command
   `npm run workers:build`, deploy command
   `npx opennextjs-cloudflare deploy --keep-vars`.
   Ensure a single production deployment pipeline; only disable Pages auto-build
   after the Workers pipeline is ready. Do not push this migration to Pages main
   while Pages still expects `npm run pages:build`.
5. Check no examinations are in progress before routing the existing hostname to
   the new Worker. Prefer an exact-host Worker route over the existing proxied
   Pages DNS record, keeping Pages available for rollback. Verify the account's
   actual route and DNS state before making any changes.
6. Verify the original hostname, Google login, teacher-only API guards, exam
   registration, saved-session resume, grading and R2 images. Avoid creating test
   student records in real examinations; use isolated local test fixtures.
7. If verification fails, remove only the newly added route to restore the existing
   Pages origin. Do not delete the Pages project, D1, R2 or OAuth client.

## Local checks

The home page must be `force-dynamic`: authentication reads cookies at runtime
even when build-time secrets are absent. A static home page causes a runtime 500.

```sh
npm ci
npm run workers:build
node scripts/test-pools.cjs
npx tsc --noEmit --incremental false
npm audit --omit=dev
```

The production dependency audit is clean after updating Auth core, Drizzle ORM
and Next's PostCSS dependency. Development-only tooling still reports advisories;
do not run `npm audit fix --force` or upgrade Tailwind across major versions as
part of this migration.

`.open-next` is generated build output, not source. It is ignored by Git; build
fresh from the committed source for every deployment.
