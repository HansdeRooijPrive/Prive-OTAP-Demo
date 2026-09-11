"""Smoke-tests in de browser: OTAP-straat laadt, poorten werken, opslag per omgeving."""


def _snel(page):
    page.evaluate("() => window.__app.tempo(5)")


def test_app_laadt(page):
    assert page.locator("h1").inner_text().strip() != ""
    assert page.locator("#env-badge").inner_text() == ""       # prod: geen omgevingsbadge
    assert page.locator(".lane").count() == 4
    namen = page.locator(".lane h2").all_inner_texts()
    assert namen == ["Ontwikkeling", "Test", "Acceptatie", "Productie"]


def test_prod_opslagsleutel(page):
    key = page.evaluate("() => window.__app.key")
    assert key and ".test" not in key and ".acc" not in key


def test_promotie_o_naar_t_en_opslag(page):
    _snel(page)
    v = page.evaluate("() => window.__app.huidig('O')")
    page.click('button[data-a="promote"][data-k="O"]')
    page.wait_for_function("v => window.__app.huidig('T') === v && !window.__app.bezig()", arg=v)
    bewaard = page.evaluate("() => JSON.parse(localStorage.getItem(window.__app.key)).envs.T.hist")
    assert bewaard[-1] == v


def test_regressietest_opent_poort_naar_acceptatie(page):
    _snel(page)
    knop = page.locator('button[data-a="promote"][data-k="T"]')
    assert knop.is_disabled()
    page.click('button[data-a="reg"]')
    page.wait_for_function("() => window.__app.staat().gates.T.reg === 'pass'")
    assert knop.is_enabled()


def test_productiepoort_vraagt_akkoord_goedkeuring_en_venster(page):
    knop = page.locator('button[data-a="promote"][data-k="A"]')
    assert knop.is_disabled()
    page.click('button[data-a="uat"]')
    page.click('button[data-a="cab"]')
    assert knop.is_disabled()                                  # nog buiten het wijzigingsvenster
    page.click('button[data-a="win"]')
    assert knop.is_enabled()
    page.click('button[data-a="freeze"]')
    assert knop.is_disabled()                                  # freeze blokkeert productie


def test_falende_rooktest_laat_productie_ongemoeid(page):
    _snel(page)
    oud = page.evaluate("() => window.__app.huidig('P')")
    for actie in ("uat", "cab", "win", "fail"):
        page.click('button[data-a="%s"]' % actie)
    page.click('button[data-a="promote"][data-k="A"]')
    page.wait_for_function("() => window.__app.staat().envs.P.status === 'failed' && !window.__app.bezig()")
    assert page.evaluate("() => window.__app.huidig('P')") == oud


def test_terugdraaien_productie(page):
    _snel(page)
    vorige = page.evaluate("() => window.__app.staat().envs.P.hist.slice(-2)[0]")
    page.click('button[data-a="rollback"]')
    page.wait_for_function("v => window.__app.huidig('P') === v && !window.__app.bezig()", arg=vorige)
