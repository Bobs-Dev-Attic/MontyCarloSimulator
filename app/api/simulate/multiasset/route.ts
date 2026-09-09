import { NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { runMultiAsset, type MultiAssetRequest } from "@/lib/run";
import type { Asset } from "@/lib/multiasset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<MultiAssetRequest>;

    const rawAssets = Array.isArray(body.assets) ? body.assets : [];
    const assets: Asset[] = rawAssets.slice(0, 8).map((a, i) => ({
      id: String((a as Asset).id ?? `a${i}`),
      name: String((a as Asset).name ?? `Asset ${i + 1}`).slice(0, 40),
      mu: num((a as Asset).mu, 0.05),
      sigma: Math.max(0, num((a as Asset).sigma, 0.1)),
      weight: Math.max(0, num((a as Asset).weight, 0)),
    }));

    if (assets.length === 0)
      return NextResponse.json({ error: "at least one asset is required" }, { status: 400 });
    if (assets.reduce((s, a) => s + a.weight, 0) <= 0)
      return NextResponse.json({ error: "asset weights must sum to a positive number" }, { status: 400 });

    const n = assets.length;
    // Validate / sanitize the correlation matrix.
    const rawCorr = Array.isArray(body.corr) ? body.corr : [];
    const corr: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 1;
        const v = num(rawCorr?.[i]?.[j], 0);
        return Math.min(1, Math.max(-1, v));
      })
    );
    // Force symmetry (average the two off-diagonal entries).
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const avg = (corr[i][j] + corr[j][i]) / 2;
        corr[i][j] = avg;
        corr[j][i] = avg;
      }
    }

    const req: MultiAssetRequest = {
      assets,
      corr,
      beginningValue: num(body.beginningValue, 100_000),
      years: num(body.years, 10),
      nSims: Math.round(num(body.nSims, 10_000)),
      seed: body.seed === null || body.seed === undefined ? null : Math.round(num(body.seed, 0)),
      rebalance: Boolean(body.rebalance),
    };

    if (req.beginningValue <= 0)
      return NextResponse.json({ error: "beginningValue must be positive" }, { status: 400 });
    if (req.years <= 0)
      return NextResponse.json({ error: "years must be positive" }, { status: 400 });

    return NextResponse.json(runMultiAsset(req));
  } catch (err) {
    return apiError(err);
  }
}
