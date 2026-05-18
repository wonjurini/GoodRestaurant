import { getNaverMenuUrl, resolveNaverUrl } from "../src/server/naver";

function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
