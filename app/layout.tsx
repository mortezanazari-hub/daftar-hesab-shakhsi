import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/vazirmatn";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "دفتر حساب شخصی | مدیریت مالی و دُنگ";
  const description = "ثبت بدهی، طلب، قسط، چک و مدیریت هوشمند هزینه‌های مشترک.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    applicationName: "دفتر حساب شخصی",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/icon-512.png",
    },
    appleWebApp: { capable: true, title: "دفتر حساب شخصی", statusBarStyle: "black-translucent" },
    openGraph: { title, description, type: "website", url: origin, locale: "fa_IR", images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "دفتر حساب شخصی — مدیریت مالی و دُنگ" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export const viewport: Viewport = {
  themeColor: "#f5f2ea",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
