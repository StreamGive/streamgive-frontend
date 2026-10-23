# Security policy

## Reporting a vulnerability

Contact the repository maintainers through
[GitHub private vulnerability reporting](https://github.com/StreamGive/streamgive-frontend/security/advisories/new).
Sign in to GitHub and submit a private report. Do not publish exploit details
in a public issue or pull request before a fix is available.

This channel requires private vulnerability reporting to be enabled for the
repository. Maintainers must enable it before publishing this policy; see
[GitHub's setup instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).
If the reporting form is unavailable, ask maintainers to enable private
reporting without sharing vulnerability details publicly.

Include the following in your report:

- A description of the vulnerability and its potential impact.
- The affected page, component, dependency, and commit or version.
- Reproduction steps or a minimal proof of concept, including the browser,
  wallet, and Stellar network when relevant.
- Relevant logs or screenshots with secrets and personal data removed.
- A way to contact you for follow-up questions.

Never send private keys, seed phrases, access tokens, or signed transactions
that could authorize movement of real funds.

## Scope and supported versions

Security fixes target the latest code on the default branch. Older commits
and forks do not receive separate security updates.

This policy covers vulnerabilities in this frontend, including:

- Wallet connection, signature requests, and transaction construction.
- Donation, withdrawal, NGO registration, and platform admin flows.
- Frontend handling of API responses and sensitive data.
- Script injection, security headers, and the embedded donation widget.
- Dependencies, build configuration, and repository automation when they
  create an exploitable risk for this application.

The StreamGive backend and smart contracts are maintained in separate
repositories. Report issues isolated to those components through their own
security policies. If the affected component is unclear or the issue spans
the frontend and another component, include that context in your private
report so maintainers can coordinate triage.

## Response and disclosure

Maintainers aim to acknowledge reports within 3 business days and provide
an initial assessment within 7 business days. These are response targets,
not guaranteed resolution deadlines; the time needed for a fix depends on
severity and complexity.

After triage, maintainers will coordinate remediation and a disclosure date
with the reporter and provide progress updates at least every 7 business
days while a confirmed vulnerability remains open. Please allow time for
a fix and affected deployments to update before publishing details.

## Responsible investigation

Use local development or testnet with accounts you control where possible.
Avoid accessing other users' data, disrupting services, or moving funds
without authorization. Stop and report privately if investigation exposes
sensitive data or risks harming users.
