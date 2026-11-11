"""Schemathesis hook for P5-DOC-PN-3 (doc-serial; D-DOC-B34, D-DOC-B63).

The owner's session cookie is read from the P5_DOC_FUZZ_COOKIE environment variable and added to every generated
request. It is never on the command line, so it cannot appear in a process list or in a logged command.

Generated requests that omitted a content-type receive application/json, which is the OAS JSON media type. A
content-type already set (including multipart) is left unchanged.
"""

import os

import schemathesis


def _has_content_type(headers):
    return any(key.lower() == "content-type" for key in headers)


@schemathesis.hook
def before_call(context, case, kwargs):
    headers = dict(case.headers or {})
    extra = kwargs.get("headers") if isinstance(kwargs, dict) else None
    if extra:
        headers.update(dict(extra))
    cookie = os.environ.get("P5_DOC_FUZZ_COOKIE", "")
    if cookie:
        headers["Cookie"] = cookie
    method = str(getattr(case, "method", "") or "").upper()
    # GET may omit a content-type. Any other method that omitted one gets application/json (D-DOC-B63).
    if method != "GET" and not _has_content_type(headers):
        headers["Content-Type"] = "application/json"
    case.headers = headers
    if isinstance(kwargs, dict):
        kwargs["headers"] = headers
