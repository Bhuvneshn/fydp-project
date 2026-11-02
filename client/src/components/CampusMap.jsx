// Campus map with event-count pins.
// Camera and 3D buildings adapted from Spots by Akshar Barot (MIT): https://github.com/notAkki/spots
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre v6 runs tile parsing in a module worker; let Vite bundle it and hand over the URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useTheme } from '../theme.jsx';

maplibregl.setWorkerUrl(workerUrl);

// OpenFreeMap's free styles, one per theme, so the map matches the rest of the page.
const STYLES = {
  light: { url: 'https://tiles.openfreemap.org/styles/positron', buildings: '#e2e0dd' },
  dark: { url: 'https://tiles.openfreemap.org/styles/dark', buildings: '#34302d' },
};
const CAMPUS_CENTER = [-80.5425, 43.4705];
const CHECK_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// Extruded buildings give the tilted 3D look; the free styles don't ship one.
function add3dBuildings(map, color) {
  if (map.getLayer('building-3d')) return;
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addLayer(
    {
      id: 'building-3d',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': color,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.85,
      },
    },
    firstLabel
  );
}

/**
 * markers: [{ id, lng, lat, text, label, going }] — text is drawn on the pin (an event count or building code)
 * selectedId: marker id to highlight and fly to
 * onSelect(id): called when a pin is clicked
 * interactive: false for small preview maps
 */
export default function CampusMap({ markers, selectedId, onSelect, userPos, interactive = true, zoom = 15.6, pitch = 52, center }) {
  const { theme } = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES[themeRef.current].url,
      center: center ?? CAMPUS_CENTER,
      zoom,
      pitch,
      interactive,
      attributionControl: { compact: true },
    });
    if (interactive) map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.on('style.load', () => add3dBuildings(map, STYLES[themeRef.current].buildings));
    // Start with the attribution collapsed to its (i) button so it doesn't cover the map.
    map.once('load', () => containerRef.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRefs.current.clear();
    };
    // Camera props only apply on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  // Swap the base map when the theme changes. Pins are DOM markers, so they stay put.
  const firstTheme = useRef(theme);
  useEffect(() => {
    if (theme === firstTheme.current) return;
    firstTheme.current = theme;
    mapRef.current?.setStyle(STYLES[theme].url, { diff: false });
  }, [theme]);

  // Sync pins with props.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = markerRefs.current;
    const nextIds = new Set(markers.map((m) => m.id));

    for (const [id, marker] of existing) {
      if (!nextIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }
    for (const m of markers) {
      let marker = existing.get(m.id);
      if (!marker) {
        // MapLibre owns the wrapper's classes (positioning), so style an inner pin instead.
        const wrapper = document.createElement('div');
        const pin = document.createElement(interactive ? 'button' : 'div');
        if (interactive) {
          pin.type = 'button';
          pin.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectRef.current?.(m.id);
          });
        }
        wrapper.appendChild(pin);
        marker = new maplibregl.Marker({ element: wrapper, anchor: 'bottom' }).setLngLat([m.lng, m.lat]).addTo(map);
        existing.set(m.id, marker);
      }
      const pin = marker.getElement().firstChild;
      const selected = m.id === selectedId;
      pin.className = `map-pin${selected ? ' selected' : ''}${m.going && !selected ? ' going' : ''}`;
      pin.innerHTML = `${m.going && !selected ? CHECK_SVG : ''}<span>${m.text}</span>`;
      pin.title = m.label;
      if (interactive) {
        pin.setAttribute('aria-label', m.label);
        pin.setAttribute('aria-pressed', String(selected));
      }
      // Keep the selected pin above its neighbours.
      marker.getElement().style.zIndex = selected ? '2' : '1';
    }
  }, [markers, selectedId, interactive]);

  useEffect(() => {
    const target = markers.find((m) => m.id === selectedId);
    if (target && mapRef.current && interactive) {
      mapRef.current.flyTo({ center: [target.lng, target.lat], zoom: Math.max(mapRef.current.getZoom(), 16.5), speed: 0.8 });
    }
    // Only fly when the selection changes, not when pins re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!userPos || !mapRef.current) return;
    const el = document.createElement('div');
    el.className = 'map-user';
    el.setAttribute('aria-label', 'Your location');
    const marker = new maplibregl.Marker({ element: el }).setLngLat([userPos.lng, userPos.lat]).addTo(mapRef.current);
    return () => marker.remove();
  }, [userPos]);

  return <div ref={containerRef} className="campus-map" />;
}
