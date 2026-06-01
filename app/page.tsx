"use client";

import { useState, useRef } from "react";
import { parseVelogicClient } from "@/lib/parseVelogicClient";

type UploadState = "idle" | "parsing" | "generating" | "merging" | "success" | "error";

interface FileInfo { name: string; size: string; }

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileDropZone({ label, hint, file, onFile, disabled }: {
  label: string; hint: string; file: FileInfo | null;
  onFile: (f: File) => void; disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") onFile(f); }}
      className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-blue-500 hover:bg-blue-50"}
        ${dragging ? "border-blue-500 bg-blue-50" : file ? "border-green-500 bg-green-50" : "border-dashed border-gray-300 bg-gray-50"}`}
    >
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
        disabled={disabled} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div className="flex items-start gap-4">
        <div className={`text-3xl mt-1 ${file ? "text-green-500" : "text-gray-400"}`}>{file ? "✓" : "📄"}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800">{label}</p>
          <p className="text-sm text-gray-500 mt-0.5">{hint}</p>
          {file
            ? <p className="text-sm text-green-700 font-medium mt-2 truncate">{file.name} · {file.size}</p>
            : <p className="text-xs text-gray-400 mt-2">PDF hierher ziehen oder klicken</p>}
        </div>
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<UploadState, string> = {
  idle: "Unified Report generieren",
  parsing: "Velogic-Daten werden extrahiert …",
  generating: "Daten-Seiten werden erstellt …",
  merging: "PDFs werden zusammengeführt …",
  success: "Erneut generieren",
  error: "Erneut versuchen",
};

export default function Home() {
  const [velogicFile, setVelogicFile] = useState<File | null>(null);
  const [v7File, setV7File] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const ready = velogicFile && v7File;
  const isLoading = ["parsing", "generating", "merging"].includes(state);

  async function handleGenerate() {
    if (!velogicFile || !v7File) return;
    setErrorMsg("");

    try {
      // 1. Parse Velogic PDF in browser (pdfjs)
      setState("parsing");
      const velogicData = await parseVelogicClient(velogicFile);

      // 2. Send only JSON to server → get back cover + data pages PDF
      setState("generating");
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(velogicData),
      });
      if (!res.ok) {
        let errMsg = `Server-Fehler (${res.status})`;
        try { const d = await res.json(); errMsg = d.error || errMsg; } catch { /* html response */ }
        throw new Error(errMsg);
      }
      const dataPagesBytes = new Uint8Array(await res.arrayBuffer());

      // 3. Merge client-side: insert V7 pages INTO the server doc (preserves fonts)
      setState("merging");
      const { PDFDocument } = await import("pdf-lib");
      const v7Bytes = new Uint8Array(await v7File.arrayBuffer());

      // Use server doc as base — fonts are already embedded correctly
      const mergedDoc = await PDFDocument.load(dataPagesBytes);
      const v7Doc = await PDFDocument.load(v7Bytes);

      // Take up to 5 content pages from V7 (skip its cover page at index 0)
      const v7PageCount = v7Doc.getPageCount();
      const v7PageIdxs = Array.from(
        { length: Math.min(v7PageCount - 1, 5) },
        (_, i) => i + 1
      );

      if (v7PageIdxs.length > 0) {
        const v7Copied = await mergedDoc.copyPages(v7Doc, v7PageIdxs);
        // Insert V7 pages after cover (position 1), before the data pages
        v7Copied.reverse().forEach((p) => mergedDoc.insertPage(1, p));
      }

      const mergedBytes = await mergedDoc.save();

      // 4. Download
      const blob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gebioMized_FitReport_${velogicData.riderName || "Report"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setState("success");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Unbekannter Fehler");
      setState("error");
    }
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-[#005A9C] text-white px-6 py-4 shadow-md">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold leading-tight">gebioMized</h1>
          <p className="text-blue-200 text-sm">Fit Report Generator</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Unified Report erstellen</h2>
          <p className="text-gray-500 text-sm">
            Lade den <strong>Velogicfit Studio Report</strong> und den <strong>gebioMized V7 Report</strong> hoch.
            Der Generator kombiniert beide zu einem einheitlichen, gebrandeten PDF.
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <FileDropZone
            label="Velogicfit Studio Report"
            hint="Enthält biomechanische Winkelwerte (Knie, Hüfte, Schulter …)"
            file={velogicFile ? { name: velogicFile.name, size: formatSize(velogicFile.size) } : null}
            onFile={setVelogicFile} disabled={isLoading}
          />
          <FileDropZone
            label="gebioMized V7 Report"
            hint="Enthält Satteldruckkarte, Video-Fotos und Positionsdiagramm"
            file={v7File ? { name: v7File.name, size: formatSize(v7File.size) } : null}
            onFile={setV7File} disabled={isLoading}
          />
        </div>

        <button onClick={handleGenerate} disabled={!ready || isLoading}
          className={`w-full py-4 rounded-xl font-semibold text-white text-lg transition-all shadow-sm
            ${ready && !isLoading ? "bg-[#005A9C] hover:bg-[#004880] cursor-pointer" : "bg-gray-300 cursor-not-allowed text-gray-500"}`}>
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              {STATUS_LABELS[state]}
            </span>
          ) : STATUS_LABELS[state]}
        </button>

        {state === "success" && (
          <div className="mt-4 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <span className="text-lg">✓</span>
            Report erfolgreich erstellt und heruntergeladen.
          </div>
        )}
        {state === "error" && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
            <strong>Fehler:</strong> {errorMsg}
          </div>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">Was wird generiert?</p>
          <ul className="space-y-0.5 list-disc list-inside text-blue-700">
            <li>Deckblatt mit Kundendaten und Analyse-Umfang</li>
            <li>Positionsdiagramm, Satteldruck &amp; Videoanalyse (aus V7)</li>
            <li>Biomechanische Winkelwerte mit Initial/Final/Änderung</li>
            <li>Anthropometrie &amp; Performance-Daten</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
