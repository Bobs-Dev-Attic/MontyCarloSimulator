# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for a
vulnerability.

Use GitHub's private vulnerability reporting for this repository:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability** (GitHub Security Advisories).
3. Describe the issue, steps to reproduce, and impact.

If private reporting is unavailable to you, open a regular issue that says only
that you have a security concern and asks a maintainer to open a private
channel — **without** including exploit details.

We aim to acknowledge reports within a few days and to address confirmed issues
promptly. Please give us reasonable time to remediate before any public
disclosure.

## Scope

This is a stateless web app: no user accounts, no database, no server-side
persistence, and no personal data collected (see [PRIVACY.md](PRIVACY.md)).
Reports we're especially interested in:

- Ways to inject content or scripts (XSS) despite the Content-Security-Policy.
- Abuse of the simulation / export endpoints (resource exhaustion, cost
  amplification).
- Flaws in the settings **import** path (`lib/profile.ts`) — e.g. prototype
  pollution or storage abuse — despite its sanitization.
- Anything that could cause a user's local data to leak off their device.

## Out of scope

- Missing rate limiting is a known, tracked item (see [TODO.md](TODO.md)); a
  proof-of-concept that meaningfully improves on it is still welcome.
- Findings that require a compromised device/browser or physical access.
- The educational accuracy of the financial models (that's not a security issue,
  but bug reports are welcome as normal issues).

## Supported versions

Only the latest deployed version (`main`) is supported.
