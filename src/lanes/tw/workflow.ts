// Workflow helpers for the SSRF-001 rows. Routes (live at 7cbdfec6-derived v2.44.0; /graphql, workspace schema):
// createCoreWorkflow, coreWorkflowsWithCurrentVersions (draft version id), updateCoreWorkflowVersionTrigger,
// createCoreWorkflowVersionStep, updateCoreWorkflowVersionStep, activateCoreWorkflowVersion,
// runCoreWorkflowVersion (fork: engine/core-modules/workflow/dtos; front: object-core/workflows/graphql).
// Run status is read from the workflowRuns object (REST). A step's error text is product output: it is returned
// to the caller for classification and is never attached to an artefact.
import { gql } from "./gql.ts";
import type { TwSession } from "./login.ts";

export interface HttpWorkflow {
  readonly coreWorkflowId: string;
  readonly versionId: string;
  readonly stepId: string;
}

async function graph<T>(
  baseUrl: string,
  session: TwSession,
  operation: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  return gql<T>({ baseUrl, operation, query, variables, bearer: session.accessToken });
}

/** A manual-trigger workflow whose only step is an HTTP request to `url` (POST, one body field). */
export async function createHttpWorkflow(input: {
  readonly baseUrl: string;
  readonly session: TwSession;
  readonly name: string;
  readonly url: string;
}): Promise<HttpWorkflow> {
  const created = await graph<{ createCoreWorkflow: { id: string } }>(
    input.baseUrl,
    input.session,
    "createCoreWorkflow",
    `mutation C($input: CreateCoreWorkflowInput!) { createCoreWorkflow(input: $input) { id } }`,
    { input: { name: input.name } },
  );
  const coreWorkflowId = created.createCoreWorkflow.id;
  const listed = await graph<{
    coreWorkflowsWithCurrentVersions: Array<{ currentVersion: { id: string } }>;
  }>(
    input.baseUrl,
    input.session,
    "coreWorkflowsWithCurrentVersions",
    `query L($input: CoreWorkflowsWithCurrentVersionsInput!) { coreWorkflowsWithCurrentVersions(input: $input) { currentVersion { id } } }`,
    { input: { coreWorkflowIds: [coreWorkflowId] } },
  );
  const versionId = listed.coreWorkflowsWithCurrentVersions[0]?.currentVersion.id;
  if (versionId === undefined) throw new Error("TEST BUG: the new workflow has no draft version");
  await graph(
    input.baseUrl,
    input.session,
    "updateCoreWorkflowVersionTrigger",
    `mutation T($input: UpdateCoreWorkflowVersionTriggerInput!) { updateCoreWorkflowVersionTrigger(input: $input) { trigger } }`,
    {
      input: {
        coreWorkflowVersionId: versionId,
        trigger: { type: "MANUAL", settings: { outputSchema: {} } },
      },
    },
  );
  const step = await graph<{ createCoreWorkflowVersionStep: { stepsDiff: unknown } }>(
    input.baseUrl,
    input.session,
    "createCoreWorkflowVersionStep",
    `mutation S($input: CreateCoreWorkflowVersionStepInput!) { createCoreWorkflowVersionStep(input: $input) { stepsDiff } }`,
    { input: { coreWorkflowVersionId: versionId, stepType: "HTTP_REQUEST" } },
  );
  const stepId = /"id":"([0-9a-f-]{36})"/.exec(
    JSON.stringify(step.createCoreWorkflowVersionStep.stepsDiff),
  )?.[1];
  if (stepId === undefined) throw new Error("TEST BUG: the HTTP step id is not in the diff");
  await graph(
    input.baseUrl,
    input.session,
    "updateCoreWorkflowVersionStep",
    `mutation U($input: UpdateCoreWorkflowVersionStepInput!) { updateCoreWorkflowVersionStep(input: $input) { id } }`,
    {
      input: {
        coreWorkflowVersionId: versionId,
        step: {
          id: stepId,
          name: "http",
          type: "HTTP_REQUEST",
          valid: true,
          nextStepIds: [],
          settings: {
            type: "HTTP_REQUEST",
            outputSchema: {},
            errorHandlingOptions: {
              continueOnFailure: { value: false },
              retryOnFailure: { value: 0 },
            },
            input: { url: input.url, method: "POST", headers: {}, body: { p5: "tw-ssrf-001" } },
          },
        },
      },
    },
  );
  await graph(
    input.baseUrl,
    input.session,
    "updateCoreWorkflowVersionTrigger",
    `mutation T($input: UpdateCoreWorkflowVersionTriggerInput!) { updateCoreWorkflowVersionTrigger(input: $input) { trigger } }`,
    {
      input: {
        coreWorkflowVersionId: versionId,
        trigger: { type: "MANUAL", settings: { outputSchema: {} }, nextStepIds: [stepId] },
      },
    },
  );
  return { coreWorkflowId, versionId, stepId };
}

export async function activateAndRun(input: {
  readonly baseUrl: string;
  readonly session: TwSession;
  readonly versionId: string;
}): Promise<string> {
  await graph(
    input.baseUrl,
    input.session,
    "activateCoreWorkflowVersion",
    `mutation A($coreWorkflowVersionId: UUID!) { activateCoreWorkflowVersion(coreWorkflowVersionId: $coreWorkflowVersionId) }`,
    { coreWorkflowVersionId: input.versionId },
  );
  const run = await graph<{ runCoreWorkflowVersion: { workflowRunId: string } }>(
    input.baseUrl,
    input.session,
    "runCoreWorkflowVersion",
    `mutation R($input: RunCoreWorkflowVersionInput!) { runCoreWorkflowVersion(input: $input) { workflowRunId } }`,
    { input: { coreWorkflowVersionId: input.versionId } },
  );
  return run.runCoreWorkflowVersion.workflowRunId;
}

/** The run status and, for a failed HTTP step, the product's error sentence (never a header or a body). */
export async function readRun(input: {
  readonly baseUrl: string;
  readonly session: TwSession;
  readonly workflowRunId: string;
}): Promise<{ status: string; stepError: string | undefined }> {
  const response = await fetch(`${input.baseUrl}/rest/workflowRuns/${input.workflowRunId}`, {
    headers: { authorization: `Bearer ${input.session.accessToken}` },
  });
  const body = (await response.json()) as {
    data?: { workflowRun?: { status?: string; stepLogs?: unknown } };
  };
  const run = body.data?.workflowRun;
  const text = JSON.stringify(run?.stepLogs ?? {});
  const error = /"error":"([^"]{1,200})"/.exec(text)?.[1];
  return { status: run?.status ?? "UNKNOWN", stepError: error };
}
