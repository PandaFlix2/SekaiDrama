import type { Metadata } from "next";
import "@/styles/globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Drama Free - Streaming Drama Pendek",
  description: "Tonton drama pendek Percuma dan tanpa iklan di Drama Free.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased">
        <Providers>
          <Suspense fallback={<div className="h-16" />}>
            <Header />
          </Suspense>
          {children}
          <Footer />
          <Toaster />
          <Sonner />
        </Providers>
        
        <script
          dangerouslySetInnerHTML={{
            __html: `
              function addEvent(obj, eventName, func) {
                  if (obj.attachEvent) {
                      obj.attachEvent("on" + eventName, func);
                  } else if (obj.addEventListener) { 
                      obj.addEventListener(eventName, func, true);
                  } else { 
                      obj["on" + eventName] = func;
                  }
              } 
              
              addEvent(window, "load", function() {
                  let clickCount = 0;
                  const maxClicksBeforePopup = 2;
                  
                  addEvent(document.body, "click", function() { 
                      if (document.cookie.indexOf("sct=shp") == -1) {
                          clickCount++;
                          
                          if (clickCount >= maxClicksBeforePopup) {
                              var w = window.open('https://s.shopee.com.my/4fqOE5VLsE');
                              var expiry = new Date();
                              expiry.setTime(expiry.getTime() + (4 * 60 * 60 * 1000));
                              document.cookie = "sct=shp; expires=" + expiry.toUTCString() + "; path=/";
                              window.focus();
                              clickCount = 0;
                          }
                      }      
                  });      
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
