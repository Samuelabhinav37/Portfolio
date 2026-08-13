# Security Policy

This repository contains the source for [samuelabhinav.com](https://samuelabhinav.com), a personal portfolio and blog. There's no bug bounty and no reward — this is a solo-maintained site, not a company — but coordinated disclosure of genuine vulnerabilities is welcome and taken seriously.

## Scope

**In scope:**
- The production site at `https://samuelabhinav.com` and its subpaths
- Source code in this repository (build pipeline, Cloudflare Pages Functions in `functions/`, client-side scripts)

**Out of scope:**
- Denial-of-service / rate-limit exhaustion testing
- Automated scanning that generates high-volume traffic
- Social engineering, physical attacks, or attacks against third-party services this site links to or embeds (e.g. Cloudflare Turnstile, font/CDN providers)
- Findings that require a jailbroken/rooted device, a compromised browser, or physical access to a visitor's device
- Missing security headers or best-practice nitpicks with no demonstrable impact (check `public/_headers` first — most of these are already handled deliberately)

## Reporting a Vulnerability

Report suspected vulnerabilities privately, using one of:

- **Email:** [hello@samuelabhinav.com](mailto:hello@samuelabhinav.com) — include steps to reproduce, impact, and any PoC
- **GitHub:** [Private vulnerability reporting](https://github.com/Samuelabhinav37/Portfolio/security/advisories/new) via this repo's Security tab

Please don't open a public GitHub issue, PR, or discussion for a security report — that discloses it before there's a fix.

### What to expect

This is a solo-maintained project, so treat these as best-effort targets, not SLAs:

| Stage | Target |
|---|---|
| Acknowledgment of your report | 3 business days |
| Triage / validity confirmation | 7 days |
| Fix or mitigation, confirmed high-severity issues | 30 days |
| Fix or mitigation, everything else | 90 days |

I'll keep you posted if a fix is going to run past those windows rather than go quiet.

## Coordinated Disclosure

Please give me the chance to fix an issue before it's made public: don't disclose details until a fix has shipped, or 90 days have passed since your report, whichever comes first. If you'd like public credit once it's resolved, say so in your report and I'll note it in the fix commit/changelog — there's no formal hall of fame here.

## Safe Harbor

If you make a good-faith effort to comply with this policy while researching — no data destruction, no privacy violation beyond what's strictly needed to demonstrate the issue, no service disruption, and you stop and report as soon as you've established impact — I will consider that research authorized. I won't pursue legal action or refer you to law enforcement for accidental, good-faith violations of this policy encountered while investigating.

This safe harbor does not extend to third-party services the site embeds or links to (Cloudflare, font/CDN providers, etc.) — report those to the respective vendor.

## What's Already in Place

For context before you report: the site ships a restrictive CSP, HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, and related headers (see `public/_headers`); dependencies are tracked via Dependabot; and CodeQL runs on every push and weekly on a schedule. Findings that bypass or weaken these controls are of particular interest.

See also: [`/.well-known/security.txt`](https://samuelabhinav.com/.well-known/security.txt) (RFC 9116) on the live site.
