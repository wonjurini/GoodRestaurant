export default function handler(_req: any, res: any) {
  res.status(200).json({
    naverMapsClientId: process.env.NAVER_MAPS_CLIENT_ID || "",
  });
}
