import { useState, useMemo, useEffect } from 'react';
import { useRestaurants, Restaurant } from '../hooks/useRestaurants';
import { cn } from '../lib/utils';
import { NaverMap } from './NaverMap';
import { Star, MapPin, ExternalLink, Coffee, Utensils, Search } from 'lucide-react';

const RESTAURANT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1e_iFONEtX9CaebJuEoZx37Sdc5sI-Kr5eg34mdH4I3Q/edit?gid=318691226#gid=318691226';
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

export default function MainLayout() {
  const { data, loading, error, categories } = useRestaurants();
  const [activeCategory, setActiveCategory] = useState<string>('한식');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedMenuUrl, setSelectedMenuUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter initially by category and search query
  const filteredData = useMemo(() => {
    return data
      .filter(r => 
        r.category === activeCategory && 
        (searchQuery === '' || r.name.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => getRatingScore(b.rating) - getRatingScore(a.rating) || a.name.localeCompare(b.name, 'ko'));
  }, [data, activeCategory, searchQuery]);

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
          <h1 className="text-xl font-bold tracking-tight text-slate-800">교원 주변 맛집</h1>
          <a
            href={RESTAURANT_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-700 transition-colors"
          >
            맛집 정보(이한빛 님 제공 시트 바로가기)
            <ExternalLink className="w-3 h-3" />
          </a>
          
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
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-0">
          {filteredData.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              해당하는 맛집이 없습니다.
            </div>
          ) : (
            filteredData.map((restaurant) => {
              const isSelected = selectedRestaurant?.id === restaurant.id;
              return (
                <button
                  key={restaurant.id}
                  onClick={() => setSelectedRestaurant(restaurant)}
                  className={cn(
                    "w-full text-left p-5 bg-white border-b border-slate-100 transition-colors last:border-b-0",
                    isSelected 
                      ? "bg-slate-50 border-l-4 border-l-amber-500 shadow-sm" 
                      : "hover:bg-slate-50 border-l-4 border-l-transparent"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={cn("font-bold text-lg leading-tight", isSelected ? "text-slate-900" : "text-slate-800 group-hover:text-slate-900")}>
                      {restaurant.name}
                    </h3>
                    <div className="flex items-center text-amber-500 text-sm mt-1">
                      <Star className="w-4 h-4 fill-current mr-1" />
                      <span className="font-medium text-slate-700">{getRatingScore(restaurant.rating) || restaurant.rating}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2 mt-2">
                    "{restaurant.review}"
                  </p>
                </button>
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

    </div>
  );
}
