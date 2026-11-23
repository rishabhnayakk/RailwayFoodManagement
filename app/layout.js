/* app/layout.js
 * Root layout — wraps every page in the app.
 * Sets the HTML lang, body font, and global metadata.
 * No mock data here — just structure.
 */
import "./globals.css";

export const metadata = {
  title: "RailGuard – Railway Food Quality Audit",
  description:
    "QR-based passenger food feedback and railway quality audit platform.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
