import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gestion des Finances",
    template: "%s · Gestion des Finances",
  },
  description:
    "Suivi des dépenses de l'entreprise : justificatif, validation, règlement et état de fin de période.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
