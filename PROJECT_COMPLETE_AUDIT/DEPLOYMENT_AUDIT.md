# Deployment audit

## Observed local build configuration

- Package scripts: `dev` = Vite on port 3000 with host `0.0.0.0`; `build` = `vite build`; `preview` = `vite preview`; `lint` = `tsc --noEmit`.
- `vite.config.ts` installs React and Tailwind plugins, sets an `@` alias and allows `DISABLE_HMR` to control development HMR/watch.
- `index.html` is the Vite shell and loads `/src/main.tsx`.
- `tsconfig.json` uses ES2022, bundler module resolution, React JSX, `noEmit`; it excludes `dist` and `supabase`.
- A pre-existing `dist/` directory exists. It was not rebuilt; its provenance and relationship to any live site are unknown.

## Hosting/deployment platform

No verified hosting platform. The README contains generic AI Studio guidance; metadata identifies an AI Studio app context. This does not prove deployment/hosting for the current domain. No Vercel/Netlify config, Dockerfile, server entry, GitHub workflow, CI pipeline, domain/DNS manifest or deployment script was found. No Supabase `config.toml` is present.

## Environment configuration names

Browser build names: `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Source contains fallbacks, so a build may use embedded defaults if variables are absent. These values are not repeated here.

Edge runtime references: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ALLOWED_ORIGINS`, `AUDIT_SIGNING_SECRET`, `RATE_LIMIT_HMAC_SECRET`. These must be configured in Supabase Function secrets, not frontend Vite variables. `.env.example` also lists `GEMINI_API_KEY` and `APP_URL`, but no runtime use was found.

The `.gitignore` excludes `.env*` except `.env.example`; whether a local `.env` was ever committed cannot be established because this workspace is not a Git repository.

## Production and development configuration

No distinct production config is evident. `vite.config.ts` controls local dev only. Browser Supabase config falls back to default source values. Supabase function allowed origins depend on deployment environment variables; an empty allowlist rejects browser requests that include an Origin header. Actual deployed origins/JWT verification/secrets are unknown.

## Risks

1. No deployment runbook or environment validation; local configuration may diverge from deployed Supabase.
2. Current default endpoint targets Supabase based on source, but this was not live-tested.
3. No Supabase deployment config records Edge Function JWT behavior or local project link.
4. Checked-in migrations include policy history with significant differences; applying only some may leave permissive policies.
5. Existing `dist/` could be stale; no build was run to avoid changing generated outputs.
6. `.env.example`/README and application code are inconsistent (Gemini variable documented but no call); unused dependencies complicate supply chain management.
7. TypeScript check excludes `supabase/` Edge Function code, so `npm run lint` does not type-check those Deno files.

## Verification performed

`npm run lint` passed (`tsc --noEmit`). Build/deployment, live app, database, function endpoints and environment secrets were not tested. No database migration or deployment command was run.

