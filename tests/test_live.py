"""Live overzicht: app-kiezer en OTAP-stand uit GitHub, met een nagebootste GitHub-API (geen netwerk)."""
import json

import pytest

REPO = "HansdeRooijPrive/Ventus-KM-Declaratie"
HDRS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "X-RateLimit-Remaining, X-RateLimit-Limit, X-RateLimit-Reset",
    "X-RateLimit-Remaining": "57",
    "X-RateLimit-Limit": "60",
    "X-RateLimit-Reset": "1790000000",
}


def _commit(sha, msg, datum):
    return {"sha": sha, "html_url": "https://github.com/%s/commit/%s" % (REPO, sha),
            "commit": {"message": msg, "author": {"name": "Hans", "date": datum}}}


def _run(i, naam, branch, sha, datum, conclusion="success", status="completed"):
    return {"id": i, "name": naam, "head_branch": branch, "head_sha": sha, "status": status,
            "conclusion": conclusion, "created_at": datum, "html_url": "https://github.com/%s/actions/runs/%d" % (REPO, i)}


DEV = [
    _commit("d3" * 20, "v3.22: nieuwe exportknop", "2026-09-13T08:00:00Z"),
    _commit("d2" * 20, "v3.21: groen app-icoon voor test", "2026-09-12T09:30:00Z"),
    _commit("d1" * 20, "v3.20: App installeren-knop", "2026-09-11T10:00:00Z"),
]
MAIN = [_commit("m1" * 20, "Release naar productie: v3.9 + v3.20 + v3.21", "2026-09-12T09:42:00Z"), DEV[1], DEV[2]]
RUNS = [
    _run(4, "Deploy to Test", "development", DEV[0]["sha"], "2026-09-13T08:01:00Z"),
    _run(3, "Tests", "development", DEV[0]["sha"], "2026-09-13T08:01:00Z", conclusion="failure"),
    _run(2, "Deploy to Production", "main", MAIN[0]["sha"], "2026-09-12T09:43:00Z"),
    _run(1, "Tests", "main", MAIN[0]["sha"], "2026-09-12T09:43:00Z"),
]


def _nep_github(route):
    url = route.request.url
    if "/repos/%s/branches" % REPO in url:
        body = [{"name": "development"}, {"name": "main"}]
    elif "/repos/%s/actions/runs" % REPO in url:
        body = {"total_count": len(RUNS), "workflow_runs": RUNS}
    elif "/repos/%s/commits" % REPO in url:
        body = MAIN if "sha=main" in url else DEV
    else:
        route.fulfill(status=404, headers=HDRS, content_type="application/json", body='{"message":"Not Found"}')
        return
    route.fulfill(status=200, headers=HDRS, content_type="application/json", body=json.dumps(body))


@pytest.fixture
def live(browser, base_url):
    ctx = browser.new_context()
    ctx.route("https://api.github.com/**", _nep_github)
    pg = ctx.new_page()
    pg.goto(base_url + "/index.html#app=" + REPO)
    pg.wait_for_function("window.__app !== undefined")
    yield pg
    ctx.close()


def _lane(page, k):
    return page.locator('#live-lanes .lane[data-env="%s"]' % k)


def test_live_straat_toont_stand_uit_github(live):
    live.wait_for_selector('#live-lanes .lane[data-env="P"] .ver-txt')
    assert _lane(live, "T").locator(".ver-txt").inner_text() == "v3.22"
    assert _lane(live, "P").locator(".ver-txt").inner_text() == "v3.21"
    assert "Niet ingericht" in _lane(live, "A").inner_text()          # geen branch acceptatie
    assert "CI rood" in _lane(live, "O").inner_text()                 # Tests faalden op development
    assert "1 commit klaar voor Productie" in _lane(live, "T").inner_text()
    assert live.locator("#live-commits tr").count() == 3


def test_kiezer_wisselt_naar_oefenstraat_en_onthoudt_keuze(live):
    live.wait_for_selector('#live-lanes .lane[data-env="P"] .ver-txt')
    live.select_option("#app-kies", "oefen")
    assert live.locator("#view-sim").is_visible()
    assert live.locator("#view-live").is_hidden()
    assert live.evaluate("() => location.hash") == "#app=oefen"
    keuze = live.evaluate("() => JSON.parse(localStorage.getItem(window.__app.key + '.dashboard')).app")
    assert keuze == "oefen"


def test_app_toevoegen_met_onbekende_repo_geeft_duidelijke_fout(live):
    live.click('button[data-l="toevoegen"]')
    live.fill("#toevoeg-repo", "HansdeRooijPrive/Bestaat-Niet")
    live.click('#toevoeg-form button[type="submit"]')
    live.wait_for_selector("#live-status .fout")
    assert "niet gevonden" in live.locator("#live-status").inner_text()
    assert live.locator('#app-kies option[value="HansdeRooijPrive/Bestaat-Niet"]').count() == 1


def test_app_toevoegen_controleert_invoer(live):
    live.click('button[data-l="toevoegen"]')
    live.fill("#toevoeg-repo", "geen geldige repo")
    live.click('#toevoeg-form button[type="submit"]')
    assert "eigenaar/repo" in live.locator("#toevoeg-fout").inner_text()
