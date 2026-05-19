# GoodRestaurant 작업 히스토리

마지막 업데이트: 2026-05-19

## 프로젝트 상태

- 프로젝트 경로: `/Users/wonjun/Documents/Codex/GoodRestaurant/local-restaurant-guide`
- GitHub 저장소: `https://github.com/wonjurini/GoodRestaurant.git`
- Vercel 프로젝트: `good-restaurant`
- 공개 배포 URL: https://good-restaurant-sandy.vercel.app
- 최신 확인 커밋: `a3d2ecf Add map loading indicator`
- 작업트리 상태: 기록 시점 기준 clean

## 환경 변수

민감정보 값은 문서에 남기지 않는다. 로컬 `.env.local` 및 Vercel 환경변수에 아래 값들이 필요하다.

- `NAVER_MAPS_CLIENT_ID`
- `NAVER_SEARCH_CLIENT_ID`
- `NAVER_SEARCH_CLIENT_SECRET`

지도 SDK용 Client ID와 Local Search API용 Client ID/Secret은 서로 다른 애플리케이션 값을 사용한다.

## 주요 변경 내용

### 초기 앱 구성

- Google Sheets CSV 데이터를 읽어 카테고리별 맛집 리스트를 표시한다.
- 리스트는 별점 순으로 정렬하고, 동일 점수는 한글 이름순으로 정렬한다.
- 헤더는 `우리 회사 주변 맛집`에서 `교원 주변 맛집`으로 변경했다.
- `맛집 정보(이한빛 님 제공 시트 바로가기)` 링크를 Google Sheet로 연결했다.

### Vercel 배포 대응

- Vercel Serverless Function용 API 파일을 추가했다.
- `/api/config`: 지도 Client ID 제공
- `/api/search`: Naver Local Search 프록시
- `/api/place-menu-url`: 네이버 메뉴 페이지 URL 변환
- `/api/place-location`: 네이버 URL에서 좌표 추출
- Vercel GitHub 연동으로 `main` push 시 production deploy가 트리거된다.

### 지도와 마커 동작

- 리스트 클릭 시 해당 음식점 좌표로 지도가 이동하고 마커가 표시된다.
- 현재는 마커 드롭 애니메이션을 완전히 제거했다.
- 지도 이동은 `panTo` 대신 `setCenter`를 사용해 즉시 이동한다.
- 기존 마커가 있으면 새로 만들지 않고 `setPosition`으로 위치만 갱신한다.
- 위치 검색 중에는 지도 위에 원형 로딩 스피너가 표시된다.

### 방명록

- 헤더 우측 방명록 버튼으로 팝업을 연다.
- `방명록` Google Sheet 탭을 CSV로 읽어 `날짜`, `오늘의 한 마디`를 표시한다.
- `방명록 쓰기` 버튼은 Google Sheet의 방명록 탭을 새 창으로 연다.
- 별도 Google API 쓰기 인증 없이, 사용자가 시트에서 직접 작성하는 흐름이다.
- 방명록 읽기 훅 위치: `src/hooks/useGuestbook.ts`

### 북마크

- 로그인 없이 브라우저 `localStorage`에 북마크한 맛집 id를 저장한다.
- 리스트 항목과 상세 카드에서 북마크 토글이 가능하다.
- `북마크만 보기` 필터와 북마크 개수 표시를 제공한다.
- 저장 key: `goodRestaurant.bookmarkedRestaurantIds`

### 소개 문구

- 헤더 제목: `교원 주변 맛집`
- 제공 문구: `제공 : 교원 최고의 미식가 이한빛님`
- 시트 링크 문구: `출처 : 맛집 시트 바로가기`
- 방명록 아이콘 아래에 `방명록` 라벨을 표시한다.

### 위치 검색 정확도 개선

- `src/components/MainLayout.tsx`에서 장소 검색 로직을 강화했다.
- 먼저 음식점 URL에서 좌표를 추출한다.
- URL에서 좌표를 얻지 못하면 여러 지역 키워드로 Naver Local Search를 실행한다.
- 검색 컨텍스트: `을지로`, `종각`, `광화문`, `명동`, `서울`
- 후보 결과는 회사 주변 기준 거리, 제목 일치, 음식점/카페 카테고리, 주소 지역성으로 점수화한다.
- Naver Local Search의 좌표 형태가 WGS84 곱셈값인지 TM128/KATECH인지 구분해 처리한다.

