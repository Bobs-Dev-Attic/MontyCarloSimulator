import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
