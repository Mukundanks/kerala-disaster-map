#!/usr/bin/env python3
"""
Scrapes KSDMA's hazard-maps page (https://sdma.kerala.gov.in/hazard-maps/)
and lists every file it offers for download, grouped by the table row it
sits in. Optionally checks each file's HTTP headers (size, ETag,
Last-Modified) and compares against a previous run, so you can tell when
KSDMA has published something new or replaced a file.

It only reads the page and file headers - it never downloads the files
themselves, and never touches the repo or git.

The page is one WordPress table: the left cell of each row describes a
dataset, the right cell holds its links. KSDMA usually publishes an
update as a *new* URL (WordPress files uploads under /YYYY/MM/), so files
are matched to the datasets our scripts use by row + filename pattern,
not by a fixed URL list.

Requires: requests, beautifulsoup4 (uses Python's built-in html.parser,
no lxml).

Usage:
    python scripts/scrape_ksdma.py                        # list what's on the page
    python scripts/scrape_ksdma.py --head                 # + size/ETag/date of every file
    python scripts/scrape_ksdma.py --head --out snap.json # save the result
    python scripts/scrape_ksdma.py --head --compare snap.json --out snap.json
                                                          # what changed since last time
    python scripts/scrape_ksdma.py --html saved-page.html # parse a saved copy, no network

Exit codes:
    0  ok (and, with --compare, nothing changed)
    1  error (network, TLS, oversized response, bad arguments)
    2  the page no longer looks the way we expect (redesign?) - check by hand
    3  ok, and --compare found changes
"""

import argparse
import json
import os
import posixpath
import re
import sys
import tempfile
import time
from datetime import datetime, timezone
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup

HOST = "sdma.kerala.gov.in"
PAGE_URL = f"https://{HOST}/hazard-maps/"
# WordPress REST API entry for the same page - gives its last-edited time.
PAGE_API_URL = f"https://{HOST}/wp-json/wp/v2/pages/12654?_fields=modified_gmt"
UPLOADS_PREFIX = "/wp-content/uploads/"

USER_AGENT = "kerala-disaster-map-bot (+https://github.com/Mukundanks/kerala-disaster-map)"
TIMEOUT = (10, 30)                # (connect, read) seconds
MAX_PAGE_BYTES = 5 * 1024 * 1024  # the page is ~115 KB today
MAX_REDIRECTS = 3
HEAD_DELAY_S = 0.3                # be polite between file header requests

SAFE_FILENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$")

# The datasets our processing scripts actually consume. `row` is matched
# against the row's description, `file` against each link's filename.
# `expect` is how many files we expect - a different count means the
# page changed in a way a human should look at.
DATASETS = [
    {
        "id": "landslide-shapefiles",
        "row": re.compile(r"Landslide Susceptibility zones .*Shape ?files", re.I),
        "file": re.compile(r"\.zip$", re.I),
        "expect": 13,
        "used_by": ["scripts/process_landslides.py", "scripts/process_landslide_coverage.py"],
    },
    {
        "id": "flood-historical-rasters",
        "row": re.compile(r"based on Historic Data \(Raster", re.I),
        "file": re.compile(r"Historical.*\.zip$", re.I),
        "expect": 2,
        "used_by": ["scripts/process_floods.py"],
    },
]


class PageError(Exception):
    """The page was fetched but doesn't have the structure we expect."""


# ---------------------------------------------------------------- HTTP

def make_session():
    s = requests.Session()
    # Ignore proxy env vars and ~/.netrc - nothing from the environment
    # should change where we connect or what credentials get sent.
    s.trust_env = False
    s.headers["User-Agent"] = USER_AGENT
    return s


def normalize_url(href, base=PAGE_URL):
    """Absolute https URL on KSDMA's host, or None if it points elsewhere."""
    parts = urlsplit(urljoin(base, href.strip()))
    host = (parts.hostname or "").lower()
    if host != HOST or parts.scheme not in ("http", "https"):
        return None
    if parts.port not in (None, 80, 443) or parts.username or parts.password:
        return None
    # The page links some files as http://; the server 301s them to https.
    return urlunsplit(("https", HOST, parts.path, parts.query, ""))


def request(session, method, url):
    """Send a request, following at most MAX_REDIRECTS redirects, and
    only ones that stay on https://sdma.kerala.gov.in. TLS is always
    verified (requests' default; never turned off here)."""
    for _ in range(MAX_REDIRECTS + 1):
        resp = session.request(method, url, allow_redirects=False, timeout=TIMEOUT, stream=True)
        if resp.status_code not in (301, 302, 303, 307, 308):
            return resp, url
        location = resp.headers.get("Location", "")
        resp.close()
        nxt = normalize_url(location, base=url)
        if nxt is None:
            raise requests.RequestException(f"refusing redirect off {HOST}: {url} -> {location!r}")
        url = nxt
    raise requests.RequestException(f"too many redirects starting from {url}")


