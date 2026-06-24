import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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

function Index() {
  const [data, setData] = useState<VdaData>(defaultVdaData);
  const [prefixes, setPrefixes] = useState<VdaPrefixes>(defaultPrefixes);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPrefixes(loadPrefixes());
    setPresets(loadPresets());
  }, []);

  const update = (k: keyof VdaData, v: string) => setData((d) => ({ ...d, [k]: v }));
  const updatePrefix = (k: PrefixKey, v: string) => {
    setPrefixes((p) => {
      const next = { ...p, [k]: v.toUpperCase().replace(/\s/g, "") };
      try { localStorage.setItem(PREFIXES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const resetPrefixes = () => {
    setPrefixes(defaultPrefixes);
    try { localStorage.setItem(PREFIXES_KEY, JSON.stringify(defaultPrefixes)); } catch {}
  };

  const savePreset = () => {
    const name = prompt("Nazwa presetu:");
    if (!name) return;
    const next = [...presets.filter((p) => p.name !== name), { name, data, prefixes }];
    setPresets(next);
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); } catch {}
  };
  const loadPreset = (name: string) => {
    const p = presets.find((x) => x.name === name);
    if (!p) return;
    setData(p.data);
    setPrefixes(p.prefixes);
  };
  const deletePreset = (name: string) => {
    if (!confirm(`Usunąć preset "${name}"?`)) return;
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); } catch {}
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
            <button onClick={() => setShowSettings((s) => !s)} className="rounded-md border px-3 py-2 text-sm hover:bg-muted">
              {showSettings ? "Ukryj ustawienia" : "Ustawienia prefiksów"}
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
          {showSettings && (
            <div className="mb-4 pb-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Prefiksy kodów kreskowych</h2>
                <button onClick={resetPrefixes} className="text-xs underline text-muted-foreground">
                  Reset
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Prefiks (np. P, Q, 30S) dodawany na początek kodu Code39. Jeśli wpiszesz go w wartości pola — zostanie automatycznie usunięty, żeby się nie dublował.
              </p>
              <div className="space-y-2">
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
              {presets.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2">Zapisane presety</h3>
                  <ul className="space-y-1">
                    {presets.map((p) => (
                      <li key={p.name} className="flex items-center justify-between text-sm">
                        <button onClick={() => loadPreset(p.name)} className="underline text-left flex-1 truncate">
                          {p.name}
                        </button>
                        <button onClick={() => deletePreset(p.name)} className="text-xs text-destructive ml-2">
                          Usuń
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

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
    </div>
  );
}
