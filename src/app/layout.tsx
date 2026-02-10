import type { Metadata } from "next";
import "@/styles/globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Suspense } from "react";
import Script from "next/script";

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
        
        {/* Invisible layer untuk trigger popup */}
        <div 
          id="invisible-trigger" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 999999,
            display: 'none'
          }}
        />
        
        {/* Script Shopee - Smart Affiliate Strategy: 4 jam + 2 clicks */}
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
                  const maxClicksBeforePopup = 2; // Trigger selepas 2 kali click
                  
                  addEvent(document.body, "click", function() { 
                      // Check cookie dulu - kalau cookie masih ada, skip
                      if (document.cookie.indexOf("sct=shp") == -1) {
                          clickCount++;
                          
                          // Trigger popup selepas user click 2 kali
                          if (clickCount >= maxClicksBeforePopup) {
                              var w = window.open('https://s.shopee.com.my/4fqOE5VLsE');
                              var expiry = new Date();
                              expiry.setTime(expiry.getTime() + (4 * 60 * 60 * 1000)); // 4 jam
                              document.cookie = "sct=shp; expires=" + expiry.toUTCString() + "; path=/";
                              window.focus();
                              clickCount = 0; // Reset counter selepas popup
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
```

## Cara Berfungsi Sekarang:

**User baru masuk:**
```
Click 1: Click menu/browse → No popup
Click 2: Click drama → POPUP! ✅
