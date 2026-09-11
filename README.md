# app-template-prive

Sjabloon (GitHub *template repository*) voor een **privé** web-app op het
OTAP-platform. Een nieuwe app maak je door van deze repo een nieuwe repo te
genereren (`prive-<app>`). De CI/CD komt uit
[`otap-ci`](https://github.com/HansdeRooijPrive/otap-ci).

## Snel starten
```bash
python build.py            # bouwt index.html (productie)
python build.py --env=test # testvariant (andere kleur + opslagsleutel)
# lokaal bekijken: open index.html of serveer de map
pip install -r requirements-test.txt && python -m playwright install chromium && pytest
```

## Wat pas je aan per app
- **`app.json`** — naam, `short_name`, `storage_key` en de thema-kleuren per omgeving (prod/acc/test).
- **`src/`** — de app zelf: `index.template.html`, `styles.css`, `app/NN-*.js` (IIFE-fragmenten), optioneel `src/vendor/*.js`.
- **`tests/`** — je eigen tests (optioneel; deze demo bevat een build- en smoke-test).

Placeholders die `build.py` invult: `{{APP_NAME}}`, `{{APP_SHORT}}`,
`{{STORAGE_KEY}}`, `{{ENV}}`, `{{ENV_LABEL}}`, `{{MERK}}`, `{{MERK_DONKER}}`,
`{{MERK_LICHT}}`.

## OTAP
| Branch | Omgeving | URL |
|--------|----------|-----|
| `main` | Productie | `…github.io/<repo>/` |
| `acceptatie` | Acceptatie | `…github.io/<repo>/acceptatie/` |
| `development` | Test | `…github.io/<repo>/test/` |

`index.html` (productie-build) staat ingecheckt; `CI` bewaakt dat die overeenkomt
met `src/`. Push naar een branch → `otap-ci` bouwt en publiceert de bijbehorende
omgeving.
