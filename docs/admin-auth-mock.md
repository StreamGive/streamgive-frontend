# Admin API authentication

The admin endpoints (`/ngo-applications*` on the `streamgive-backend` API)
aren't protected by a session or API key — they're authenticated per request
with a **SEP-53 signed message** proving control of an admin's Stellar
account. This document describes the scheme implemented in
[`src/lib/adminApi.ts`](../src/lib/adminApi.ts) and
[`src/components/wallet/WalletProvider.tsx`](../src/components/wallet/WalletProvider.tsx)
(function names below refer to `adminApi.ts` unless noted), so you don't have
to reverse-engineer it to add a new admin endpoint.

## Message format

Each request is authenticated by signing a colon-separated string:

```
${method}:${path}:${timestamp}
```

- `method` — the HTTP method, uppercase (`GET`, `POST`, ...).
- `path` — must match what the backend (Fastify) sees as `request.url`:
  no scheme/origin, but the query string included if the request has one
  (e.g. `/ngo-applications?status=PENDING`).
- `timestamp` — `Date.now()` at signing time, as a decimal string
  (milliseconds since epoch).

For example, approving an application produces the message:

```
POST:/ngo-applications/abc123/approve:1735732800000
```

This exactly mirrors what the backend's `requireAdminSignature` middleware
reconstructs and verifies — if you add a new admin route, no new signing
logic is needed on the frontend as long as you route requests through
`adminFetch()`.

Before signing, the wallet itself (via `StellarWalletsKit.signMessage`, per
[SEP-53](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md))
prepends the `"Stellar Signed Message:\n"` prefix and SHA-256-hashes the
result — callers in this codebase only ever pass the plain
`method:path:timestamp` string and never do that framing themselves.

> **Open question:** the signature's wire encoding (base64 vs hex) isn't
> pinned down anywhere authoritative — this frontend assumes base64, for
> consistency with `signTransaction`'s `signedTxXdr`. If backend
> verification ever fails against a real wallet, check this assumption
> first (see the comment above `signMessage` in `WalletProvider.tsx`).

## Headers

`adminFetch()` sends the signed request as:

| Header               | Value                                      |
| -------------------- | ------------------------------------------- |
| `content-type`        | `application/json`                          |
| `x-admin-address`     | The signer's Stellar public key (`G...`)    |
| `x-admin-signature`   | The signature returned by the wallet        |
| `x-admin-timestamp`   | The same timestamp used in the signed message |

The JSON body (for `POST`/etc.) is not part of the signed message — only
the method, path, and timestamp are authenticated.

## Signature caching

Getting a wallet to sign is a user-facing prompt, so `adminApi.ts` avoids
asking for one on every request:

- Signatures are cached **in memory only**, in a module-level
  `Map<string, CachedSignature>` keyed by `` `${address}:${method}:${path}` ``.
  This is deliberate: it survives client-side navigation but not a full
  page reload, so nothing sensitive persists to disk or across sessions.
- The backend accepts a signature within a 5-minute clock-skew window of
  its timestamp. The frontend reuses a cached signature for up to **4
  minutes** (`SIGNATURE_REUSE_WINDOW_MS`), leaving a minute of margin for
  clock drift and request latency before it would be rejected server-side.
- Reuse is scoped per exact `address:method:path` key, so a signature never
  gets reused across different requests — e.g. approving two different
  applications, or the same one with `GET` vs `POST`, each sign
  independently.
- Reuse grants nothing the server wouldn't already accept from a fresh
  signature with the same address/method/path/expiry; it only avoids
  re-prompting the wallet for a signature that's still valid, which is
  what previously made every visit to the admin page pop a signing dialog.

## Retry logic

`adminFetch()` retries **once**, and only in one specific case:

1. It gets a signature (cached or freshly signed) and sends the request.
2. If the response is `401` **and the signature that was sent came from the
   cache**, it evicts that cache entry, signs a fresh message, and retries
   the request once with the new signature.
3. If the response is `401` for a signature that was **just** signed (not
   reused), it does **not** retry — a fresh signature being rejected means
   the wrong wallet is connected (or the account isn't an admin), and
   signing again with the same wallet wouldn't change that outcome.

This means a legitimate cached-signature expiry (e.g. the server clock
running further ahead than the 4-minute margin allows) costs the user one
extra silent retry rather than a dead page, while an actual auth failure
surfaces immediately instead of looping.

## Manual testing with curl

Because signing normally happens inside a wallet extension, testing an
admin endpoint by hand means producing a SEP-53 signature yourself with a
raw keypair (e.g. a funded testnet admin account). This uses
`@stellar/stellar-sdk`, which is already a project dependency:

```js
// sign.mjs — usage: node sign.mjs <METHOD> <PATH>
import { Keypair, hash } from '@stellar/stellar-sdk';

const [method, path] = process.argv.slice(2);
const secret = process.env.ADMIN_SECRET_KEY; // starts with "S..."
const keypair = Keypair.fromSecret(secret);

const timestamp = Date.now().toString();
const message = `${method}:${path}:${timestamp}`;
const payload = Buffer.concat([Buffer.from('Stellar Signed Message:\n'), Buffer.from(message)]);
const signature = keypair.sign(hash(payload)).toString('base64');

console.log(JSON.stringify({ address: keypair.publicKey(), signature, timestamp }, null, 2));
```

```bash
export ADMIN_SECRET_KEY=S...   # an admin account's secret key
node sign.mjs GET /ngo-applications
# => { "address": "GA...", "signature": "...", "timestamp": "1735732800000" }

curl "$API_URL/ngo-applications" \
  -H "x-admin-address: GA..." \
  -H "x-admin-signature: <signature from above>" \
  -H "x-admin-timestamp: <timestamp from above>"
```

For a `POST` (e.g. approving an application), sign the same way with
`method` set to `POST` and `path` set to the full path including the
resource id, and send the body separately — it isn't part of the signed
message:

```bash
node sign.mjs POST /ngo-applications/abc123/approve

curl -X POST "$API_URL/ngo-applications/abc123/approve" \
  -H "content-type: application/json" \
  -H "x-admin-address: GA..." \
  -H "x-admin-signature: <signature>" \
  -H "x-admin-timestamp: <timestamp>" \
  -d '{"reviewNote": "looks good"}'
```

If verification fails, double-check: the `path` matches exactly what the
server receives (including the query string, no trailing slash mismatch),
the timestamp is fresh (within 5 minutes of the server's clock), and the
signature encoding — see the base64/hex caveat above.
