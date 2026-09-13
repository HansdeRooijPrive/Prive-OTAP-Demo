"""Build- en omgevingsisolatie-tests (pure Python, geen browser)."""
import base64
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import build  # noqa: E402


def test_build_check_slaagt():
    assert subprocess.run([sys.executable, "build.py", "--check"], cwd=ROOT).returncode == 0


def test_opslag_isolatie_per_omgeving():
    key = build._config()["storage_key"]
    prod, acc, test = build.build("prod"), build.build("acc"), build.build("test")
    assert ("'" + key + "'") in prod          # prod: kale sleutel
    assert (key + ".acc") in acc              # acceptatie: eigen sleutel
    assert (key + ".test") in test            # test: eigen sleutel
    assert (key + ".test") not in prod        # prod deelt geen testsleutel
    assert (key + ".acc") not in prod


def test_thema_verschilt_per_omgeving():
    assert build.build("prod") != build.build("test")   # andere kleur + env-badge


def _icoon(html):
    iconen = re.findall(r'<link rel="(?:apple-touch-icon|icon)" href="data:image/png;base64,([A-Za-z0-9+/=]+)">', html)
    assert len(iconen) == 2 and iconen[0] == iconen[1]
    return iconen[0]


def test_icoon_verschilt_per_omgeving():
    """Op je beginscherm moet je de omgevingen uit elkaar kunnen houden."""
    iconen = [_icoon(build.build(env)) for env in ("prod", "acc", "test")]
    assert len(set(iconen)) == 3
    for i in iconen:
        assert base64.b64decode(i).startswith(b"\x89PNG")


def test_naam_onder_icoon_verschilt_per_omgeving():
    """Het bijschrift onder het icoon: 'Demo', 'Demo acc', 'Demo test'."""
    kort = build._config().get("short_name", build._config()["name"])
    assert 'content="%s"' % kort in build.build("prod")
    assert 'content="%s acc"' % kort in build.build("acc")
    assert 'content="%s test"' % kort in build.build("test")
    # ook in het manifest, want daar leest Android de naam uit
    assert "%20acc" in build.build("acc")
    assert "%20test" in build.build("test")
