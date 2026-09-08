/**
 * Color themes. Each theme sets the app's CSS variables (space-separated RGB
 * channels so Tailwind's /opacity modifiers work) and declares a light or dark
 * `mode`. The mode drives `color-scheme` and a set of light-mode text overrides
 * in globals.css, so both dark and light palettes stay readable.
 */

export type ThemeMode = "dark" | "light";

export interface Theme {
  id: string;
  name: string;
  mode: ThemeMode;
  /** Small swatch colors for the picker (accent, accent2). */
  swatch: [string, string];
  vars: Record<string, string>;
}

const DARK_BASE = {
  good: "52 211 153",
  bad: "248 113 113",
  text: "230 237 247",
  textSoft: "203 213 225",
};

export const THEMES: Theme[] = [
  {
    id: "amber",
    name: "Amber (default)",
    mode: "dark",
    swatch: ["#f59e0b", "#38bdf8"],
    vars: {
      ink: "11 18 32",
      panel: "17 26 46",
      panel2: "14 22 38",
      line: "30 42 68",
      accent: "245 158 11",
      accent2: "56 189 248",
      muted: "142 161 192",
      ...DARK_BASE,
    },
  },
  {
    id: "dark",
    name: "Dark (neutral)",
    mode: "dark",
    swatch: ["#38bdf8", "#818cf8"],
    vars: {
      ink: "3 7 18",
      panel: "15 23 42",
      panel2: "2 6 23",
      line: "30 41 59",
      accent: "56 189 248",
      accent2: "129 140 248",
      muted: "148 163 184",
      good: "74 222 128",
      bad: "248 113 113",
      text: "226 232 240",
      textSoft: "203 213 225",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    mode: "dark",
    swatch: ["#38bdf8", "#818cf8"],
    vars: {
      ink: "8 15 28",
      panel: "15 27 46",
      panel2: "11 21 38",
      line: "28 45 72",
      accent: "56 189 248",
      accent2: "129 140 248",
      muted: "138 165 199",
      ...DARK_BASE,
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    mode: "dark",
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
      textSoft: "197 227 217",
    },
  },
  {
    id: "violet",
    name: "Violet",
    mode: "dark",
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
      textSoft: "209 202 233",
    },
  },
  {
    id: "rose",
    name: "Rose",
    mode: "dark",
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
      textSoft: "230 205 212",
    },
  },
  {
    id: "slate",
    name: "Slate (mono)",
    mode: "dark",
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
      textSoft: "203 213 225",
    },
  },
  {
    id: "highContrast",
    name: "High Contrast",
    mode: "dark",
    swatch: ["#facc15", "#22d3ee"],
    vars: {
      ink: "0 0 0",
      panel: "12 12 12",
      panel2: "0 0 0",
      line: "120 120 120",
      accent: "250 204 21",
      accent2: "34 211 238",
      muted: "214 214 214",
      good: "74 222 128",
      bad: "248 113 113",
      text: "255 255 255",
      textSoft: "235 235 235",
    },
  },
  {
    id: "light",
    name: "Light",
    mode: "light",
    swatch: ["#2563eb", "#be185d"],
    vars: {
      ink: "246 247 249",
      panel: "255 255 255",
      panel2: "240 243 247",
      line: "209 217 227",
      accent: "37 99 235",
      accent2: "190 24 93",
      muted: "90 105 130",
      good: "22 163 74",
      bad: "220 38 38",
      text: "15 23 42",
      textSoft: "51 65 85",
    },
  },
  {
    id: "twoTone",
    name: "2-Tone (mono light)",
    mode: "light",
    swatch: ["#18181b", "#52525b"],
    vars: {
      ink: "255 255 255",
      panel: "255 255 255",
      panel2: "244 244 245",
      line: "24 24 27",
      accent: "24 24 27",
      accent2: "82 82 91",
      muted: "82 82 91",
      good: "21 128 61",
      bad: "185 28 28",
      text: "9 9 11",
      textSoft: "63 63 70",
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
  root.setAttribute("data-theme-mode", theme.mode);
  root.style.colorScheme = theme.mode;
}
