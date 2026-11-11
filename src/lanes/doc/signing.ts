// Recipient and signing helpers for the doc rows (doc plan 4.5). Shapes cited from the fork at f4105e4:
// POST /api/v2/envelope/recipient/create-many (envelope-recipients/create-envelope-recipients.types.ts:31-37),
// POST /api/v2/envelope/field/create-many (envelope-fields/create-envelope-fields.types.ts:79-86, coordinates
// from ZCoordinatePositionSchema), tRPC envelope.field.sign (sign-envelope-field.types.ts:50-55) and
// tRPC recipient.completeDocumentWithToken (recipient-router/schema.ts:161-171, documentId from secondaryId
// "document_<n>", lib/utils/envelope.ts:11). The tRPC wire format is UNVERIFIED until the first live run
// (packages/trpc/utils/data-transformer.ts:4); a mismatch is a TEST BUG, never a PASS.
import { expect, type APIRequestContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { createEnvelope, V2_PATH } from "./envelope-api.ts";
import { extractFirstLink, latestMessageBodyFor } from "./inbucket.ts";
import { redactArtefact } from "../../security/redact.ts";

/** A 1x1 PNG as a data URL: the value of a SIGNATURE field. */
export const SIGNATURE_VALUE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export interface SignerSpec {
  readonly email: string;
  readonly name: string;
}

export interface PlacedSigner {
  readonly id: number;
  readonly email: string;
  readonly fieldId: number;
}

export interface SignerIds {
  readonly recipientId: number;
  readonly fieldId: number;
}

/** Adds the recipients (SIGNER) and one NAME field per recipient on page 1. Returns the ids. */
export async function addSignersWithFields(
  request: APIRequestContext,
  baseUrl: string,
  envelopeId: string,
  signers: readonly SignerSpec[],
): Promise<PlacedSigner[]> {
  const recipientsRes = await request.post(`${baseUrl}${V2_PATH}/envelope/recipient/create-many`, {
    data: {
      envelopeId,
      data: signers.map((s) => ({ email: s.email, name: s.name, role: "SIGNER" })),
    },
  });
  if (!recipientsRes.ok()) throw new Error(`recipient create returned ${recipientsRes.status()}`);
  const recipients = ((await recipientsRes.json()) as { data: { id: number; email: string }[] })
    .data;
  const fieldsRes = await request.post(`${baseUrl}${V2_PATH}/envelope/field/create-many`, {
    data: {
      envelopeId,
      data: recipients.map((r, index) => ({
        recipientId: r.id,
        type: "SIGNATURE",
        page: 1,
        positionX: 10,
        positionY: 10 + index * 10,
        width: 30,
        height: 5,
      })),
    },
  });
  if (!fieldsRes.ok()) throw new Error(`field create returned ${fieldsRes.status()}`);
  const fields = ((await fieldsRes.json()) as { data: { id: number; recipientId: number }[] }).data;
  return recipients.map((r) => {
    const field = fields.find((f) => f.recipientId === r.id);
    if (!field) throw new Error("TEST BUG: no field returned for a recipient");
    return { id: r.id, email: r.email, fieldId: field.id };
  });
}

/** Sends the envelope (envelope/distribute). The signing mail then carries /sign/<token>. */
/** Sends the envelope (distribute). A refusal throws with the redacted product response (D-DOC-B49). */
export async function sendEnvelope(
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
/** Signs one NAME field with a recipient token (tRPC envelope.field.sign). Returns the status; never throws. */
export async function signFieldWithToken(
  request: APIRequestContext,
  baseUrl: string,
  token: string,
  fieldId: number,
): Promise<number> {
  const res = await request.post(`${baseUrl}/api/trpc/envelope.field.sign`, {
    data: { json: { token, fieldId, fieldValue: { type: "SIGNATURE", value: SIGNATURE_VALUE } } },
  });
  return res.status();
}

/** Completes one recipient with its token (tRPC recipient.completeDocumentWithToken). Returns the status. */
export async function completeWithToken(
  request: APIRequestContext,
  baseUrl: string,
  token: string,
  documentId: number,
): Promise<number> {
  const res = await request.post(`${baseUrl}/api/trpc/recipient.completeDocumentWithToken`, {
    data: { json: { token, documentId } },
  });
  return res.status();
}

/** The numeric legacy document id from an envelope's secondaryId ("document_<n>"). Throws on any other form. */
export function documentIdOf(secondaryId: string): number {
  const match = /^document_(\d+)$/.exec(secondaryId);
  if (!match) throw new Error("TEST BUG: secondaryId is not document_<n>");
  return Number(match[1]);
}

/** Reads the field's inserted flag through the v2 contract (GET /envelope/field/{fieldId}). */
export async function fieldInserted(
  request: APIRequestContext,
  baseUrl: string,
  fieldId: number,
): Promise<boolean> {
  const res = await request.get(`${baseUrl}${V2_PATH}/envelope/field/${fieldId}`);
  if (!res.ok()) throw new Error(`field read returned ${res.status()}`);
  return ((await res.json()) as { inserted?: boolean }).inserted === true;
}

/** The signing token of one recipient, read from its mailbox (expect.poll; the deadline is the configured expect timeout). */
export async function signingTokenFor(
  request: APIRequestContext,
  email: string,
  runPrefix: string,
): Promise<string> {
  let token = "";
  await expect
    .poll(
      async () => {
        const body = await latestMessageBodyFor(request, email, runPrefix);
        const link = body === null ? null : extractFirstLink(body, "/sign/");
        token = link === null ? "" : (new URL(link).pathname.split("/sign/")[1] ?? "");
        return link;
      },
      { message: "signing mail" },
    )
    .toBeTruthy();
  return token;
}

/** One envelope, two signers, one NAME field each, distributed. Returns the envelope and both tokens. */
export async function sendTwoSignerEnvelope(
  owner: APIRequestContext,
  baseUrl: string,
  runPrefix: string,
  title: string,
  onCreated: (envelopeId: string) => void,
): Promise<{
  envelopeId: string;
  a: PlacedSigner;
  b: PlacedSigner;
  tokenA: string;
  tokenB: string;
}> {
  const envelopeId = await createEnvelope(owner, baseUrl, title);
  onCreated(envelopeId);
  const [a, b] = await addSignersWithFields(owner, baseUrl, envelopeId, [
    {
      email: `${runPrefix}-signer-a-${randomBytes(3).toString("hex")}@p5.test`,
      name: "P5 signer A",
    },
    {
      email: `${runPrefix}-signer-b-${randomBytes(3).toString("hex")}@p5.test`,
      name: "P5 signer B",
    },
  ]);
  if (a === undefined || b === undefined) throw new Error("TEST BUG: two signers expected");
  await sendEnvelope(owner, baseUrl, envelopeId);
  const tokenA = await signingTokenFor(owner, a.email, runPrefix);
  const tokenB = await signingTokenFor(owner, b.email, runPrefix);
  return { envelopeId, a, b, tokenA, tokenB };
}
