# react-router-dom: npm audit flags GHSA-qwww-vcr4-c8h2, doesn't apply here

`npm audit` flags `react-router-dom@7.18.1` (current pin) for
[GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2), a
CSRF issue in React Router's **unstable RSC (React Server Components) mode**
— confirmed by reading the actual advisory, not just the audit summary.

This app uses `createBrowserRouter` as a plain client-side SPA router — no
server actions, no RSC, none of the affected code paths. The advisory itself
states this only affects apps using the unstable RSC APIs.

**Why not just run `npm audit fix --force`**: the only "fix" it offers is
downgrading to `react-router-dom@7.11.0` — a real breaking-change regression
— because no patched forward version exists in the registry yet (fix
landed in 8.3.0, which hasn't been published as of this writing; latest
available is 7.18.2, still inside the flagged range). Downgrading would add
real risk (multiple minor versions back) for zero actual security benefit
given this app doesn't use the vulnerable feature.

**Action**: none taken. Re-check when react-router-dom 8.3.0+ becomes
available and upgrade normally at that point. If this app ever adopts RSC/
server actions, re-evaluate immediately rather than assuming this is still
a non-issue.
