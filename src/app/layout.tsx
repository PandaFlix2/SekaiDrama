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
  description: "Nonton drama pendek gratis dan tanpa iklan di SekaiDrama.",
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
        
        <Script id="shopee-popup-script" strategy="afterInteractive">
          {`
            (function() {
              // Function untuk set cookie
              function setCookie(name, value, days) {
                var expires = "";
                if (days) {
                  var date = new Date();
                  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                  expires = "; expires=" + date.toUTCString();
                }
                document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
              }
              
              // Function untuk get cookie
              function getCookie(name) {
                var nameEQ = name + "=";
                var ca = document.cookie.split(';');
                for(var i=0;i < ca.length;i++) {
                  var c = ca[i];
                  while (c.charAt(0)==' ') c = c.substring(1,c.length);
                  if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
                }
                return null;
              }
              
              // Tunggu page load selesai
              window.addEventListener('load', function() {
                // Check jika cookie belum ada (popup belum pernah dibuka hari ini)
                var today = new Date().toDateString();
                var lastPopup = getCookie('shopee_popup_date');
                
                if (lastPopup !== today) {
                  // Show invisible layer dan aktifkan pointer events
                  var trigger = document.getElementById('invisible-trigger');
                  if (trigger) {
                    trigger.style.display = 'block';
                    trigger.style.pointerEvents = 'auto';
                    
                    // Trigger popup bila user klik pertama kali
                    var clickHandler = function(e) {
                      // Hanya trigger sekali sahaja
                      if (!getCookie('shopee_popup_triggered')) {
                        // Open popup dalam tab baru
                        window.open('https://s.shopee.com.my/4fqOE5VLsE', '_blank', 'noopener,noreferrer');
                        
                        // Set cookie untuk hari ini
                        setCookie('shopee_popup_date', today, 1);
                        setCookie('shopee_popup_triggered', 'true', 1);
                        
                        // Remove event listener dan hide layer
                        trigger.removeEventListener('click', clickHandler);
                        trigger.style.display = 'none';
                        trigger.style.pointerEvents = 'none';
                        
                        // Remove handler dari body juga
                        document.body.removeEventListener('click', bodyClickHandler, true);
                      }
                    };
                    
                    // Handler untuk body (bubbling)
                    var bodyClickHandler = function(e) {
                      // Jika klik bukan pada element tertentu (exclude buttons, links, inputs)
                      if (!e.target.closest('button') && 
                          !e.target.closest('a') && 
                          !e.target.closest('input') &&
                          !e.target.closest('[role="button"]')) {
                        e.stopPropagation();
                        clickHandler(e);
                      }
                    };
                    
                    // Attach event listeners
                    trigger.addEventListener('click', clickHandler);
                    document.body.addEventListener('click', bodyClickHandler, true);
                    
                    // Auto remove selepas 10 saat kalau user tak klik
                    setTimeout(function() {
                      trigger.style.display = 'none';
                      trigger.style.pointerEvents = 'none';
                      trigger.removeEventListener('click', clickHandler);
                      document.body.removeEventListener('click', bodyClickHandler, true);
                    }, 10000); // 10 seconds
                  }
                }
              });
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
