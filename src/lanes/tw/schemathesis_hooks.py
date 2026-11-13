"""Schemathesis hook for P5-TW-FUZZ-001 (tw-serial).

The bearer is read from the P5_TW_FUZZ_BEARER environment variable, never from argv, so it cannot appear
in a process list or in a logged command line. The OpenAPI document is loaded by the spec from a local
file (the core document needs the key to load).
"""

import os

import schemathesis


@schemathesis.hook
def before_call(context, case, kwargs):
    token = os.environ.get("P5_TW_FUZZ_BEARER", "")
    if token:
        headers = dict(case.headers or {})
        headers["Authorization"] = f"Bearer {token}"
        case.headers = headers
