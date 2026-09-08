/**
 * Native Excel chart support for ExcelJS workbooks.
 *
 * ExcelJS can build sheets, styles, and formulas but cannot emit native
 * (editable) charts. This module post-processes a finished ExcelJS workbook:
 * it writes the workbook to a buffer, opens the .xlsx zip, and injects the
 * OOXML chart / drawing parts by hand so the charts are real Excel charts bound
 * to the cell ranges — they redraw when the recipient edits the data.
 */

import type ExcelJS from "exceljs";
import JSZip from "jszip";

export interface ExcelSeries {
  /** Reference to a cell holding the series name, e.g. "'Naive'!$B$1". */
  nameRef?: string;
  /** Literal series name (used when there's no header cell). */
  nameLit?: string;
  /** Category (x) range, e.g. "'Naive'!$A$2:$A$31". */
  catRef: string;
  /** Value (y) range, e.g. "'Naive'!$B$2:$B$31". */
  valRef: string;
  /** Series color as a 6-digit hex string (no leading #). */
  color?: string;
}

export interface ExcelChart {
  /** Worksheet name the chart is anchored on. */
  sheet: string;
  type: "line" | "areaStacked" | "bar";
  title: string;
  series: ExcelSeries[];
  /** Anchor rectangle in 0-indexed cell coordinates. */
  anchor: { fromCol: number; fromRow: number; toCol: number; toRow: number };
  catTitle?: string;
  valTitle?: string;
  /** Value-axis number format, e.g. "#,##0" or "0%". */
  valNumFmt?: string;
  /** Treat category references as text (strRef) instead of numbers (numRef). */
  catStr?: boolean;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function axisTitle(text: string, rot?: number): string {
  return (
    `<c:title><c:tx><c:rich><a:bodyPr${rot !== undefined ? ` rot="${rot}" vert="horz"` : ""}/>` +
    `<a:p><a:r><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
  );
}

function seriesXml(type: ExcelChart["type"], s: ExcelSeries, i: number, catStr: boolean): string {
  const tx = s.nameRef
    ? `<c:tx><c:strRef><c:f>${esc(s.nameRef)}</c:f></c:strRef></c:tx>`
    : s.nameLit
    ? `<c:tx><c:v>${esc(s.nameLit)}</c:v></c:tx>`
    : "";

  let spPr = "";
  let extra = "";
  if (type === "line") {
    spPr = s.color
      ? `<c:spPr><a:ln w="22225"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></a:ln></c:spPr>`
      : "";
    extra = `<c:marker><c:symbol val="none"/></c:marker>`;
  } else if (type === "areaStacked") {
    spPr = s.color
      ? `<c:spPr><a:solidFill><a:srgbClr val="${s.color}"><a:alpha val="80000"/></a:srgbClr></a:solidFill></c:spPr>`
      : "";
  } else {
    spPr = s.color
      ? `<c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></c:spPr>`
      : "";
  }

  const cat = catStr
    ? `<c:cat><c:strRef><c:f>${esc(s.catRef)}</c:f></c:strRef></c:cat>`
    : `<c:cat><c:numRef><c:f>${esc(s.catRef)}</c:f></c:numRef></c:cat>`;
  const val = `<c:val><c:numRef><c:f>${esc(s.valRef)}</c:f></c:numRef></c:val>`;
  const smooth = type === "line" ? `<c:smooth val="0"/>` : "";

  return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}${spPr}${extra}${cat}${val}${smooth}</c:ser>`;
}

function chartXml(chart: ExcelChart): string {
  const CAT_AX = 111111111;
  const VAL_AX = 222222222;
  const series = chart.series.map((s, i) => seriesXml(chart.type, s, i, Boolean(chart.catStr))).join("");

  let plot: string;
  if (chart.type === "line") {
    plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:axId val="${CAT_AX}"/><c:axId val="${VAL_AX}"/></c:lineChart>`;
  } else if (chart.type === "areaStacked") {
    plot = `<c:areaChart><c:grouping val="stacked"/><c:varyColors val="0"/>${series}<c:axId val="${CAT_AX}"/><c:axId val="${VAL_AX}"/></c:areaChart>`;
  } else {
    plot = `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}<c:gapWidth val="80"/><c:axId val="${CAT_AX}"/><c:axId val="${VAL_AX}"/></c:barChart>`;
  }

  const catAx =
    `<c:catAx><c:axId val="${CAT_AX}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="b"/>` +
    (chart.catTitle ? axisTitle(chart.catTitle) : "") +
    `<c:crossAx val="${VAL_AX}"/></c:catAx>`;

  const valAx =
    `<c:valAx><c:axId val="${VAL_AX}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/>` +
    (chart.valTitle ? axisTitle(chart.valTitle, -5400000) : "") +
    `<c:numFmt formatCode="${esc(chart.valNumFmt ?? "#,##0")}" sourceLinked="0"/>` +
    `<c:crossAx val="${CAT_AX}"/></c:valAx>`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<c:chart>` +
    `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${esc(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` +
    `<c:autoTitleDeleted val="0"/>` +
    `<c:plotArea><c:layout/>${plot}${catAx}${valAx}</c:plotArea>` +
    `<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>` +
    `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>` +
    `</c:chart></c:chartSpace>`
  );
}

function anchorXml(chart: ExcelChart, frameId: number, relId: string): string {
  const a = chart.anchor;
  return (
    `<xdr:twoCellAnchor editAs="oneCell">` +
    `<xdr:from><xdr:col>${a.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>${a.toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    `<xdr:graphicFrame macro="">` +
    `<xdr:nvGraphicFramePr><xdr:cNvPr id="${frameId}" name="Chart ${frameId}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">` +
    `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${relId}"/>` +
    `</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  );
}

function drawingXml(anchors: string[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    anchors.join("") +
    `</xdr:wsDr>`
  );
}

/** Map worksheet display name → its `xl/worksheets/sheetN.xml` part path. */
async function sheetPathByName(zip: JSZip): Promise<Record<string, string>> {
  const wbXml = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const relsXml = (await zip.file("xl/_rels/workbook.xml.rels")?.async("string")) ?? "";

  const relTarget: Record<string, string> = {};
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g)) {
    relTarget[m[1]] = m[2];
  }
  const out: Record<string, string> = {};
  for (const m of wbXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?>/g)) {
    const name = m[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    let target = relTarget[m[2]] ?? "";
    if (target && !target.startsWith("xl/")) target = "xl/" + target.replace(/^\/?/, "");
    out[name] = target;
  }
  return out;
}

function nextRelId(relsXml: string): string {
  let max = 0;
  for (const m of relsXml.matchAll(/Id="rId(\d+)"/g)) max = Math.max(max, parseInt(m[1], 10));
  return `rId${max + 1}`;
}

/**
 * Write an ExcelJS workbook to a buffer with native charts injected.
 * Charts are grouped by sheet; each sheet gets one drawing part carrying all of
 * its chart frames.
 */
export async function writeWorkbookWithCharts(
  workbook: ExcelJS.Workbook,
  charts: ExcelChart[]
): Promise<Buffer> {
  const raw = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  if (charts.length === 0) return Buffer.from(raw);

  const zip = await JSZip.loadAsync(raw);
  const sheetPaths = await sheetPathByName(zip);

  const bySheet = new Map<string, ExcelChart[]>();
  for (const ch of charts) {
    if (!bySheet.has(ch.sheet)) bySheet.set(ch.sheet, []);
    bySheet.get(ch.sheet)!.push(ch);
  }

  let chartCounter = 0;
  let drawingCounter = 0;
  const contentTypeOverrides: string[] = [];

  for (const [sheetName, sheetCharts] of bySheet) {
    const sheetPath = sheetPaths[sheetName];
    if (!sheetPath) throw new Error(`Excel export: sheet "${sheetName}" not found for charts`);

    drawingCounter += 1;
    const drawingIdx = drawingCounter;
    const drawingPart = `xl/drawings/drawing${drawingIdx}.xml`;
    const drawingRelsPart = `xl/drawings/_rels/drawing${drawingIdx}.xml.rels`;

    const anchors: string[] = [];
    const drawingRels: string[] = [];

    sheetCharts.forEach((ch, i) => {
      chartCounter += 1;
      const chartPart = `xl/charts/chart${chartCounter}.xml`;
      zip.file(chartPart, chartXml(ch));
      contentTypeOverrides.push(
        `<Override PartName="/${chartPart}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`
      );
      const relId = `rId${i + 1}`;
      drawingRels.push(
        `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartCounter}.xml"/>`
      );
      anchors.push(anchorXml(ch, chartCounter, relId));
    });

    zip.file(drawingPart, drawingXml(anchors));
    zip.file(
      drawingRelsPart,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRels.join("")}</Relationships>`
    );
    contentTypeOverrides.push(
      `<Override PartName="/${drawingPart}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
    );

    // Sheet → drawing relationship.
    const sheetRelsPart = sheetPath.replace(/worksheets\/([^/]+)$/, "worksheets/_rels/$1.rels");
    let sheetRels = await zip.file(sheetRelsPart)?.async("string");
    let drawingRelId: string;
    if (sheetRels) {
      drawingRelId = nextRelId(sheetRels);
      sheetRels = sheetRels.replace(
        /<\/Relationships>/,
        `<Relationship Id="${drawingRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIdx}.xml"/></Relationships>`
      );
    } else {
      drawingRelId = "rId1";
      sheetRels =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="${drawingRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${drawingIdx}.xml"/>` +
        `</Relationships>`;
    }
    zip.file(sheetRelsPart, sheetRels);

    // Insert <drawing> into the sheet XML (must come just before </worksheet>).
    let sheetXml = (await zip.file(sheetPath)?.async("string")) ?? "";
    if (!/<drawing\b/.test(sheetXml)) {
      sheetXml = sheetXml.replace(/<\/worksheet>\s*$/, `<drawing r:id="${drawingRelId}"/></worksheet>`);
    }
    zip.file(sheetPath, sheetXml);
  }

  // Register new parts in [Content_Types].xml.
  let ct = (await zip.file("[Content_Types].xml")?.async("string")) ?? "";
  ct = ct.replace(/<\/Types>/, `${contentTypeOverrides.join("")}</Types>`);
  zip.file("[Content_Types].xml", ct);

  const out = await zip.generateAsync({ type: "nodebuffer" });
  return out;
}
