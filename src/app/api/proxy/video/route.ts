import { NextRequest, NextResponse } from "next/server"; 
import https from "https";
import http from "http";

export const dynamic = 'force-dynamic'; // Prevent static optimization

// Custom agent to ignore SSL issues
const agent = new https.Agent({
  rejectUnauthorized: false
});

// Helper: Fetch stream with redirect handling
function fetchStream(url: string, headers: any, redirectCount = 5): Promise<{ res: http.IncomingMessage; url: string }> {
  return new Promise((resolve, reject) => {
    if (redirectCount <= 0) return reject(new Error("Too many redirects"));

    const isHttp = url.startsWith("http:");
    const requestModule = isHttp ? http : https;
    
    const options = {
        headers: headers,
        agent: isHttp ? undefined : agent,
        rejectUnauthorized: false, 
        method: 'GET'
    };

    const req = requestModule.request(url, options, (res) => {
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
             const newUrl = new URL(res.headers.location, url).href;
             res.resume(); 
             return resolve(fetchStream(newUrl, headers, redirectCount - 1));
        }
        resolve({ res, url });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}

// Helper: Consume stream to buffer (for rewriting text)
function streamToBuffer(stream: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

// Helper: Convert Node stream to Web ReadableStream (for streaming response)
function nodeToWebStream(nodeStream: http.IncomingMessage): ReadableStream {
    return new ReadableStream({
        start(controller) {
            nodeStream.on('data', (chunk) => controller.enqueue(chunk));
            nodeStream.on('end', () => controller.close());
            nodeStream.on('error', (err) => controller.error(err));
        }
    });
}

// Helper: Detect if content is SRT format
function isSrtContent(text: string): boolean {
    // SRT format: starts with number, then timestamp with comma separator
    const srtPattern = /^\s*\d+\s*[\r\n]+\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/;
    return srtPattern.test(text);
}

// Helper: Convert SRT to VTT
function convertSrtToVtt(srtContent: string): string {
    let vttContent = srtContent
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Convert SRT timestamps (comma) to VTT timestamps (period)
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
        .trim();
    
    // Add WEBVTT header if not present
    if (!vttContent.startsWith('WEBVTT')) {
        vttContent = "WEBVTT\n\n" + vttContent;
    }
    
    return vttContent;
}

// Helper: Add positioning to VTT if not already present
function addVttPositioning(vttContent: string): string {
    return vttContent.replace(
        /((?:\d{2}:)?\d{2}:\d{2}\.\d{3}\s*-->\s*(?:\d{2}:)?\d{2}:\d{2}\.\d{3})([^\n]*)/g,
        (match, timeRange, rest) => {
            // Don't modify if positioning already exists
            if (rest.includes('line:') || rest.includes('position:') || rest.includes('align:')) {
                return match;
            }
            // Add line positioning at 90% (near bottom but not cut off)
            return `${timeRange} line:90%${rest}`;
        }
    );
}

export async function GET(req: NextRequest) {
  const urlParams = req.nextUrl.searchParams;
  const url = urlParams.get("url");
  const refererParam = urlParams.get("referer");

  if (!url) {
    return new NextResponse("Missing URL parameter", { status: 400 });
  }

  try {
    const range = req.headers.get("range");
    const headers: any = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Referer": refererParam || new URL(url).origin + "/", 
      // NOTE: Do NOT send Origin header - video CDN returns 403 if Origin doesn't match their whitelist
    };

    if (range) {
      headers["Range"] = range;
    }

    // 1. Start Request (Get Stream)
    const { res: upstreamRes, url: finalUrl } = await fetchStream(url, headers);

    if ((upstreamRes.statusCode || 500) >= 400) {
       console.error(`Proxy fetch failed for ${url}: ${upstreamRes.statusCode}`);
       return new NextResponse(`Upstream Error: ${upstreamRes.statusMessage}`, { status: upstreamRes.statusCode });
    }

    const contentType = (upstreamRes.headers['content-type'] || "").toLowerCase();
    const lowUrl = finalUrl.toLowerCase();
    
    // 2. Identify Type
    const isM3u8 = contentType.includes("application/vnd.apple.mpegurl") || 
                   contentType.includes("application/x-mpegurl") ||
                   lowUrl.includes(".m3u8");
                   
    const isVtt = contentType.includes("text/vtt") || 
                  contentType.includes("text/plain") && lowUrl.includes("vtt") ||
                  lowUrl.endsWith(".vtt");
    
    const isSrt = contentType.includes("text/srt") ||
                  contentType.includes("text/plain") && lowUrl.includes("srt") ||
                  lowUrl.endsWith(".srt");

    // 3. IF BINARY (MP4, TS, etc) -> STREAM DIRECTLY
    if (!isM3u8 && !isVtt && !isSrt && (lowUrl.includes(".mp4") || lowUrl.includes(".ts") || contentType.includes("video/"))) {
        const stream = nodeToWebStream(upstreamRes);
        
        const responseHeaders = new Headers();
        responseHeaders.set("Content-Type", contentType || "video/mp4");
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Accept-Ranges", "bytes");
        
        if (upstreamRes.headers['content-length']) {
            responseHeaders.set("Content-Length", upstreamRes.headers['content-length']);
        }
        if (upstreamRes.headers['content-range']) {
            responseHeaders.set("Content-Range", upstreamRes.headers['content-range']);
        }

        return new NextResponse(stream as any, {
            status: upstreamRes.statusCode || 200,
            statusText: upstreamRes.statusMessage,
            headers: responseHeaders
        });
    }

    // 4. IF TEXT/HLS/SUBTITLE -> BUFFER & REWRITE
    const buffer = await streamToBuffer(upstreamRes);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    
    // Check more content for better detection (first 1KB instead of 100 bytes)
    const sampleSize = Math.min(buffer.length, 1024);
    const firstChunk = decoder.decode(buffer.slice(0, sampleSize)); 
    
    const isM3u8Content = firstChunk.includes("#EXTM3U");
    const isSrtContent = isSrtContent(firstChunk);
    const isVttContent = firstChunk.includes("WEBVTT");
    
    // DETERMINE VALID ORIGIN for rewrites
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https"; 
    const origin = `${proto}://${host}`;

    // Handle M3U8 playlists
    if (isM3u8 || isM3u8Content) {
        const text = decoder.decode(buffer);
        const baseUrl = new URL(finalUrl); 

        const subUrl = urlParams.get("sub");
        const isMasterPlaylist = text.includes("#EXT-X-STREAM-INF");

        let rewritten = text.split(/\r?\n/).map(line => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            const createProxyUrl = (targetUrl: string) => {
                let base = `${origin}/api/proxy/video?url=${encodeURIComponent(targetUrl)}`;
                if (refererParam) base += `&referer=${encodeURIComponent(refererParam)}`;
                return base;
            };

            // Handle URIs in tags (like #EXT-X-KEY)
            if (trimmed.startsWith('#')) {
                return line.replace(/URI="([^"]+)"/g, (match, uri) => {
                    try {
                        const absoluteUrl = new URL(uri, baseUrl.href).href;
                        return `URI="${createProxyUrl(absoluteUrl)}"`;
                    } catch (e) { return match; }
                });
            }
            
            // Handle segment URLs
            try {
                const absoluteUrl = new URL(trimmed, baseUrl.href).href;
                return createProxyUrl(absoluteUrl);
            } catch (e) { return line; }
        }).join('\n');

        // Inject subtitle if provided
        if (isMasterPlaylist && subUrl) {
            let proxiedSubUrl = `${origin}/api/proxy/video?url=${encodeURIComponent(subUrl)}`;
            if (refererParam) proxiedSubUrl += `&referer=${encodeURIComponent(refererParam)}`;
            
            const mediaLine = `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Indonesia",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="id",URI="${proxiedSubUrl}"`;
            
            // Insert subtitle media tag after #EXTM3U
            rewritten = rewritten.replace("#EXTM3U", "#EXTM3U\n" + mediaLine);
            
            // Add SUBTITLES reference to stream variants
            rewritten = rewritten.replace(/#EXT-X-STREAM-INF:(.*)/g, (match, attrs) => {
                if (attrs.includes("SUBTITLES=")) return match; 
                return `#EXT-X-STREAM-INF:${attrs},SUBTITLES="subs"`;
            });
        }

        return new NextResponse(rewritten, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.apple.mpegurl",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store",
            }
        });
    }

    // Handle VTT/SRT Subtitles
    if (isVtt || isSrt || isVttContent || isSrtContent) {
       let vttContent = decoder.decode(buffer);
       
       // Convert SRT to VTT if needed
       if ((isSrt || isSrtContent) && !vttContent.trim().startsWith('WEBVTT')) {
           console.log('Converting SRT to VTT format');
           vttContent = convertSrtToVtt(vttContent);
       }
       
       // Ensure WEBVTT header is present
       if (!vttContent.trim().startsWith('WEBVTT')) {
           vttContent = "WEBVTT\n\n" + vttContent;
       }
       
       // Add positioning only if not already present
       vttContent = addVttPositioning(vttContent);

       return new NextResponse(vttContent, {
         status: 200,
         headers: {
           "Content-Type": "text/vtt; charset=utf-8",
           "Access-Control-Allow-Origin": "*",
           "Cache-Control": "no-store",
         }
       });
    }

    // FALLBACK: Just return buffered content (e.g. small unknown files)
    return new NextResponse(buffer as any, {
        status: upstreamRes.statusCode || 200,
        headers: {
            "Content-Type": contentType || "application/octet-stream",
            "Access-Control-Allow-Origin": "*",
        }
    });

  } catch (error) {
    console.error("Proxy error:", error);
    return new NextResponse(`Internal Server Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}
