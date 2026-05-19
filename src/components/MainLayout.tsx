import { useState, useMemo, useEffect } from 'react';
import { useRestaurants, Restaurant } from '../hooks/useRestaurants';
import { useGuestbook } from '../hooks/useGuestbook';
import { cn } from '../lib/utils';
import { NaverMap } from './NaverMap';
import { Star, MapPin, ExternalLink, Coffee, Utensils, Search, MessageSquareText, X, RefreshCw, PenLine, Bookmark } from 'lucide-react';

const RESTAURANT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1e_iFONEtX9CaebJuEoZx37Sdc5sI-Kr5eg34mdH4I3Q/edit?gid=318691226#gid=318691226';
const GUESTBOOK_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1e_iFONEtX9CaebJuEoZx37Sdc5sI-Kr5eg34mdH4I3Q/edit?gid=1853269471#gid=1853269471';
const BOOKMARK_STORAGE_KEY = 'goodRestaurant.bookmarkedRestaurantIds';
const GUIDE_CENTER = { lat: 37.5668, lng: 126.9827 };
const PLACE_SEARCH_CONTEXTS = ['을지로', '종각', '광화문', '명동', '서울'];

interface PlaceLocation {
  lat: number;
  lng: number;
  _isKatech?: boolean;
}

interface NaverLocalItem {
  title?: string;
  category?: string;
  roadAddress?: string;
  address?: string;
  mapx?: string;
  mapy?: string;
}

const MANUAL_PLACE_LOCATIONS: Record<string, PlaceLocation> = {
  온도: { lat: 37.5687931, lng: 126.9862618 },
};

function getRatingScore(rating: string) {
  const numericRating = Number(rating);
  if (!Number.isNaN(numericRating)) return numericRating;

  return [...rating].filter((character) => character === '★' || character === '⭐').length;
}