### 수동 위치 보정

다음 음식점은 검색 결과가 애매하거나 유사 장소로 새는 문제가 있어 보정했다.

- `온도`: `37.5687931, 126.9862618`

관련 네이버 장소:
`https://map.naver.com/p/entry/place/1446714516?placePath=/home?from=map&fromPanelNum=1&additionalHeight=76&timestamp=202605191047&locale=ko&svcName=map_pcv5&c=15.00,0,0,0,dh`

### 폐점/삭제 필터

Google Sheet에서 검은색 셀로 표시된 폐점/삭제 음식점은 코드에서 행 번호 기반으로 제외한다.

- 위치: `src/hooks/useRestaurants.ts`
- `CLOSED_RESTAURANT_ROWS`에 카테고리별 Google Sheet 행 번호를 관리한다.
- 최근 반영: `피크버거앤스테이크` 삭제 처리로 `양식` 행 `12` 추가.

## 주요 파일

- `src/components/MainLayout.tsx`
  - 맛집 리스트, 카테고리, 검색, 선택 상태, 지도 위치 검색, 로딩 스피너 담당
- `src/components/NaverMap.tsx`
  - Naver Maps SDK 로드, 지도 생성, 마커 표시/위치 갱신 담당
- `src/hooks/useRestaurants.ts`
  - Google Sheet CSV 로드, 파싱, 폐점 행 필터 담당
- `src/hooks/useGuestbook.ts`
  - Google Sheet 방명록 탭 CSV 로드, 파싱 담당
- `src/server/naver.ts`
  - 로컬 Express 서버에서 사용하는 Naver URL/검색 helper
- `server.ts`
  - 로컬 개발 서버 및 API 라우트
- `api/*.ts`
  - Vercel 배포용 Serverless Functions

## 최근 커밋

- 다음 커밋 예정
  - 방명록 팝업, Google Sheet 방명록 읽기, 북마크, 소개 문구 수정, 작업 히스토리 문서 추가
- `a3d2ecf Add map loading indicator`
  - 지도 위치 검색 중 원형 로딩 표시 추가
- `c639122 Remove map marker animation`
  - 마커 드롭 애니메이션 제거, 즉시 이동 방식으로 단순화
- `4a89ba5 Improve restaurant location matching`
  - URL 좌표 우선 사용, 다중 검색 후보 점수화, 폐점 필터, `온도` 수동 보정
- `c88bd8f Refine map marker drop animation`
  - 이전 마커 애니메이션 개선. 이후 `c639122`에서 애니메이션 제거됨
- `18133f9 Fix Vercel API module resolution`
  - Vercel API 함수 모듈 해석 문제 수정
- `7b89b0a Add Vercel API functions`
  - Vercel 배포용 API 추가
- `7e1b2fe Build local restaurant guide`
  - 초기 맛집 지도 앱 구성

## 검증 명령

배포 전 항상 아래를 확인했다.

```bash
npm run lint
npm run build
```

로컬 실행:

```bash
npm run dev
```

기본 로컬 URL:

```text
http://localhost:3000/
```

## 배포 방식

현재는 GitHub `main` 브랜치 push가 Vercel production 배포를 트리거한다.

일반 흐름:

```bash
git status --short
npm run lint
npm run build
git add <changed-files>
git commit -m "<message>"
git push
```

Vercel 배포 상태는 Vercel 플러그인의 deployment list로 확인했다. 최신 production deployment가 `READY`인지 확인하고, 공개 URL에서 앱이 정상 로딩되는지도 확인한다.

## 주의할 점

- 사용자가 명시적으로 배포를 요청하기 전에는 Vercel 배포를 진행하지 않는 흐름으로 작업했다.
- Naver Place의 메뉴 상세 API는 공식 제공 API가 없어, 메뉴 데이터 직접 연동은 하지 않았다.
- `상세 메뉴 보러가기` 버튼은 네이버 모바일 플레이스 메뉴 URL로 연결한다.
- Google Sheet의 검은색 셀 정보는 API로 직접 색상을 읽지 않고 행 번호 목록으로 관리한다.
- `.env.local`에는 실제 인증키가 있으므로 문서나 커밋에 값이 들어가지 않게 주의한다.
