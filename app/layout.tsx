import "./globals.css";

export const metadata = {
  title: "Mirum Group CRM",
  description: "Lead & property pipeline management for Mirum Group",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}