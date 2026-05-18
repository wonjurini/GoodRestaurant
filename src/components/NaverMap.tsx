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
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    if (marker) {
      const position = new window.naver.maps.LatLng(marker.lat, marker.lng);
      
      markerRef.current = new window.naver.maps.Marker({
        position: position,
        map: mapRef.current,
        title: marker.title,
        animation: window.naver.maps.Animation.DROP
      });

      const focusMarker = () => {
        mapRef.current.setZoom(17, false);
        mapRef.current.setCenter(position);
      };

      focusMarker();
      window.requestAnimationFrame(focusMarker);
      const focusTimer = window.setTimeout(focusMarker, 120);

      return () => window.clearTimeout(focusTimer);
    }
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
