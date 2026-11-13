// Envelope calls through the v2 OpenAPI handler (mounted at /api/v2; the session cookie is accepted by the
// tRPC context, fork ref held by the owner). Shapes from the vendored contract (openapi.json):
// POST /envelope/create (multipart: payload JSON + files), POST /envelope/delete (json envelopeId),
// GET /envelope/{envelopeId}. Pure HTTP; no assertions here (the specs assert).
import type { APIRequestContext } from "@playwright/test";
import { minimalPdf } from "./pdf.ts";
import { redactArtefact } from "../../security/redact.ts";

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
  if (!res.ok()) {
    // The first 200 characters of the product response, redacted: a 500 is classified from this, never guessed.
    const detail = redactArtefact((await res.text()).slice(0, 200));
    throw new Error(`envelope create returned ${res.status()}: ${detail}`);
  }
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

/** Adds one SIGNER (create-many, fork ref held by the owner). Returns the status. */
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
/** Sends the envelope (distribute). A refusal throws with the redacted product response (D-DOC-B49). */
export async function distributeEnvelope(
  request: APIRequestContext,
  baseUrl: string,
  envelopeId: string,
): Promise<void> {
  const res = await request.post(`${baseUrl}${V2_PATH}/envelope/distribute`, {
    data: { envelopeId },
  });
  if (!res.ok())
    throw new Error(
      `distribute returned ${res.status()}: ${redactArtefact((await res.text()).slice(0, 200))}`,
    );
}
/** Creates a TEMPLATE with one PDF (POST /envelope/create with type TEMPLATE). Returns the envelope id. */
export async function createTemplate(
  request: APIRequestContext,
  baseUrl: string,
  title: string,
): Promise<string> {
  const res = await request.post(`${baseUrl}${V2_PATH}/envelope/create`, {
    multipart: {
      payload: JSON.stringify({ title, type: "TEMPLATE" }),
      files: { name: "p5-template.pdf", mimeType: "application/pdf", buffer: minimalPdf() },
    },
  });
  if (!res.ok()) throw new Error(`template create returned ${res.status()}`);
  return ((await res.json()) as { id: string }).id;
}

/** The numeric legacy template id from the envelope secondaryId ("template_<n>"). Throws on any other form. */
export async function legacyTemplateId(
  request: APIRequestContext,
  baseUrl: string,
  envelopeId: string,
): Promise<number> {
  const res = await request.get(`${baseUrl}${V2_PATH}/envelope/${encodeURIComponent(envelopeId)}`);
  if (!res.ok()) throw new Error(`template read returned ${res.status()}`);
  const secondary = ((await res.json()) as { secondaryId?: string }).secondaryId ?? "";
  const match = /^template_(\d+)$/.exec(secondary);
  if (!match) throw new Error("TEST BUG: secondaryId is not template_<n>");
  return Number(match[1]);
}

/** Reads a template by its legacy numeric id (GET /template/{templateId}, the vendored contract). */
export async function getTemplateStatus(
  request: APIRequestContext,
  baseUrl: string,
  templateId: number,
): Promise<number> {
  const res = await request.get(`${baseUrl}${V2_PATH}/template/${templateId}`);
  return res.status();
}

/** Creates an envelope from a template (POST /template/use, templateId numeric). Returns the status. */
/** Creates an envelope from a template (POST /template/use). Returns the status and the redacted detail (D-DOC-B49). */
export async function useTemplateStatus(
  request: APIRequestContext,
  baseUrl: string,
  templateId: number,
): Promise<{ status: number; detail: string }> {
  const res = await request.post(`${baseUrl}${V2_PATH}/template/use`, {
    data: { templateId, recipients: [] },
  });
  const detail = res.ok() ? "" : redactArtefact((await res.text()).slice(0, 200));
  return { status: res.status(), detail };
}
