"use client";

/**
 * Client helper: POST a view's inputs to the Excel export API and trigger a
 * download of the returned .xlsx. The server builds the workbook (tables,
 * live formulas for Tax & Roth, and native charts).
 */
export async function exportToExcel(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/export/excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = "Export failed";
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      // non-JSON error
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = cd.match(/filename="([^"]+)"/);
  const name = m ? m[1] : "monty-carlo-export.xlsx";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
