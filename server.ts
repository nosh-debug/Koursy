import express from "express";
import path from "path";
import multer from "multer";
import nodemailer from "nodemailer";

// Helper to extract JSON block accounting for braces and quotes
function extractJsonBlock(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) return '';
  let bracesCount = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        bracesCount++;
      } else if (char === '}') {
        bracesCount--;
        if (bracesCount === 0) {
          return text.substring(start, i + 1);
        }
      }
    }
  }
  return '';
}

// Recursively find continuationItemRenderer
function findContinuationToken(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.continuationItemRenderer && obj.continuationItemRenderer.continuationEndpoint) {
    return obj.continuationItemRenderer.continuationEndpoint.continuationCommand.token;
  }
  for (const key of Object.keys(obj)) {
    try {
      const found = findContinuationToken(obj[key]);
      if (found) return found;
    } catch (e) {
      // guard
    }
  }
  return null;
}

// Recursively find all playlistVideoRenderer instances
function findPlaylistVideos(obj: any, list: any[] = []): any[] {
  if (!obj || typeof obj !== 'object') return list;
  if (obj.playlistVideoRenderer) {
    list.push(obj.playlistVideoRenderer);
  }
  for (const key of Object.keys(obj)) {
    try {
      findPlaylistVideos(obj[key], list);
    } catch (e) {
      // guard in case of weird non-standard properties
    }
  }
  return list;
}

