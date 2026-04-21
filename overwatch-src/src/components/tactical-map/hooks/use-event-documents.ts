import { useState, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import type { OperationPin } from "../types";
import { getEventDocuments } from "@/lib/supabase/db-documents";
import type { OperationDocument } from "@/types/operations";

export function useEventDocuments(operations: OperationPin[]) {
  const [eventDocs, setEventDocs] = useState<Record<string, OperationDocument[]>>({});
  const eventDocsRef = useRef<Record<string, OperationDocument[]>>({});
  const [viewingDoc, setViewingDoc] = useState<OperationDocument | null>(null);

  // Load docs for all operations
  useEffect(() => {
    if (!operations.length) return;
    const loadDocs = async () => {
      const docs: Record<string, OperationDocument[]> = {};
      await Promise.all(operations.map(async (op) => {
        try {
          const d = await getEventDocuments(op.id);
          // Only keep the latest issued or draft of each type
          const byType: Record<string, OperationDocument> = {};
          for (const doc of d) {
            if (!byType[doc.doc_type] || doc.status === "issued" || doc.version > (byType[doc.doc_type]?.version ?? 0)) {
              byType[doc.doc_type] = doc;
            }
          }
          docs[op.id] = Object.values(byType);
        } catch (e) { logger.swallow("event-docs:load-per-op", e, "warn"); }
      }));
      setEventDocs(docs);
      eventDocsRef.current = docs;
    };
    loadDocs();
  }, [operations]);

  return { eventDocs, eventDocsRef, viewingDoc, setViewingDoc };
}
