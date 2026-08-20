# Video Playback Analysis

Last updated: August 20, 2026

## Purpose

This note records the proxy/video playback behavior that was confirmed during debugging, so the working boundary is preserved in the repository.

## Confirmed Working Baseline

- Working playback baseline commit: `5114740`
- Commit message: `Force absolute proxy dashboard redirects`
- Commit date: `2026-08-20 11:46:13 +0600`

At this baseline, the proxied lesson URL below was confirmed to play video correctly:

```txt
/proxy/p1/courses/probability-and-statistics-nex-5263/lessons/lecture-2-central-tendency-ogive-curve-mean/?page_tab=comments
```

## Current Rollback State

- Current rollback commit on `main`: `c6898f9`
- Commit message: `Revert "Preserve protocol-relative player URLs"`
- Commit date: `2026-08-20 14:03:31 +0600`

Important: `c6898f9` is a revert stack, but the code tree matches commit `5114740`.

Evidence:

```txt
git diff --stat 5114740 HEAD
```

The diff was empty when the rollback was verified.

## Why Video Works In `5114740`

The main reason is that this version keeps the proxy behavior conservative enough for the upstream lesson/video flow to survive.

In `backend/server.js`, this working state does these things:

- Rewrites `Set-Cookie` so each profile stays isolated under `/proxy/p1` or `/proxy/p2`
- Rewrites `Location` headers so dashboard and internal navigation stay under the active proxy base path
- Rewrites HTML/CSS/targeted JSON URL fields
- Keeps `changeOrigin: true`
- Does **not** inject extra upstream `Origin` / `Referer` normalization on proxied requests

That last point is the most important one for playback.

In the working baseline, the `proxyReq` hook for the response-rewriting proxy only sets:

```js
proxyReq.setHeader('accept-encoding', 'gzip, br, deflate');
```

It does **not** force:

- `origin: https://nexcourses.com`
- rewritten `referer`

This means the VdoCipher/player-related flow stays closer to the original browser behavior.

## Most Likely Regression Boundary

The strongest regression candidate is:

- Commit: `f73e121`
- Message: `Normalize proxied origin and referer headers`
- Date: `2026-08-20 12:51:33 +0600`

This commit added a new function:

```js
function rewriteOutgoingRequestHeaders(proxyReq, req, profileBasePath)
```

and started forcing proxied request headers such as:

- `origin`
- `referer`

Behavior added in that commit:

```js
proxyReq.setHeader('origin', TARGET_ORIGIN);
proxyReq.setHeader('referer', rewrittenReferer);
```

Why this is risky:

- the browser is actually running on `multi-profile-nex.onrender.com`
- the upstream lesson/DRM flow is sensitive to request context
- forcing upstream-looking `origin` and `referer` can create an auth/context mismatch between:
  - browser page origin
  - proxy request headers
  - upstream lesson/session state
  - downstream VdoCipher auth/license flow

## Later Repair Attempt

Another commit tried to preserve player-specific URLs:

- Commit: `a81a8c1`
- Message: `Preserve VdoCipher auth and config paths`
- Date: `2026-08-20 13:20:24 +0600`

This commit added bypass logic for values matching:

- `vdocipher.com`
- `cdn.cgi`

That patch was a repair attempt, not the original working condition.

Meaning:

- by the time this commit was added, playback had already become fragile
- this patch tried to avoid rewriting some VdoCipher-related URLs
- it did not restore the simpler, working request behavior from `5114740`

## Practical Conclusion

If future work needs to preserve proxy-side video playback, use this rule:

- treat `5114740` as the known-good playback baseline
- be very careful with any change that rewrites proxied request headers
- especially avoid global `Origin` / `Referer` normalization unless proven necessary
- prefer minimal, targeted rewrites over broad request-context mutation

## Commits To Remember

| Commit | Status | Meaning |
| --- | --- | --- |
| `5114740` | working | Known-good lesson/video playback baseline |
| `f73e121` | likely regression boundary | Added forced proxied `origin` / `referer` rewriting |
| `a81a8c1` | repair attempt | Tried to preserve VdoCipher-specific paths after playback became fragile |
| `c6898f9` | current safe rollback marker | Revert stack whose tree matches `5114740` |

## Recommended Future Recovery Strategy

If video playback work is resumed later:

1. Start from the code tree equivalent to `5114740`
2. Re-apply later fixes one by one
3. Test the lesson playback after each change
4. First suspect any code that mutates:
   - request `origin`
   - request `referer`
   - player config URLs
   - VdoCipher-related script/config paths
