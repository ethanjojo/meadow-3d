# English Publication Design

## Goal

Publish the intentionally reverted meadow version as the canonical `main` branch, with an English-only public experience and without internal Superpowers working documents in the repository.

## Scope

- Preserve every current uncommitted scene revert in `/Users/george/Desktop/Meadow3D`.
- Translate all visitor-facing interface copy, accessibility labels, fallback messages, HTML metadata, and the README into English.
- Update automated tests so they verify the English accessible experience.
- Remove `docs/superpowers/` from the current repository tree, keep any remaining copies local, and ignore the directory going forward.
- Keep implementation identifiers and existing English file names unchanged.
- Do not rewrite Git history to erase previously committed Superpowers documents.

## Delivery

Use two implementation commits after this design commit:

1. Record the confirmed scene reverts without mixing in translation work.
2. Translate public copy, update tests, and ignore/remove `docs/superpowers/`.

Push the resulting history directly to `main`. The existing GitHub Pages workflow must run automatically and publish the same commit.

## Verification

- Unit and component tests pass with English accessible names.
- TypeScript linting succeeds.
- Default and GitHub Pages production builds succeed.
- End-to-end tests cover the English settings interaction on desktop and mobile.
- The GitHub Actions deployment succeeds from `main`.
- The live Pages HTML, JavaScript, and CSS return HTTP 200 and the rendered page exposes English title and controls without console errors.

## Safety

Only the already confirmed revert set and the English/publication files belong in scope. Existing local files under `docs/superpowers/` must not be destroyed merely to remove them from Git tracking.
