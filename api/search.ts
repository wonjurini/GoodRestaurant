function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function searchNaverLocal(query: string, display = 1) {
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

export default async function handler(req: any, res: any) {
  const query = getQueryParam(req.query?.query);
  const displayParam = Number(getQueryParam(req.query?.display));
  if (!query) {
    res.status(400).json({ error: "Query is required" });
    return;
  }

  try {
    const data = await searchNaverLocal(query, Number.isFinite(displayParam) ? displayParam : 1);
    res.status(200).json(data);
  } catch (error) {
    console.error("Local search error:", error);
    res.status(500).json({ error: "Failed to search location" });
  }
}
