#!/usr/bin/env python3
"""
Env-bewuste build: voegt src/ samen tot één self-contained index.html en vult
per omgeving (prod/acc/test) de thema-kleur, het app-icoon, de app-naam en de
opslagsleutels in vanuit app.json. Geen Node/npm nodig.

    python build.py                 -> productie-build naar index.html
    python build.py --env=test      -> testvariant (andere kleur + opslagsleutel)
    python build.py --env=acc --out ../dist/acceptatie/index.html
    python build.py --check         -> faalt als index.html != productie-build
"""
import argparse
import base64
import glob
import json
import os
import struct
import sys
import urllib.parse
import zlib

ROOT = os.path.dirname(os.path.abspath(__file__))
ENVS = ("prod", "acc", "test")
SUFFIX = {"prod": "", "acc": ".acc", "test": ".test"}
LABEL = {"prod": "", "acc": "ACCEPTATIE", "test": "TEST"}
# Achter de app-naam, zodat het bijschrift onder het icoon op je beginscherm
# meteen verraadt welke omgeving je hebt geïnstalleerd.
NAAM_SUFFIX = {"prod": "", "acc": " acc", "test": " test"}


def _read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def _config():
    return json.loads(_read("app.json"))


def _theme(cfg, env):
    t = cfg.get("theme", {})
    kleur = dict(t.get("prod", {}))
    kleur.update(t.get(env, {}))
    return kleur


def _rgb(hexkleur):
    h = hexkleur.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _maak_icoon(merk, merk_licht, maat=256):
    """Eenvoudig app-icoon in de kleur van deze omgeving: afgeronde vierkant met
    een diagonale band. Puur standaard-Python, zodat de CI niets hoeft te
    installeren. Levert base64 (PNG) op."""
    achter, band = _rgb(merk), _rgb(merk_licht)
    r = maat // 5
    rijen = bytearray()
    for y in range(maat):
        rijen.append(0)                                  # filterbyte per rij
        for x in range(maat):
            cx = min(max(x, r), maat - 1 - r)
            cy = min(max(y, r), maat - 1 - r)
            if (x - cx) ** 2 + (y - cy) ** 2 > r * r:    # buiten de afronding
                rijen += b"\xff\xff\xff"
            elif maat * 0.60 < y + x * 0.30 < maat * 0.78:
                rijen += bytes(band)
            else:
                rijen += bytes(achter)

    def blok(soort, data):
        return (struct.pack(">I", len(data)) + soort + data +
                struct.pack(">I", zlib.crc32(soort + data) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n" +
           blok(b"IHDR", struct.pack(">IIBBBBB", maat, maat, 8, 2, 0, 0, 0)) +
           blok(b"IDAT", zlib.compress(bytes(rijen), 9)) +
           blok(b"IEND", b""))
    return base64.b64encode(png).decode("ascii")


def _icoon(env, th):
    """Eigen icoon van de app (src/icons/icon.<env>.png) als dat er is; anders
    een gegenereerd icoon in de kleur van de omgeving."""
    pad = os.path.join(ROOT, "src", "icons", "icon.%s.png" % env)
    if os.path.exists(pad):
        with open(pad, "rb") as f:
            return base64.b64encode(f.read()).decode("ascii")
    return _maak_icoon(th.get("merk", "#333333"), th.get("merk_licht", "#555555"))


def _apply(text, repl):
    for k, v in repl.items():
        text = text.replace(k, v)
    return text


def build(env="prod"):
    if env not in ENVS:
        raise SystemExit("onbekende omgeving: %s (kies uit %s)" % (env, ", ".join(ENVS)))
    cfg = _config()
    th = _theme(cfg, env)
    naam = cfg["name"]
    kort = cfg.get("short_name", naam)
    naam_env = naam + NAAM_SUFFIX[env]
    kort_env = kort + NAAM_SUFFIX[env]
    repl = {
        "{{APP_NAME}}": naam,
        "{{APP_NAME_URL}}": urllib.parse.quote(naam),
        "{{APP_SHORT}}": kort,
        "{{APP_NAME_ENV}}": naam_env,
        "{{APP_NAME_ENV_URL}}": urllib.parse.quote(naam_env),
        "{{APP_SHORT_ENV}}": kort_env,
        "{{APP_SHORT_ENV_URL}}": urllib.parse.quote(kort_env),
        "{{ICOON}}": _icoon(env, th),
        "{{STORAGE_KEY}}": cfg["storage_key"] + SUFFIX[env],
        "{{ENV}}": env,
        "{{ENV_LABEL}}": LABEL[env],
        "{{MERK}}": th.get("merk", "#333333"),
        "{{MERK_DONKER}}": th.get("merk_donker", "#111111"),
        "{{MERK_LICHT}}": th.get("merk_licht", "#555555"),
    }
    vendor = "".join(_read(os.path.relpath(p, ROOT)) for p in sorted(glob.glob(os.path.join(ROOT, "src", "vendor", "*.js"))))
    app = "".join(_read(os.path.relpath(p, ROOT)) for p in sorted(glob.glob(os.path.join(ROOT, "src", "app", "*.js"))))
    script = _apply(vendor + app, repl)
    styles = _apply(_read("src/styles.css"), repl)
    html = _apply(_read("src/index.template.html"), repl)
    html = html.replace("{{STYLES}}", styles).replace("{{SCRIPT}}", script)
    return html


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", default="prod", choices=ENVS)
    ap.add_argument("--out", default=None, help="uitvoerpad (standaard index.html in de repo)")
    ap.add_argument("--check", action="store_true", help="vergelijk index.html met de productie-build")
    args = ap.parse_args()

    if args.check:
        current = _read("index.html") if os.path.exists(os.path.join(ROOT, "index.html")) else ""
        if current == build("prod"):
            print("OK: index.html komt overeen met src/")
            return 0
        print("FOUT: index.html is verouderd — draai `python build.py` en commit het resultaat.", file=sys.stderr)
        return 1

    html = build(args.env)
    out = args.out or os.path.join(ROOT, "index.html")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print("gebouwd (%s): %s (%d bytes)" % (args.env, out, len(html)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
