import { searchNaverLocal } from "../src/server/naver";

function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: any, res: any) {
  const query = getQueryParam(req.query?.query);
  if (!query) {
    res.status(400).json({ error: "Query is required" });
    return;
  }

  try {
    const data = await searchNaverLocal(query);
    res.status(200).json(data);
  } catch (error) {
    console.error("Local search error:", error);
    res.status(500).json({ error: "Failed to search location" });
  }
}
