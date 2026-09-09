/**
 * Builders that turn a simulation's inputs / results into an ExcelJS workbook
 * plus a set of native-chart definitions (see ./charts).
 *
 * - Tax & Roth is built from its INPUTS as **live Excel formulas** (2024
 *   brackets, RMDs, bracket-fill conversions, progressive tax), so the workbook
 *   recomputes when the recipient edits an assumption — it is a working model,
 *   not a data dump. The formulas mirror lib/tax.ts exactly.
 * - Sequence risk and the Portfolio / Retirement forecast are Monte Carlo, so
 *   their randomness can't live in a spreadsheet; those workbooks carry the
 *   result tables (sweeps, bands, histograms, summary stats) with native charts.
 */

import ExcelJS from "exceljs";
import type { ExcelChart } from "./charts";
import {
  BRACKETS_2024,
  STD_DEDUCTION_2024,
  RMD_DIVISOR,
  type TaxParams,
} from "../tax";
import type { SequenceRiskResult } from "../sequenceRisk";
import type { SimulationResponse } from "../types";

const MONEY = "#,##0";
const PCT = "0.0%";
const FACTOR = "0.000";
const YELLOW = "FFFDE68A";

export interface BuiltWorkbook {
  workbook: ExcelJS.Workbook;
  charts: ExcelChart[];
  filename: string;
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Guard against CSV/formula injection. Every cell these builders write today is
 * either a number or a static label, so nothing user-controlled reaches a cell.
 * But if a free-text field is ever exported, run its value through this: a string
 * a spreadsheet could execute as a formula (leading `= + - @` or a leading tab /
 * carriage return) is prefixed with an apostrophe so it's rendered as text.
 */
export function sanitizeCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

// ---------------------------------------------------------------------------
// Tax & Roth — live-formula model
// ---------------------------------------------------------------------------

export function buildTaxWorkbook(p: TaxParams): BuiltWorkbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Monty Carlo Simulator";
  wb.calcProperties.fullCalcOnLoad = true;

  const filing = p.filing === "mfj" ? "mfj" : "single";
  const brackets = BRACKETS_2024[filing];
  const rates = brackets.map((b) => b.rate); // 7
  const tops = brackets.slice(0, 6).map((b) => b.upTo); // th1..th6
  const stdDed = STD_DEDUCTION_2024[filing];
  const convBracket = brackets.find((b) => b.rate === p.conversionTopRate);
  const convBracketTop = convBracket ? convBracket.upTo : 0;
  const useConv = p.conversionTopRate > 0 && !!convBracket;
  const years = Math.min(50, Math.max(1, Math.round(p.years)));

  // --- Assumptions sheet -------------------------------------------------
  const asx = wb.addWorksheet("Assumptions");
  asx.getColumn(1).width = 30;
  asx.getColumn(2).width = 16;
  asx.getColumn(4).width = 10;
  asx.getColumn(5).width = 14;
  asx.getColumn(7).width = 8;
  asx.getColumn(8).width = 10;

  asx.getCell("A1").value = "Tax & Roth — assumptions";
  asx.getCell("A1").font = { bold: true, size: 14 };
  asx.getCell("A2").value = "Edit the highlighted cells; every sheet and chart recomputes.";
  asx.getCell("A2").font = { italic: true, color: { argb: "FF6B7280" } };

