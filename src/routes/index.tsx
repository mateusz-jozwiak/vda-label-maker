import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  VdaLabel,
  defaultVdaData,
  defaultPrefixes,
  type VdaData,
  type VdaPrefixes,
  type PrefixKey,
} from "@/components/VdaLabel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Generator etykiet wysyłkowych VDA 4902" },
      { name: "description", content: "Generator etykiet VDA 4902 z kodami Code39 i eksportem do PDF." },
    ],
  }),
  component: Index,
});

const fields: { key: keyof VdaData; label: string; textarea?: boolean }[] = [
  { key: "recipient", label: "(1) Warenempfänger", textarea: true },
  { key: "unloadingPoint", label: "(2) Abladestelle / Lagerort" },
  { key: "deliveryNoteNo", label: "(3) Lieferschein-Nr." },
  { key: "supplierAddress", label: "(4) Lieferantenanschrift" },
  { key: "netWeight", label: "(5) Gewicht Netto" },
  { key: "grossWeight", label: "(6) Gewicht Brutto" },
  { key: "packagesCount", label: "(7) Anzahl Packstücke" },
  { key: "partNoCustomer", label: "(8) Sach-Nr. Kunde" },
  { key: "quantity", label: "(9) Füllmenge" },
  { key: "description", label: "(10) Bezeichnung" },
  { key: "partNoSupplier", label: "(11) Sach-Nr. Lieferant" },
  { key: "supplierNo", label: "(12) Lieferanten-Nr." },
  { key: "date", label: "(13) Datum" },
  { key: "engineeringChange", label: "(14) Änderungsstand" },
  { key: "packageNo", label: "(15) Packstück-Nr." },
  { key: "batchNo", label: "(16) Chargen-Nr." },
];

const prefixFieldLabels: Record<PrefixKey, string> = {
  deliveryNoteNo: "(3) Lieferschein-Nr.",
  partNoCustomer: "(8) Sach-Nr. Kunde",
  quantity: "(9) Füllmenge",
  partNoSupplier: "(11) Sach-Nr. Lieferant",
  supplierNo: "(12) Lieferanten-Nr.",
  packageNo: "(15) Packstück-Nr.",
  batchNo: "(16) Chargen-Nr.",
};

type Preset = { name: string; data: VdaData; prefixes: VdaPrefixes };
const PRESETS_KEY = "vda-presets-v1";
const PREFIXES_KEY = "vda-prefixes-v1";

function loadPresets(): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? (JSON.parse(raw) as Preset[]) : [];
  } catch {
    return [];
  }
}

function loadPrefixes(): VdaPrefixes {
  if (typeof window === "undefined") return defaultPrefixes;
  try {
    const raw = localStorage.getItem(PREFIXES_KEY);
    return raw ? { ...defaultPrefixes, ...JSON.parse(raw) } : defaultPrefixes;
  } catch {
    return defaultPrefixes;
  }
}

