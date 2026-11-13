// The one redaction placeholder (F-ZAP-1, decision B46). zap-redact writes it, and the evidence gate exempts it: a
// name=value hit is exempt only when every such hit in the line has a value exactly equal to this constant.
export const REDACTED_PLACEHOLDER = "[REDACTED]";