function getStoredBookmarkIds() {
  try {
    const storedValue = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];
    return Array.isArray(parsedValue) ? parsedValue.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function getNaverMenuUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const sharePlaceId = url.searchParams.get('id');
    const pathPlaceId = url.pathname.match(/\/(?:restaurant|place)\/(\d+)/)?.[1];
    const mapPlaceId = url.pathname.match(/\/(?:v5\/)?(?:entry|place)\/place\/(\d+)/)?.[1]
      || url.pathname.match(/\/p\/entry\/place\/(\d+)/)?.[1];
    const placeId = sharePlaceId || pathPlaceId || mapPlaceId;

    if (placeId) {
      return `https://m.place.naver.com/place/${placeId}/menu/list`;
    }

    if (url.hostname === 'map.naver.com') {
      url.searchParams.set('placePath', '/menu/list');
      return url.toString();
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

function stripHtml(value = '') {
  return value.replace(/<[^>]*>/g, '').trim();
}

function getDistanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const earthRadius = 6371000;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getLocationFromNaverItem(item: NaverLocalItem): PlaceLocation | null {
  let lng = Number(item.mapx);
  let lat = Number(item.mapy);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  if (lng > 1000000) {
    lng = lng / 10000000;
    lat = lat / 10000000;
    return { lat, lng };
  }

  return { lat, lng, _isKatech: true };
}

function getComparableLocation(location: PlaceLocation): { lat: number; lng: number } | null {
  if (!location._isKatech) {
    return location;
  }

  if (!window.naver?.maps?.TransCoord) return null;

  const tm128 = new window.naver.maps.Point(location.lng, location.lat);
  const latLng = window.naver.maps.TransCoord.fromTM128ToLatLng(tm128);
  return { lat: latLng.lat(), lng: latLng.lng() };
}

function chooseNearestLocalSearchItem(items: NaverLocalItem[], restaurantName: string): PlaceLocation | null {
  const uniqueCandidates = new Map<string, { item: NaverLocalItem; location: PlaceLocation; comparableLocation: { lat: number; lng: number } }>();

  for (const item of items) {
    const location = getLocationFromNaverItem(item);
    if (!location) continue;

    const comparableLocation = getComparableLocation(location);
    if (!comparableLocation) continue;

    const key = `${item.mapx}:${item.mapy}`;
    if (!uniqueCandidates.has(key)) {
      uniqueCandidates.set(key, { item, location, comparableLocation });
    }
  }

  const candidates = [...uniqueCandidates.values()];
  if (candidates.length === 0) return null;

  const cleanName = restaurantName.replace(/\s+/g, '').toLowerCase();

  candidates.sort((a, b) => {
    const getScore = (candidate: typeof candidates[number]) => {
      const title = stripHtml(candidate.item.title).replace(/\s+/g, '').toLowerCase();
      const category = candidate.item.category || '';
      const address = `${candidate.item.roadAddress || ''} ${candidate.item.address || ''}`;
      let score = getDistanceMeters(GUIDE_CENTER, candidate.comparableLocation);

      if (!title.includes(cleanName)) score += 3000;
      if (!category.includes('음식점') && !category.includes('카페')) score += 1500;
      if (!/(중구|종로구|을지로|종각|광화문|명동)/.test(address)) score += 2000;

      return score;
    };

    return getScore(a) - getScore(b);
  });

  return candidates[0].location;
}

function PlaceSearchMap({ selectedRestaurant }: { selectedRestaurant: Restaurant | null }) {
  const [placeLocation, setPlaceLocation] = useState<PlaceLocation | null>(null);
  const [clientId, setClientId] = useState<string>('');
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  useEffect(() => {
    // Fetch Map Client ID securely from server
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.naverMapsClientId) {
          setClientId(data.naverMapsClientId);
        }
      })
      .catch(err => console.error("Failed to fetch map config", err));
  }, []);

  useEffect(() => {
    if (!selectedRestaurant) {
      setPlaceLocation(null);
      setIsLocationLoading(false);
      return;
    }
    
    const controller = new AbortController();
    setIsLocationLoading(true);

    async function findLocation() {
      const manualLocation = MANUAL_PLACE_LOCATIONS[selectedRestaurant.name];
      if (manualLocation) {
        setPlaceLocation(manualLocation);
        return;
      }

      if (selectedRestaurant.url) {
        const urlResponse = await fetch(`/api/place-location?url=${encodeURIComponent(selectedRestaurant.url)}`, { signal: controller.signal });
        if (urlResponse.ok) {
          const data = await urlResponse.json();
          if (data.location) {
            setPlaceLocation(data.location);
            return;
          }
        }
      }

      const searchResponses = await Promise.all(PLACE_SEARCH_CONTEXTS.map(async (context) => {
        const query = `${selectedRestaurant.name} ${context}`;
        const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&display=5`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to search location: ${response.status}`);
        }

        const data = await response.json();
        return (data.items || []) as NaverLocalItem[];
      }));

      const location = chooseNearestLocalSearchItem(searchResponses.flat(), selectedRestaurant.name);
      setPlaceLocation(location);
    }

    findLocation()
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.error("Failed to find location via Naver Search:", err);
        setPlaceLocation(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLocationLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedRestaurant]);

  // Handle map center and markers depending on isKatech
  const [marker, setMarker] = useState<{lat: number; lng: number; title: string} | null>(null);

  useEffect(() => {
    if (!placeLocation) {
      setMarker(null);
      return;
    }

    let lat = placeLocation.lat;
    let lng = placeLocation.lng;
    
    const isKatech = (placeLocation as any)._isKatech;
    if (isKatech) {
      if (!window.naver) {
        setMarker(null);
        return;
      }

      // Local Search returning KATECH (mapx=X, mapy=Y without dot usually like 312312, 542421)
      // Actually Naver Local Search is known to return KATECH but represented as integer strings without decimals.
      // E.g., mapx: "312312", mapy: "542421".
      // They can be converted using naver.maps.TransCoord.fromTM128ToLatLng(new naver.maps.Point(lng, lat))
      const tm128 = new window.naver.maps.Point(lng, lat);
      const latLng = window.naver.maps.TransCoord.fromTM128ToLatLng(tm128);
      lat = latLng.lat();
      lng = latLng.lng();
    }

    setMarker({
      lat: lat,
      lng: lng,
      title: selectedRestaurant?.name || ''
    });
  }, [placeLocation, selectedRestaurant]);


  return (
    <div className="w-full h-full relative">
      {clientId ? (
        <NaverMap 
          clientId={clientId}
          marker={marker}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
          지도를 설정하는 중...
        </div>
      )}
      {isLocationLoading && clientId && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/20">
          <div
            className="h-12 w-12 rounded-full border-4 border-white/90 border-t-amber-500 shadow-lg animate-spin"
            aria-label="위치 불러오는 중"
          />
        </div>
      )}
    </div>
  );
}

function GuestbookModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { entries, loading, error, refetch } = useGuestbook(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-xl max-h-[82vh] overflow-hidden bg-white shadow-2xl border border-slate-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold">
              <MessageSquareText className="w-4 h-4" />
              방명록
            </div>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">오늘의 한마디</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            aria-label="방명록 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <a
            href={GUESTBOOK_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 transition-colors"
          >
            <PenLine className="w-4 h-4" />
            방명록 쓰기
          </a>
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            새로고침
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
          {loading && entries.length === 0 ? (
            <div className="py-14 flex flex-col items-center text-slate-500">
              <div className="h-10 w-10 rounded-full border-4 border-white border-t-amber-500 shadow animate-spin" />
              <p className="mt-4 text-sm">방명록을 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="bg-white border border-red-100 p-5 text-sm text-red-600">
              {error.message}
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-white border border-slate-100 p-8 text-center text-sm text-slate-500">
              아직 남겨진 한마디가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="bg-white border border-slate-100 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-amber-700">{entry.date || '날짜 없음'}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
                    {entry.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MainLayout() {
  const { data, loading, error, categories } = useRestaurants();
  const [activeCategory, setActiveCategory] = useState<string>('한식');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedMenuUrl, setSelectedMenuUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGuestbookOpen, setIsGuestbookOpen] = useState(false);
  const [bookmarkedRestaurantIds, setBookmarkedRestaurantIds] = useState<string[]>(() => getStoredBookmarkIds());
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarkedRestaurantIds));
  }, [bookmarkedRestaurantIds]);

  const bookmarkedRestaurantIdSet = useMemo(() => new Set(bookmarkedRestaurantIds), [bookmarkedRestaurantIds]);
  const bookmarkCount = bookmarkedRestaurantIds.length;

  const toggleBookmark = (restaurantId: string) => {
    setBookmarkedRestaurantIds((currentIds) => (
      currentIds.includes(restaurantId)
        ? currentIds.filter((id) => id !== restaurantId)
        : [...currentIds, restaurantId]
    ));
  };

  // Filter initially by category and search query
  const filteredData = useMemo(() => {
    return data
      .filter(r => 
        r.category === activeCategory && 
        (!showOnlyBookmarks || bookmarkedRestaurantIdSet.has(r.id)) &&
        (searchQuery === '' || r.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => getRatingScore(b.rating) - getRatingScore(a.rating) || a.name.localeCompare(b.name, 'ko'));
  }, [data, activeCategory, searchQuery, showOnlyBookmarks, bookmarkedRestaurantIdSet]);

  // When category changes, reset selection if the selected restaurant is not in it
  useEffect(() => {
    if (selectedRestaurant && selectedRestaurant.category !== activeCategory) {
      setSelectedRestaurant(null);
    }
  }, [activeCategory, selectedRestaurant]);

  useEffect(() => {
    if (!selectedRestaurant?.url) {
      setSelectedMenuUrl('');
      return;
    }

    const fallbackMenuUrl = getNaverMenuUrl(selectedRestaurant.url);
    setSelectedMenuUrl(fallbackMenuUrl);

    const controller = new AbortController();
    fetch(`/api/place-menu-url?url=${encodeURIComponent(selectedRestaurant.url)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to resolve place URL: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.url) {
          setSelectedMenuUrl(data.url);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Failed to resolve menu URL:', err);
        }
      });

    return () => controller.abort();
  }, [selectedRestaurant]);

  const detailMenuUrl = selectedMenuUrl || selectedRestaurant?.url || '';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500">맛집 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-red-500">데이터를 불러오는데 실패했습니다: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar List */}
      <div className="w-full md:w-[400px] lg:w-[480px] flex-shrink-0 flex flex-col border-r border-slate-200 shadow-sm z-10 h-full bg-white">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">교원 주변 맛집</h1>
              <p className="mt-1 text-xs font-medium text-slate-500">제공 : 교원 최고의 미식가 이한빛님</p>
              <a
                href={RESTAURANT_SHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-700 transition-colors"
              >
                출처 : 맛집 시트 바로가기
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex flex-shrink-0 flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => setIsGuestbookOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                aria-label="방명록 열기"
                title="방명록"
              >
                <MessageSquareText className="w-5 h-5" />
              </button>
              <span className="text-[11px] font-semibold text-slate-500">방명록</span>
            </div>
          </div>
          
          {/* Categories */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setSearchQuery('');
                }}
                className={cn(
                  "px-4 py-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  activeCategory === cat 
                    ? "bg-amber-50 text-amber-700" 
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {cat === '카페' ? <Coffee className="w-4 h-4 inline-block mr-1.5" /> : <Utensils className="w-4 h-4 inline-block mr-1.5" />}
                {cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder={`${activeCategory} 맛집 검색...`} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-slate-700"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowOnlyBookmarks((value) => !value)}
            className={cn(
              "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors",
              showOnlyBookmarks
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            <Bookmark className={cn("w-4 h-4", showOnlyBookmarks && "fill-current")} />
            북마크만 보기
            <span className="text-xs text-slate-400">({bookmarkCount})</span>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-0">
          {filteredData.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              {showOnlyBookmarks ? '북마크한 맛집이 없습니다.' : '해당하는 맛집이 없습니다.'}
            </div>
          ) : (
            filteredData.map((restaurant) => {
              const isSelected = selectedRestaurant?.id === restaurant.id;
              const isBookmarked = bookmarkedRestaurantIdSet.has(restaurant.id);
              return (
                <div
                  key={restaurant.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRestaurant(restaurant)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedRestaurant(restaurant);
                    }
                  }}
                  className={cn(
                    "w-full cursor-pointer text-left p-5 bg-white border-b border-slate-100 transition-colors last:border-b-0",
                    isSelected 
                      ? "bg-slate-50 border-l-4 border-l-amber-500 shadow-sm" 
                      : "hover:bg-slate-50 border-l-4 border-l-transparent"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="min-w-0 pr-3">
                      <h3 className={cn("font-bold text-lg leading-tight", isSelected ? "text-slate-900" : "text-slate-800 group-hover:text-slate-900")}>
                        {restaurant.name}
                      </h3>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <div className="flex items-center text-amber-500 text-sm mt-1">
                        <Star className="w-4 h-4 fill-current mr-1" />
                        <span className="font-medium text-slate-700">{getRatingScore(restaurant.rating) || restaurant.rating}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleBookmark(restaurant.id);
                        }}
                        className={cn(
                          "h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors",
                          isBookmarked
                            ? "bg-amber-50 text-amber-600"
                            : "text-slate-300 hover:bg-slate-100 hover:text-amber-500"
                        )}
                        aria-label={isBookmarked ? `${restaurant.name} 북마크 해제` : `${restaurant.name} 북마크 추가`}
                        title={isBookmarked ? '북마크 해제' : '북마크 추가'}
                      >
                        <Bookmark className={cn("w-4 h-4", isBookmarked && "fill-current")} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2 mt-2">
                    "{restaurant.review}"
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Content (Map & Details) */}
      <div className="flex-1 hidden md:flex flex-col relative bg-[#e5e3df] overflow-hidden">
        <div className="flex-1 relative">
          <PlaceSearchMap selectedRestaurant={selectedRestaurant} />
          
          {/* Default State */}
          {!selectedRestaurant && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 backdrop-blur-sm px-6 py-4 rounded-full shadow-lg border border-white flex items-center text-slate-600 pointer-events-auto">
                    <MapPin className="w-5 h-5 mr-2 text-slate-400" />
                    왼쪽 리스트에서 맛집을 선택해보세요
                </div>
             </div>
          )}
        </div>

        {/* Selected Restaurant Detial Card Floating */}
        {selectedRestaurant && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-white p-8 shadow-xl border border-slate-200 animate-in fade-in slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded mb-3 italic">{selectedRestaurant.category}</span>
                <h2 className="text-2xl font-bold text-slate-900 leading-tight">{selectedRestaurant.name}</h2>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex text-amber-500 tracking-widest text-lg">
                  {selectedRestaurant.rating}
                </div>
                <button
                  type="button"
                  onClick={() => toggleBookmark(selectedRestaurant.id)}
                  className={cn(
                    "mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors",
                    bookmarkedRestaurantIdSet.has(selectedRestaurant.id)
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-amber-600"
                  )}
                >
                  <Bookmark className={cn("w-4 h-4", bookmarkedRestaurantIdSet.has(selectedRestaurant.id) && "fill-current")} />
                  북마크
                </button>
              </div>
            </div>
            
            <p className="text-slate-600 text-sm mb-6">"{selectedRestaurant.review}"</p>
            
            <div className="mt-4">
              {detailMenuUrl && (
                <a 
                  href={detailMenuUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-all shadow-md active:transform active:scale-95"
                >
                  상세 메뉴 보러가기 <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Map Button Floating */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2">
         {/* Could implement full mobile toggle later, but currently keeping it desktop-first priority as per guidelines while adapting UI */}
      </div>

      <GuestbookModal open={isGuestbookOpen} onClose={() => setIsGuestbookOpen(false)} />

    </div>
  );
}
