const NAVER_URL_HOSTS = new Set([
  "naver.me",
  "m.place.naver.com",
  "map.naver.com",
]);

function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getNaverLocationFromUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const latParam = url.searchParams.get("lat");
    const lngParam = url.searchParams.get("lng");
    if (!latParam || !lngParam) return null;

    const lat = Number(latParam);
    const lng = Number(lngParam);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  } catch {
    return null;
  }

  return null;
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

export default async function handler(req: any, res: any) {
  const rawUrl = getQueryParam(req.query?.url);
  if (!rawUrl) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  const resolvedUrl = await resolveNaverUrl(rawUrl);
  res.status(200).json({
    location: getNaverLocationFromUrl(resolvedUrl),
    resolvedUrl,
  });
}
