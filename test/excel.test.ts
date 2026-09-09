import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildTaxWorkbook, sanitizeCell } from "@/lib/excel/workbooks";
import { writeWorkbookWithCharts } from "@/lib/excel/charts";
import type { TaxParams } from "@/lib/tax";

const PARAMS: TaxParams = {
  startAge: 62,
  filing: "mfj",
  years: 30,
  taxable: 400_000,
  taxableBasisPct: 0.6,
  deferred: 1_200_000,
  roth: 150_000,
  annualSpend: 60_000,
  otherIncome: 30_000,
  nominalReturn: 0.06,
  inflation: 0.025,
  ltcgRate: 0.15,
  conversionTopRate: 0.12,
  terminalTaxRate: 0.24,
};

describe("sanitizeCell", () => {
  it("prefixes formula-like strings and leaves safe ones alone", () => {
    expect(sanitizeCell("=1+1")).toBe("'=1+1");
    expect(sanitizeCell("+cmd")).toBe("'+cmd");
    expect(sanitizeCell("-2")).toBe("'-2");
    expect(sanitizeCell("@SUM")).toBe("'@SUM");
    expect(sanitizeCell("hello")).toBe("hello");
    expect(sanitizeCell("Married (MFJ)")).toBe("Married (MFJ)");
  });
});

describe("Excel export (native charts)", () => {
  it("produces a valid xlsx with wired-up chart/drawing parts", async () => {
    const { workbook, charts } = buildTaxWorkbook(PARAMS);
    expect(charts.length).toBeGreaterThan(0);

    const buf = await writeWorkbookWithCharts(workbook, charts);
    const zip = await JSZip.loadAsync(buf);
    const names = zip.file(/.*/).map((f) => f.name);

    const chartParts = names.filter((n) => /^xl\/charts\/chart\d+\.xml$/.test(n));
    const drawingParts = names.filter((n) => /^xl\/drawings\/drawing\d+\.xml$/.test(n));
    expect(chartParts.length).toBe(charts.length);
    expect(drawingParts.length).toBeGreaterThan(0);

    // Content types must register the new parts.
    const ct = await zip.file("[Content_Types].xml")!.async("string");
    expect(ct).toContain("drawingml.chart+xml");
    expect(ct).toContain("officedocument.drawing+xml");

    // The Summary sheet must reference a drawing, and a drawing rel must point
    // at a chart.
    const summarySheet = names.find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    expect(summarySheet).toBeDefined();
    const anySheetHasDrawing = (
      await Promise.all(
        names
          .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
          .map((n) => zip.file(n)!.async("string"))
      )
    ).some((xml) => xml.includes("<drawing "));
    expect(anySheetHasDrawing).toBe(true);

    const drawingRel = await zip.file("xl/drawings/_rels/drawing1.xml.rels")!.async("string");
    expect(drawingRel).toContain("../charts/chart1.xml");
  });
});
