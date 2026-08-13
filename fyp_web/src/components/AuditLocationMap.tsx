import React, { useEffect, useRef, useState } from 'react';
import { Building2, MapPin } from 'lucide-react';
import { apiService } from '../services/api';
import type { AuditIPLocation } from '../services/api';

interface Maps3DLibrary {
  Map3DElement: new (options: Record<string, unknown>) => HTMLElement;
  Marker3DElement: new (options: Record<string, unknown>) => HTMLElement;
  MapMode: { ROADMAP: unknown };
  GestureHandling: { NONE: unknown };
}

interface MarkerLibrary {
  PinElement: new (options: Record<string, unknown>) => HTMLElement;
}

interface GoogleMapsAPI {
  maps: {
    importLibrary: (library: string) => Promise<unknown>;
  };
}

let googleMapsLoader: Promise<GoogleMapsAPI> | null = null;

const loadGoogleMaps = (apiKey: string): Promise<GoogleMapsAPI> => {
  const existing = (window as typeof window & { google?: GoogleMapsAPI }).google;
  if (existing?.maps) return Promise.resolve(existing);
  if (googleMapsLoader) return googleMapsLoader;

  googleMapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=alpha&loading=async`;
    script.async = true;
    script.onload = () => {
      const loaded = (window as typeof window & { google?: GoogleMapsAPI }).google;
      if (loaded?.maps) resolve(loaded);
      else reject(new Error('Google Maps did not load'));
    };
    script.onerror = () => reject(new Error('Google Maps did not load'));
    document.head.appendChild(script);
  });

  return googleMapsLoader;
};

export const AuditLocationMap: React.FC<{ ipAddress?: string }> = ({ ipAddress }) => {
  const mapHostRef = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useState<AuditIPLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(Boolean(ipAddress));
  const [mapLoading, setMapLoading] = useState(Boolean(ipAddress));
  const [mapError, setMapError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiService.getAuditMapConfig()
      .then(({ api_key }) => {
        if (cancelled) return;
        const configuredKey = api_key.trim();
        setApiKey(configuredKey);
        if (!configuredKey) setMapLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setApiKey('');
          setMapLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!ipAddress) {
      return () => { cancelled = true; };
    }

    apiService.getAuditIPLocation(ipAddress)
      .then((result) => {
        if (!cancelled) {
          setLocation(result);
          if (!result.available) setMapLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMapError('Location unavailable');
          setMapLoading(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLocationLoading(false);
      });

    return () => { cancelled = true; };
  }, [ipAddress]);

  useEffect(() => {
    let cancelled = false;
    const host = mapHostRef.current;
    if (!host || !location?.available || location.latitude == null || location.longitude == null || !apiKey) return;

    loadGoogleMaps(apiKey)
      .then(async (google) => {
        const [{ Map3DElement, Marker3DElement, MapMode, GestureHandling }, { PinElement }] = await Promise.all([
          google.maps.importLibrary('maps3d') as Promise<Maps3DLibrary>,
          google.maps.importLibrary('marker') as Promise<MarkerLibrary>,
        ]);
        if (cancelled || !mapHostRef.current) return;

        const map = new Map3DElement({
          center: { lat: location.latitude, lng: location.longitude, altitude: 0 },
          range: 1800,
          tilt: 67.5,
          heading: 25,
          mode: MapMode.ROADMAP,
          gestureHandling: GestureHandling.NONE,
          defaultUIHidden: true,
        });
        map.setAttribute('aria-label', 'Read-only approximate action location');

        const redPin = new PinElement({
          background: '#ef4444',
          borderColor: '#ffffff',
          glyphColor: '#ffffff',
          scale: 1.35,
        });
        const locationMarker = new Marker3DElement({
          position: { lat: location.latitude, lng: location.longitude, altitude: 0 },
          label: 'Action location',
          drawsWhenOccluded: true,
          sizePreserved: true,
          zIndex: 1000,
        });
        locationMarker.append(redPin);
        map.append(locationMarker);
        mapHostRef.current.replaceChildren(map);
      })
      .catch(() => {
        if (!cancelled) setMapError('Map unavailable');
      })
      .finally(() => {
        if (!cancelled) setMapLoading(false);
      });

    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, [apiKey, location]);

  const loading = locationLoading || mapLoading;
  const place = [location?.city, location?.region, location?.country].filter(Boolean).join(', ');
  const hasCoordinates = location?.available && location.latitude != null && location.longitude != null;
  const unavailable = !loading && !hasCoordinates;
  const useStaticFallback = !loading && hasCoordinates && (!apiKey || mapError);

  return (
    <section className="space-y-2" aria-label="Action location">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Approximate location</p>
          <p className="text-[10px] text-slate-400">Network estimate · View only</p>
        </div>
        {place && (
          <span className="max-w-[60%] truncate rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-brand-blue dark:bg-blue-950/40">
            {place}
          </span>
        )}
      </div>

      <div className="relative h-52 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
        <div ref={mapHostRef} className="absolute inset-0 [&>*]:h-full [&>*]:w-full pointer-events-none select-none" />

        {useStaticFallback && (
          <>
            <iframe
              title="Read-only approximate action location"
              src={`https://maps.google.com/maps?q=${location.latitude},${location.longitude}&z=18&t=m&output=embed`}
              className="pointer-events-none absolute inset-0 h-full w-full border-0"
              tabIndex={-1}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full drop-shadow-lg" aria-hidden="true">
              <MapPin className="h-9 w-9 fill-red-500 text-white" strokeWidth={2.5} />
            </div>
          </>
        )}

        {loading && (
          <div className="absolute inset-0 space-y-3 bg-slate-100 p-5 dark:bg-slate-800" aria-label="Loading map">
            <div className="h-full w-full rounded-xl shimmer-placeholder" />
            <div className="absolute inset-x-8 bottom-7 h-9 rounded-full shimmer-placeholder" />
          </div>
        )}

        {unavailable && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-50 via-slate-50 to-cyan-50 text-center dark:from-slate-800 dark:via-slate-900 dark:to-blue-950/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-blue shadow-sm dark:bg-slate-800">
              <Building2 className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {location?.message || 'Location unavailable'}
            </p>
          </div>
        )}

        {!loading && hasCoordinates && (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl border border-white/20 bg-slate-950/75 px-3 py-2 text-white shadow-lg backdrop-blur-md">
            <MapPin className="h-4 w-4 shrink-0 text-cyan-300" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold">{place || 'Approximate network area'}</p>
              <p className="truncate text-[9px] text-slate-300">{location.network || location.resolved_ip}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
