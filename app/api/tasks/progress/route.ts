import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type ProgressStage = "pending_acceptance" | "accepted" | "travel_started" | "work_started";
type TaskSource = "order" | "help_request";

type ProgressRequest = {
  taskId: string;
  source: TaskSource;
  stage: ProgressStage;
};

const isValidStage = (value: string): value is ProgressStage =>
  ["pending_acceptance", "accepted", "travel_started", "work_started"].includes(value);
const isValidSource = (value: string): value is TaskSource => ["order", "help_request"].includes(value);

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: authResult.message }, { status: authResult.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "Supabase server credentials are missing." }, { status: 500 });
  }

  let body: ProgressRequest;
  try {
    body = (await request.json()) as ProgressRequest;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON payload." }, { status: 400 });
  }

  const taskId = body.taskId?.trim();
  const source = body.source?.trim();
  const stage = body.stage?.trim();

  if (!taskId || !source || !isValidSource(source) || !stage || !isValidStage(stage)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PAYLOAD", message: "taskId, source, and a valid stage are required." },
      { status: 400 }
    );
  }

  if (source === "order") {
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,status,consumer_id,provider_id,metadata")
      .eq("id", taskId)
      .maybeSingle<{
        id: string;
        status: string | null;
        consumer_id: string | null;
        provider_id: string | null;
        metadata: Record<string, unknown> | null;
      }>();

    if (orderError || !order) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: orderError?.message || "Order not found." },
        { status: 404 }
      );
    }

    if (order.provider_id !== authResult.auth.userId) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Only the assigned provider can update task progress." },
        { status: 403 }
      );
    }

    const normalizedStatus = (order.status || "").toLowerCase();
    if (!["accepted", "in_progress"].includes(normalizedStatus)) {
      return NextResponse.json(
        { ok: false, code: "INVALID_STATE", message: "This task is not in a live state that can be updated." },
        { status: 400 }
      );
    }

    const currentMetadata = order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata) ? order.metadata : {};
    const nextMetadata = {
      ...currentMetadata,
      progress_stage: stage,
      progress_updated_at: new Date().toISOString(),
    };

    const nextStatus =
      stage === "work_started"
        ? "in_progress"
        : stage === "pending_acceptance" || stage === "accepted" || stage === "travel_started"
          ? "accepted"
          : order.status;
    const { error: updateError } = await admin.from("orders").update({ metadata: nextMetadata, status: nextStatus }).eq("id", taskId);
    if (updateError) {
      return NextResponse.json({ ok: false, code: "DB", message: updateError.message }, { status: 500 });
    }

    const title =
      stage === "accepted"
        ? "Task accepted"
        : stage === "travel_started"
          ? "Provider started travel"
          : stage === "work_started"
            ? "Work started"
            : "Task reset to accepted";
    const description =
      stage === "accepted"
        ? "The provider accepted the task and it is ready for travel updates."
        : stage === "travel_started"
          ? "The provider is on the way. This update is now visible in the seeker task tracker."
          : stage === "work_started"
            ? "The provider has started working on the task."
            : "The live tracker was reset back to the accepted state.";

    const { error: eventError } = await admin.from("task_events").insert({
      order_id: order.id,
      consumer_id: order.consumer_id,
      provider_id: order.provider_id,
      actor_id: authResult.auth.userId,
      event_type: "status_changed",
      previous_status: order.status,
      next_status: nextStatus,
      title,
      description,
      metadata: {
        source: "task_progress",
        progress_stage: stage,
      },
    });

    if (eventError) {
      return NextResponse.json({ ok: false, code: "DB", message: eventError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, taskId, source, stage });
  }

  const { data: requestRow, error: requestError } = await admin
    .from("help_requests")
    .select("id,status,requester_id,accepted_provider_id,metadata")
    .eq("id", taskId)
    .maybeSingle<{
      id: string;
      status: string | null;
      requester_id: string | null;
      accepted_provider_id: string | null;
      metadata: Record<string, unknown> | null;
    }>();

  if (requestError || !requestRow) {
    return NextResponse.json(
      { ok: false, code: "NOT_FOUND", message: requestError?.message || "Help request not found." },
      { status: 404 }
    );
  }

  if (requestRow.accepted_provider_id !== authResult.auth.userId) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", message: "Only the accepted provider can update task progress." },
      { status: 403 }
    );
  }

  const normalizedStatus = (requestRow.status || "").toLowerCase();
  if (!["accepted", "in_progress"].includes(normalizedStatus)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_STATE", message: "This request is not in a live state that can be updated." },
      { status: 400 }
    );
  }

  const currentMetadata =
    requestRow.metadata && typeof requestRow.metadata === "object" && !Array.isArray(requestRow.metadata) ? requestRow.metadata : {};
  const nextMetadata = {
    ...currentMetadata,
    progress_stage: stage,
    progress_updated_at: new Date().toISOString(),
  };

  const nextStatus =
    stage === "work_started"
      ? "in_progress"
      : stage === "pending_acceptance" || stage === "accepted" || stage === "travel_started"
        ? "accepted"
        : requestRow.status;
  const { error: updateError } = await admin
    .from("help_requests")
    .update({ metadata: nextMetadata, status: nextStatus })
    .eq("id", taskId);

  if (updateError) {
    return NextResponse.json({ ok: false, code: "DB", message: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, taskId, source, stage });
}
