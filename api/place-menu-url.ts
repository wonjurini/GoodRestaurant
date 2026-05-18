const NAVER_URL_HOSTS = new Set([
  "naver.me",
  "m.place.naver.com",
  "map.naver.com",
]);

function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

export default async function handler(req: any, res: any) {
  const rawUrl = getQueryParam(req.query?.url);
  if (!rawUrl) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  const resolvedUrl = await resolveNaverUrl(rawUrl);
  res.status(200).json({
    url: getNaverMenuUrl(resolvedUrl),
  });
}