function uniqueName(base: string, existing: Preset[]): string {
  const names = new Set(existing.map((p) => p.name));
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base} (${i})`)) i++;
  return `${base} (${i})`;
}

/**
 * Parse an EDIFACT DESADV message into partial VdaData.
 * Segment terminator: '  Element sep: +  Component sep: :
 */
function parseEdi(text: string): Partial<VdaData> {
  const clean = text.replace(/\r?\n/g, "").trim();
  const segments = clean.split("'").map((s) => s.trim()).filter(Boolean);
  const out: Partial<VdaData> = {};

  const fmtDate = (raw: string): string =>
    /^\d{8,}/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;

  for (const seg of segments) {
    const parts = seg.split("+");
    const tag = parts[0];
    const els = parts.slice(1).map((e) => e.split(":"));

    switch (tag) {
      case "BGM": {
        const docNo = els[1]?.[0];
        if (docNo) out.deliveryNoteNo = docNo;
        break;
      }
      case "DTM": {
        const [qual, val] = els[0] ?? [];
        if ((qual === "11" || qual === "137") && val && !out.date) out.date = fmtDate(val);
        break;
      }
      case "MEA": {
        const qual = els[1]?.[0];
        const value = els[2]?.[1];
        if (value) {
          const f = `${value} kg`;
          if (qual === "G") out.grossWeight = f;
          if (qual === "N") out.netWeight = f;
        }
        break;
      }
      case "NAD": {
        const role = els[0]?.[0];
        const id = els[1]?.[0];
        const name = els[4]?.[0];
        if (role === "CN" || role === "BY") {
          if (name) out.recipient = name;
        } else if (role === "SE" || role === "CZ") {
          if (name) out.supplierAddress = name;
          if (id && !out.supplierNo) out.supplierNo = id;
        }
        break;
      }
      case "LOC": {
        if (els[0]?.[0] === "11" && els[1]?.[0]) out.unloadingPoint = els[1][0];
        break;
      }
      case "QTY": {
        const [qual, value] = els[0] ?? [];
        if (qual === "12" && value) out.quantity = value;
        break;
      }
      case "PAC": {
        const count = els[0]?.[0];
        if (count && !out.packagesCount) out.packagesCount = count;
        break;
      }
      case "GIR": {
        const pkg = els[2]?.[0];
        if (pkg) out.packageNo = pkg;
        break;
      }
      case "LIN": {
        const part = els[2]?.[0];
        const qual = els[2]?.[1];
        if (part) {
          if (qual === "IN") out.partNoCustomer = part;
          else if (qual === "SA") out.partNoSupplier = part;
        }
        break;
      }
      case "RFF": {
        const [qual, value] = els[0] ?? [];
        if (qual === "DQ" && value) out.deliveryNoteNo = value;
        else if ((qual === "ON" || qual === "AAK") && value && !out.deliveryNoteNo) out.deliveryNoteNo = value;
        break;
      }
    }
  }
  return out;
}

function Index() {
  const [data, setData] = useState<VdaData>(defaultVdaData);
  const [prefixes, setPrefixes] = useState<VdaPrefixes>(defaultPrefixes);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrefixes(loadPrefixes());
    setPresets(loadPresets());
  }, []);

  const persistPresets = (next: Preset[]) => {
    setPresets(next);
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); } catch {}
  };
  const persistPrefixes = (next: VdaPrefixes) => {
    setPrefixes(next);
    try { localStorage.setItem(PREFIXES_KEY, JSON.stringify(next)); } catch {}
  };

  const update = (k: keyof VdaData, v: string) => setData((d) => ({ ...d, [k]: v }));
  const updatePrefix = (k: PrefixKey, v: string) =>
    persistPrefixes({ ...prefixes, [k]: v.toUpperCase().replace(/\s/g, "") });
  const resetPrefixes = () => persistPrefixes(defaultPrefixes);

  const savePreset = () => {
    const name = prompt("Nazwa presetu:");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [...presets.filter((p) => p.name !== trimmed), { name: trimmed, data, prefixes }];
    persistPresets(next);
  };
  const loadPreset = (name: string) => {
    const p = presets.find((x) => x.name === name);
    if (!p) return;
    setData(p.data);
    setPrefixes(p.prefixes);
    try { localStorage.setItem(PREFIXES_KEY, JSON.stringify(p.prefixes)); } catch {}
  };
  const deletePreset = (name: string) => {
    if (!confirm(`Usunąć preset "${name}"?`)) return;
    persistPresets(presets.filter((p) => p.name !== name));
  };
  const duplicatePreset = (name: string) => {
    const p = presets.find((x) => x.name === name);
    if (!p) return;
    const newName = uniqueName(`${p.name} (kopia)`, presets);
    persistPresets([...presets, { name: newName, data: p.data, prefixes: p.prefixes }]);
  };
  const renamePreset = (name: string) => {
    const next = prompt("Nowa nazwa presetu:", name);
    if (!next) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === name) return;
    if (presets.some((p) => p.name === trimmed)) {
      alert("Preset o takiej nazwie już istnieje.");
      return;
    }
    persistPresets(presets.map((p) => (p.name === name ? { ...p, name: trimmed } : p)));
  };

  const exportPresets = () => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vda-presety-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importPresets = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Plik nie zawiera tablicy presetów.");
      const valid = parsed.filter(
        (p: any) => p && typeof p.name === "string" && p.data && p.prefixes,
      ) as Preset[];
      if (!valid.length) throw new Error("Brak prawidłowych presetów w pliku.");
      const merged = [...presets];
      for (const p of valid) {
        const name = uniqueName(p.name, merged);
        merged.push({ name, data: { ...defaultVdaData, ...p.data }, prefixes: { ...defaultPrefixes, ...p.prefixes } });
      }
      persistPresets(merged);
      alert(`Zaimportowano ${valid.length} preset(ów).`);
    } catch (err) {
      alert("Import nie powiódł się: " + (err as Error).message);
    }
  };

  const exportPdf = async () => {
    if (!labelRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(labelRef.current, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        onclone: (doc) => {
          const style = doc.createElement("style");
          style.textContent = `* { border-color: #000 !important; color: #000; background-color: transparent; } .vda-label-root, .vda-label-root * { color: #000 !important; } .vda-label-root { background:#fff !important; }`;
          doc.head.appendChild(style);
        },
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const aw = pw - margin * 2;
      const ah = ph - margin * 2;
      const ratio = canvas.width / canvas.height;
      let w = aw, h = aw / ratio;
      if (h > ah) { h = ah; w = ah * ratio; }
      pdf.addImage(img, "PNG", (pw - w) / 2, (ph - h) / 2, w, h);
      pdf.save("etykieta-vda-4902.pdf");
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Eksport PDF nie powiódł się: " + (err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-[1600px] px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Generator etykiet wysyłkowych VDA 4902</h1>
            <p className="text-sm text-muted-foreground">Standard Label z kodami Code39 · eksport PDF</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <select
              onChange={(e) => { if (e.target.value) { loadPreset(e.target.value); e.target.value = ""; } }}
              className="rounded-md border border-input bg-background px-2 py-2 text-sm"
              defaultValue=""
            >
              <option value="">Wczytaj preset…</option>
              {presets.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <button onClick={savePreset} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Zapisz preset
            </button>
            <button onClick={() => setSettingsOpen(true)} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              Ustawienia
            </button>
            <button
              onClick={exportPdf}
              disabled={exporting}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {exporting ? "Generowanie..." : "Eksportuj do PDF"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 p-6">
        <aside className="bg-background rounded-lg border p-4 h-fit lg:sticky lg:top-6 max-h-[calc(100vh-3rem)] overflow-auto">
          <h2 className="font-semibold mb-3">Dane etykiety</h2>
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {f.label}
                  {f.key in prefixes && (
                    <span className="ml-1 font-mono text-foreground">
                      ({prefixes[f.key as PrefixKey]})
                    </span>
                  )}
                </label>
                {f.textarea ? (
                  <textarea
                    value={data[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                    rows={2}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                  />
                ) : (
                  <input
                    value={data[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </aside>

        <section className="flex justify-center items-start">
          <div className="bg-background p-6 rounded-lg border shadow-sm w-full">
            <VdaLabel ref={labelRef} data={data} prefixes={prefixes} />
          </div>
        </section>
      </main>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Ustawienia</DialogTitle>
            <DialogDescription>
              Zarządzaj prefiksami kodów kreskowych i presetami zapisanymi w przeglądarce.
            </DialogDescription>
          </DialogHeader>

          <section className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Prefiksy kodów kreskowych</h3>
              <button onClick={resetPrefixes} className="text-xs underline text-muted-foreground">
                Reset
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Prefiks (np. P, Q, 30S) dodawany na początek kodu Code39. Jeśli wpiszesz go w wartości pola — zostanie automatycznie usunięty, żeby się nie dublował.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(prefixFieldLabels) as PrefixKey[]).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <label className="text-xs flex-1">{prefixFieldLabels[k]}</label>
                  <input
                    value={prefixes[k]}
                    onChange={(e) => updatePrefix(k, e.target.value)}
                    className="w-20 rounded border border-input bg-background px-2 py-1 text-sm font-mono"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 border-t pt-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold text-sm">Presety ({presets.length})</h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={exportPresets}
                  disabled={!presets.length}
                  className="text-xs rounded border px-2 py-1 hover:bg-muted disabled:opacity-50"
                >
                  Eksportuj JSON
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs rounded border px-2 py-1 hover:bg-muted"
                >
                  Importuj JSON
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importPresets(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            {presets.length === 0 ? (
              <p className="text-xs text-muted-foreground">Brak zapisanych presetów. Użyj „Zapisz preset" w nagłówku.</p>
            ) : (
              <ul className="space-y-1">
                {presets.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-2 text-sm border rounded px-2 py-1.5">
                    <span className="truncate flex-1" title={p.name}>{p.name}</span>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => loadPreset(p.name)} className="text-xs rounded border px-2 py-0.5 hover:bg-muted">
                        Wczytaj
                      </button>
                      <button onClick={() => duplicatePreset(p.name)} className="text-xs rounded border px-2 py-0.5 hover:bg-muted">
                        Duplikuj
                      </button>
                      <button onClick={() => renamePreset(p.name)} className="text-xs rounded border px-2 py-0.5 hover:bg-muted">
                        Zmień nazwę
                      </button>
                      <button onClick={() => deletePreset(p.name)} className="text-xs rounded border px-2 py-0.5 text-destructive hover:bg-destructive/10">
                        Usuń
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </div>
  );
}
