import { createClient } from "@/lib/supabase/client";
import type { DocType, DocStatus, OperationDocument, DocumentAck, TlpStep } from "@/types/operations";

function ts() { return { updated_at: new Date().toISOString() }; }

/* ── Operation Documents ──────────────────────────────── */

export async function getEventDocuments(eventId: string): Promise<OperationDocument[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("operation_documents")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OperationDocument[];
}

export async function getDocumentsByType(eventId: string, docType: DocType): Promise<OperationDocument[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("operation_documents")
    .select("*")
    .eq("event_id", eventId)
    .eq("doc_type", docType)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OperationDocument[];
}

export async function getLatestDocument(eventId: string, docType: DocType): Promise<OperationDocument | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("operation_documents")
    .select("*")
    .eq("event_id", eventId)
    .eq("doc_type", docType)
    .neq("status", "superseded")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as OperationDocument | null;
}

export async function createDocument(params: {
  eventId: string;
  companyId: string;
  docType: DocType;
  data: Record<string, unknown>;
  parentDocId?: string;
  createdBy?: string;
}): Promise<OperationDocument> {
  const supabase = createClient();

  // Get current version count for auto-increment
  const { count } = await supabase
    .from("operation_documents")
    .select("id", { count: "exact", head: true })
    .eq("event_id", params.eventId)
    .eq("doc_type", params.docType);

  const version = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from("operation_documents")
    .insert({
      event_id: params.eventId,
      company_id: params.companyId,
      doc_type: params.docType,
      version,
      status: "draft",
      data: params.data,
      parent_doc_id: params.parentDocId ?? null,
      created_by: params.createdBy ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as OperationDocument;
}

export async function updateDocument(
  docId: string,
  updates: { data?: Record<string, unknown>; status?: DocStatus },
): Promise<OperationDocument> {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: Record<string, any> = { ...ts() };
  if (updates.data !== undefined) row.data = updates.data;
  if (updates.status !== undefined) {
    row.status = updates.status;
    if (updates.status === "issued") row.issued_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from("operation_documents")
    .update(row)
    .eq("id", docId)
    .select()
    .single();
  if (error) throw error;
  return data as OperationDocument;
}

export async function deleteDocument(docId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("operation_documents")
    .delete()
    .eq("id", docId);
  if (error) throw error;
}

export async function issueDocument(docId: string): Promise<OperationDocument> {
  return updateDocument(docId, { status: "issued" });
}

export async function supersedeDocument(docId: string): Promise<OperationDocument> {
  return updateDocument(docId, { status: "superseded" });
}

/* ── Document Acknowledgements ────────────────────────── */

export async function getDocumentAcks(docId: string): Promise<DocumentAck[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("document_acknowledgements")
    .select("*, users(id, first_name, last_name, avatar_url)")
    .eq("document_id", docId)
    .order("acknowledged_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DocumentAck[];
}

export async function acknowledgeDocument(docId: string, userId: string): Promise<DocumentAck> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("document_acknowledgements")
    .upsert(
      { document_id: docId, user_id: userId, acknowledged_at: new Date().toISOString() },
      { onConflict: "document_id,user_id" },
    )
    .select("*, users(id, first_name, last_name, avatar_url)")
    .single();
  if (error) throw error;
  return data as DocumentAck;
}

/* ── TLP Step Management ─────────────────────────────── */

export async function updateTlpStep(eventId: string, step: TlpStep) {
  const supabase = createClient();
  const { error } = await supabase
    .from("events")
    .update({ tlp_step: step, ...ts() })
    .eq("id", eventId);
  if (error) throw error;
}

/* ── FRAGO count helper ──────────────────────────────── */

export async function getFragoCount(eventId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("operation_documents")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("doc_type", "frago");
  if (error) throw error;
  return count ?? 0;
}
