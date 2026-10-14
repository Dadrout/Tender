import type { Metadata } from "next";
import { Providers } from "@/lib/context";
import "./globals.css";
export const metadata: Metadata = {
  title: "QazBid AI — тендеры с ясным решением",
  description:
    "Проверка требований, запасов, рисков и прибыльности тендеров Казахстана.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="ru" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
