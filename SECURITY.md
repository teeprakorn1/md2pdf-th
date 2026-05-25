# Security policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 4.x     | Yes       |
| 3.x     | No        |
| < 3.0   | No        |

## Reporting a vulnerability

If you discover a security vulnerability in md2pdf-th, please report it responsibly:

- **Email** — [teeprakorn1@users.noreply.github.com](mailto:teeprakorn1@users.noreply.github.com)
- **GitHub Security Advisories** — [Create advisory](https://github.com/teeprakorn1/md2pdf-th/security/advisories/new)

**Do not** open a public issue for security vulnerabilities.

## Response timeline

| Severity | Acknowledgement | Patch target |
|----------|----------------|--------------|
| Critical | 24 hours       | 3 days       |
| High     | 48 hours       | 7 days       |
| Medium   | 72 hours       | 14 days      |
| Low      | 1 week         | Next release |

## Scope

**In scope:**

- XSS via `sanitizeHtml` bypass
- Path traversal in CLI or web server
- Remote code execution
- Prototype pollution
- ReDoS in regex patterns
- Authentication bypass in web preview server

**Out of scope:**

- Denial of service from extremely large Markdown files
- Social engineering
- Vulnerabilities in dependencies (report upstream instead)
- Issues requiring physical access

## Credit

Security researchers who report valid vulnerabilities will be acknowledged in the CHANGELOG and README (unless anonymity is preferred).
