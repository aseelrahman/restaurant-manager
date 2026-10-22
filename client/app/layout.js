import "./globals.css";
import ClientShell from "@/components/ClientShell";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Harbor & Hearth",
  description: "Restaurant management",
};

export const instant = false;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="corporate">
      <body className="flex min-h-screen flex-col bg-base-200">
        <ClientShell>{children}</ClientShell>
        <Footer />
      </body>
    </html>
  );
}
