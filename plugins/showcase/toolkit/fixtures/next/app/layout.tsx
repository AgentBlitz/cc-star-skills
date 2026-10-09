import Link from "next/link";
import type { ReactNode } from "react";
import ShowcaseTour from "../components/showcase/ShowcaseTour";
import "./globals.css";

export const metadata = { title: "Orbit" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <header>
          <strong>Orbit</strong>
          <nav aria-label="Main">
            <Link href="/">Home</Link>
            <Link href="/projects">Projects</Link>
            <Link href="/settings">Settings</Link>
          </nav>
        </header>
        <main>{children}</main>
        <ShowcaseTour />
      </body>
    </html>
  );
}
