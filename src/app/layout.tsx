import type { Metadata } from "next";
import "./globals.css";
import { getSettings, themeCssVars } from "@/lib/settings";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export const metadata: Metadata = {
  title: "Mellan Practice Manager",
  description: "Practice management for Mellan Consulting Engineers",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const vars = themeCssVars(settings) as React.CSSProperties;

  return (
    <html lang="en-AU">
      <body style={vars}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar
            companyName={settings.companyName}
            logoPath={settings.logoPath}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar companyName={settings.companyName} />
            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
