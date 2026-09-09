import type { Metadata } from "next";
import "./globals.css";
import { RealProvider } from "@/lib/realContext";
import { BroadcastProvider } from "@/lib/broadcast";
import { PreferencesProvider } from "@/lib/preferences";
import { ProgressProvider } from "@/lib/progress";
import ConsentGate from "@/components/ConsentGate";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://monty-carlo-simulator.vercel.app";
const DESCRIPTION =
  "Run thousands of Monte Carlo scenarios for retirement, sequence-of-returns risk, Roth conversions & taxes, long-term care, and more — private, in your browser. Not financial advice.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Monty Carlo Simulator",
  description: DESCRIPTION,
  applicationName: "Monty Carlo Simulator",
  openGraph: {
    title: "Monty Carlo Simulator",
    description: DESCRIPTION,
    type: "website",
    siteName: "Monty Carlo Simulator",
  },
  twitter: {
    card: "summary_large_image",
    title: "Monty Carlo Simulator",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <PreferencesProvider>
          <RealProvider>
            <BroadcastProvider>
              <ProgressProvider>{children}</ProgressProvider>
            </BroadcastProvider>
          </RealProvider>
        </PreferencesProvider>
        <ConsentGate />
      </body>
    </html>
  );
}
