<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0c856905-cde3-4576-b4f6-35edd7b6fffe

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local`, then fill in the Naver keys:
   - `NAVER_MAPS_CLIENT_ID`: NAVER Cloud Platform > Application Services > Maps > Application에서 발급한 Client ID
   - `NAVER_SEARCH_CLIENT_ID`: NAVER Developers 지역 검색 API Client ID
   - `NAVER_SEARCH_CLIENT_SECRET`: NAVER Developers 지역 검색 API Client Secret
3. In NAVER Cloud Platform, enable `Dynamic Map` for the Maps application and register the local web service URL as `http://localhost` without the port number.
4. Run the app:
   `npm run dev`

Open http://localhost:3000.

## Deploy to Vercel

Use the `Vite` framework preset.

- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

Add these environment variables in Vercel Project Settings:

- `NAVER_MAPS_CLIENT_ID`
- `NAVER_SEARCH_CLIENT_ID`
- `NAVER_SEARCH_CLIENT_SECRET`

After deployment, add the Vercel production domain to NAVER Cloud Platform Maps > Web Service URL.
