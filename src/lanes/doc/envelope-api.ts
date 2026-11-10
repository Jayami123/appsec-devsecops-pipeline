// Envelope calls through the v2 OpenAPI handler (mounted at /api/v2; the session cookie is accepted by the
// tRPC context, packages/trpc/server/context.ts:19-20). Shapes from the vendored contract (openapi.json):
// POST /envelope/create (multipart: payload JSON + files), POST /envelope/delete (json envelopeId),
// GET /envelope/{envelopeId}. Pure HTTP; no assertions here (the specs assert).
import type { APIRequestContext } from "@playwright/test";
import { minimalPdf } from "./pdf.ts";

export const V2_PATH = "/api/v2";

/** Creates a DOCUMENT envelope with one PDF. Returns its id. Throws on a non-2xx (ENV or PRODUCT, status only). */
export async function createEnvelope(
  request: APIRequestContext,
  baseUrl: string,
  title: string,
): Promise<string> {
  const res = await request.post(`${baseUrl}${V2_PATH}/envelope/create`, {
    multipart: {
      payload: JSON.stringify({ title, type: "DOCUMENT" }),
      files: { name: "p5-doc.pdf", mimeType: "application/pdf", buffer: minimalPdf() },
    },
  });
  if (!res.ok()) throw new Error(`envelope create returned ${res.status()}`);
  return ((await res.json()) as { id: string }).id;
}

export async function getEnvelopeStatus(
  request: APIRequestContext,
  baseUrl: string,
  id: string,
): Promise<number> {
  const res = await request.get(`${baseUrl}${V2_PATH}/envelope/${encodeURIComponent(id)}`);
  return res.status();
}

export async function deleteEnvelopeStatus(
  request: APIRequestContext,
  baseUrl: string,
  id: string,
): Promise<number> {
  const res = await request.post(`${baseUrl}${V2_PATH}/envelope/delete`, {
    data: { envelopeId: id },
  });
  return res.status();
}

/** Adds one SIGNER (create-many, envelope-recipients/create-envelope-recipients.types.ts:31-35). Returns the status. */
export async function addSigner(
  request: APIRequestContext,
  baseUrl: string,
  envelopeId: string,
  email: string,
  name: string,
): Promise<number> {
  const res = await request.post(`${baseUrl}${V2_PATH}/envelope/recipient/create-many`, {
    data: { envelopeId, data: [{ email, name, role: "SIGNER" }] },
  });
  return res.status();
}

/** Sends the envelope (distribute, envelope/distribute). The signing mail carries the /sign/<token> link. */
export async function distributeEnvelope(
  request: APIRequestContext,
  baseUrl: string,
  envelopeId: string,
): Promise<number> {
  const res = await request.post(`${baseUrl}${V2_PATH}/envelope/distribute`, {
    data: { envelopeId },
  });
  return res.status();
}
