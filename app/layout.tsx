import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "700", "900"],
});

export const metadata: Metadata = {
  title: "Odisej Yacht Club | Konfigurator BALI A-2026",
  description: "Profesjonalny konfigurator ofert katamaranów BALI dla Odisej Yacht Club (OYC).",
  applicationName: "Odisej Yacht Club",
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${basePath}/favicon.png`, type: "image/png", sizes: "64x64" },
      { url: `${basePath}/icons/icon-192.png`, type: "image/png", sizes: "192x192" },
    ],
    shortcut: `${basePath}/favicon.png`,
    apple: [{ url: `${basePath}/apple-touch-icon.png`, type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className={lato.variable}>
        {children}
      </body>
    </html>
  );
}
