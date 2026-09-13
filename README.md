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
python build.py            # bouwt index.html (productie); haalt eenmalig OTAP-CI v2 op in .otap/
python build.py --env=test # testvariant (andere naam, icoon en opslagsleutel)
python build.py --check    # platformafspraken + index.html controleren
pip install -r requirements-test.txt && python -m playwright install chromium && pytest
```

`index.html` (productie-build) staat ingecheckt; `CI` bewaakt dat die overeenkomt
met `src/`. De bouwstap komt centraal uit OTAP-CI (`"platform": "v2"` in
`app.json`); `build.py` is alleen de dunne ingang en pas je niet aan.

## Iconen
`src/icons/icon.<prod|acc|test>.png` zijn de eigen app-iconen per omgeving: de
merkkleur uit `app.json` (blauw, oranje, groen) met de letter P, A of T en een
straat van vier stippen waarin de eigen omgeving groter is. De drie moeten van
elkaar verschillen (platformafspraak); `.gitattributes` legt ze binair vast.
