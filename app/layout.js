/* app/layout.js
 * Root layout — wraps every page in the app with ToastProvider.
 */
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata = {
  title: "RailGuard – Railway Food Quality Audit",
  description:
    "QR-based passenger food feedback and railway quality audit platform.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
