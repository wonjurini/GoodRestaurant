const NAVER_URL_HOSTS = new Set([
  "naver.me",
  "m.place.naver.com",
  "map.naver.com",
]);

export function getNaverMenuUrl(rawUrl: string) {
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

export async function resolveNaverUrl(rawUrl: string) {
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

export function getNaverLocationFromUrl(rawUrl: string) {
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

export async function searchNaverLocal(query: string, display = 1) {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Naver Search API credentials are not configured on server");
  }

  const safeDisplay = Math.min(Math.max(display, 1), 10);
  const apiUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${safeDisplay}`;
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

  return response.json();
}
