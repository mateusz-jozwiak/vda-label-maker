import { useEffect, useRef, forwardRef } from "react";
import JsBarcode from "jsbarcode";

export type VdaData = {
  recipient: string;
  unloadingPoint: string;
  deliveryNoteNo: string;
  supplierAddress: string;
  netWeight: string;
  grossWeight: string;
  packagesCount: string;
  partNoCustomer: string;
  quantity: string;
  description: string;
  partNoSupplier: string;
  supplierNo: string;
  date: string;
  engineeringChange: string;
  packageNo: string;
  batchNo: string;
  footerLeft: string;
  footerRight: string;
};

export const defaultVdaData: VdaData = {
  recipient: "Fa. Muster KG\n00000 Musterstadt",
  unloadingPoint: "384 T",
  deliveryNoteNo: "12345678",
  supplierAddress: "A. Absender, Werk, 11111 Lieferstadt",
  netWeight: "34 kg",
  grossWeight: "158 kg",
  packagesCount: "3",
  partNoCustomer: "A 123 456 7890",
  quantity: "1 000 St.",
  description: "Elektr. Steuergerät",
  partNoSupplier: "987654321 B",
  supplierNo: "123 45678",
  date: "D 960126",
  engineeringChange: "D 940801",
  packageNo: "9876543 21",
  batchNo: "C 123456",
  footerLeft: "A. Absender GmbH & Co. KG, 11111 Lieferstadt",
  footerRight: "Warenanhänger VDA 4902, Version 4",
};

function Barcode({ value, height = 36 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: "CODE39",
          displayValue: false,
          height,
          margin: 0,
          width: 1.4,
        });
      } catch (e) {
        // noop
      }
    }
  }, [value, height]);
  return <svg ref={ref} className="w-full" style={{ height }} />;
}

function Cell({
  label,
  children,
  className = "",
}: {
  label: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`vda-cell ${className}`}>
      <div className="vda-label-text">{label}</div>
      <div className="vda-cell-content">{children}</div>
    </div>
  );
}

export const VdaLabel = forwardRef<HTMLDivElement, { data: VdaData }>(
  ({ data }, ref) => {
    return (
      <div ref={ref} className="vda-label-root">
        <div className="vda-grid">
          {/* Row 1 */}
          <Cell label="(1) Warenempfänger" className="col-span-7">
            <div className="vda-value-lg whitespace-pre-line">{data.recipient}</div>
          </Cell>
          <Cell label="(2) Abladestelle - Lagerort - Verwendungsschlüssel" className="col-span-5">
            <div className="vda-value-xl text-center">{data.unloadingPoint}</div>
          </Cell>

          {/* Row 2 */}
          <Cell label="(3) Lieferschein-Nr. (N)" className="col-span-7">
            <div className="vda-value-lg text-center">{data.deliveryNoteNo}</div>
            <Barcode value={data.deliveryNoteNo} />
          </Cell>
          <div className="col-span-5 vda-subgrid">
            <Cell label="(4) Lieferantenanschrift (Kurzname, Werk, PLZ Ort)" className="col-span-12">
              <div className="vda-value-md">{data.supplierAddress}</div>
            </Cell>
            <Cell label="(5) Gewicht Netto" className="col-span-4">
              <div className="vda-value-md text-center">{data.netWeight}</div>
            </Cell>
            <Cell label="(6) Gewicht Brutto" className="col-span-4">
              <div className="vda-value-md text-center">{data.grossWeight}</div>
            </Cell>
            <Cell label="(7) Anzahl Packstücke" className="col-span-4">
              <div className="vda-value-md text-center">{data.packagesCount}</div>
            </Cell>
          </div>

          {/* Row 3 - full width */}
          <Cell label="(8) Sach-Nr. Kunde (P)" className="col-span-12">
            <div className="vda-value-xl text-center">{data.partNoCustomer}</div>
            <Barcode value={data.partNoCustomer.replace(/\s/g, "")} height={60} />
          </Cell>

          {/* Row 4 */}
          <div className="col-span-5 vda-subgrid">
            <Cell label="(9) Füllmenge (Q)" className="col-span-12">
              <div className="vda-value-lg">{data.quantity}</div>
              <Barcode value={data.quantity.replace(/\s/g, "")} />
            </Cell>
            <Cell label="(12) Lieferanten-Nr. (V)" className="col-span-12">
              <div className="vda-value-lg text-center">{data.supplierNo}</div>
              <Barcode value={data.supplierNo.replace(/\s/g, "")} />
            </Cell>
          </div>
          <div className="col-span-7 vda-subgrid">
            <Cell label="(10) Bezeichnung, Lieferung, Leistung" className="col-span-12">
              <div className="vda-value-lg text-center">{data.description}</div>
            </Cell>
            <Cell label="(11) Sach-Nr. Lieferant (30S)" className="col-span-12">
              <div className="vda-value-lg text-right">{data.partNoSupplier}</div>
              <Barcode value={data.partNoSupplier.replace(/\s/g, "")} />
            </Cell>
            <Cell label="(13) Datum" className="col-span-6">
              <div className="vda-value-md text-center">{data.date}</div>
            </Cell>
            <Cell label="(14) Änderungsstand Konstruktion" className="col-span-6">
              <div className="vda-value-md text-center">{data.engineeringChange}</div>
            </Cell>
          </div>

          {/* Row 5 */}
          <Cell label="(15) Packstück-Nr. (S)" className="col-span-5">
            <div className="vda-value-lg text-center">{data.packageNo}</div>
            <Barcode value={data.packageNo.replace(/\s/g, "")} />
          </Cell>
          <Cell label="(16) Chargen-Nr. (H)" className="col-span-7">
            <div className="vda-value-lg text-center">{data.batchNo}</div>
            <Barcode value={data.batchNo.replace(/\s/g, "")} />
          </Cell>
        </div>
      </div>
    );
  }
);
VdaLabel.displayName = "VdaLabel";