def read_capped(resp, limit):
    declared = resp.headers.get("Content-Length")
    if declared and declared.isdigit() and int(declared) > limit:
        raise requests.RequestException(f"response too large ({declared} bytes > {limit})")
    chunks, total = [], 0
    for chunk in resp.iter_content(64 * 1024):
        total += len(chunk)
        if total > limit:
            raise requests.RequestException(f"response too large (> {limit} bytes)")
        chunks.append(chunk)
    return b"".join(chunks)


def fetch_page(session):
    resp, final_url = request(session, "GET", PAGE_URL)
    with resp:
        resp.raise_for_status()
        ctype = resp.headers.get("Content-Type", "")
        if not ctype.startswith("text/html"):
            raise requests.RequestException(f"page has unexpected Content-Type {ctype!r}")
        body = read_capped(resp, MAX_PAGE_BYTES)
    return body.decode(resp.encoding or "utf-8", errors="replace"), final_url


def fetch_page_modified(session):
    """The page's last-edited time from WordPress, or None. Best effort."""
    try:
        resp, _ = request(session, "GET", PAGE_API_URL)
        with resp:
            if resp.status_code != 200:
                return None
            data = json.loads(read_capped(resp, 64 * 1024))
        value = data.get("modified_gmt")
        return value if isinstance(value, str) and len(value) <= 40 else None
    except (requests.RequestException, ValueError):
        return None


def fetch_headers(session, url):
    """Size / ETag / Last-Modified for one file, without downloading it."""
    try:
        resp, final_url = request(session, "HEAD", url)
        if resp.status_code in (403, 405, 501):
            # HEAD not allowed: GET instead, but only read the headers
            # (stream=True, and the body is never touched before close).
            resp.close()
            resp, final_url = request(session, "GET", url)
        with resp:
            h = resp.headers
            size = h.get("Content-Length")
            return {
                "status": resp.status_code,
                "final_url": final_url if final_url != url else None,
                "size": int(size) if size and size.isdigit() else None,
                "etag": h.get("ETag"),
                "last_modified": h.get("Last-Modified"),
                "content_type": h.get("Content-Type"),
            }
    except requests.RequestException as e:
        return {"status": None, "error": str(e)[:300]}


# ------------------------------------------------------------- parsing

def clean_text(node):
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


def parse_page(html):
    soup = BeautifulSoup(html, "html.parser")
    content = soup.select_one("article .entry-content") or soup.select_one(".entry-content")
    if content is None:
        raise PageError("no .entry-content block found")
    rows_html = content.select("table tr")
    if not rows_html:
        raise PageError("no table rows found in the page content")

    rows, external = [], []
    for i, tr in enumerate(rows_html):
        cells = tr.find_all(["td", "th"], recursive=False)
        if not cells:
            continue
        title = clean_text(cells[0])[:500]
        files, seen = [], set()
        for a in tr.find_all("a", href=True):
            url = normalize_url(a["href"])
            if url is None:
                external.append({"row": i, "href": a["href"][:500], "text": clean_text(a)[:200]})
                continue
            if url in seen:
                continue
            seen.add(url)
            path = urlsplit(url).path
            decoded = unquote(path)
            name = posixpath.basename(decoded)
            # Encoded slashes or ".." anywhere in the path = not a plain file link.
            tricky = "%2f" in path.lower() or "%5c" in path.lower() or ".." in decoded.split("/")
            files.append({
                "url": url,
                "text": clean_text(a)[:200],
                "filename": name,
                "safe_filename": bool(SAFE_FILENAME.match(name)) and not tricky,
                "is_upload": path.startswith(UPLOADS_PREFIX),
            })
        images = sorted({
            u for u in (normalize_url(img.get("src", "")) for img in tr.find_all("img")) if u
        })
        rows.append({"index": i, "title": title, "files": files, "images": images})
    return rows, external


def match_datasets(rows):
    """Tag files that belong to a dataset we process. Returns problems."""
    problems = []
    for ds in DATASETS:
        matched = []
        for row in rows:
            if not ds["row"].search(row["title"]):
                continue
            for f in row["files"]:
                if f["is_upload"] and ds["file"].search(f["filename"]):
                    f["dataset"] = ds["id"]
                    matched.append(f)
        if len(matched) != ds["expect"]:
            problems.append(f"{ds['id']}: expected {ds['expect']} files, found {len(matched)}")
        for f in matched:
            if not f["safe_filename"]:
                problems.append(f"{ds['id']}: unexpected characters in filename {f['filename']!r}")
    return problems


# ---------------------------------------------------------- comparison

def all_files(snapshot):
    return {f["url"]: f for row in snapshot["rows"] for f in row["files"]}


