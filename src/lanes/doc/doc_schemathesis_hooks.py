"""Schemathesis hook for P5-DOC-PN-3 (doc-serial; D-DOC-B34, the same pattern as tw D-TW-B25).

The owner's session cookie is read from the P5_DOC_FUZZ_COOKIE environment variable and added to every generated
request. It is never on the command line, so it cannot appear in a process list or in a logged command.
"""

import os

import schemathesis


@schemathesis.hook
def before_call(context, case, kwargs):
    cookie = os.environ.get("P5_DOC_FUZZ_COOKIE", "")
    if cookie:
        headers = dict(case.headers or {})
        headers["Cookie"] = cookie
        case.headers = headers
