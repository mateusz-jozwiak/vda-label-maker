import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { VdaLabel, defaultVdaData, type VdaData } from "@/components/VdaLabel";

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

function Index() {
  const [data, setData] = useState<VdaData>(defaultVdaData);
  const labelRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const update = (k: keyof VdaData, v: string) => setData((d) => ({ ...d, [k]: v }));

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
          // Neutralize oklch() values (Tailwind v4) that html2canvas cannot parse
          doc.querySelectorAll<HTMLElement>("*").forEach((el) => {
            el.style.borderColor = el.style.borderColor || "#000";
          });
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
        <div className="mx-auto max-w-[1600px] px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Generator etykiet wysyłkowych VDA 4902</h1>
            <p className="text-sm text-muted-foreground">Standard Label z kodami Code39 · eksport PDF</p>
          </div>
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {exporting ? "Generowanie..." : "Eksportuj do PDF"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 p-6">
        <aside className="bg-background rounded-lg border p-4 h-fit lg:sticky lg:top-6 max-h-[calc(100vh-3rem)] overflow-auto">
          <h2 className="font-semibold mb-3">Dane etykiety</h2>
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{f.label}</label>
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
            <VdaLabel ref={labelRef} data={data} />
          </div>
        </section>
      </main>
    </div>
  );
}
