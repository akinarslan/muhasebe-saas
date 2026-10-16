import type { Metadata } from "next";
import "./globals.css";
import "./v02.css";
import "./premium.css";
import { MotionProvider } from "@/components/motion-provider";
export const metadata: Metadata = {
  title: "Pusula — İşletmenizin finansal rotası",
  description: "Muhasebe ve işletme yönetimi · Frontend demo prototipi",
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