  const rows: [string, string, number | string, string?][] = [
    ["Current age", "startAge", Math.round(p.startAge)],
    ["Filing status", "", filing === "mfj" ? "Married (MFJ)" : "Single"],
    ["Projection years", "years", years],
    ["Taxable brokerage", "taxable", p.taxable, MONEY],
    ["Taxable cost-basis fraction", "basisPct", Math.min(1, Math.max(0, p.taxableBasisPct)), PCT],
    ["Tax-deferred (IRA/401k)", "deferred", p.deferred, MONEY],
    ["Tax-free (Roth)", "roth", p.roth, MONEY],
    ["Annual spending (today's $)", "annualSpend", p.annualSpend, MONEY],
    ["Other taxable income (today's $)", "otherIncome", p.otherIncome, MONEY],
    ["Nominal return", "nominalReturn", p.nominalReturn, PCT],
    ["Inflation", "inflation", p.inflation, PCT],
    ["Capital gains rate", "ltcgRate", p.ltcgRate, PCT],
    ["Roth conversion fills up to rate (0 = off)", "convTopRate", p.conversionTopRate, PCT],
    ["Terminal tax rate (value of leftover IRA)", "terminalTaxRate", p.terminalTaxRate, PCT],
    ["Standard deduction (2024)", "stdDeduction", stdDed, MONEY],
    ["Conversion bracket top (taxable income)", "convBracketTop", convBracketTop, MONEY],
  ];
  let r = 3;
  for (const [label, name, value, fmt] of rows) {
    asx.getCell(`A${r}`).value = label;
    const cell = asx.getCell(`B${r}`);
    cell.value = value;
    if (fmt) cell.numFmt = fmt;
    if (name) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
      wb.definedNames.add(`Assumptions!$B$${r}`, name);
    }
    r += 1;
  }

  // Bracket table (active filing): rates in D, taxable-income tops in E.
  asx.getCell("A20").value = `2024 ordinary brackets — ${filing === "mfj" ? "MFJ" : "Single"}`;
  asx.getCell("A20").font = { bold: true };
  asx.getCell("C21").value = "Rate";
  asx.getCell("D21").value = "Top (taxable income)";
  for (let i = 0; i < 7; i++) {
    const rr = 22 + i;
    asx.getCell(`C${rr}`).value = rates[i];
    asx.getCell(`C${rr}`).numFmt = PCT;
    wb.definedNames.add(`Assumptions!$C$${rr}`, `taxRate${i + 1}`);
    if (i < 6) {
      asx.getCell(`D${rr}`).value = tops[i];
      asx.getCell(`D${rr}`).numFmt = MONEY;
      wb.definedNames.add(`Assumptions!$D$${rr}`, `taxTop${i + 1}`);
    } else {
      asx.getCell(`D${rr}`).value = "and up";
    }
  }

  // RMD Uniform Lifetime Table (age → divisor) for VLOOKUP.
  asx.getCell("G2").value = "Age";
  asx.getCell("H2").value = "RMD divisor";
  asx.getCell("G2").font = { bold: true };
  asx.getCell("H2").font = { bold: true };
  const ages = Object.keys(RMD_DIVISOR).map(Number).sort((a, b) => a - b);
  ages.forEach((age, i) => {
    asx.getCell(`G${3 + i}`).value = age;
    asx.getCell(`H${3 + i}`).value = RMD_DIVISOR[age];
  });
  wb.definedNames.add(`Assumptions!$G$3:$H$${2 + ages.length}`, "RMDtable");

  // --- Year-by-year strategy sheets -------------------------------------
  const HEADERS = [
    "Year", "Age", "Infl factor",
    "Taxable start", "Basis start", "Deferred start", "Roth start",
    "Taxable grown", "Deferred grown", "Roth grown",
    "RMD", "Deferred after RMD", "Ord. income (pre-conv)", "Roth conversion",
    "Deferred after conv", "Roth after conv", "Ord. income (post-conv)",
    "Spend need", "Cash (RMD)", "Need after cash",
    "Draw: taxable", "Gain fraction", "Realized gain", "Basis after draw",
    "Taxable after draw", "Need after taxable",
    "Draw: deferred", "Deferred after draw", "Ord. income + deferred", "Need after deferred",
    "Draw: Roth", "Roth after draw",
    "Taxable ord. income", "Ordinary tax", "LTCG tax", "Total tax",
    "Pay tax: taxable", "Taxable end", "Tax remaining", "Pay tax: deferred",
    "Deferred end", "Tax remaining 2", "Pay tax: Roth", "Roth end",
  ]; // 44 columns A..AR

  const progressiveTax = (rr: number) =>
    `taxRate1*MIN(AG${rr},taxTop1*C${rr})` +
    `+taxRate2*MAX(0,MIN(AG${rr},taxTop2*C${rr})-taxTop1*C${rr})` +
    `+taxRate3*MAX(0,MIN(AG${rr},taxTop3*C${rr})-taxTop2*C${rr})` +
    `+taxRate4*MAX(0,MIN(AG${rr},taxTop4*C${rr})-taxTop3*C${rr})` +
    `+taxRate5*MAX(0,MIN(AG${rr},taxTop5*C${rr})-taxTop4*C${rr})` +
    `+taxRate6*MAX(0,MIN(AG${rr},taxTop6*C${rr})-taxTop5*C${rr})` +
    `+taxRate7*MAX(0,AG${rr}-taxTop6*C${rr})`;

  const buildStrategy = (name: string, withConv: boolean): ExcelJS.Worksheet => {
    const ws = wb.addWorksheet(name);
    ws.addRow(HEADERS);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { wrapText: true, vertical: "top" };
    ws.views = [{ state: "frozen", ySplit: 1, xSplit: 3 }];

    for (let t = 0; t < years; t++) {
      const rr = t + 2; // data row
      const prev = rr - 1;
      const first = t === 0;
      const F = (formula: string) => ({ formula });

      const conv = withConv
        ? `MAX(0, MIN((convBracketTop+stdDeduction)*C${rr}-M${rr}, L${rr}))`
        : "0";

      const cells: Record<string, ExcelJS.CellValue> = {
        A: t + 1,
        B: F(`startAge+${t}`),
        C: F(`(1+inflation)^(A${rr}-1)`),
        D: first ? F(`taxable`) : F(`AL${prev}`),
        E: first ? F(`taxable*basisPct`) : F(`X${prev}`),
        F: first ? F(`deferred`) : F(`AO${prev}`),
        G: first ? F(`roth`) : F(`AR${prev}`),
        H: F(`D${rr}*(1+nominalReturn)`),
        I: F(`F${rr}*(1+nominalReturn)`),
        J: F(`G${rr}*(1+nominalReturn)`),
        K: F(`IF(AND(B${rr}>=73,I${rr}>0), I${rr}/VLOOKUP(MIN(B${rr},110),RMDtable,2,FALSE), 0)`),
        L: F(`I${rr}-K${rr}`),
        M: F(`otherIncome*C${rr}+K${rr}`),
        N: F(conv),
        O: F(`L${rr}-N${rr}`),
        P: F(`J${rr}+N${rr}`),
        Q: F(`M${rr}+N${rr}`),
        R: F(`annualSpend*C${rr}`),
        S: F(`K${rr}`),
        T: F(`MAX(0,R${rr}-S${rr})`),
        U: F(`MIN(T${rr},H${rr})`),
        V: F(`IF(H${rr}>0,(H${rr}-E${rr})/H${rr},0)`),
        W: F(`U${rr}*V${rr}`),
        X: F(`E${rr}-U${rr}*(1-V${rr})`),
        Y: F(`H${rr}-U${rr}`),
        Z: F(`T${rr}-U${rr}`),
        AA: F(`MIN(Z${rr},O${rr})`),
        AB: F(`O${rr}-AA${rr}`),
        AC: F(`Q${rr}+AA${rr}`),
        AD: F(`Z${rr}-AA${rr}`),
        AE: F(`MIN(AD${rr},P${rr})`),
        AF: F(`P${rr}-AE${rr}`),
        AG: F(`MAX(0,AC${rr}-stdDeduction*C${rr})`),
        AH: F(progressiveTax(rr)),
        AI: F(`MAX(0,W${rr})*ltcgRate`),
        AJ: F(`AH${rr}+AI${rr}`),
        AK: F(`MIN(AJ${rr},Y${rr})`),
        AL: F(`Y${rr}-AK${rr}`),
        AM: F(`AJ${rr}-AK${rr}`),
        AN: F(`MIN(AM${rr},AB${rr})`),
        AO: F(`AB${rr}-AN${rr}`),
        AP: F(`AM${rr}-AN${rr}`),
        AQ: F(`MIN(AP${rr},AF${rr})`),
        AR: F(`AF${rr}-AQ${rr}`),
      };
      for (const [colLetter, value] of Object.entries(cells)) {
        ws.getCell(`${colLetter}${rr}`).value = value;
      }
    }

    // Number formats for the money/percent columns.
    const money = ["D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","W","X","Y","Z","AA","AB","AC","AD","AE","AF","AG","AH","AI","AJ","AK","AL","AM","AN","AO","AP","AQ","AR"];
    for (const c of money) ws.getColumn(c).numFmt = MONEY;
    ws.getColumn("C").numFmt = FACTOR;
    ws.getColumn("V").numFmt = PCT;
    return ws;
  };

  buildStrategy("Naive", false);
  buildStrategy("TaxSmart", useConv);

  // --- Summary sheet -----------------------------------------------------
  const last = years + 1; // last data row
  const sm = wb.addWorksheet("Summary");
  sm.getColumn(1).width = 34;
  sm.getColumn(2).width = 16;
  sm.getColumn(3).width = 16;
  sm.getColumn(8).width = 14;
  sm.getColumn(9).width = 16;

  sm.getCell("A1").value = "Tax & Roth — strategy comparison";
  sm.getCell("A1").font = { bold: true, size: 14 };

  const afterTax = (s: string) =>
    `${s}!AL${last}-MAX(0,${s}!AL${last}-${s}!X${last})*ltcgRate+${s}!AO${last}*(1-terminalTaxRate)+${s}!AR${last}`;

  sm.getCell("A3").value = "Metric";
  sm.getCell("B3").value = "Naive";
  sm.getCell("C3").value = "Tax-smart";
  sm.getRow(3).font = { bold: true };
  const metricRows: [string, string, string, string][] = [
    ["After-tax terminal wealth", afterTax("Naive"), afterTax("TaxSmart"), MONEY],
    ["Nominal terminal wealth", `Naive!AL${last}+Naive!AO${last}+Naive!AR${last}`, `TaxSmart!AL${last}+TaxSmart!AO${last}+TaxSmart!AR${last}`, MONEY],
    ["Lifetime taxes paid", `SUM(Naive!AJ2:AJ${last})`, `SUM(TaxSmart!AJ2:AJ${last})`, MONEY],
    ["Total RMDs", `SUM(Naive!K2:K${last})`, `SUM(TaxSmart!K2:K${last})`, MONEY],
    ["Total Roth conversions", `SUM(Naive!N2:N${last})`, `SUM(TaxSmart!N2:N${last})`, MONEY],
  ];
  let mr = 4;
  for (const [label, nf, sf, fmt] of metricRows) {
    sm.getCell(`A${mr}`).value = label;
    sm.getCell(`B${mr}`).value = { formula: nf };
    sm.getCell(`C${mr}`).value = { formula: sf };
    sm.getCell(`B${mr}`).numFmt = fmt;
    sm.getCell(`C${mr}`).numFmt = fmt;
    mr += 1;
  }
  sm.getCell("A10").value = "After-tax gain (Tax-smart − Naive)";
  sm.getCell("B10").value = { formula: "C4-B4" };
  sm.getCell("B10").numFmt = MONEY;
  sm.getCell("B10").font = { bold: true };
  sm.getCell("A11").value = "Lifetime tax saved (Naive − Tax-smart)";
  sm.getCell("B11").value = { formula: "B6-C6" };
  sm.getCell("B11").numFmt = MONEY;

  // Helper table for the terminal-wealth bar chart (text categories).
  sm.getCell("H3").value = "Naive";
  sm.getCell("H4").value = "Tax-smart";
  sm.getCell("I3").value = { formula: "B4" };
  sm.getCell("I4").value = { formula: "C4" };
  sm.getCell("I3").numFmt = MONEY;
  sm.getCell("I4").numFmt = MONEY;

  const charts: ExcelChart[] = [
    {
      sheet: "Summary",
      type: "bar",
      title: "After-tax terminal wealth",
      catStr: true,
      series: [{ nameLit: "After-tax wealth", catRef: "Summary!$H$3:$H$4", valRef: "Summary!$I$3:$I$4", color: "34D399" }],
      anchor: { fromCol: 0, fromRow: 12, toCol: 6, toRow: 28 },
      valNumFmt: MONEY,
    },
    {
      sheet: "Summary",
      type: "areaStacked",
      title: "Account balances — Tax-smart",
      catTitle: "Age",
      valTitle: "Balance",
      series: [
        { nameLit: "Taxable", catRef: `TaxSmart!$B$2:$B$${last}`, valRef: `TaxSmart!$AL$2:$AL$${last}`, color: "38BDF8" },
        { nameLit: "Tax-deferred", catRef: `TaxSmart!$B$2:$B$${last}`, valRef: `TaxSmart!$AO$2:$AO$${last}`, color: "F59E0B" },
        { nameLit: "Roth", catRef: `TaxSmart!$B$2:$B$${last}`, valRef: `TaxSmart!$AR$2:$AR$${last}`, color: "34D399" },
      ],
      anchor: { fromCol: 7, fromRow: 12, toCol: 15, toRow: 28 },
      valNumFmt: MONEY,
    },
    {
      sheet: "Summary",
      type: "line",
      title: "Annual tax, RMDs & conversions — Tax-smart",
      catTitle: "Age",
      valTitle: "Dollars",
      series: [
        { nameLit: "Total tax", catRef: `TaxSmart!$B$2:$B$${last}`, valRef: `TaxSmart!$AJ$2:$AJ$${last}`, color: "F87171" },
        { nameLit: "RMD", catRef: `TaxSmart!$B$2:$B$${last}`, valRef: `TaxSmart!$K$2:$K$${last}`, color: "A78BFA" },
        { nameLit: "Roth conversion", catRef: `TaxSmart!$B$2:$B$${last}`, valRef: `TaxSmart!$N$2:$N$${last}`, color: "34D399" },
      ],
      anchor: { fromCol: 0, fromRow: 29, toCol: 8, toRow: 45 },
      valNumFmt: MONEY,
    },
  ];

  // Put Summary first in tab order.
  wb.worksheets.sort((a, b) => (a.name === "Summary" ? -1 : b.name === "Summary" ? 1 : 0));

  return { workbook: wb, charts, filename: `tax-roth-projection-${stamp()}.xlsx` };
}

