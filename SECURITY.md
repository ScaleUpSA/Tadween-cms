# Security Policy

## Supported versions

Tadween is pre-1.0. Only the latest release receives security fixes.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via [GitHub Security Advisories](https://github.com/ScaleUpSA/Tadween-cms/security/advisories/new) or email **security@scaleup.sa** with:

- A description of the issue and its impact
- Steps to reproduce or a proof of concept
- Any suggested remediation

We aim to acknowledge reports within 72 hours and to ship a fix or mitigation as quickly as severity warrants. We will credit reporters in the release notes unless you prefer to remain anonymous.

## Scope notes

- The dashboard Worker handles authentication, sessions, and CSRF; issues in these areas are highest priority.
- Content rendering escapes raw HTML in markdown by default; bypasses of that escaping are in scope.
- Vulnerabilities in third-party dependencies should be reported upstream, but let us know so we can pin or patch.
