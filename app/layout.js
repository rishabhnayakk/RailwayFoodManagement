import "./globals.css";

export const metadata = {
  title: "RailGuard | Railway Food Quality",
  description: "Passenger food feedback and railway quality audit platform."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
