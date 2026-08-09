'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Image from 'next/image';
import type { Session } from '@supabase/supabase-js';
import { Sidebar } from './ui/Sidebar';
import { SpotFormModal } from './SpotFormModal';
import { createClient } from '../lib/supabase/client';
import type { City, Photo, Spot, SpotType } from '../lib/types';

type Island = 'north' | 'south';

// Order here also drives left-to-right layout in the grid below.
const ISLAND_ORDER: Island[] = ['south', 'north'];

const ISLANDS: Record<Island, { label: string; bounds: L.LatLngBoundsLiteral }> = {
  north: {
    label: '北島',
    bounds: [
      [-40.2, 173.2],
      [-34.0, 178.9],
    ],
  },
  south: {
    label: '南島',
    bounds: [
      [-46.8, 165.5],
      [-41.1, 174.8],
    ],
  },
};

const getIsland = (city: City): Island => (city.lat > -41.5 ? 'north' : 'south');

// Haversine-free approximation is fine here: NZ spans a small enough
// latitude range that squared-distance comparison picks the same
// "nearest city" as a true great-circle distance would.
const findNearestCity = (cities: City[], lat: number, lng: number): City | null => {
  let nearest: City | null = null;
  let nearestDistanceSq = Infinity;

  for (const city of cities) {
    const distanceSq = (city.lat - lat) ** 2 + (city.lng - lng) ** 2;
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearest = city;
    }
  }

  return nearest;
};

const hasValidCoordinates = (location: { lat: unknown; lng: unknown } | null | undefined): location is { lat: number; lng: number } => (
  location != null
  && typeof location.lat === 'number'
  && Number.isFinite(location.lat)
  && typeof location.lng === 'number'
  && Number.isFinite(location.lng)
);

