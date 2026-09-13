# Prive-OTAP-Demo — OTAP Platform Demo

Demo-app (privé) op het OTAP-platform, gegenereerd uit
[`Prive-App-Template`](https://github.com/HansdeRooijPrive/Prive-App-Template).
De CI/CD komt uit [`OTAP-CI`](https://github.com/HansdeRooijPrive/OTAP-CI).
Doel: de volledige O → T → A → P-keten live laten zien.

De app zelf is de **OTAP-straat**, een dashboard met een app-kiezer bovenin:

- **Live uit GitHub** — kies een app (standaard: Ventus KM-Declaratie, deze
  demo, Zeilen in Griekenland, Reizen Schotland) of voeg zelf een openbare repo
  toe. Het dashboard leest zonder token de branches (`development` = Test,
  `acceptatie`, `main` = Productie), commits en workflow-runs en toont per
  omgeving welke versie er live staat, of CI groen is en hoeveel commits klaar
  staan voor de volgende omgeving. Alleen-lezen; zonder inloggen staat GitHub
  60 verzoeken per uur toe, daarom wordt de stand 5 minuten bewaard.
- **Oefenstraat** — een gesimuleerde releasestraat met poortcriteria
  (regressietest, gebruikersacceptatie, change-goedkeuring met vier-ogenprincipe,
  wijzigingsvenster, release freeze), blue-green uitrol en terugdraaien. Alle
  gegevens daarin zijn fictief.

De gekozen app staat in de URL (`#app=eigenaar/repo` of `#app=oefen`) en wordt,
net als de oefenstraat, per omgeving apart in `localStorage` bewaard.

## OTAP
| Branch | Omgeving | URL |
|--------|----------|-----|
| `development` | Test | https://hansderooijprive.github.io/Prive-OTAP-Demo/test/ |
| `acceptatie` | Acceptatie | https://hansderooijprive.github.io/Prive-OTAP-Demo/acceptatie/ |
| `main` | Productie | https://hansderooijprive.github.io/Prive-OTAP-Demo/ |

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
