"""Smoke-test in de browser: app laadt, teller werkt, prod-opslagsleutel."""


def test_app_laadt(page):
    assert page.locator("h1").inner_text().strip() != ""
    assert page.locator("#env-badge").inner_text() == ""       # prod: geen omgevingsbadge


def test_teller_telt_en_bewaart(page):
    start = page.evaluate("() => window.__app.lees()")
    page.click("#tik")
    assert page.evaluate("() => window.__app.lees()") == start + 1
    assert page.locator("#teller").inner_text() == str(start + 1)


def test_prod_opslagsleutel(page):
    key = page.evaluate("() => window.__app.key")
    assert key and ".test" not in key and ".acc" not in key
