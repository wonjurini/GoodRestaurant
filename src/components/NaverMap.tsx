import { useEffect, useRef, useState } from 'react';

// Declare naver map types on window
declare global {
  interface Window {
    naver: any;
  }
}

interface NaverMapProps {
  clientId: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  marker?: { lat: number; lng: number; title: string } | null;
}

export function NaverMap({ clientId, center = { lat: 37.5665, lng: 126.9780 }, zoom = 15, marker }: NaverMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const markerTimerRef = useRef<number | null>(null);
  const mapIdleListenerRef = useRef<any>(null);
  const markerRequestRef = useRef(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const clearPendingMarker = () => {
    if (markerTimerRef.current !== null) {
      window.clearTimeout(markerTimerRef.current);
      markerTimerRef.current = null;
    }

    if (mapIdleListenerRef.current) {
      window.naver?.maps?.Event?.removeListener(mapIdleListenerRef.current);
      mapIdleListenerRef.current = null;
    }
  };

  useEffect(() => {
    const existingScript = document.getElementById('naver-map-script') as HTMLScriptElement;
    setLoadError(null);
    
    if (existingScript) {
      if (existingScript.src.includes(`ncpKeyId=${encodeURIComponent(clientId)}`)) {
        if (window.naver && window.naver.maps) {
          setIsLoaded(true);
        } else {
          existingScript.addEventListener('load', () => {
            setIsLoaded(Boolean(window.naver && window.naver.maps));
          });
        }
        return;
      } else {
        existingScript.remove();
        delete window.naver;
      }
    }

    const script = document.createElement('script');
    script.id = 'naver-map-script';
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`;
    script.async = true;
    script.onload = () => {
      if (window.naver && window.naver.maps) {
        setIsLoaded(true);
      } else {
        setLoadError('네이버 지도 SDK 인증에 실패했습니다. Client ID와 Web Service URL을 확인해주세요.');
      }
    };
    script.onerror = () => {
      setLoadError('네이버 지도 SDK를 불러오지 못했습니다. 네트워크 또는 인증 설정을 확인해주세요.');
    };
    document.head.appendChild(script);
  }, [clientId]);

  useEffect(() => {
    if (!isLoaded || !mapElement.current) return;

    if (!mapRef.current) {
      const initialCenter = marker ?? center;
      const location = new window.naver.maps.LatLng(initialCenter.lat, initialCenter.lng);
      
      const mapOptions = {
        center: location,
        zoom: marker ? 17 : zoom,
        minZoom: 7,
        zoomControl: true,
        zoomControlOptions: {
          position: window.naver.maps.Position.TOP_RIGHT,
        },
      };

      mapRef.current = new window.naver.maps.Map(mapElement.current, mapOptions);
    }
  }, [isLoaded, center, zoom, marker]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const requestId = markerRequestRef.current + 1;
    markerRequestRef.current = requestId;
    clearPendingMarker();

    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }

    if (!marker) {
      return;
    }

    const position = new window.naver.maps.LatLng(marker.lat, marker.lng);
    let didShowMarker = false;

    const showMarker = () => {
      if (didShowMarker || markerRequestRef.current !== requestId || !mapRef.current) return;

      didShowMarker = true;
      clearPendingMarker();
      markerRef.current = new window.naver.maps.Marker({
        position: position,
        map: mapRef.current,
        title: marker.title,
        icon: {
          content: '<div class="restaurant-map-marker"><div class="restaurant-map-marker-pin"><div class="restaurant-map-marker-dot"></div></div></div>',
          anchor: new window.naver.maps.Point(18, 44),
        },
      });
    };

    mapRef.current.setZoom(17, false);
    mapRef.current.panTo(position);

    mapIdleListenerRef.current = window.naver.maps.Event.addListener(mapRef.current, 'idle', showMarker);
    markerTimerRef.current = window.setTimeout(showMarker, 500);

    return () => {
      clearPendingMarker();
    };
  }, [marker, isLoaded]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapElement} className="w-full h-full" />
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90 p-6 text-center text-sm text-slate-600">
          {loadError}
        </div>
      )}
    </div>
  );
}
