/**
 * Color themes. Each sets the app's CSS variables (space-separated RGB
 * channels). All are dark palettes that keep light text readable; they mainly
 * vary the accent hues and the panel/background tint.
 */

export interface Theme {
  id: string;
  name: string;
  /** Small swatch colors for the picker (accent, accent2). */
  swatch: [string, string];
  vars: Record<string, string>;
}

const BASE = {
  good: "52 211 153",
  bad: "248 113 113",
  text: "230 237 247",
};

export const THEMES: Theme[] = [
  {
    id: "amber",
    name: "Amber (default)",
    swatch: ["#f59e0b", "#38bdf8"],
    vars: {
      ink: "11 18 32",
      panel: "17 26 46",
      panel2: "14 22 38",
      line: "30 42 68",
      accent: "245 158 11",
      accent2: "56 189 248",
      muted: "142 161 192",
      ...BASE,
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    swatch: ["#38bdf8", "#818cf8"],
    vars: {
      ink: "8 15 28",
      panel: "15 27 46",
      panel2: "11 21 38",
      line: "28 45 72",
      accent: "56 189 248",
      accent2: "129 140 248",
      muted: "138 165 199",
      ...BASE,
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    swatch: ["#34d399", "#fbbf24"],
    vars: {
      ink: "9 20 18",
      panel: "14 30 27",
      panel2: "11 24 22",
      line: "26 51 45",
      accent: "52 211 153",
      accent2: "251 191 36",
      muted: "136 176 165",
      good: "52 211 153",
      bad: "248 113 113",
      text: "231 247 242",
    },
  },
  {
    id: "violet",
    name: "Violet",
    swatch: ["#a78bfa", "#f472b6"],
    vars: {
      ink: "16 12 28",
      panel: "26 20 44",
      panel2: "21 16 37",
      line: "44 34 68",
      accent: "167 139 250",
      accent2: "244 114 182",
      muted: "163 156 196",
      good: "52 211 153",
      bad: "248 113 113",
      text: "237 233 248",
    },
  },
  {
    id: "rose",
    name: "Rose",
    swatch: ["#fb7185", "#38bdf8"],
    vars: {
      ink: "24 12 16",
      panel: "40 20 27",
      panel2: "33 16 22",
      line: "66 34 44",
      accent: "251 113 133",
      accent2: "56 189 248",
      muted: "199 161 170",
      good: "52 211 153",
      bad: "248 113 113",
      text: "248 235 238",
    },
  },
  {
    id: "slate",
    name: "Slate (mono)",
    swatch: ["#94a3b8", "#e2e8f0"],
    vars: {
      ink: "15 18 24",
      panel: "24 29 38",
      panel2: "19 23 31",
      line: "42 49 62",
      accent: "148 163 184",
      accent2: "226 232 240",
      muted: "148 163 184",
      good: "134 239 172",
      bad: "252 165 165",
      text: "233 238 245",
    },
  },
];

export function themeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(id: string) {
  if (typeof document === "undefined") return;
  const theme = themeById(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(`--${k}`, v);
  }
}
