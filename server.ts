import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { parse } from "dotenv";

const NAVER_URL_HOSTS = new Set([
  "naver.me",
  "m.place.naver.com",
  "map.naver.com",
]);

function loadEnvFiles() {
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";
  const envFiles = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
  const shellEnvKeys = new Set(Object.keys(process.env));

  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;

    const parsed = parse(fs.readFileSync(filePath));
    for (const [key, value] of Object.entries(parsed)) {
      if (!shellEnvKeys.has(key)) {
        process.env[key] = value;
      }
    }
  }
}

function getNaverMenuUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    if (!NAVER_URL_HOSTS.has(url.hostname)) {
      return rawUrl;
    }

    const sharePlaceId = url.searchParams.get("id");
    const pathPlaceId = url.pathname.match(/\/(?:restaurant|place)\/(\d+)/)?.[1];
    const mapPlaceId = url.pathname.match(/\/(?:v5\/)?(?:entry|place)\/place\/(\d+)/)?.[1]
      || url.pathname.match(/\/p\/entry\/place\/(\d+)/)?.[1];
    const placeId = sharePlaceId || pathPlaceId || mapPlaceId;

    if (placeId) {
      return `https://m.place.naver.com/place/${placeId}/menu/list`;
    }

    if (url.hostname === "map.naver.com") {
      url.searchParams.set("placePath", "/menu/list");
      return url.toString();
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

async function resolveNaverUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (!NAVER_URL_HOSTS.has(url.hostname)) {
      return rawUrl;
    }

    const response = await fetch(rawUrl, { redirect: "follow" });
    return response.url || rawUrl;
  } catch {
    return rawUrl;
  }
}

async function startServer() {
  loadEnvFiles();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Configuration
  app.get("/api/config", (req, res) => {
    res.json({
      naverMapsClientId: process.env.NAVER_MAPS_CLIENT_ID || "",
    });
  });

  // API Route for Naver Local Search
  app.get("/api/search", async (req, res) => {
    const query = req.query.query;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: "Query is required" });
      return;
    }

    const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      res.status(500).json({ error: "Naver Search API credentials are not configured on server" });
      return;
    }

    try {
      const apiUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=1`;
      const response = await fetch(apiUrl, {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Naver API error ${response.status}: ${response.statusText} ${errorText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Local search error:", error);
      res.status(500).json({ error: "Failed to search location" });
    }
  });

  app.get("/api/place-menu-url", async (req, res) => {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== "string") {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    const resolvedUrl = await resolveNaverUrl(rawUrl);
    res.json({
      url: getNaverMenuUrl(resolvedUrl),
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Important for express 5: use *all or * depends on version. We have express 4
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
