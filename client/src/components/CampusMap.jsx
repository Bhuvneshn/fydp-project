// Campus map with glowing status markers.
// Look and camera adapted from Spots by Akshar Barot (MIT): https://github.com/notAkki/spots
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre v6 runs tile parsing in a module worker; let Vite bundle it and hand over the URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const CAMPUS_CENTER = [-80.5425, 43.4705];

// Extruded buildings give the tilted 3D look; the free dark style doesn't ship one.
function add3dBuildings(map) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addLayer(
    {
      id: 'building-3d',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': '#2a2a31',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.85,
      },
    },
    firstLabel
  );
}

/**
 * markers: [{ id, lng, lat, status: 'live'|'today'|'upcoming', label }]
 * selectedId: marker id to highlight and fly to
 * onSelect(id): called when a marker is clicked
 * interactive: false for small preview maps
 */
export default function CampusMap({ markers, selectedId, onSelect, userPos, interactive = true, zoom = 15.6, pitch = 52, center }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: center ?? CAMPUS_CENTER,
      zoom,
      pitch,
      interactive,
      attributionControl: { compact: true },
    });
    if (interactive) map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.on('style.load', () => add3dBuildings(map));
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

  // Sync markers with props.
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
        // MapLibre owns the wrapper's classes (positioning), so style an inner dot instead.
        const wrapper = document.createElement('div');
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectRef.current?.(m.id);
        });
        wrapper.appendChild(dot);
        marker = new maplibregl.Marker({ element: wrapper }).setLngLat([m.lng, m.lat]).addTo(map);
        existing.set(m.id, marker);
      }
      const dot = marker.getElement().firstChild;
      dot.className = `map-dot ${m.status}${m.id === selectedId ? ' selected' : ''}`;
      dot.title = m.label;
      dot.setAttribute('aria-label', m.label);
    }
  }, [markers, selectedId]);

  useEffect(() => {
    const target = markers.find((m) => m.id === selectedId);
    if (target && mapRef.current && interactive) {
      mapRef.current.flyTo({ center: [target.lng, target.lat], zoom: Math.max(mapRef.current.getZoom(), 16.5), speed: 0.8 });
    }
    // Only fly when the selection changes, not when markers re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (!userPos || !mapRef.current) return;
    const el = document.createElement('div');
    el.innerHTML = '<div class="map-dot user"></div>';
    const marker = new maplibregl.Marker({ element: el }).setLngLat([userPos.lng, userPos.lat]).addTo(mapRef.current);
    return () => marker.remove();
  }, [userPos]);

  return <div ref={containerRef} className="campus-map" />;
}

export function MapLegend() {
  return (
    <div className="map-legend">
      <div><span className="map-dot live static" /> <span className="pill live">happening now</span></div>
      <div><span className="map-dot today static" /> <span className="pill today">today</span></div>
      <div><span className="map-dot upcoming static" /> <span className="pill upcoming">upcoming</span></div>
    </div>
  );
}
