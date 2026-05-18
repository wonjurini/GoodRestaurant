/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import MainLayout from './components/MainLayout';

const NAVER_MAPS_CLIENT_ID =
  process.env.NAVER_MAPS_CLIENT_ID ||
  (import.meta as any).env?.VITE_NAVER_MAPS_CLIENT_ID ||
  (globalThis as any).NAVER_MAPS_CLIENT_ID ||
  '';
const hasValidKey = Boolean(NAVER_MAPS_CLIENT_ID) && NAVER_MAPS_CLIENT_ID !== 'MY_NAVER_MAPS_CLIENT_ID';

export default function App() {
  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50 font-sans p-4">
        <div className="max-w-2xl text-center bg-white p-8 rounded-2xl shadow-sm border border-neutral-100">
          <h2 className="text-2xl font-bold mb-4 text-neutral-900">네이버 지도 API 키 설정이 필요합니다</h2>
          <div className="space-y-4 text-left text-neutral-700">
            <p>
              <strong>Step 1:</strong> 네이버 클라우드 플랫폼에서 <strong>Web Dynamic Map</strong> 등록 후 Client ID를 발급받으세요.
            </p>
            <p className="mt-4 pt-4 border-t border-neutral-100">
              또한 식당 이름으로 위치 좌표를 찾으려면 주소가 아닌 상호명 검색이 필요합니다.<br/>
              네이버 개발자 센터(developers.naver.com)의 애플리케이션 등록 화면에서 <strong>'검색'</strong>(스크린샷 맨 위 항목) API를 추가해주세요.
            </p>
            <p><strong>Step 2:</strong> 로컬에서는 <code>.env.local</code>에, AI Studio에서는 Settings(오른쪽 위 톱니바퀴) &gt; Secrets 에 다음 값을 등록해주세요:</p>
            <ul className="list-disc pl-5 space-y-2 bg-slate-50 p-4 rounded-lg">
              <li><code>NAVER_MAPS_CLIENT_ID</code>: 네이버 클라우드 플랫폼 Client ID</li>
              <li><code>NAVER_SEARCH_CLIENT_ID</code>: 네이버 개발자센터 지역검색 Client ID</li>
              <li><code>NAVER_SEARCH_CLIENT_SECRET</code>: 네이버 개발자센터 지역검색 Client Secret</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return <MainLayout />;
}
