#!/usr/bin/env python3
"""
Read PostgreSQL/psql-style SELECT output from stdin or a file and bulk-index rows
into Elasticsearch.

Default index and fields match the dev stack's username search index (`usernames`:
user_id as keyword + document _id, username as text).

Example:

    psql ... -c "SELECT username, user_id FROM ..." | \\
      ELASTICSEARCH_URI=http://localhost:9200 ./sql_output_to_elasticsearch.py

Environment:
  ELASTICSEARCH_URI   Base URL (default: http://localhost:9200)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import IO


def is_separator_line(line: str) -> bool:
    """Match psql dashed separator rows like '----------+---'."""
    if "|" not in line:
        return False
    return all(c in "-+| \t" for c in line)


def parse_psql_table(lines: list[str]) -> tuple[list[str], list[dict[str, str]]]:
    """
    Parse header + data rows from psql text table output.
    Returns (column_names, rows_as_dicts).
    """
    header: list[str] | None = None
    rows: list[dict[str, str]] = []

    for raw in lines:
        line = raw.rstrip("\n")
        if not line.strip():
            continue
        if "|" not in line:
            continue
        if is_separator_line(line):
            continue

        cells = [c.strip() for c in line.split("|")]
        if header is None:
            header = cells
            continue

        if len(cells) != len(header):
            raise ValueError(
                f"Column count mismatch: header has {len(header)} columns, "
                f"row has {len(cells)}: {line!r}"
            )
        rows.append(dict(zip(header, cells)))

    if not header:
        raise ValueError("No table header with '|' column separators found in input.")

    return header, rows


def ndjson_bulk_body(index: str, rows: list[dict[str, str]], id_field: str) -> str:
    parts: list[str] = []
    for row in rows:
        if id_field not in row:
            raise KeyError(f"Row missing id field {id_field!r}: {row!r}")
        doc_id = row[id_field]
        if not doc_id:
            raise ValueError(f"Empty {id_field!r} in row: {row!r}")
        action = {"index": {"_index": index, "_id": doc_id}}
        parts.append(json.dumps(action, separators=(",", ":")))
        parts.append(json.dumps(row, separators=(",", ":")))
    return "\n".join(parts) + "\n"


def post_bulk(es_url: str, body: str) -> None:
    url = f"{es_url.rstrip('/')}/_bulk"
    req = urllib.request.Request(
        url,
        data=body.encode("utf-8"),
        headers={"Content-Type": "application/x-ndjson"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"Elasticsearch HTTP {e.code}: {err_body}", file=sys.stderr)
        raise SystemExit(1) from e
    except OSError as e:
        print(f"Request failed: {e}", file=sys.stderr)
        raise SystemExit(1) from e

    if payload.get("errors"):
        for item in payload.get("items", []):
            op = item.get("index") or item.get("create") or {}
            if op.get("error"):
                print(json.dumps(op["error"], indent=2), file=sys.stderr)
        raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bulk-index psql-style table output into Elasticsearch."
    )
    parser.add_argument(
        "file",
        nargs="?",
        type=argparse.FileType("r", encoding="utf-8"),
        default=sys.stdin,
        help="File containing SELECT output (default: stdin)",
    )
    parser.add_argument(
        "--index",
        default="usernames",
        help='Elasticsearch index name (default: "usernames")',
    )
    parser.add_argument(
        "--id-field",
        default="user_id",
        help='Row field to use as document _id (default: "user_id")',
    )
    parser.add_argument(
        "--es-url",
        default=os.environ.get("ELASTICSEARCH_URI", "http://localhost:9200"),
        help="Elasticsearch base URL (default: ELASTICSEARCH_URI or http://localhost:9200)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print NDJSON bulk body to stdout instead of sending to Elasticsearch",
    )
    args = parser.parse_args()
    infile: IO[str] = args.file

    try:
        lines = infile.readlines()
    except OSError as e:
        print(f"Failed to read input: {e}", file=sys.stderr)
        raise SystemExit(1) from e
    finally:
        if infile is not sys.stdin:
            infile.close()

    try:
        _header, rows = parse_psql_table(lines)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(1) from e

    if not rows:
        print("No data rows found.", file=sys.stderr)
        raise SystemExit(1)

    body = ndjson_bulk_body(args.index, rows, args.id_field)

    if args.dry_run:
        sys.stdout.write(body)
        return

    post_bulk(args.es_url, body)
    print(f"Indexed {len(rows)} document(s) into {args.index!r}.")


if __name__ == "__main__":
    main()
