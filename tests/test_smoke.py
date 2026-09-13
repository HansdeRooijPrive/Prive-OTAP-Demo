"""Smoke-tests in de browser: Oefenstraat (simulatie) laadt, poorten werken, opslag per omgeving."""
import pytest


@pytest.fixture
def sim(browser, base_url):
    """Pagina direct op de Oefenstraat; GitHub wordt geblokkeerd zodat de tests offline en stabiel zijn."""
    ctx = browser.new_context()
    ctx.route("https://api.github.com/**", lambda route: route.abort())
    pg = ctx.new_page()
    pg.goto(base_url + "/index.html#app=oefen")
    pg.wait_for_function("window.__app !== undefined")
    yield pg
    ctx.close()


def _snel(page):
    page.evaluate("() => window.__app.tempo(5)")


def test_app_laadt(sim):
    assert sim.locator("h1").inner_text().strip() != ""
    assert sim.locator("#env-badge").inner_text() == ""        # prod: geen omgevingsbadge
    assert sim.locator("#view-sim").is_visible()
    assert sim.locator("#lanes .lane").count() == 4
    namen = sim.locator("#lanes .lane h2").all_inner_texts()
    assert namen == ["Ontwikkeling", "Test", "Acceptatie", "Productie"]


def test_prod_opslagsleutel(sim):
    key = sim.evaluate("() => window.__app.key")
    assert key and ".test" not in key and ".acc" not in key


def test_promotie_o_naar_t_en_opslag(sim):
    _snel(sim)
    v = sim.evaluate("() => window.__app.huidig('O')")
    sim.click('button[data-a="promote"][data-k="O"]')
    sim.wait_for_function("v => window.__app.huidig('T') === v && !window.__app.bezig()", arg=v)
    bewaard = sim.evaluate("() => JSON.parse(localStorage.getItem(window.__app.key)).envs.T.hist")
    assert bewaard[-1] == v


def test_regressietest_opent_poort_naar_acceptatie(sim):
    _snel(sim)
    knop = sim.locator('button[data-a="promote"][data-k="T"]')
    assert knop.is_disabled()
    sim.click('button[data-a="reg"]')
    sim.wait_for_function("() => window.__app.staat().gates.T.reg === 'pass'")
    assert knop.is_enabled()


def test_productiepoort_vraagt_akkoord_goedkeuring_en_venster(sim):
    knop = sim.locator('button[data-a="promote"][data-k="A"]')
    assert knop.is_disabled()
    sim.click('button[data-a="uat"]')
    sim.click('button[data-a="cab"]')
    assert knop.is_disabled()                                  # nog buiten het wijzigingsvenster
    sim.click('button[data-a="win"]')
    assert knop.is_enabled()
    sim.click('button[data-a="freeze"]')
    assert knop.is_disabled()                                  # freeze blokkeert productie


def test_falende_rooktest_laat_productie_ongemoeid(sim):
    _snel(sim)
    oud = sim.evaluate("() => window.__app.huidig('P')")
    for actie in ("uat", "cab", "win", "fail"):
        sim.click('button[data-a="%s"]' % actie)
    sim.click('button[data-a="promote"][data-k="A"]')
    sim.wait_for_function("() => window.__app.staat().envs.P.status === 'failed' && !window.__app.bezig()")
    assert sim.evaluate("() => window.__app.huidig('P')") == oud


def test_terugdraaien_productie(sim):
    _snel(sim)
    vorige = sim.evaluate("() => window.__app.staat().envs.P.hist.slice(-2)[0]")
    sim.click('button[data-a="rollback"]')
    sim.wait_for_function("v => window.__app.huidig('P') === v && !window.__app.bezig()", arg=vorige)
