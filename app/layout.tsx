import type { Metadata } from "next";
import "./globals.css";
import { RealProvider } from "@/lib/realContext";
import { BroadcastProvider } from "@/lib/broadcast";
import { PreferencesProvider } from "@/lib/preferences";
import ConsentGate from "@/components/ConsentGate";

export const metadata: Metadata = {
  title: "Monty Carlo Simulator",
  description:
    "Monte Carlo financial simulation on the web — portfolio forecasting (GBM) and retirement success probability. Deployable to Vercel.",
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
            <BroadcastProvider>{children}</BroadcastProvider>
          </RealProvider>
        </PreferencesProvider>
        <ConsentGate />
      </body>
    </html>
  );
}
