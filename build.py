#!/usr/bin/env python3
"""
Env-bewuste build: voegt src/ samen tot één self-contained index.html en vult
per omgeving (prod/acc/test) de thema-kleur en de opslagsleutels in vanuit
app.json. Geen Node/npm nodig.

    python build.py                 -> productie-build naar index.html
    python build.py --env=test      -> testvariant (andere kleur + opslagsleutel)
    python build.py --env=acc --out ../dist/acceptatie/index.html
    python build.py --check         -> faalt als index.html != productie-build
"""
import argparse
import glob
import json
import os
import sys
import urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
ENVS = ("prod", "acc", "test")
SUFFIX = {"prod": "", "acc": ".acc", "test": ".test"}
LABEL = {"prod": "", "acc": "ACCEPTATIE", "test": "TEST"}


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
    repl = {
        "{{APP_NAME}}": naam,
        "{{APP_NAME_URL}}": urllib.parse.quote(naam),
        "{{APP_SHORT}}": cfg.get("short_name", naam),
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