// Collapsed state shows the spot count; expanded state shows a plain
// collapse affordance instead, so the count label disappears once the
// individual spots are visible on the map.
const createCityCountIcon = (count: number, isExpanded: boolean) => L.divIcon({
  html: `<div style="
    background: ${isExpanded ? 'var(--color-trip1)' : 'var(--color-accommodation)'};
    border: 3px solid white;
    border-radius: 50%;
    min-width: 38px; height: 38px;
    padding: 0 6px;
    display: flex; align-items: center; justify-content: center;
    color: white;
    font-size: ${isExpanded ? '20px' : '14px'};
    font-weight: 700;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  ">${isExpanded ? '−' : count}</div>`,
  className: 'custom-city-count-icon',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const SPOT_EMOJIS: Record<SpotType, string> = {
  accommodation: '🏠',
  attraction: '📍',
  restaurant: '🍽️',
  other: '📌',
};

const createSpotIcon = (type: SpotType) => L.divIcon({
  html: `<div style="
    background: white;
    border: 2px solid var(--color-${type});
    border-radius: 50%;
    width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  ">${SPOT_EMOJIS[type]}</div>`,
  className: 'custom-spot-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function MapComponent() {
  const northMapRef = useRef<HTMLDivElement>(null);
  const southMapRef = useRef<HTMLDivElement>(null);
  const mapInstancesRef = useRef<Partial<Record<Island, L.Map>>>({});
  const markersRef = useRef<Record<Island, L.Marker[]>>({ north: [], south: [] });
  // The map-click handler below is registered once (empty deps effect), so
  // it closes over a stale `cities` state. Keep a ref in sync instead of
  // reading `cities` directly, so newly loaded cities are visible to it.
  const citiesRef = useRef<City[]>([]);

  const [session, setSession] = useState<Session | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [expandedCityIds, setExpandedCityIds] = useState<Set<string>>(() => new Set());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [clickCoords, setClickCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [activeFilters, setActiveFilters] = useState({
    accommodation: true,
    attraction: true,
    restaurant: true,
    other: true,
  });

  const loadData = useCallback(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
    });

    Promise.all([
      supabase.from('cities').select('*').order('order'),
      supabase.from('spots').select('*'),
      supabase.from('photos').select('*'),
    ]).then(([citiesRes, spotsRes, photosRes]) => {
      if (citiesRes.data) {
        setCities(citiesRes.data.filter((city): city is City => hasValidCoordinates(city)));
      }
      if (spotsRes.data) {
        setSpots(spotsRes.data.filter((spot): spot is Spot => hasValidCoordinates(spot)));
      }
      if (photosRes.data) setPhotos(photosRes.data);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    citiesRef.current = cities;
  }, [cities]);

  useEffect(() => {
    const mapContainers: Record<Island, HTMLDivElement | null> = {
      north: northMapRef.current,
      south: southMapRef.current,
    };

    // The two map panes sit in a CSS grid whose column width isn't final the
    // instant this effect runs (fonts/layout can still settle), so calling
    // fitBounds() immediately can lock in a zoom level based on a
    // too-narrow container -- which is why the default view sometimes
    // looked more zoomed out than intended. Track first-resize-per-island
    // so we only force-refit once real dimensions are known, and afterwards
    // just keep Leaflet's internal size cache in sync without fighting any
    // zoom/pan the user has already done.
    const hasSettled: Partial<Record<Island, boolean>> = {};
    const resizeObservers: ResizeObserver[] = [];

    ISLAND_ORDER.forEach((island) => {
      const container = mapContainers[island];
      if (!container || mapInstancesRef.current[island]) return;

      const map = L.map(container, {
        maxBounds: ISLANDS[island].bounds,
        maxBoundsViscosity: 1.0,
        zoomControl: false,
      });
      map.fitBounds(ISLANDS[island].bounds, { padding: [12, 12] });
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
        if (!hasSettled[island]) {
          hasSettled[island] = true;
          map.fitBounds(ISLANDS[island].bounds, { padding: [12, 12] });
        }
      });
      resizeObserver.observe(container);
      resizeObservers.push(resizeObserver);

      map.on('click', async (event) => {
        const supabase = createClient();
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) return;

        if (citiesRef.current.length === 0) {
          console.warn('No cities loaded yet; cannot assign a city_id to a new spot.');
          return;
        }

        setClickCoords({ lat: event.latlng.lat, lng: event.latlng.lng });
        setIsFormOpen(true);
      });

      mapInstancesRef.current[island] = map;
    });

    return () => {
      resizeObservers.forEach((observer) => observer.disconnect());
      (Object.keys(mapInstancesRef.current) as Island[]).forEach((island) => {
        mapInstancesRef.current[island]?.remove();
      });
      mapInstancesRef.current = {};
    };
  }, []);

  useEffect(() => {
    ISLAND_ORDER.forEach((island) => {
      const map = mapInstancesRef.current[island];
      if (!map) return;

      markersRef.current[island].forEach((marker) => marker.remove());
      markersRef.current[island] = [];

      cities
        .filter((city) => hasValidCoordinates(city) && getIsland(city) === island)
        .sort((a, b) => a.order - b.order)
        .forEach((city) => {
          const visibleSpots = spots
            .filter((spot) => spot.city_id === city.id && activeFilters[spot.type] && hasValidCoordinates(spot))
            .sort((a, b) => new Date(a.visited_date).getTime() - new Date(b.visited_date).getTime());

          if (visibleSpots.length === 0) return;

          const cityLatLng = L.latLng(city.lat, city.lng);
          const isExpanded = expandedCityIds.has(city.id);
          const cityMarker = L.marker(cityLatLng, {
            icon: createCityCountIcon(visibleSpots.length, isExpanded),
            title: `${city.name}：${visibleSpots.length} 個地點`,
          }).addTo(map);

          cityMarker.bindTooltip(
            `${city.name}：${visibleSpots.length} 個地點${isExpanded ? '（點擊收合）' : '（點擊展開）'}`,
            { direction: 'top', offset: [0, -19] },
          );
          cityMarker.on('click', () => {
            setExpandedCityIds((previous) => {
              const next = new Set(previous);
              if (next.has(city.id)) next.delete(city.id);
              else next.add(city.id);
              return next;
            });

            if (isExpanded) return;

            // Zoom in far enough that same-city spots (which can sit only
            // a few dozen metres apart) actually separate on screen,
            // instead of overlapping into a stack of circles.
            if (visibleSpots.length > 1) {
              const spotBounds = L.latLngBounds(visibleSpots.map((spot) => [spot.lat, spot.lng]));
              map.flyToBounds(spotBounds, { padding: [60, 60], maxZoom: 17, duration: 0.5 });
            } else {
              map.flyTo(cityLatLng, 15, { duration: 0.5 });
            }
          });
          markersRef.current[island].push(cityMarker);

          if (!isExpanded) return;

          visibleSpots.forEach((spot) => {
            const spotMarker = L.marker([spot.lat, spot.lng], {
              icon: createSpotIcon(spot.type),
              title: spot.name,
            }).addTo(map);
            spotMarker.bindTooltip(spot.name, { direction: 'top', offset: [0, -15] });
            spotMarker.on('click', () => setSelectedSpot(spot));
            markersRef.current[island].push(spotMarker);
          });
        });
    });
  }, [activeFilters, cities, expandedCityIds, spots]);

  const toggleFilter = (type: SpotType) => {
    setActiveFilters((previous) => ({ ...previous, [type]: !previous[type] }));
  };

  const selectedSpotPhotos = selectedSpot ? photos.filter((photo) => photo.spot_id === selectedSpot.id) : [];
  const nearestCityForClick = clickCoords ? findNearestCity(cities, clickCoords.lat, clickCoords.lng) : null;

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', height: '100%', background: 'var(--border-color)' }}>
        {ISLAND_ORDER.map((island) => (
          <section key={island} style={{ position: 'relative', minWidth: 0, height: '100%', overflow: 'hidden' }}>
            <div
              ref={island === 'north' ? northMapRef : southMapRef}
              style={{ height: '100%', width: '100%', zIndex: 10 }}
            />
            <h2 style={{
              position: 'absolute', top: 16, right: 16, zIndex: 20, margin: 0,
              padding: '8px 12px', borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.9)', color: 'var(--text-primary)', fontSize: '16px',
            }}>
              {ISLANDS[island].label}
            </h2>
          </section>
        ))}
      </div>

      <div className="aurora-glass" style={{
        position: 'absolute', top: 20, left: 20, zIndex: 30,
        padding: '16px', borderRadius: 'var(--radius-md)', width: '200px',
      }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>地點篩選</h4>
        <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.4 }}>
          圓點數字為該區符合篩選條件的地點數。點擊可展開該區地點，展開後數字會變成「－」，再點一次可收合。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(
            [
              ['accommodation', '🏠 住宿'],
              ['attraction', '📍 景點'],
              ['restaurant', '🍽️ 餐廳'],
              ['other', '📌 其他'],
            ] as const
          ).map(([type, label]) => (
            <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={activeFilters[type]} onChange={() => toggleFilter(type)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {session && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>💡 點擊地圖任意處可新增地點</p>
          </div>
        )}
      </div>

      <Sidebar isOpen={!!selectedSpot} onClose={() => setSelectedSpot(null)} title={selectedSpot?.name ?? ''}>
        {selectedSpot && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <span className={`badge badge-${selectedSpot.type}`}>
                {selectedSpot.type === 'accommodation' ? '🏠 住宿' : selectedSpot.type === 'attraction' ? '📍 景點' : selectedSpot.type === 'restaurant' ? '🍽️ 餐廳' : '📌 其他'}
              </span>
              <span style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>日期：{selectedSpot.visited_date}</span>
            </div>
            <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '24px', whiteSpace: 'pre-wrap' }}>{selectedSpot.description}</p>
            {selectedSpotPhotos.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0 }}>📸 照片記錄</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {selectedSpotPhotos.map((photo) => (
                    <div key={photo.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden' }}>
                      <Image src={photo.cloudinary_url} alt="" fill sizes="200px" style={{ objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '24px', textAlign: 'center', border: '1px dashed var(--border-strong)', color: 'var(--text-muted)', fontSize: '13px' }}>
                尚無照片
              </div>
            )}
          </div>
        )}
      </Sidebar>

      {clickCoords && nearestCityForClick && (
        <SpotFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setClickCoords(null);
          }}
          lat={clickCoords.lat}
          lng={clickCoords.lng}
          cityId={nearestCityForClick.id}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
