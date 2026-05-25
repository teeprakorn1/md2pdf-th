# Contributing to md2pdf-th

Thank you for your interest in contributing. This guide covers the process for submitting changes.

---

## Getting started

```bash
git clone https://github.com/teeprakorn1/md2pdf-th.git
cd md2pdf-th
npm install
npm test
```

**Requirements:** Node.js >= 16.0.0 and Chromium (auto-installed by Puppeteer via `md-to-pdf`).

---

## Branch strategy

- **`main`** — stable, release-ready branch
- **Feature branches** — create from `main`, merge back via PR

```bash
git checkout -b feat/my-feature main
```

---

## Commit convention

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): message
```

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Build, CI, tooling |
| `test` | Adding or updating tests |
| `refactor` | Code change that neither fixes a bug nor adds a feature |

Examples:

```
feat(cli): add --lang flag for language hint
fix(core): prevent ReDoS in sanitizeHtml regex
docs: update README with NestJS async config
test: add regression test for frontmatter booleans
```

---

## Pull request checklist

Before submitting a PR, ensure:

- [ ] `npm test` passes (unit + integration tests)
- [ ] No lint errors
- [ ] New features have corresponding tests
- [ ] CHANGELOG.md updated for user-facing changes
- [ ] TypeScript types updated if API surface changed (`types/index.d.ts`, `types/nestjs.d.ts`)
- [ ] PR description explains **what** and **why**

---

## Code style

- Self-documenting code — avoid unnecessary comments
- Follow existing patterns in the codebase
- Keep functions focused and small
- Use `const` over `let` where possible
- Prefer early returns over nested conditions

---

## Reporting bugs

Open a [GitHub Issue](https://github.com/teeprakorn1/md2pdf-th/issues) with:

- **md2pdf-th version** (`md2pdf-th --version`)
- **Node.js version** (`node --version`)
- **OS** (e.g. Ubuntu 22.04, macOS 14)
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Minimal `.md` file** that triggers the bug (if applicable)

---

## Feature requests

Open a [GitHub Issue](https://github.com/teeprakorn1/md2pdf-th/issues) or [Discussion](https://github.com/teeprakorn1/md2pdf-th/discussions) describing:

- The problem you're trying to solve
- Your proposed solution
- Alternatives you've considered

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
