import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple Next.js Form",
  description: "A simple UI form in Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="page">
          <header className="header">
            <div className="container">
              <div className="brand">Next.js Form</div>
              <div className="subtitle">Simple server-action form example</div>
            </div>
          </header>
          <main className="container main">{children}</main>
          <footer className="footer">
            <div className="container">Built with Next.js</div>
          </footer>
        </div>
      </body>
    </html>
  );
}
