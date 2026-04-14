"use client";

import { useState, useRef } from "react";
import { X, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DOCUMENT_TYPES, type PendingFile } from "./apply-types";

interface ApplyDocumentsSectionProps {
  pendingFiles: PendingFile[];
  filePreviews: Record<number, string>;
  onAddDocument: (file: File, name: string, type: string) => void;
  onRemoveFile: (idx: number) => void;
}

export function ApplyDocumentsSection({ pendingFiles, filePreviews, onAddDocument, onRemoveFile }: ApplyDocumentsSectionProps) {
  const [docFormName, setDocFormName] = useState("");
  const [docFormType, setDocFormType] = useState<string>(DOCUMENT_TYPES[0]);
  const [docFormFile, setDocFormFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setDocFormFile(file);
  }

  function confirmAddDocument() {
    if (!docFormFile || !docFormName.trim()) return;
    onAddDocument(docFormFile, docFormName.trim(), docFormType);
    setDocFormName("");
    setDocFormType(DOCUMENT_TYPES[0]);
    setDocFormFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">5</span>
        Certifications &amp; Documents
      </h2>
      <p className="text-xs text-zinc-500">Optional. Upload certificates, licenses, and other supporting documents.</p>

      {/* Existing pending files */}
      {pendingFiles.length > 0 && (
        <div className="space-y-2">
          {pendingFiles.map((pf, idx) => (
            <div key={idx} className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
              {filePreviews[idx] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={filePreviews[idx]} alt={pf.name} className="h-10 w-10 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 flex-shrink-0">
                  <FileText className="h-5 w-5 text-zinc-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{pf.name}</p>
                <p className="text-xs text-zinc-500">{pf.type} &middot; {pf.file.name}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFile(idx)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex-shrink-0"
                aria-label="Remove document"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new document form */}
      <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Certificate Name</label>
            <Input
              value={docFormName}
              onChange={(e) => setDocFormName(e.target.value)}
              className="bg-zinc-800 border-zinc-600 text-white"
              placeholder="e.g. BSIS Guard Card"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Type</label>
            <select
              value={docFormType}
              onChange={(e) => setDocFormType(e.target.value)}
              className="w-full h-9 rounded-md border border-zinc-600 bg-zinc-800 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">File (image or PDF)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileSelect}
            className="w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-zinc-600 file:cursor-pointer cursor-pointer"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={confirmAddDocument}
          disabled={!docFormFile || !docFormName.trim()}
          className="gap-1.5 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
        >
          <Upload className="h-3.5 w-3.5" /> Add Certificate
        </Button>
      </div>
    </div>
  );
}
