/**
 * Validateur TEF Desjardins — Page principale
 * Design: Terminal/Diagnostic Tool
 * - IBM Plex Mono pour les valeurs de champs
 * - Vert Desjardins (#00874A) pour les succès
 * - Split asymétrique: panneau gauche (upload) + panneau droit (rapport)
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  FileText,
  ChevronDown,
  ChevronRight,
  Info,
  BarChart3,
  Shield,
} from "lucide-react";
import { validateTEFFile, formatJulianDate, type ValidationSummary, type RecordResult } from "@/lib/tefValidator";

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ valid, errors, warnings }: { valid: boolean; errors: number; warnings: number }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-sm font-bold tracking-widest uppercase ${
        valid
          ? "bg-[#00874A]/10 text-[#00874A] border border-[#00874A]/30"
          : "bg-red-50 text-red-700 border border-red-200"
      }`}
    >
      {valid ? (
        <>
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: 2, duration: 0.4 }}
          >
            <CheckCircle2 size={16} />
          </motion.span>
          FICHIER VALIDE
        </>
      ) : (
        <>
          <XCircle size={16} />
          {errors} ERREUR{errors > 1 ? "S" : ""}
          {warnings > 0 && (
            <span className="text-amber-600 ml-1">· {warnings} avertissement{warnings > 1 ? "s" : ""}</span>
          )}
        </>
      )}
    </motion.div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono text-lg font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function RecordRow({ record }: { record: RecordResult }) {
  const [open, setOpen] = useState(record.errors.length > 0 && record.errors.some(e => e.severity === "error"));

  const errorCount = record.errors.filter((e) => e.severity === "error").length;
  const warnCount = record.errors.filter((e) => e.severity === "warning").length;

  const typeColor =
    record.recordType === "A"
      ? "bg-blue-100 text-blue-700"
      : record.recordType === "C"
      ? "bg-violet-100 text-violet-700"
      : record.recordType === "Z"
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";

  return (
    <div className={`border rounded-lg overflow-hidden ${record.valid ? "border-slate-200" : "border-red-200"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${typeColor}`}>
          {record.recordType}
        </span>
        <span className="text-sm text-slate-700 flex-1 font-medium">{record.label}</span>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-mono">
              <XCircle size={12} /> {errorCount}
            </span>
          )}
          {warnCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-600 font-mono">
              <AlertTriangle size={12} /> {warnCount}
            </span>
          )}
          {errorCount === 0 && warnCount === 0 && (
            <span className="flex items-center gap-1 text-xs text-[#00874A] font-mono">
              <CheckCircle2 size={12} /> OK
            </span>
          )}
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 bg-slate-50">
              {/* Errors first */}
              {record.errors.filter(e => e.severity === "error").length > 0 && (
                <div className="p-3 space-y-2">
                  <div className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Erreurs</div>
                  {record.errors.filter(e => e.severity === "error").map((err, i) => (
                    <div key={i} className="flex gap-3 bg-red-50 border border-red-100 rounded p-2">
                      <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-mono font-bold text-red-700">{err.field} <span className="font-normal text-red-400">pos {err.position}</span></div>
                        <div className="text-xs text-red-600 mt-0.5">{err.message}</div>
                        <div className="text-xs text-red-400 mt-0.5 font-mono">Valeur: {err.actual}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {record.errors.filter(e => e.severity === "warning").length > 0 && (
                <div className="p-3 space-y-2 border-t border-slate-100">
                  <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Avertissements</div>
                  {record.errors.filter(e => e.severity === "warning").map((err, i) => (
                    <div key={i} className="flex gap-3 bg-amber-50 border border-amber-100 rounded p-2">
                      <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-mono font-bold text-amber-700">{err.field} <span className="font-normal text-amber-400">pos {err.position}</span></div>
                        <div className="text-xs text-amber-600 mt-0.5">{err.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fields table */}
              <div className="p-3 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Champs parsés</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-200">
                        <th className="text-left py-1 pr-3 font-medium">Champ</th>
                        <th className="text-left py-1 pr-3 font-medium">Pos.</th>
                        <th className="text-left py-1 pr-3 font-medium">Long.</th>
                        <th className="text-left py-1 font-medium">Valeur</th>
                        <th className="text-left py-1 pl-3 font-medium">État</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.fields.map((field, i) => (
                        <tr key={i} className={`border-b border-slate-100 ${field.valid ? "" : "bg-red-50/50"}`}>
                          <td className="py-1 pr-3 text-slate-600">{field.name}</td>
                          <td className="py-1 pr-3 text-slate-400">{field.position}</td>
                          <td className="py-1 pr-3 text-slate-400">{field.length}</td>
                          <td className="py-1 text-slate-800 max-w-[200px] truncate" title={field.value}>
                            {field.value === " ".repeat(field.length)
                              ? <span className="text-slate-300 italic">({field.length} espaces)</span>
                              : field.value === "0".repeat(field.length)
                              ? <span className="text-slate-400">{"0".repeat(Math.min(field.length, 10))}{field.length > 10 ? "…" : ""}</span>
                              : <span>{field.value.trim() || <span className="text-slate-300 italic">(vide)</span>}</span>
                            }
                          </td>
                          <td className="py-1 pl-3">
                            {field.valid ? (
                              <CheckCircle2 size={12} className="text-[#00874A]" />
                            ) : (
                              <XCircle size={12} className="text-red-500" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<ValidationSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    setIsValidating(true);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setTimeout(() => {
        const summary = validateTEFFile(content);
        setResult(summary);
        setIsValidating(false);
      }, 600); // slight delay for UX
    };
    reader.readAsText(file, "latin1");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleReset = () => {
    setFileName(null);
    setResult(null);
    setIsValidating(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      {/* Header */}
      <header
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, #0F1B2D 0%, #1a2e4a 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, rgba(0, 135, 74, 0.38), transparent 28%), radial-gradient(circle at 80% 18%, rgba(59, 130, 246, 0.22), transparent 24%), linear-gradient(115deg, rgba(255, 255, 255, 0.06) 0%, transparent 34%), repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0 1px, transparent 1px 48px), repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.04) 0 1px, transparent 1px 48px)`,
            backgroundSize: "auto, auto, auto, 48px 48px, 48px 48px",
            backgroundPosition: "center",
          }}
        />
        <div className="relative container py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#00874A] flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight">Validateur TEF Desjardins</h1>
              <p className="text-slate-400 text-xs font-mono mt-0.5">Format CPA-005 · Enregistrements A/C/Z · 1464 caractères</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-[#00874A] animate-pulse" />
            Traitement dans le navigateur de l'utilisateur — aucune donnee stockee
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

          {/* Left panel — Upload */}
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-[#00874A] bg-[#00874A]/5 scale-[1.01]"
                  : fileName
                  ? "border-slate-300 bg-white"
                  : "border-slate-300 bg-white hover:border-[#00874A]/50 hover:bg-[#00874A]/3"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.eft,.dat"
                onChange={handleFileChange}
                className="hidden"
              />
              <AnimatePresence mode="wait">
                {isValidating ? (
                  <motion.div
                    key="validating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-12 h-12 rounded-full border-2 border-[#00874A] border-t-transparent"
                    />
                    <p className="text-sm text-slate-600 font-mono">Validation en cours…</p>
                  </motion.div>
                ) : fileName ? (
                  <motion.div
                    key="file"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <FileText size={36} className="text-[#00874A]" />
                    <div>
                      <p className="text-sm font-mono font-bold text-slate-800 truncate max-w-[280px]">{fileName}</p>
                      <p className="text-xs text-slate-400 mt-1">Cliquer pour changer de fichier</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <Upload size={36} className="text-slate-300" />
                    <div>
                      <p className="text-sm font-semibold text-slate-600">Déposer le fichier TEF ici</p>
                      <p className="text-xs text-slate-400 mt-1">ou cliquer pour parcourir</p>
                      <p className="text-xs text-slate-300 mt-2 font-mono">.txt · .eft · .dat</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Reset button */}
            {(fileName || result) && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={handleReset}
                className="w-full text-xs text-slate-400 hover:text-slate-600 transition-colors py-2 font-mono"
              >
                ↺ Réinitialiser
              </motion.button>
            )}

            {/* Stats */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <StatusBadge valid={result.valid} errors={result.totalErrors} warnings={result.totalWarnings} />

                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="Lignes" value={String(result.totalLines)} />
                    <StatCard label="Transactions" value={String(result.recordC)} />
                    <StatCard
                      label="Montant total"
                      value={new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(result.stats.totalAmount)}
                    />
                    <StatCard
                      label="Date création"
                      value={result.stats.dateCreation}
                      sub={result.stats.dateCreation ? formatJulianDate(result.stats.dateCreation) : undefined}
                    />
                  </div>

                  {result.stats.organisme && (
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Organisme</div>
                      <div className="font-mono text-sm font-bold text-slate-800">{result.stats.organisme}</div>
                    </div>
                  )}

                  {/* Summary counts */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Structure</div>
                    {[
                      { label: "Enreg. A (en-tête)", count: result.recordA, expected: 1 },
                      { label: "Enreg. C (détails)", count: result.recordC, expected: null },
                      { label: "Enreg. Z (pied)", count: result.recordZ, expected: 1 },
                    ].map(({ label, count, expected }) => (
                      <div key={label} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-mono">{label}</span>
                        <span className={`font-mono font-bold ${expected !== null && count !== expected ? "text-red-600" : "text-slate-800"}`}>
                          {count}
                          {expected !== null && count !== expected && ` (attendu: ${expected})`}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Info box */}
            {!result && !isValidating && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-700 space-y-1">
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <Info size={14} />
                  À propos de ce validateur
                </div>
                <p>Valide les fichiers TEF Desjardins selon la spec CPA-005 :</p>
                <ul className="space-y-1 mt-2 text-blue-600">
                  <li>· Longueur de chaque ligne : <span className="font-mono">1 464 caractères</span></li>
                  <li>· Structure A → C(s) → Z</li>
                  <li>· Validation de chaque champ</li>
                  <li>· Vérification des totaux de contrôle</li>
                  <li>· Séparateur de ligne : CRLF</li>
                </ul>
                <p className="mt-2 text-blue-500 italic">Traitement dans le navigateur de l'utilisateur — aucune donnee stockee ou transmise a un autre fournisseur de services.</p>
              </div>
            )}
          </div>

          {/* Right panel — Report */}
          <div>
            <AnimatePresence>
              {!result && !isValidating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-64 text-slate-300"
                >
                  <BarChart3 size={48} className="mb-4" />
                  <p className="text-sm font-mono">Le rapport apparaîtra ici après validation</p>
                </motion.div>
              )}

              {result && (
                <motion.div
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  {/* Global errors */}
                  {result.globalErrors.filter(e => e.severity === "error").length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-red-700 font-semibold text-sm mb-3">
                        <XCircle size={16} />
                        Erreurs de structure globale
                      </div>
                      <div className="space-y-2">
                        {result.globalErrors.filter(e => e.severity === "error").map((err, i) => (
                          <div key={i} className="text-xs font-mono text-red-600 bg-white border border-red-100 rounded p-2">
                            <span className="font-bold text-red-700">{err.field}</span>: {err.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Records */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <FileText size={14} />
                        Rapport détaillé par enregistrement
                      </h2>
                      <span className="text-xs text-slate-400 font-mono">{result.totalLines} ligne{result.totalLines > 1 ? "s" : ""}</span>
                    </div>
                    <div className="space-y-2">
                      {result.records.map((record, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <RecordRow record={record} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4">
        <div className="container flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Validateur TEF Desjardins · CPA-005</span>
          <span>Traitement dans le navigateur de l'utilisateur · Aucune donnee stockee ou transmise a un autre fournisseur de services</span>
        </div>
      </footer>
    </div>
  );
}


