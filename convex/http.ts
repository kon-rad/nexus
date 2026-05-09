/**
 * HTTP routes mounted on the Convex deployment.
 *
 * Convex Auth's `auth.addHttpRoutes(http)` registers:
 *   - `/api/auth/signin/google`      — kicks the OAuth dance
 *   - `/api/auth/callback/google`    — Google redirects here with the code
 *   - `/.well-known/openid-configuration` + `/.well-known/jwks.json`
 *     so Convex itself can verify the JWTs `convexAuth` issues.
 *
 * The web client never calls these directly — it uses `useAuthActions()` from
 * `@convex-dev/auth/react`, which proxies through the Convex client.
 */

import { httpRouter } from "convex/server";
import { auth } from "./auth.js";

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