// ---------------------------------------------------------------------------
// Sequence risk — result tables + charts
// ---------------------------------------------------------------------------

export function buildSequenceRiskWorkbook(d: SequenceRiskResult): BuiltWorkbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Monty Carlo Simulator";

  const sweep = wb.addWorksheet("BufferSweep");
  sweep.columns = [
    { header: "Buffer (years)", key: "b", width: 14 },
    { header: "Amount ($)", key: "amt", width: 14 },
    { header: "Sell-at-trough prob.", key: "sell", width: 18 },
    { header: "Ruin prob.", key: "ruin", width: 14 },
    { header: "Median ending ($)", key: "end", width: 18 },
  ];
  sweep.getRow(1).font = { bold: true };
  for (const pnt of d.sweep) {
    sweep.addRow({ b: pnt.bufferYears, amt: Math.round(pnt.bufferDollars), sell: pnt.sellProb, ruin: pnt.ruinProb, end: Math.round(pnt.medianTerminalReal) });
  }
  sweep.getColumn("amt").numFmt = MONEY;
  sweep.getColumn("end").numFmt = MONEY;
  sweep.getColumn("sell").numFmt = PCT;
  sweep.getColumn("ruin").numFmt = PCT;
  const nSweep = d.sweep.length + 1;

  const cmp = wb.addWorksheet("RefillCompare");
  cmp.columns = [
    { header: "Buffer (years)", key: "b", width: 14 },
    { header: "Ruin — refill on", key: "ron", width: 16 },
    { header: "Ruin — refill off", key: "roff", width: 16 },
    { header: "Median end — refill on ($)", key: "eon", width: 22 },
    { header: "Median end — refill off ($)", key: "eoff", width: 22 },
  ];
  cmp.getRow(1).font = { bold: true };
  const n = Math.max(d.compare.on.length, d.compare.off.length);
  for (let i = 0; i < n; i++) {
    const on = d.compare.on[i];
    const off = d.compare.off[i];
    cmp.addRow({
      b: on?.bufferYears ?? off?.bufferYears ?? i,
      ron: on?.ruinProb, roff: off?.ruinProb,
      eon: on ? Math.round(on.medianTerminalReal) : undefined,
      eoff: off ? Math.round(off.medianTerminalReal) : undefined,
    });
  }
  cmp.getColumn("ron").numFmt = PCT;
  cmp.getColumn("roff").numFmt = PCT;
  cmp.getColumn("eon").numFmt = MONEY;
  cmp.getColumn("eoff").numFmt = MONEY;
  const nCmp = n + 1;

  const eq = wb.addWorksheet("EquityPath");
  eq.columns = [
    { header: "Retirement year", key: "yr", width: 16 },
    { header: "Median equity — no buffer ($)", key: "no", width: 26 },
    { header: `Median equity — ${d.recommendedBufferYears ?? "rec."}-yr buffer ($)`, key: "rec", width: 28 },
  ];
  eq.getRow(1).font = { bold: true };
  d.steps.forEach((yr, i) => {
    eq.addRow({ yr, no: Math.round(d.equityPathNoBuffer[i] ?? 0), rec: Math.round(d.equityPathRecommended[i] ?? 0) });
  });
  eq.getColumn("no").numFmt = MONEY;
  eq.getColumn("rec").numFmt = MONEY;
  const nEq = d.steps.length + 1;

  const charts: ExcelChart[] = [
    {
      sheet: "BufferSweep",
      type: "line",
      title: "Vulnerability vs. buffer size",
      catTitle: "Buffer (years of spending)",
      valTitle: "Probability",
      valNumFmt: "0%",
      series: [
        { nameRef: "BufferSweep!$C$1", catRef: `BufferSweep!$A$2:$A$${nSweep}`, valRef: `BufferSweep!$C$2:$C$${nSweep}`, color: "F87171" },
        { nameRef: "BufferSweep!$D$1", catRef: `BufferSweep!$A$2:$A$${nSweep}`, valRef: `BufferSweep!$D$2:$D$${nSweep}`, color: "F59E0B" },
      ],
      anchor: { fromCol: 6, fromRow: 1, toCol: 14, toRow: 18 },
    },
    {
      sheet: "RefillCompare",
      type: "line",
      title: "Ruin probability — rolling bucket vs. static tent",
      catTitle: "Buffer (years)",
      valTitle: "Ruin probability",
      valNumFmt: "0%",
      series: [
        { nameRef: "RefillCompare!$B$1", catRef: `RefillCompare!$A$2:$A$${nCmp}`, valRef: `RefillCompare!$B$2:$B$${nCmp}`, color: "34D399" },
        { nameRef: "RefillCompare!$C$1", catRef: `RefillCompare!$A$2:$A$${nCmp}`, valRef: `RefillCompare!$C$2:$C$${nCmp}`, color: "A78BFA" },
      ],
      anchor: { fromCol: 6, fromRow: 1, toCol: 14, toRow: 18 },
    },
    {
      sheet: "RefillCompare",
      type: "line",
      title: "Median ending balance — rolling bucket vs. static tent",
      catTitle: "Buffer (years)",
      valTitle: "Median ending ($)",
      valNumFmt: MONEY,
      series: [
        { nameRef: "RefillCompare!$D$1", catRef: `RefillCompare!$A$2:$A$${nCmp}`, valRef: `RefillCompare!$D$2:$D$${nCmp}`, color: "34D399" },
        { nameRef: "RefillCompare!$E$1", catRef: `RefillCompare!$A$2:$A$${nCmp}`, valRef: `RefillCompare!$E$2:$E$${nCmp}`, color: "A78BFA" },
      ],
      anchor: { fromCol: 6, fromRow: 20, toCol: 14, toRow: 37 },
    },
    {
      sheet: "EquityPath",
      type: "line",
      title: "Median equity value through the bear window",
      catTitle: "Retirement year",
      valTitle: "Equity value ($)",
      valNumFmt: MONEY,
      series: [
        { nameRef: "EquityPath!$B$1", catRef: `EquityPath!$A$2:$A$${nEq}`, valRef: `EquityPath!$B$2:$B$${nEq}`, color: "F87171" },
        { nameRef: "EquityPath!$C$1", catRef: `EquityPath!$A$2:$A$${nEq}`, valRef: `EquityPath!$C$2:$C$${nEq}`, color: "34D399" },
      ],
      anchor: { fromCol: 4, fromRow: 1, toCol: 13, toRow: 20 },
    },
  ];

  return { workbook: wb, charts, filename: `sequence-risk-${stamp()}.xlsx` };
}

