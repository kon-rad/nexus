# Auth Setup — Convex Auth + Google

> One-time setup for the "Sign in with Google" pill in the workspace top nav. Convex Auth signs its own JWTs against a private key it keeps on the deployment, then trusts itself via `convex/auth.config.ts`.

## What's already wired in code

- `convex/auth.config.ts` — declares the JWT issuer the deployment trusts.
- `convex/auth.ts` — `convexAuth({ providers: [Google] })`. Exports `signIn`, `signOut`, `auth`, `isAuthenticated`.
- `convex/http.ts` — mounts `auth.addHttpRoutes(http)` so OAuth callbacks land on the Convex deployment.
- `convex/users.ts` — `me` query reading `auth.getUserId(ctx)`.
- `convex/schema.ts` — spreads `authTables` (users, authSessions, authAccounts, …).
- `apps/web/middleware.ts` — runs `convexAuthNextjsMiddleware()`.
- `apps/web/app/layout.tsx` — wrapped in `ConvexAuthNextjsServerProvider`.
- `apps/web/components/ConvexClientProvider.tsx` — uses `ConvexAuthNextjsProvider`.
- `apps/web/components/SignInPill.tsx` — the auth-aware nav element.

## What you need to set up once

### 1. Run the Convex Auth bootstrap

This generates `JWT_PRIVATE_KEY` + `JWKS` and writes them onto your Convex deployment env.

```bash
cd /Users/konradgnat/dev/hackathons/aieng2026
npx @convex-dev/auth
```

The CLI will:
- Detect your `CONVEX_DEPLOYMENT` (already in `apps/web/.env.local`).
- Generate an RSA keypair.
- Run `npx convex env set JWT_PRIVATE_KEY ...` and `JWKS ...` on your deployment.
- Add `SITE_URL` (your dev URL — typically `http://localhost:3000`).

If anything is interactive, accept the defaults.

### 2. Register a Google OAuth client

In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Create an OAuth 2.0 Client ID (Web application).
2. **Authorized JavaScript origins**: `http://localhost:3000` (and your prod web origin).
3. **Authorized redirect URIs**: `${CONVEX_SITE_URL}/api/auth/callback/google`
   - For `quirky-octopus-123.convex.site`, that's `https://quirky-octopus-123.convex.site/api/auth/callback/google`.
   - For local dev with the Convex CLI: same URL, the CLI proxies callbacks back to your machine.
4. Copy the Client ID and Client Secret.

### 3. Push them to the Convex deployment

```bash
npx convex env set AUTH_GOOGLE_ID <your-client-id>
npx convex env set AUTH_GOOGLE_SECRET <your-client-secret>
```

You already have `CLIENT_SECRET=GOCSPX-…` in `apps/web/.env.local` — that value belongs on the **Convex deployment** as `AUTH_GOOGLE_SECRET`, not in the web app's env. The web app never sees the secret.

### 4. Push the schema + new functions

```bash
npx convex dev
```

Leave it running in a separate terminal during dev. First push will:
- Create the `users`, `authSessions`, `authAccounts`, etc. tables.
- Mount the `/api/auth/*` HTTP routes on your deployment.
- Regenerate `convex/_generated/` with the typed `api.users`, `api.auth` shapes.

### 5. Restart the Next.js dev server

```bash
pnpm --filter web dev
```

The "Sign in" pill should appear on the workspace top nav. Click it → Google consent → redirected back to `/workspace` signed in.

## Verifying

After setup, in the browser dev console:

```js
// While signed out:
window.__CONVEX_AUTH_DEBUG?.()
// Expected: { authenticated: false }

// After signing in:
// Expected: { authenticated: true }
```

Or just look at the nav — the "Sign in" pill should swap to your Google avatar, and clicking it opens a menu with your name + email + sign-out.

## Troubleshooting

- **"redirect_uri_mismatch" from Google.** The redirect URI in the Google Console must match `${CONVEX_SITE_URL}/api/auth/callback/google` exactly. Check `npx convex env get SITE_URL` and `npx convex env get CONVEX_SITE_URL`.
- **"Invalid token" / 401 on `useQuery(api.users.me)`.** The Convex deployment didn't get `JWT_PRIVATE_KEY` / `JWKS`. Re-run `npx @convex-dev/auth`.
- **Pill stays "Sign in" after redirect.** The middleware isn't running. Confirm `apps/web/middleware.ts` exists and `pnpm --filter web dev` was restarted.
- **`@convex-dev/auth/server` not resolvable.** Run `pnpm install` from the repo root — the package is declared in `convex/package.json`.

## Scope

- The pill only gates the *UI*; routes aren't protected. Add `nextjsMiddlewareRedirect()` to `apps/web/middleware.ts` if we ever want to bounce unauthenticated visitors away from `/workspace`.
- Build sessions don't yet require auth either — `convex/sessions.ts` `userId` stays optional. We can tighten this later by writing the resolved user id from `auth.getUserId(ctx)` on every `sessions.create` call.
