#!/usr/bin/env python3
"""Local development server with same-origin API proxies for CORS-blocked data."""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DEFAULT_PORT = 8080
REMOTE_TIMEOUT = 10
USER_AGENT = "hk-dashboard-dev-server/1.0"

FX_URL = "https://api.frankfurter.dev/v1/latest?base=HKD&symbols=USD,CNY,GBP,JPY,EUR"
HSI_URL = "https://stooq.com/q/l/?s=%5Ehsi&i=d"
HOLIDAYS_URL = "https://www.1823.gov.hk/common/ical/tc.json"

_CACHE: dict[str, tuple[float, Any]] = {}


def fetch_remote(url: str, expect_json: bool = True) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=REMOTE_TIMEOUT) as resp:
        body = resp.read()
    if expect_json:
        return json.loads(body.decode("utf-8"))
    return body.decode("utf-8", errors="replace")


def cached_fetch(key: str, ttl: int, loader: Callable[[], Any]) -> Any:
    now = time.time()
    cached = _CACHE.get(key)
    if cached and now - cached[0] < ttl:
        return cached[1]

    try:
        value = loader()
    except Exception:
        if cached:
            return cached[1]
        raise

    _CACHE[key] = (now, value)
    return value


def parse_stooq_hsi(csv_text: str) -> dict[str, Any]:
    line = csv_text.strip().splitlines()[0]
    parts = line.split(",")
    if len(parts) < 7:
        raise ValueError("Invalid HSI CSV payload")

    close = float(parts[6])
    open_price = float(parts[3])
    high = float(parts[4])
    low = float(parts[5])
    date_raw = parts[1]
    time_raw = parts[2]

    date_text = ""
    time_text = ""
    if len(date_raw) == 8:
        date_text = f"{date_raw[0:4]}-{date_raw[4:6]}-{date_raw[6:8]}"
    if len(time_raw) == 6:
        time_text = f"{time_raw[0:2]}:{time_raw[2:4]}:{time_raw[4:6]}"

    return {
        "meta": {
          "regularMarketPrice": close,
          "regularMarketTimeText": " ".join(part for part in [date_text, time_text] if part),
        },
        "session": {
          "open": open_price,
          "high": high,
          "low": low,
        },
        "sourceLabel": "Stooq 本地代理",
    }


class DevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stdout.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), fmt % args))

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path

        if path == "/api/finance/fx":
            self._write_json(
                lambda: cached_fetch("finance_fx", 300, lambda: fetch_remote(FX_URL, expect_json=True))
            )
            return

        if path == "/api/finance/hsi":
            self._write_json(
                lambda: cached_fetch("finance_hsi", 60, lambda: parse_stooq_hsi(fetch_remote(HSI_URL, expect_json=False)))
            )
            return

        if path == "/api/holidays":
            self._write_json(
                lambda: cached_fetch("holidays", 3600, lambda: fetch_remote(HOLIDAYS_URL, expect_json=True))
            )
            return

        super().do_GET()

    def _write_json(self, loader: Callable[[], Any]) -> None:
        try:
            payload = loader()
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except urllib.error.HTTPError as exc:
            self._write_error(502, f"Upstream HTTP {exc.code}")
        except Exception as exc:
            self._write_error(502, str(exc))

    def _write_error(self, status: int, message: str) -> None:
        body = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        port = int(sys.argv[1])

    server = ThreadingHTTPServer(("0.0.0.0", port), DevHandler)
    print(f"Serving HK Dashboard dev server on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