// ---------------------------------------------------------------------------
// Portfolio / Retirement forecast — aggregates + charts
// ---------------------------------------------------------------------------

export function buildForecastWorkbook(res: SimulationResponse, label: string): BuiltWorkbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Monty Carlo Simulator";
  const xUnit = res.xAxis?.label ?? "Year";

  // Summary stats
  const sm = wb.addWorksheet("Summary");
  sm.getColumn(1).width = 30;
  sm.getColumn(2).width = 18;
  sm.getCell("A1").value = `${label} — summary`;
  sm.getCell("A1").font = { bold: true, size: 14 };
  const s = res.summary;
  const meta = res.meta;
  const statRows: [string, number, string?][] = [
    ["Simulations", Number(meta.nSims) || 0],
    ["Beginning value", Number(meta.beginningValue) || 0, MONEY],
    ["Median terminal", s.median, MONEY],
    ["Mean terminal", s.mean, MONEY],
    ["5th percentile", s.p5, MONEY],
    ["95th percentile", s.p95, MONEY],
    ["Minimum", s.min, MONEY],
    ["Maximum", s.max, MONEY],
    ["95% Value at Risk", s.var95, MONEY],
    ["Probability of loss", s.probLoss, PCT],
    ["Success rate", s.successRate, PCT],
  ];
  let rr = 3;
  for (const [label2, val, fmt] of statRows) {
    sm.getCell(`A${rr}`).value = label2;
    sm.getCell(`B${rr}`).value = val;
    if (fmt) sm.getCell(`B${rr}`).numFmt = fmt;
    rr += 1;
  }

  // Percentile bands
  const bands = res.bands;
  const bs = wb.addWorksheet("Bands");
  bs.columns = [
    { header: xUnit, key: "x", width: 10 },
    { header: "P5", key: "p5", width: 14 },
    { header: "P25", key: "p25", width: 14 },
    { header: "P50 (median)", key: "p50", width: 14 },
    { header: "P75", key: "p75", width: 14 },
    { header: "P95", key: "p95", width: 14 },
  ];
  bs.getRow(1).font = { bold: true };
  const round2 = (v: number) => Math.round(v * 100) / 100;
  bands.steps.forEach((x, i) => {
    bs.addRow({ x: round2(x), p5: Math.round(bands.p5[i]), p25: Math.round(bands.p25[i]), p50: Math.round(bands.p50[i]), p75: Math.round(bands.p75[i]), p95: Math.round(bands.p95[i]) });
  });
  for (const c of ["p5", "p25", "p50", "p75", "p95"]) bs.getColumn(c).numFmt = MONEY;
  const nB = bands.steps.length + 1;

  // Histogram
  const h = res.histogram;
  const hs = wb.addWorksheet("Histogram");
  hs.columns = [
    { header: "Terminal value (bin midpoint)", key: "mid", width: 26 },
    { header: "Count", key: "count", width: 12 },
  ];
  hs.getRow(1).font = { bold: true };
  for (let i = 0; i < h.counts.length; i++) {
    const mid = (h.edges[i] + h.edges[i + 1]) / 2;
    hs.addRow({ mid: Math.round(mid), count: h.counts[i] });
  }
  hs.getColumn("mid").numFmt = MONEY;
  const nH = h.counts.length + 1;

  const charts: ExcelChart[] = [
    {
      sheet: "Bands",
      type: "line",
      title: "Percentile bands over time",
      catTitle: xUnit,
      valTitle: "Portfolio value ($)",
      valNumFmt: MONEY,
      series: [
        { nameRef: "Bands!$B$1", catRef: `Bands!$A$2:$A$${nB}`, valRef: `Bands!$B$2:$B$${nB}`, color: "F87171" },
        { nameRef: "Bands!$C$1", catRef: `Bands!$A$2:$A$${nB}`, valRef: `Bands!$C$2:$C$${nB}`, color: "FBBF24" },
        { nameRef: "Bands!$D$1", catRef: `Bands!$A$2:$A$${nB}`, valRef: `Bands!$D$2:$D$${nB}`, color: "38BDF8" },
        { nameRef: "Bands!$E$1", catRef: `Bands!$A$2:$A$${nB}`, valRef: `Bands!$E$2:$E$${nB}`, color: "34D399" },
        { nameRef: "Bands!$F$1", catRef: `Bands!$A$2:$A$${nB}`, valRef: `Bands!$F$2:$F$${nB}`, color: "22C55E" },
      ],
      anchor: { fromCol: 7, fromRow: 1, toCol: 16, toRow: 20 },
    },
    {
      sheet: "Histogram",
      type: "bar",
      title: "Distribution of terminal outcomes",
      catTitle: "Terminal value",
      valTitle: "Count",
      valNumFmt: "#,##0",
      series: [
        { nameRef: "Histogram!$B$1", catRef: `Histogram!$A$2:$A$${nH}`, valRef: `Histogram!$B$2:$B$${nH}`, color: "38BDF8" },
      ],
      anchor: { fromCol: 3, fromRow: 1, toCol: 13, toRow: 20 },
    },
  ];

  const slug = label.toLowerCase().includes("retire") ? "retirement" : "portfolio";
  return { workbook: wb, charts, filename: `${slug}-forecast-${stamp()}.xlsx` };
}