def compare(old, new):
    """Human-readable list of differences between two snapshots."""
    changes = []
    old_files, new_files = all_files(old), all_files(new)
    for url in sorted(new_files.keys() - old_files.keys()):
        f = new_files[url]
        changes.append(f"NEW FILE      [{f.get('dataset', '-')}] {f['text']!r} {url}")
    for url in sorted(old_files.keys() - new_files.keys()):
        f = old_files[url]
        changes.append(f"REMOVED FILE  [{f.get('dataset', '-')}] {f['text']!r} {url}")
    for url in sorted(new_files.keys() & old_files.keys()):
        a, b = old_files[url].get("headers") or {}, new_files[url].get("headers") or {}
        if not a or not b or a.get("status") is None or b.get("status") is None:
            continue  # need headers from both runs to say anything
        diffs = [k for k in ("size", "etag", "last_modified") if a.get(k) != b.get(k)]
        if diffs:
            detail = ", ".join(f"{k}: {a.get(k)} -> {b.get(k)}" for k in diffs)
            changes.append(f"CHANGED FILE  [{new_files[url].get('dataset', '-')}] {url} ({detail})")
    old_titles = [r["title"] for r in old["rows"]]
    new_titles = [r["title"] for r in new["rows"]]
    for t in new_titles:
        if t not in old_titles:
            changes.append(f"NEW ROW       {t[:120]!r}")
    for t in old_titles:
        if t not in new_titles:
            changes.append(f"REMOVED ROW   {t[:120]!r}")
    return changes


# ------------------------------------------------------------- output

def write_json_atomic(path, data):
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(prefix=".scrape-", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, sort_keys=True)
            f.write("\n")
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


def print_summary(snapshot, problems):
    rows = snapshot["rows"]
    n_files = sum(len(r["files"]) for r in rows)
    print(f"{snapshot['page_url']}  (page last edited: {snapshot.get('page_modified_gmt') or 'unknown'})")
    print(f"{len(rows)} rows, {n_files} linked files, {len(snapshot['external_links'])} links to other sites\n")
    for r in rows:
        print(f"[{r['index']:2}] {r['title'][:100]}")
        if not r["files"]:
            print("       (no download links)")
        for f in r["files"]:
            h = f.get("headers") or {}
            if h.get("status") is None and "error" in h:
                info = f"  ERROR {h['error'][:60]}"
            elif h:
                size = f"{h['size'] / 1e6:.1f} MB" if h.get("size") is not None else "? MB"
                info = f"  {h.get('status')} {size:>9}  {h.get('last_modified') or ''}"
            else:
                info = ""
            tag = f"<{f['dataset']}> " if "dataset" in f else ""
            print(f"       {tag}{f['filename']}{info}")
    print()
    for p in problems:
        print(f"PROBLEM: {p}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--head", action="store_true", help="also fetch size/ETag/Last-Modified of every file")
    ap.add_argument("--out", help="write the result as JSON to this file")
    ap.add_argument("--compare", help="previous JSON result to compare against")
    ap.add_argument("--html", help="parse this saved copy of the page instead of fetching it")
    ap.add_argument("--quiet", action="store_true", help="only print problems and changes")
    args = ap.parse_args()

    if args.html and args.head:
        ap.error("--html is offline; don't combine it with --head")

    old = None
    if args.compare:
        try:
            with open(args.compare, encoding="utf-8") as f:
                old = json.load(f)
        except FileNotFoundError:
            print(f"(no previous result at {args.compare} - nothing to compare yet)")
        except (OSError, ValueError) as e:
            print(f"ERROR: can't read {args.compare}: {e}", file=sys.stderr)
            return 1

    session = make_session()
    try:
        if args.html:
            with open(args.html, encoding="utf-8") as f:
                html, final_url, modified = f.read(), PAGE_URL, None
        else:
            html, final_url = fetch_page(session)
            modified = fetch_page_modified(session)
        rows, external = parse_page(html)
    except PageError as e:
        print(f"PAGE STRUCTURE PROBLEM: {e}", file=sys.stderr)
        return 2
    except (requests.RequestException, OSError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    problems = match_datasets(rows)
    if not any(r["files"] for r in rows):
        problems.append("zero download links found on the page")

    if args.head:
        for row in rows:
            for f in row["files"]:
                if f["is_upload"]:
                    f["headers"] = fetch_headers(session, f["url"])
                    time.sleep(HEAD_DELAY_S)
        for row in rows:
            for f in row["files"]:
                h = f.get("headers") or {}
                if "dataset" in f and h.get("status") != 200:
                    problems.append(f"{f['dataset']}: {f['url']} returned {h.get('status') or h.get('error')}")

    snapshot = {
        "schema": 1,
        "checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "page_url": final_url,
        "page_modified_gmt": modified,
        "datasets": {ds["id"]: {"expect": ds["expect"], "used_by": ds["used_by"]} for ds in DATASETS},
        "rows": rows,
        "external_links": external,
        "problems": problems,
    }

    if not args.quiet:
        print_summary(snapshot, problems)
    elif problems:
        for p in problems:
            print(f"PROBLEM: {p}")

    changes = compare(old, snapshot) if old else []
    if old is not None:
        print(f"\n{len(changes)} change(s) since {old.get('checked_at', 'previous run')}:")
        for c in changes:
            print(f"  {c}")

    if args.out:
        write_json_atomic(args.out, snapshot)

    if problems:
        return 2
    return 3 if changes else 0


if __name__ == "__main__":
    sys.exit(main())