// Recursively find playlistMetadataRenderer
function findPlaylistMetadata(obj: any): any {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.playlistMetadataRenderer) {
    return obj.playlistMetadataRenderer;
  }
  for (const key of Object.keys(obj)) {
    try {
      const found = findPlaylistMetadata(obj[key]);
      if (found) return found;
    } catch (e) {
      // guard
    }
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse playlist API route
  app.get("/api/parse-playlist", async (req, res) => {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: "Missing or invalid playlist 'id' query parameter" });
    }

    try {
      const url = `https://www.youtube.com/playlist?list=${id}`;
      console.log(`Fetching playlist URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        }
      });

      if (!response.ok) {
        throw new Error(`YouTube responded with status code: ${response.status}`);
      }

      const html = await response.text();
      let playlistTitle = "Imported YouTube Playlist";
      let description = "Automatically imported YouTube playlist tracker.";
      let videos: any[] = [];

      let jsonStr = '';
      const indicators = ['ytInitialData = ', 'window["ytInitialData"] = ', "window['ytInitialData'] = "];
      for (const ind of indicators) {
        const index = html.indexOf(ind);
        if (index !== -1) {
          const slice = html.substring(index + ind.length);
          jsonStr = extractJsonBlock(slice);
          if (jsonStr) break;
        }
      }

      if (jsonStr) {
        try {
          const parsedData = JSON.parse(jsonStr);
          const apiKey = parsedData.INNERTUBE_API_KEY;
          const context = parsedData.INNERTUBE_CONTEXT;
          let continuationToken = findContinuationToken(parsedData);
          
          // Try to get metadata
          const meta = findPlaylistMetadata(parsedData);
          if (meta && meta.title) {
            playlistTitle = meta.title;
          }

          // Fetch videos from first page
          let renderers = findPlaylistVideos(parsedData);
          
          // Fetch subsequent pages
          while (continuationToken && context?.client) {
            const browseUrl = `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`;
            const browseResp = await fetch(browseUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                'x-goog-visitor-id': context.client.visitorData,
                'x-youtube-client-name': '1',
                'x-youtube-client-version': context.client.clientVersion,
              },
              body: JSON.stringify({
                context: context,
                continuation: continuationToken
              })
            });
            
            if (browseResp.ok) {
              const browseData = await browseResp.json();
              const nextRenderers = findPlaylistVideos(browseData);
              renderers = [...renderers, ...nextRenderers];
              continuationToken = findContinuationToken(browseData);
            } else {
              console.error("Failed to fetch continuation page:", browseResp.status);
              break;
            }
          }

          if (renderers && renderers.length > 0) {
            videos = renderers.map((r: any, idx: number) => {
              const videoId = r.videoId || (r.navigationEndpoint?.watchEndpoint?.videoId) || (r.shortBylineText?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId);
              if (!videoId) return null;

              let title = `Video ${idx + 1}`;
              
              if (r.title) {
                if (Array.isArray(r.title.runs) && r.title.runs[0]) {
                  title = r.title.runs[0].text;
                } else if (typeof r.title.simpleText === 'string') {
                  title = r.title.simpleText;
                }
              }

              let lengthStr = '';
              if (r.lengthText && r.lengthText.simpleText) {
                lengthStr = r.lengthText.simpleText;
              } else if (r.thumbnailOverlays) {
                // Sometimes time is inside thumbnailOverlays
                for (const overlay of r.thumbnailOverlays) {
                  if (overlay.thumbnailOverlayTimeStatusRenderer?.text?.simpleText) {
                    lengthStr = overlay.thumbnailOverlayTimeStatusRenderer.text.simpleText;
                  }
                }
              }

              return {
                title,
                link: `https://www.youtube.com/watch?v=${videoId}`,
                duration: lengthStr || undefined
              };
            }).filter(Boolean);
          }
        } catch (parseErr) {
          console.error("Failed to parse extracted JSON ytInitialData: ", parseErr);
        }
      }

      // If json extractor failed or found 0 videos, fall back to parsing regex matching videoIds
      if (videos.length === 0) {
        console.log("No videos extracted via JSON. Falling back to global HTML regex scan...");
        const matches = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)];
        const matchedIds = Array.from(new Set(matches.map(m => m[1])));
        
        if (matchedIds.length > 0) {
          videos = matchedIds.map((vid, idx) => ({
            title: `Lesson ${idx + 1} (Ref: ${vid})`,
            link: `https://www.youtube.com/watch?v=${vid}`
          }));
          
          // Also try to find title inside HTML tag
          const titleMatch = html.match(/<title>(.*?)<\/title>/);
          if (titleMatch && titleMatch[1]) {
            playlistTitle = titleMatch[1].replace(" - YouTube", "").trim();
          }
        }
      }

      if (videos.length === 0) {
        return res.status(404).json({ error: "Could not fetch any videos or layout structured metadata from this playlist link." });
      }

      res.json({
        title: playlistTitle,
        description: `Imported with ${videos.length} sections from playlist ${id}.`,
        videos
      });

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to process the requested playlist load." });
    }
  });

  // Parse individual video API route
  app.get("/api/parse-video", async (req, res) => {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: "Missing or invalid video 'id' query parameter" });
    }

    try {
      const url = `https://www.youtube.com/watch?v=${id}`;
      console.log(`Fetching individual video URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        }
      });

      let videoTitle = "Imported Video Lecture";
      if (response.ok) {
        const html = await response.text();
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        if (titleMatch && titleMatch[1]) {
          videoTitle = titleMatch[1].replace(" - YouTube", "").trim();
        }
      }

      res.json({
        title: videoTitle,
        link: url,
        id
      });
    } catch (error: any) {
      console.error(error);
      res.json({
        title: "Imported YouTube Video Lecture",
        link: `https://www.youtube.com/watch?v=${id}`,
        id
      });
    }
  });

  app.post("/api/report-bug", multer().single('footage'), async (req, res) => {
    const { description, userEmail } = req.body;
    const file = req.file;

    try {
      const email = process.env.NODEMAILER_EMAIL;
      const password = process.env.NODEMAILER_PASSWORD;

      if (!email || !password) {
        throw new Error('Nodemailer configuration missing');
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: email,
          pass: password,
        },
      });

      await transporter.sendMail({
        from: process.env.NODEMAILER_EMAIL,
        to: 'nosh1988osh@gmail.com',
        subject: 'New Bug Report',
        text: `From: ${userEmail}\nDescription: ${description}`,
        attachments: file ? [{ filename: file.originalname, content: file.buffer }] : [],
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error sending bug email', error);
      res.status(500).json({ error: 'Failed to send bug report email' });
    }
  });

  // Vite dev server mounting or Production builds output delivery
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const { default: fs } = await import("fs");
        const indexHtmlPath = path.join(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexHtmlPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DUONO Backend server listening on port ${PORT}`);
  });
}

startServer();
