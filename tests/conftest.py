"""Fixtures: bouw de app, serveer over localhost, start headless Chromium."""
import functools
import http.server
import os
import socketserver
import subprocess
import sys
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable


@pytest.fixture(scope="session")
def base_url():
    subprocess.run([PY, "build.py"], cwd=ROOT, check=True)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield "http://127.0.0.1:%d" % httpd.server_address[1]
    httpd.shutdown()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture
def page(browser, base_url):
    ctx = browser.new_context()
    pg = ctx.new_page()
    pg.goto(base_url + "/index.html")
    pg.wait_for_function("window.__app !== undefined")
    yield pg
    ctx.close()
