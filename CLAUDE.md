# OTAP Platform Monitoring (Prive-OTAP-Demo)

Privé-app on the OTAP platform. CI/CD comes from `HansdeRooijPrive/OTAP-CI@v1`;
this repo was generated from `Prive-App-Template`. See README.md for URLs.

## Working method (OTAP)
- Always work on `development` (T). Never commit directly to `acceptatie` or `main`.
- Change `src/`, then `python build.py` (rebuilds the checked-in `index.html`),
  `python build.py --check` and `python -m pytest -q`; commit only when green.
- Push to `development` → CI + deploy to `/test/`. Only promote to `acceptatie`
  (fast-forward: `git push origin development:acceptatie`) once CI on `development` is green.
- The user tests on https://hansderooijprive.github.io/Prive-OTAP-Demo/acceptatie/.
- **Release gate:** `main` (production) only after an explicit "go ahead" from the
  user in the chat. Then fast-forward `acceptatie` → `main`; no merge commits.

## Conventions
- App code in `src/app/NN-*.js` as IIFE fragments; placeholders like `{{STORAGE_KEY}}`
  are filled in by `build.py` from `app.json`.
- Storage key per environment: `prive-otap-demo` (P), `.acc` (A), `.test` (T) — keep them separate.
- Tests: Playwright + pytest via Python, no Node.
- Shared build/deploy logic changes belong in `OTAP-CI`, not here.
