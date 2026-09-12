import type { Metadata, Viewport } from "next";

import "./globals.css";
import PrivyProvider from "./components/privy-provider";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { Toaster } from "./components/ui/Toast";

import { Inter } from "next/font/google";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const APP_NAME = "MonQuest";
const APP_DEFAULT_TITLE = "MonQuest";
const APP_TITLE_TEMPLATE = "%s · MonQuest";
const APP_DESCRIPTION = "Monad-native bounties, judged by AI. Post, work, pay — onchain on Monad Testnet.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  icons: {
    icon: "/brain.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_DEFAULT_TITLE,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#09090B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Script to unregister stale service workers */}
        <Script id="unregister-sw" strategy="beforeInteractive">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for (let registration of registrations) {
                  registration.unregister();
                }
              });
            }
          `}
        </Script>
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <PrivyProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-grow" id="main">
              {children}
            </main>
            <Footer />
            <Toaster />
          </div>
        </PrivyProvider>
      </body>
    </html>
  );
}