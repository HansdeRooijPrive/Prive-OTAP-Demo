# prive-otap-demo — OTAP Platform Demo

Demo-app (privé) op het OTAP-platform, gegenereerd uit
[`app-template-prive`](https://github.com/HansdeRooijPrive/app-template-prive).
De CI/CD komt uit [`otap-ci`](https://github.com/HansdeRooijPrive/otap-ci).
Doel: de volledige O → T → A → P-keten live laten zien.

De app zelf is de **OTAP-straat**: een gesimuleerde releasestraat waarin je
releases van Ontwikkeling via Test en Acceptatie naar Productie promoveert.
Elke poort heeft eigen criteria (tests, regressietest, gebruikersacceptatie,
change-goedkeuring met vier-ogenprincipe, wijzigingsvenster, release freeze);
productie rolt blue-green uit en kan worden teruggedraaid. Alle gegevens zijn
fictief en worden per omgeving apart in `localStorage` bewaard.

## OTAP
| Branch | Omgeving | URL |
|--------|----------|-----|
| `development` | Test | https://hansderooijprive.github.io/prive-otap-demo/test/ |
| `acceptatie` | Acceptatie | https://hansderooijprive.github.io/prive-otap-demo/acceptatie/ |
| `main` | Productie | https://hansderooijprive.github.io/prive-otap-demo/ |

Werkwijze: wijzig op `development` → CI groen → door naar `acceptatie` →
testen op de acceptatie-URL → pas na expliciet akkoord naar `main` (productie).

## Lokaal (O)
```bash
python build.py            # bouwt index.html (productie)
python build.py --env=test # testvariant (andere kleur + opslagsleutel)
pip install -r requirements-test.txt && python -m playwright install chromium && pytest
```

`index.html` (productie-build) staat ingecheckt; `CI` bewaakt dat die overeenkomt
met `src/`.
