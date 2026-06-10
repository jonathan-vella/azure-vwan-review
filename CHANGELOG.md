# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
on the **content** of the review pack — major bumps for backwards-incompatible
control-ID changes, minor bumps for new controls or new sections, patch bumps
for typo / source-URL / wording-only fixes.

## [Unreleased]

### Added

- `CONTRIBUTING.md` with a five-line issue-driven contribution flow.
- GitHub issue templates: control-proposal, source-url-rot.
- Dependabot for `pip` and `github-actions` ecosystems.
- Weekly lychee link-check workflow that opens a tracking issue on URL rot.
- `CODEOWNERS` for automatic reviewer assignment.
- `pre-commit` config — anchor verifier + markdown lint on commit,
  `mkdocs build --strict` on push.
- MkDocs Material social-card plugin + favicon.

## [0.2.0] — 2026-05-22

### Added

- `prompts/` folder with the original construction blueprint
  (`00-blueprint.prompt.md`) and three maintenance prompts:
  `refresh-sources.prompt.md`, `add-or-update-control.prompt.md`,
  `verify-pack.prompt.md`.
- MkDocs Material docs site (`mkdocs.yml`, `requirements.txt`,
  `docs/` symlink tree) with explicit nav and light/dark palette.
- GitHub Actions workflow `docs.yml` that runs anchor verification,
  markdown lint, and `mkdocs build --strict` on every push/PR and
  deploys GitHub Pages from `main`.
- `scripts/verify.mjs` anchor checker with GitHub-compatible slug rules
  that skips inline code spans.
- Visual README with badges, at-a-glance table, mermaid pack-structure
  diagram, and rubric tables.
- `.markdownlint-cli2.jsonc`, `.editorconfig`, `.gitignore`, MIT `LICENSE`.

## [0.1.0] — 2026-05-22

### Added

- Initial publish of the Azure VWAN Review Pack:
  `README.md`, `01-vwan-review-checklist.md`,
  `02-vwan-review-addendum.md`, `03-vwan-waf-cheatsheet.md`,
  `evidence/.gitkeep`.
- Coverage: WAF pillars (Reliability, Security, Cost, OpEx, Performance),
  CAF topology alignment, Palo Alto Cloud NGFW (SaaS-only) section,
  10-row routing options matrix, findings backlog.
