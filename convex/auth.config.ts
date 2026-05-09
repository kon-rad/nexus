/**
 * Convex Auth provider config — JWT issuer that the Convex deployment trusts.
 *
 * Convex Auth signs JWTs with a private key it keeps in `JWT_PRIVATE_KEY` and
 * exposes the matching public key at `${process.env.CONVEX_SITE_URL}/.well-known/jwks.json`
 * (mounted by `auth.addHttpRoutes(http)` in `convex/http.ts`). This file
 * tells the Convex runtime which issuer + audience to accept on `ctx.auth`
 * lookups.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
