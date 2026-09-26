// Wanderly – Singapore Trip Picks
// Friends suggest places in a shared chat, then vote yes or no on each one.
// Map: Leaflet + OpenStreetMap. Sign-in and shared data: Firebase (see SETUP.md).
(() => {
  'use strict';

  // ---------- helpers ----------
  const $ = s => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    for (const c of kids) if (c != null) e.append(c);
    return e;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const str = (v, n) => Array.from(String(v == null ? '' : v)).slice(0, n).join('');
  const narrow = () => matchMedia('(max-width: 860px)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollToEl = node => node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

  const SG_BOUNDS = [[1.205, 103.60], [1.475, 104.05]];
  const inSingapore = (lat, lng) => lat > 1.15 && lat < 1.49 && lng > 103.58 && lng < 104.10;
  const coordText = (lat, lng) => `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;

  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 4200);
  }

  // ---------- starter places (added with one tap when the map is empty) ----------
  const STARTERS = [
    { name: 'Marina Bay Sands', icon: '🏨', area: 'Marina Bay', mrt: 'Bayfront MRT (CE1 / DT16)', lat: 1.2834, lng: 103.8607,
      blurb: 'The three towers with the ship on top. Best skyline views in the city.',
      activities: ['SkyPark Observation Deck at sunset', 'Spectra light and water show on the bay (free, nightly from 8pm)', 'ArtScience Museum', 'Sampan boat ride along the canal inside the Shoppes'] },
    { name: 'Gardens by the Bay', icon: '🌳', area: 'Marina Bay', mrt: 'Gardens by the Bay MRT (TE22)', lat: 1.2816, lng: 103.8636,
      blurb: 'Giant Supertrees and two huge glass domes right next to Marina Bay Sands.',
      activities: ['Walk the OCBC Skyway between the Supertrees', 'Cloud Forest dome and its indoor waterfall', 'Flower Dome', 'Garden Rhapsody light show (free, 7:45pm and 8:45pm)'] },
    { name: 'Sentosa', icon: '🏖️', area: 'Sentosa Island', mrt: 'HarbourFront MRT, then Sentosa Express', lat: 1.2494, lng: 103.8303,
      blurb: 'The island resort: theme park, aquarium and beaches in one day.',
      activities: ['Universal Studios Singapore', 'S.E.A. Aquarium', 'Siloso Beach', 'Cable car from Mount Faber'] },
    { name: 'Chinatown', icon: '🏮', area: 'Outram', mrt: 'Chinatown MRT (NE4 / DT19)', lat: 1.2836, lng: 103.8443,
      blurb: 'Temples, shophouses and some of the best hawker food in Singapore.',
      activities: ['Chicken rice at Maxwell Food Centre', 'Buddha Tooth Relic Temple', 'Chinatown Street Market', 'Drinks on Ann Siang Hill'] },
    { name: 'Singapore Zoo & Night Safari', icon: '🦒', area: 'Mandai', mrt: 'Khatib MRT, then Mandai shuttle', lat: 1.4043, lng: 103.7930,
      blurb: 'Four wildlife parks side by side in the rainforest by Upper Seletar Reservoir.',
      activities: ['Singapore Zoo', 'Night Safari tram ride', 'Bird Paradise', 'River Wonders'] },
    { name: 'Jewel Changi Airport', icon: '💧', area: 'Changi', mrt: 'Changi Airport MRT (CG2)', lat: 1.3602, lng: 103.9894,
      blurb: "The world's tallest indoor waterfall. Easy to do on arrival or before the flight home.",
      activities: ['HSBC Rain Vortex waterfall', 'Canopy Park and the hedge maze', 'Shiseido Forest Valley walking trail', 'Food and shopping'] },
    { name: 'Kampong Glam', icon: '🕌', area: 'Bugis', mrt: 'Bugis MRT (EW12 / DT14)', lat: 1.3023, lng: 103.8589,
      blurb: 'Colourful lanes around Sultan Mosque, full of indie shops, murals and cafés.',
      activities: ['Haji Lane murals and boutiques', 'Sultan Mosque', 'Textile shops on Arab Street', 'Murtabak on North Bridge Road'] },
    { name: 'Pulau Ubin', icon: '🚲', area: 'Off Changi', mrt: 'Bumboat from Changi Point Ferry Terminal', lat: 1.4044, lng: 103.9625,
      blurb: 'A quiet island that feels like 1960s Singapore. Rent bikes and explore.',
      activities: ['Cycle around the island', 'Chek Jawa Wetlands boardwalk', 'Bumboat ride from Changi Point', 'Seafood lunch in the village'] },
    { name: 'East Coast Park', icon: '🦀', area: 'Marine Parade', mrt: 'Marine Parade MRT (TE26)', lat: 1.3008, lng: 103.9122,
      blurb: 'A long seaside park. Cycle by day and eat chilli crab at night.',
      activities: ['Rent bikes and ride along the coast', 'Chilli crab at East Coast Seafood Centre', 'Satay at Lagoon Food Village', 'Watch the sunset by the sea'] },
  ];

  // ---------- Firebase ----------
  const cfg = window.FIREBASE_CONFIG || {};
  const configured = !!cfg.apiKey && !/^PASTE/.test(cfg.apiKey);
  let auth = null, db = null;
  if (configured && window.firebase) {
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
  }
  const now = () => firebase.firestore.FieldValue.serverTimestamp();

  // ---------- map ----------
  // Two layers: a street map from OpenFreeMap (roads, rail lines), and underneath it a simple
  // hand-drawn Singapore that shows if the street map can't load. Neither needs an API key.
  const map = L.map('map', {
    zoomControl: false,
    minZoom: 11,
    maxZoom: 18,
    zoomSnap: 0.5,
    maxBounds: L.latLngBounds(SG_BOUNDS).pad(0.35),
    maxBoundsViscosity: 0.8,
  });
  L.control.zoom({ position: 'topright' }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  map.createPane('base').style.zIndex = 150;     // hand-drawn backup map
  map.createPane('streets').style.zIndex = 180;  // street map, covers the backup once loaded
  map.createPane('transit').style.zIndex = 590;  // MRT stations and bus stops, under the place pins
  const handDrawn = L.layerGroup().addTo(map);

  // Outlines as [lng, lat] points, smoothed into curves below.
  const MAINLAND = [[103.607,1.318],[103.618,1.338],[103.640,1.345],[103.662,1.352],[103.680,1.370],[103.690,1.395],[103.700,1.420],[103.715,1.440],[103.735,1.452],[103.757,1.447],[103.770,1.450],[103.790,1.455],[103.810,1.462],[103.827,1.468],[103.840,1.460],[103.855,1.445],[103.870,1.428],[103.885,1.418],[103.900,1.418],[103.915,1.410],[103.935,1.395],[103.955,1.390],[103.975,1.385],[103.995,1.388],[104.015,1.390],[104.032,1.378],[104.040,1.360],[104.030,1.335],[104.005,1.318],[103.975,1.310],[103.945,1.303],[103.915,1.298],[103.890,1.292],[103.872,1.280],[103.864,1.273],[103.850,1.270],[103.838,1.263],[103.822,1.266],[103.805,1.272],[103.790,1.278],[103.770,1.290],[103.745,1.300],[103.725,1.305],[103.705,1.300],[103.680,1.295],[103.655,1.293],[103.630,1.298],[103.612,1.305]];
  const ISLANDS = [
    [[103.805,1.255],[103.815,1.259],[103.830,1.257],[103.843,1.252],[103.848,1.246],[103.838,1.243],[103.822,1.245],[103.808,1.248]], // Sentosa
    [[103.665,1.285],[103.690,1.290],[103.715,1.288],[103.725,1.275],[103.712,1.255],[103.690,1.250],[103.672,1.262]],               // Jurong Island
    [[103.935,1.412],[103.955,1.420],[103.975,1.418],[103.990,1.412],[103.982,1.402],[103.960,1.401],[103.940,1.404]],               // Pulau Ubin
    [[104.020,1.410],[104.045,1.419],[104.066,1.411],[104.060,1.395],[104.035,1.392]],                                               // Pulau Tekong
  ];
  const JOHOR_COAST = [[103.50,1.335],[103.59,1.345],[103.61,1.35],[103.63,1.36],[103.65,1.375],[103.665,1.395],[103.68,1.42],[103.695,1.44],[103.71,1.452],[103.73,1.462],[103.75,1.465],[103.77,1.462],[103.79,1.468],[103.82,1.478],[103.84,1.478],[103.86,1.475],[103.89,1.46],[103.92,1.45],[103.95,1.44],[103.99,1.435],[104.03,1.44],[104.06,1.435],[104.10,1.43],[104.20,1.43]];
  const MARINA_BAY = [[103.852,1.289],[103.856,1.2915],[103.8595,1.288],[103.859,1.2848],[103.855,1.2838],[103.8515,1.2852]];
  const RESERVOIRS = [[103.822,1.343,.008,.0035],[103.806,1.373,.006,.004],[103.800,1.402,.012,.005],[103.735,1.428,.010,.005],[103.855,1.407,.006,.003],[103.925,1.340,.007,.0028]]; // lng, lat, x-radius, y-radius
  const PARKS = [[103.803,1.372,.032,.04]];
  const AREA_LABELS = [['WOODLANDS',103.786,1.438],['JURONG',103.720,1.340],['TAMPINES',103.945,1.357],['ANG MO KIO',103.848,1.372],['PUNGGOL',103.905,1.403],['TUAS',103.640,1.318],['BUKIT TIMAH',103.776,1.338],['CHANGI',104.012,1.338],['CITY',103.848,1.296]];
  const WATER_LABELS = [['Singapore Strait',103.94,1.262],['Johor, Malaysia',103.70,1.492],['Jurong Island',103.695,1.243],['Pulau Tekong',104.045,1.386]];

  // Catmull-Rom smoothing: turns a few points into a gentle curve. Returns [lat, lng] pairs.
  function smooth(pts, closed, steps = 8) {
    const n = pts.length, out = [];
    const at = i => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        const f = k => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3);
        out.push([f(1), f(0)]);
      }
    }
    if (!closed) out.push([pts[n - 1][1], pts[n - 1][0]]);
    return out;
  }
  const ellipse = (lng, lat, rx, ry) => Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return [lat + Math.sin(a) * ry, lng + Math.cos(a) * rx];
  });
  const shape = (latlngs, cls) => L.polygon(latlngs, { pane: 'base', className: cls, interactive: false, fillOpacity: 1, smoothFactor: 0.5 }).addTo(handDrawn);

  shape([...smooth(JOHOR_COAST, false), [1.9, 104.4], [1.9, 103.3]], 'foreign');
  shape(smooth(MAINLAND, true), 'land');
  for (const isle of ISLANDS) shape(smooth(isle, true), 'land');
  for (const [lng, lat, rx, ry] of PARKS) shape(ellipse(lng, lat, rx, ry), 'park');
  for (const [lng, lat, rx, ry] of RESERVOIRS) shape(ellipse(lng, lat, rx, ry), 'res');
  shape(smooth(MARINA_BAY, true), 'res');
  const mapLabel = (text, lng, lat, cls) => L.marker([lat, lng], {
    interactive: false, keyboard: false, zIndexOffset: -1000,
    icon: L.divIcon({ className: 'maplabel ' + cls, html: `<span>${esc(text)}</span>`, iconSize: null }),
  }).addTo(handDrawn);
  for (const [t, lng, lat] of AREA_LABELS) mapLabel(t, lng, lat, 'area');
  for (const [t, lng, lat] of WATER_LABELS) mapLabel(t, lng, lat, 'water');

  map.fitBounds(SG_BOUNDS);

  // Street map (OpenFreeMap vector tiles), recoloured to match the app and with shop/restaurant
  // icons hidden. If it hasn't loaded after 12 seconds, remove it and keep the hand-drawn map.
  const PALETTE = { land: '#FBF6E4', water: '#BFE3EC', park: '#D5EBC0' };
  function restyleStreets(gl) {
    for (const layer of gl.getStyle().layers) {
      const src = layer['source-layer'];
      try {
        if (['poi', 'housenumber', 'mountain_peak', 'aerodrome_label'].includes(src)) gl.setLayoutProperty(layer.id, 'visibility', 'none');
        else if (layer.type === 'background') gl.setPaintProperty(layer.id, 'background-color', PALETTE.land);
        else if (layer.type === 'fill' && src === 'water') gl.setPaintProperty(layer.id, 'fill-color', PALETTE.water);
        else if (layer.type === 'fill' && (src === 'park' || src === 'landcover')) gl.setPaintProperty(layer.id, 'fill-color', PALETTE.park);
        else if (layer.type === 'fill' && src === 'building') gl.setPaintProperty(layer.id, 'fill-opacity', 0.35);
      } catch { /* a layer this style doesn't have; skip it */ }
    }
  }
  let streetsState = 'none'; // none | loading | ready | failed
  function addStreetMap() {
    if (streetsState !== 'none') return;
    if (typeof L.maplibreGL !== 'function' || !window.maplibregl) { streetsState = 'failed'; return; } // library didn't load
    streetsState = 'loading';
    const streets = L.maplibreGL({
      style: 'https://tiles.openfreemap.org/styles/liberty',
      pane: 'streets',
      interactive: false,
      attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(map);
    const giveUp = setTimeout(() => {
      if (streetsState !== 'loading') return;
      streetsState = 'failed';
      map.removeLayer(streets);
      if (mapMode === 'detailed') toast("The detailed map couldn't load, so you're seeing the simple one.");
    }, 12000);
    const gl = streets.getMaplibreMap();
    gl.once('load', () => {
      if (streetsState !== 'loading') return;
      streetsState = 'ready'; clearTimeout(giveUp);
      restyleStreets(gl);
      applyMapMode();
    });
  }

  // Simple (hand-drawn) or Detailed (streets, stations, bus stops). Remembered on this device.
  let mapMode = 'simple';
  try { if (localStorage.getItem('wanderly-map-mode') === 'detailed') mapMode = 'detailed'; } catch { /* storage blocked */ }
  function applyMapMode() {
    const detailed = mapMode === 'detailed';
    if (detailed) { try { addStreetMap(); } catch { streetsState = 'failed'; } }
    const showStreets = detailed && streetsState === 'ready';
    map.getPane('streets').style.display = showStreets ? '' : 'none';
    map.getPane('transit').style.display = detailed ? '' : 'none';
    if (showStreets) map.removeLayer(handDrawn); else if (!map.hasLayer(handDrawn)) handDrawn.addTo(map);
    if (showStreets) map.removeLayer(mrtLines); else if (!map.hasLayer(mrtLines)) mrtLines.addTo(map);
    for (const b of document.querySelectorAll('#mapMode button')) b.setAttribute('aria-pressed', String(b.dataset.mode === mapMode));
  }
  function setMapMode(m) {
    mapMode = m;
    try { localStorage.setItem('wanderly-map-mode', m); } catch { /* storage blocked */ }
    applyMapMode();
    if (m === 'detailed') loadBusStops().catch(() => {});
  }
  for (const b of document.querySelectorAll('#mapMode button')) b.onclick = () => setMapMode(b.dataset.mode);

  // ---------- MRT stations and bus stops (OpenStreetMap data via Overpass, free, no key) ----------
  const OVERPASS = 'https://overpass-api.de/api/interpreter';
  async function overpass(query) {
    const r = await fetch(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: query }) });
    if (!r.ok) throw new Error('overpass ' + r.status);
    return (await r.json()).elements || [];
  }
  const cacheGet = (key, maxAgeMs) => {
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); return c && Date.now() - c.at < maxAgeMs ? c.data : null; } catch { return null; }
  };
  const cacheSet = (key, data) => { try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* storage full or blocked */ } };

  const mrtLayer = L.layerGroup().addTo(map);
  const busLayer = L.layerGroup().addTo(map);
  const transitIcon = (cls, symbol, label) => L.divIcon({
    className: 'transit ' + cls,
    html: `<span class="tsym">${symbol}</span>${label ? `<span class="tname">${esc(label)}</span>` : ''}`,
    iconSize: [18, 18], iconAnchor: [9, 9],
  });

  async function loadMrt() {
    let stations = cacheGet('wanderly-mrt-v1', 7 * 864e5);
    if (!stations) {
      const els = await overpass(`[out:json][timeout:25];
        (node["railway"="station"]["station"~"subway|light_rail"](1.15,103.6,1.48,104.1);
         node["public_transport"="station"]["subway"="yes"](1.15,103.6,1.48,104.1););
        out body;`);
      const seen = new Set();
      stations = [];
      for (const e of els) {
        const t = e.tags || {};
        const name = str(t['name:en'] || t.name || '', 60).replace(/ (MRT|LRT) Station$/i, '');
        if (!name || seen.has(name) || !isFinite(e.lat)) continue;
        seen.add(name);
        stations.push({ name, lat: e.lat, lng: e.lon, lrt: t.station === 'light_rail', code: str(t.ref || '', 30).replace(/;/g, ' / ') });
      }
      if (stations.length) cacheSet('wanderly-mrt-v1', stations);
    }
    for (const s of stations) {
      L.marker([s.lat, s.lng], {
        pane: 'transit', keyboard: false,
        title: `${s.name} ${s.lrt ? 'LRT' : 'MRT'}${s.code ? ' (' + s.code + ')' : ''}`,
        icon: transitIcon(s.lrt ? 'lrt' : 'mrt', 'M', s.name),
      }).bindTooltip(`${esc(s.name)} ${s.lrt ? 'LRT' : 'MRT'}${s.code ? '<br><small>' + esc(s.code) + '</small>' : ''}`, { direction: 'top', offset: [0, -8] })
        .addTo(mrtLayer);
    }
  }
  loadMrt().catch(() => { /* stations are a nice-to-have */ });

  // MRT/LRT lines for the simple map: stations joined in order, in each line's official colour.
  map.createPane('mrtlines').style.zIndex = 160; // above the hand-drawn land, below the street map
  const mrtLines = L.layerGroup();
  const LINE_COLOURS = { NS: '#D42E12', EW: '#009645', CG: '#009645', NE: '#9900AA', CC: '#FA9E0D', CE: '#FA9E0D', DT: '#005EC4', TE: '#9D5B25' };
  const hexColour = c => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');
  async function loadMrtLines() {
    let lines = cacheGet('wanderly-mrt-lines-v1', 30 * 864e5);
    if (!lines) {
      const els = await overpass(`[out:json][timeout:30];
        relation["route"~"^(subway|light_rail)$"](1.15,103.6,1.48,104.1);
        out body;
        node(r);
        out body;`);
      const nodes = new Map();
      for (const e of els) if (e.type === 'node') nodes.set(e.id, e);
      lines = [];
      for (const r of els) {
        if (r.type !== 'relation') continue;
        const t = r.tags || {};
        const stops = [];
        for (const m of r.members || []) {
          if (m.type !== 'node' || !/^stop/.test(m.role || '')) continue;
          const n = nodes.get(m.ref);
          if (!n) continue;
          const nt = n.tags || {};
          stops.push([+n.lat.toFixed(5), +n.lon.toFixed(5), str(nt['name:en'] || nt.name || '', 60).replace(/ (MRT|LRT) Station$/i, '')]);
        }
        if (stops.length < 2) continue;
        const prefix = String(t.ref || '').slice(0, 2).toUpperCase();
        const lrt = t.route === 'light_rail';
        lines.push({ colour: hexColour(t.colour) || LINE_COLOURS[prefix] || '#748477', lrt, stops });
      }
      if (lines.length) cacheSet('wanderly-mrt-lines-v1', lines);
    }
    // Draw LRT first so the MRT lines sit on top.
    lines.sort((a, b) => Number(b.lrt) - Number(a.lrt));
    for (const line of lines) {
      const pts = line.stops.map(s => [s[0], s[1]]);
      const w = line.lrt ? 2 : 3.5;
      L.polyline(pts, { pane: 'mrtlines', color: '#FFFFFF', weight: w + 3, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(mrtLines);
      L.polyline(pts, { pane: 'mrtlines', color: line.colour, weight: w, opacity: 0.95, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(mrtLines);
    }
    const seen = new Set();
    for (const line of lines) {
      for (const [lat, lng, name] of line.stops) {
        const key = name || `${lat.toFixed(3)},${lng.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const dot = L.circleMarker([lat, lng], {
          pane: 'mrtlines', radius: line.lrt ? 2.5 : 3.5, color: '#2A3431', weight: 1.2,
          fillColor: '#FFFFFF', fillOpacity: 1, bubblingMouseEvents: false,
        });
        if (name) dot.bindTooltip(`${esc(name)} ${line.lrt ? 'LRT' : 'MRT'}`, { direction: 'top', offset: [0, -4] });
        dot.addTo(mrtLines);
      }
    }
  }
  loadMrtLines().catch(() => { /* the simple map works without the lines */ });

  // Bus stops only show when zoomed in close, and load for the area on screen.
  const BUS_ZOOM = 16;
  let busBounds = null, busTimer = 0, busSeq = 0;
  async function loadBusStops() {
    if (mapMode !== 'detailed') return;
    if (map.getZoom() < BUS_ZOOM) { busLayer.clearLayers(); busBounds = null; return; }
    const view = map.getBounds();
    if (busBounds && busBounds.contains(view)) return;
    const b = view.pad(0.5), seq = ++busSeq;
    const els = await overpass(`[out:json][timeout:20];node["highway"="bus_stop"](${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()});out body;`);
    if (seq !== busSeq) return;
    busLayer.clearLayers();
    busBounds = b;
    for (const e of els.slice(0, 400)) {
      const t = e.tags || {};
      const name = str(t.name || 'Bus stop', 60), code = str(t.asset_ref || t.ref || '', 10);
      L.marker([e.lat, e.lon], { pane: 'transit', keyboard: false, title: name, icon: transitIcon('bus', '🚌', '') })
        .bindTooltip(`${esc(name)}${code ? '<br><small>Stop ' + esc(code) + '</small>' : ''}`, { direction: 'top', offset: [0, -8] })
        .addTo(busLayer);
    }
  }
  map.on('moveend', () => { clearTimeout(busTimer); busTimer = setTimeout(() => loadBusStops().catch(() => {}), 500); });
  applyMapMode();

  const updateLabels = () => {
    const z = map.getZoom();
    $('#map').classList.toggle('show-labels', z >= 14);
    $('#map').classList.toggle('show-stations', z >= 13);
    $('#map').classList.toggle('show-mrt', z >= 12);
  };
  map.on('zoomend', updateLabels);
  updateLabels();
  map.on('click', e => handleMapClick(e.latlng));
  new ResizeObserver(() => map.invalidateSize()).observe($('#mapwrap'));

  // ---------- state ----------
  let me = null;              // signed-in Firebase user
  let places = [];
  let ballots = {};           // uid -> { votes: {placeId: 'yes'|'no'}, name, photo }
  let messages = [];          // oldest first
  let loaded = false;
  let selectedId = null;
  let adding = false, draft = null, draftMarker = null, prefill = null;
  let voteBlocked = false;
  let activeTab = 'vote', seenAt = Date.now();
  let unsubscribers = [];
  const markers = new Map();  // placeId -> { marker, key }

  function cleanPlace(doc) {
    const x = doc.data() || {};
    const lat = Number(x.lat), lng = Number(x.lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return {
      id: doc.id, name: str(x.name, 80) || 'Untitled place', icon: str(x.icon, 2) || '📍',
      area: str(x.area, 60), mrt: str(x.mrt, 60), blurb: str(x.blurb, 300),
      activities: Array.isArray(x.activities) ? x.activities.slice(0, 12).map(a => str(a, 160)).filter(Boolean) : [],
      lat, lng, addedBy: typeof x.addedBy === 'string' ? x.addedBy : null, addedByName: str(x.addedByName, 60),
      source: str(x.source, 12),
    };
  }
  function tally(pid) {
    const yes = [], no = [];
    for (const [uid, b] of Object.entries(ballots)) {
      if (b.votes[pid] === 'yes') yes.push(uid);
      else if (b.votes[pid] === 'no') no.push(uid);
    }
    return { yes, no };
  }
  // A place is "voted out" when more people said No than Yes. It stays until someone deletes it.
  const isVotedOut = t => t.no.length > t.yes.length;
  const ranked = () => places.map(p => ({ p, t: tally(p.id) }))
    .sort((a, b) => (b.t.yes.length - b.t.no.length) - (a.t.yes.length - a.t.no.length)
      || b.t.yes.length - a.t.yes.length || a.p.name.localeCompare(b.p.name));

  // ---------- pins ----------
  function pinIcon(icon, name, yes, selected, isDraft, out) {
    return L.divIcon({
      className: 'pin-wrap' + (selected ? ' selected' : '') + (out ? ' out' : ''),
      html: `<div class="pin${selected ? ' sel' : ''}${isDraft ? ' draft' : ''}${out ? ' out' : ''}"><span class="emoji">${esc(icon)}</span>${yes ? `<span class="badge">${yes}</span>` : ''}</div>`
        + (name ? `<div class="plabel">${esc(name)}</div>` : ''),
      iconSize: [36, 36],
      iconAnchor: [18, 44],
    });
  }
  function renderPins() {
    const seen = new Set();
    for (const p of places) {
      seen.add(p.id);
      const t = tally(p.id), yes = t.yes.length, sel = p.id === selectedId, out = isVotedOut(t);
      const key = [p.icon, p.name, yes, sel, out, p.lat, p.lng].join('|');
      let it = markers.get(p.id);
      if (!it) {
        const marker = L.marker([p.lat, p.lng], { title: p.name, alt: p.name, riseOnHover: true })
          .on('click', () => { if (!adding) select(p.id, true); })
          .addTo(map);
        it = { marker, key: '' };
        markers.set(p.id, it);
      }
      if (it.key !== key) {
        it.marker.setIcon(pinIcon(p.icon, p.name, yes, sel, false, out));
        it.marker.setLatLng([p.lat, p.lng]);
        it.marker.setZIndexOffset(sel ? 1000 : out ? -500 : 0);
        it.key = key;
      }
    }
    for (const [id, it] of markers) if (!seen.has(id)) { it.marker.remove(); markers.delete(id); }
  }

  // ---------- selecting and voting ----------
  function handleMapClick(latlng) {
    if (adding) {
      if (!draft) {
        draft = { lat: latlng.lat, lng: latlng.lng };
        placeDraftMarker();
        renderForm();
        if (narrow()) scrollToEl($('#detail'));
      } else {
        draft.lat = latlng.lat; draft.lng = latlng.lng; draft.moved = true;
        draftMarker.setLatLng(latlng);
        updateFormCoords();
      }
      return;
    }
    if (selectedId) { selectedId = null; renderAll(); }
  }
  function select(id, fly) {
    selectedId = id;
    showTab('vote');
    const p = places.find(q => q.id === id);
    if (p && fly) map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 15), { duration: reduceMotion ? 0 : 0.6 });
    renderAll();
    if (narrow() && fly) scrollToEl($('#detail'));
  }

  let voteChain = Promise.resolve();
  function vote(pid, v) {
    if (!db || !me || voteBlocked) return;
    const mine = { ...((ballots[me.uid] || {}).votes || {}) };
    if (mine[pid] === v) delete mine[pid]; else mine[pid] = v;
    ballots = { ...ballots, [me.uid]: { votes: mine, name: me.displayName || '', photo: me.photoURL || '' } };
    renderAll();
    voteChain = voteChain
      .then(() => db.collection('votes').doc(me.uid).set({
        votes: mine, name: me.displayName || null, photo: me.photoURL || '', updatedAt: now(),
      }))
      .catch(e => {
        if (e && e.code === 'permission-denied') { voteBlocked = true; toast("You can't vote on this trip. Ask the organiser to add your Google account."); }
        else toast("Your vote didn't save. Check your connection and try again.");
        renderAll();
      });
  }

  // ---------- adding a place ----------
  const ICONS = ['📍', '🏨', '🌳', '🏖️', '🍜', '🦀', '🏮', '🕌', '🛕', '🎡', '🎢', '🦒', '🛍️', '🍸', '☕', '🚲', '🏛️', '🌅'];
  let formIcon = '📍';
  function placeDraftMarker() {
    if (draftMarker) draftMarker.remove();
    draftMarker = L.marker([draft.lat, draft.lng], {
      icon: pinIcon(formIcon, '', 0, false, true), draggable: true, zIndexOffset: 2000,
      title: 'New place. Drag to move it.', alt: 'New place pin',
    }).addTo(map);
    draftMarker.on('dragend', () => {
      const ll = draftMarker.getLatLng();
      draft.lat = ll.lat; draft.lng = ll.lng; draft.moved = true;
      updateFormCoords();
    });
  }
  function clearDraft() {
    if (draftMarker) { draftMarker.remove(); draftMarker = null; }
    draft = null;
  }
  function startAdd(pre) {
    adding = true; selectedId = null; prefill = pre || null;
    formIcon = (pre && pre.icon) || '📍';
    clearDraft();
    $('#mapwrap').classList.add('adding');
    $('#addBtn').textContent = 'Cancel';
    $('#hint').hidden = !!pre;
    showTab('vote');
    renderAll();
    if (pre) {
      draft = { lat: pre.lat, lng: pre.lng };
      placeDraftMarker();
      map.flyTo([pre.lat, pre.lng], Math.max(map.getZoom(), 16), { duration: reduceMotion ? 0 : 0.6 });
      renderForm();
      if (narrow()) scrollToEl($('#mapwrap'));
    }
  }
  function stopAdd() {
    adding = false; prefill = null; clearDraft();
    $('#mapwrap').classList.remove('adding');
    $('#addBtn').textContent = '+ Add a place';
    $('#hint').hidden = true;
    renderAll();
  }
  $('#addBtn').onclick = () => (adding ? stopAdd() : startAdd());

  function updateFormCoords() {
    const c = $('#fCoords');
    if (c && draft) c.textContent = coordText(draft.lat, draft.lng) + ' · drag the pin or tap the map to move it';
  }
  function setIcon(ic) {
    formIcon = ic;
    const icons = $('#fIcons');
    if (icons) {
      if (![...icons.children].some(b => b.textContent === ic)) icons.prepend(iconButton(ic));
      for (const b of icons.children) b.setAttribute('aria-pressed', String(b.textContent === ic));
    }
    if (draftMarker) draftMarker.setIcon(pinIcon(ic, '', 0, false, true));
  }
  function iconButton(ic) {
    const b = el('button', { type: 'button', 'aria-pressed': String(ic === formIcon), 'aria-label': 'Icon ' + ic, text: ic });
    b.onclick = () => setIcon(ic);
    return b;
  }
  const SOURCE_NOTES = {
    link: 'This pin uses the exact location from the Google Maps link.',
    coords: 'This pin uses the exact coordinates you pasted.',
    search: "This pin comes from an OpenStreetMap search. Check it's the right place and drag the pin if needed.",
  };
  function renderForm() {
    const pre = prefill || {};
    const box = $('#detail');
    box.replaceChildren(); box.className = 'card form';
    const icons = el('div', { class: 'icons', id: 'fIcons', role: 'group', 'aria-label': 'Icon' });
    for (const ic of (ICONS.includes(formIcon) ? ICONS : [formIcon, ...ICONS])) icons.append(iconButton(ic));
    const err = el('p', { class: 'err', hidden: '' });
    const saveLabel = pre.source ? 'Put it to a vote' : 'Save place';
    const save = el('button', { class: 'primary', type: 'submit', text: saveLabel });
    const form = el('form', {},
      el('h2', { text: pre.source ? 'Check the pin' : 'New place' }),
      el('p', { class: 'coords', id: 'fCoords' }),
      SOURCE_NOTES[pre.source] ? el('p', { class: 'note', text: SOURCE_NOTES[pre.source] }) : null,
      el('label', { for: 'fName', text: 'Name' }), el('input', { id: 'fName', maxlength: '80', placeholder: 'e.g. Clarke Quay', required: '' }),
      el('label', { text: 'Icon' }), icons,
      el('label', { for: 'fArea', text: 'Area or nearest MRT (optional)' }), el('input', { id: 'fArea', maxlength: '60', placeholder: 'e.g. Clarke Quay MRT' }),
      el('label', { for: 'fBlurb', text: 'Why go? (optional)' }), el('input', { id: 'fBlurb', maxlength: '300', placeholder: 'One line to sell it to the group' }),
      el('label', { for: 'fActs', text: 'Things to do, one per line' }), el('textarea', { id: 'fActs', placeholder: 'River cruise\nDinner by the water\nBar hopping' }),
      err,
      el('div', { class: 'factions' }, save, el('button', { class: 'ghost', type: 'button', id: 'fCancel', text: 'Cancel' })));
    box.append(form);
    $('#fName').value = pre.name || '';
    $('#fArea').value = pre.area || '';
    $('#fBlurb').value = pre.blurb || '';
    $('#fActs').value = (pre.activities || []).join('\n');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('#fName').value.trim();
      if (!name) { err.textContent = 'Give the place a name.'; err.hidden = false; $('#fName').focus(); return; }
      const doc = {
        name: str(name, 80), icon: formIcon,
        area: str($('#fArea').value.trim(), 60), mrt: '',
        blurb: str($('#fBlurb').value.trim(), 300),
        activities: $('#fActs').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12).map(s => str(s, 160)),
        lat: +draft.lat.toFixed(6), lng: +draft.lng.toFixed(6),
        addedBy: me.uid, addedByName: me.displayName || null, createdAt: now(),
        source: pre.source || 'map',
      };
      save.disabled = true; save.textContent = 'Saving…'; err.hidden = true;
      try {
        const ref = await db.collection('places').add(doc);
        postMessage({ kind: 'added', placeId: ref.id, placeName: doc.name, placeIcon: doc.icon }).catch(() => {});
        stopAdd();
        select(ref.id, false);
        toast(`${doc.name} is up for a vote`);
      } catch (x) {
        save.disabled = false; save.textContent = saveLabel;
        err.textContent = x && x.code === 'permission-denied'
          ? "This place couldn't be saved. Check that it's in Singapore and the name isn't too long."
          : "The place didn't save. Check your connection and try again.";
        err.hidden = false;
      }
    });
    $('#fCancel').onclick = stopAdd;
    updateFormCoords();
    if (!pre.name) $('#fName').focus({ preventScroll: true });
  }

  async function addStarters(btn) {
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      const batch = db.batch();
      for (const s of STARTERS) {
        batch.set(db.collection('places').doc(), {
          ...s, addedBy: me.uid, addedByName: me.displayName || null, createdAt: now(), source: 'starter',
        });
      }
      await batch.commit();
      toast('Added 9 places. Tap a pin to vote.');
    } catch {
      btn.disabled = false; btn.textContent = 'Add 9 popular places';
      toast("The places didn't save. Try again.");
    }
  }

  // ---------- panel ----------
  function renderDetail() {
    if (adding && draft) return; // keep the form while it's being filled in
    const box = $('#detail');
    box.className = 'card'; box.replaceChildren();

    if (adding) {
      box.append(el('div', { class: 'intro' }, el('h2', { text: 'Tap the map' }),
        el('p', { text: 'Tap the spot where the place is. You can drag the pin before saving.' })));
      return;
    }
    const p = places.find(q => q.id === selectedId);
    if (!p) {
      const intro = el('div', { class: 'intro' });
      if (!loaded) intro.append(el('h2', { text: 'Loading places…' }));
      else if (!places.length) {
        const seed = el('button', { class: 'primary', type: 'button', text: 'Add 9 popular places' });
        seed.onclick = () => addStarters(seed);
        intro.append(el('h2', { text: 'No places yet' }),
          el('p', { text: 'Suggest places in the Chat tab, tap "+ Add a place", or start with a list of popular Singapore spots.' }), seed);
      } else intro.append(el('h2', { text: 'Where should we go?' }),
        el('p', { text: 'Tap a pin to see what you can do there, then vote Yes or No. Places with the most Yes votes rise to the top of the list.' }));
      box.append(intro);
      return;
    }

    const t = tally(p.id);
    const mine = me ? ((ballots[me.uid] || {}).votes || {})[p.id] : undefined;
    const meta = [p.area, p.mrt].filter(Boolean).join(' · ');
    const gmaps = el('a', { href: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`, target: '_blank', rel: 'noopener', text: 'Open in Google Maps' });
    const byline = p.addedByName ? `Suggested by ${p.addedBy === (me && me.uid) ? 'you' : p.addedByName}` : '';
    const out = isVotedOut(t);
    box.append(el('div', { class: 'place' + (out ? ' out' : '') },
      out ? el('p', { class: 'outnote', text: `Voted out: ${t.no.length} No vs ${t.yes.length} Yes. It's greyed out on the map. Anyone can delete it below, or votes can still change.` }) : null,
      el('div', { class: 'phead' },
        el('div', { class: 'bigicon', 'aria-hidden': 'true', text: p.icon }),
        el('div', {}, el('h2', { text: p.name }), meta ? el('p', { class: 'meta', text: meta }) : null,
          el('div', { class: 'coords' }, coordText(p.lat, p.lng), gmaps))),
      p.blurb ? el('p', { class: 'blurb', text: p.blurb }) : null,
      p.activities.length ? el('p', { class: 'eyebrow', text: 'Things to do' }) : null,
      p.activities.length ? el('ul', { class: 'acts' }, ...p.activities.map(a => el('li', { text: a }))) : null,
      byline ? el('p', { class: 'srcnote', text: byline }) : null));

    const yesB = el('button', { class: 'vbtn yes', type: 'button', 'aria-pressed': String(mine === 'yes'), text: "Yes, I'm in" });
    const noB = el('button', { class: 'vbtn no', type: 'button', 'aria-pressed': String(mine === 'no'), text: 'No, skip it' });
    yesB.disabled = noB.disabled = !me || voteBlocked;
    yesB.onclick = () => vote(p.id, 'yes');
    noB.onclick = () => vote(p.id, 'no');
    const total = t.yes.length + t.no.length;
    const pct = n => `width:${total ? (n / total) * 100 : 0}%`;
    const voterList = ids => {
      const ul = el('ul', { class: 'chips' });
      if (!ids.length) ul.append(el('li', { class: 'none', text: 'Nobody yet' }));
      for (const uid of ids) {
        const b = ballots[uid] || {};
        ul.append(el('li', {},
          b.photo ? el('img', { src: b.photo, alt: '', referrerpolicy: 'no-referrer' }) : null,
          el('span', { text: uid === (me && me.uid) ? 'You' : (b.name || 'Someone') })));
      }
      return ul;
    };
    box.append(
      el('p', { class: 'eyebrow', text: 'Do you want to go?' }),
      el('div', { class: 'votebtns' }, yesB, noB),
      el('p', { class: 'vnote', text: voteBlocked ? "You can't vote on this trip. Ask the organiser to add your Google account." : mine ? 'Tap your vote again to take it back.' : 'Everyone on the trip can see your vote.' }),
      el('div', { class: 'tbar', 'aria-hidden': 'true' }, el('span', { class: 'y', style: pct(t.yes.length) }), el('span', { class: 'n', style: pct(t.no.length) })),
      el('div', { class: 'voters' },
        el('div', {}, el('h4', { class: 'yh', text: `Yes · ${t.yes.length}` }), voterList(t.yes)),
        el('div', {}, el('h4', { class: 'nh', text: `No · ${t.no.length}` }), voterList(t.no))));

    if (me) {
      const del = el('button', { class: 'danger', type: 'button', text: 'Delete place' });
      const cancel = el('button', { class: 'ghost', type: 'button', text: 'Cancel', hidden: '' });
      const ask = el('span', { class: 'small', text: '' });
      let armed = false;
      const disarm = () => { armed = false; del.textContent = 'Delete place'; del.classList.remove('armed'); cancel.hidden = true; ask.textContent = ''; };
      cancel.onclick = disarm;
      del.onclick = async () => {
        if (!armed) {
          armed = true; del.classList.add('armed'); del.textContent = 'Yes, delete it'; cancel.hidden = false;
          ask.textContent = `This removes ${p.name} and its votes for everyone.`;
          return;
        }
        del.disabled = true; cancel.hidden = true;
        try {
          await db.collection('places').doc(p.id).delete();
          selectedId = null; renderAll(); toast(`Deleted ${p.name}`);
        } catch (x) {
          del.disabled = false; disarm();
          toast(x && x.code === 'permission-denied' ? "You don't have permission to delete places on this trip." : "Couldn't delete the place. Try again.");
        }
      };
      box.append(el('div', { class: 'delrow' }, ask, el('div', { class: 'row2' }, del, cancel)));
    }
  }

  // Delete every place with more No votes than Yes.
  let bulkArmed = false;
  function renderBulk() {
    const box = $('#bulk');
    box.replaceChildren();
    if (!me) return;
    const rejected = places.filter(p => isVotedOut(tally(p.id)));
    if (!rejected.length) { bulkArmed = false; return; }
    const names = rejected.map(p => p.name).join(', ');
    if (!bulkArmed) {
      const b = el('button', { class: 'danger', type: 'button', text: `Delete voted-out places (${rejected.length})` });
      b.onclick = () => { bulkArmed = true; renderBulk(); };
      box.append(b, el('p', { class: 'small', text: 'The greyed-out places, where more people voted No than Yes.' }));
      return;
    }
    const yes = el('button', { class: 'danger armed', type: 'button', text: `Yes, delete ${rejected.length}` });
    const no = el('button', { class: 'ghost', type: 'button', text: 'Cancel' });
    no.onclick = () => { bulkArmed = false; renderBulk(); };
    yes.onclick = async () => {
      yes.disabled = no.disabled = true; yes.textContent = 'Deleting…';
      try {
        const batch = db.batch();
        for (const p of rejected) batch.delete(db.collection('places').doc(p.id));
        await batch.commit();
        bulkArmed = false;
        toast(`Deleted ${rejected.length} place${rejected.length === 1 ? '' : 's'}`);
      } catch (x) {
        bulkArmed = false; renderBulk();
        toast(x && x.code === 'permission-denied' ? "You don't have permission to delete places on this trip." : "Couldn't delete the places. Try again.");
      }
    };
    box.append(el('p', { class: 'small', text: `Delete ${names} for everyone?` }), el('div', { class: 'row2' }, yes, no));
  }

  function renderRows() {
    const ul = $('#rows');
    ul.replaceChildren();
    if (!places.length) {
      ul.append(el('li', {}, el('p', { class: 'empty', text: loaded ? 'Nothing to rank yet.' : 'Loading…' })));
      return;
    }
    ranked().forEach(({ p, t }, i) => {
      const total = t.yes.length + t.no.length;
      const pct = n => `width:${total ? (n / total) * 100 : 0}%`;
      const out = isVotedOut(t);
      const b = el('button', { class: 'row' + (out ? ' out' : ''), type: 'button', 'aria-current': String(p.id === selectedId) },
        el('span', { class: 'pos', text: String(i + 1) }),
        el('span', { class: 'ic', 'aria-hidden': 'true', text: p.icon }),
        el('span', { class: 'nm' }, p.name, el('span', { class: 'ar', text: out ? 'Voted out' : (p.area || coordText(p.lat, p.lng)) })),
        el('span', { class: 'ct' }, el('span', { class: 'y', text: `${t.yes.length} yes` }), el('span', { class: 'n', text: `${t.no.length} no` })),
        el('span', { class: 'mini', 'aria-hidden': 'true' }, el('span', { class: 'y', style: pct(t.yes.length) }), el('span', { class: 'n', style: pct(t.no.length) })));
      b.onclick = () => { if (adding) stopAdd(); select(p.id, true); };
      ul.append(el('li', {}, b));
    });
  }

  function renderStats() {
    $('#nPlaces').textContent = places.length;
    const ids = new Set(places.map(p => p.id));
    $('#nVoters').textContent = Object.values(ballots).filter(b => Object.keys(b.votes).some(k => ids.has(k))).length;
  }

  function renderAll() {
    if (selectedId && !places.some(p => p.id === selectedId)) selectedId = null;
    renderPins(); renderRows(); renderStats(); renderDetail(); renderBulk();
  }

  // ---------- tabs ----------
  function showTab(t) {
    activeTab = t;
    $('#tabVote').setAttribute('aria-selected', String(t === 'vote'));
    $('#tabChat').setAttribute('aria-selected', String(t === 'chat'));
    $('#paneVote').hidden = t !== 'vote';
    $('#paneChat').hidden = t !== 'chat';
    if (t === 'chat') { const m = $('#msgs'); m.scrollTop = m.scrollHeight; }
    renderUnread();
  }
  $('#tabVote').onclick = () => showTab('vote');
  $('#tabChat').onclick = () => showTab('chat');
  function renderUnread() {
    if (activeTab === 'chat') seenAt = Date.now();
    const n = messages.filter(m => m.createdAt > seenAt && m.uid !== (me && me.uid)).length;
    const u = $('#unread');
    u.hidden = !n || activeTab === 'chat';
    u.textContent = n > 9 ? '9+' : String(n);
  }

  // ---------- chat ----------
  function linkify(text) {
    const frag = document.createDocumentFragment();
    const re = /https?:\/\/[^\s<>"]+/gi;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      const url = m[0];
      frag.append(el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: url.length > 48 ? url.slice(0, 45) + '…' : url }));
      last = m.index + url.length;
    }
    if (last < text.length) frag.append(text.slice(last));
    return frag;
  }
  function whenText(ms) {
    const d = new Date(ms), today = new Date();
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return d.toDateString() === today.toDateString() ? t : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ', ' + t;
  }
  function renderChat() {
    const box = $('#msgs');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.replaceChildren();
    if (!messages.length) {
      box.append(el('li', { class: 'empty', text: 'No messages yet. Paste a Google Maps link, coordinates or a place name to suggest somewhere.' }));
    }
    for (const m of messages) {
      const who = m.uid === (me && me.uid) ? 'You' : (m.name || 'Someone');
      const body = el('p', { class: 'body' });
      if (m.kind === 'added') {
        const see = el('button', { class: 'linkbtn', type: 'button', text: 'See it and vote' });
        see.onclick = () => (places.some(p => p.id === m.placeId) ? select(m.placeId, true) : toast('That place has been removed.'));
        body.append('added ', el('b', { text: `${m.placeIcon || '📍'} ${m.placeName || 'a place'}` }), ' to the vote. ', see);
      } else body.append(linkify(m.text));
      box.append(el('li', { class: 'msg' + (m.kind === 'added' ? ' added' : '') },
        m.photo ? el('img', { class: 'av', src: m.photo, alt: '', referrerpolicy: 'no-referrer' }) : el('span'),
        el('div', {}, el('span', { class: 'who', text: who }), el('span', { class: 'when', text: whenText(m.createdAt) }), body)));
    }
    if (atBottom || activeTab !== 'chat') box.scrollTop = box.scrollHeight;
  }

  function postMessage(extra) {
    return db.collection('messages').add({
      uid: me.uid, name: me.displayName || null, photo: me.photoURL || '', createdAt: now(), ...extra,
    });
  }

  // Reading what people paste.
  function parseInput(text) {
    const s = text.trim();
    const hasUrl = /https?:\/\/\S+/i.test(s);
    const coordRe = /(-?\d{1,2}\.\d{3,})\s*[,\s]\s*(-?\d{2,3}\.\d{3,})/;
    let lat = null, lng = null, source = 'coords', m;
    if ((m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/))) { lat = +m[1]; lng = +m[2]; source = 'link'; }            // the place itself
    else if ((m = s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i))) { lat = +m[1]; lng = +m[2]; source = 'link'; }
    else if ((m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/))) { lat = +m[1]; lng = +m[2]; source = 'link'; }            // map centre
    else if ((m = s.match(coordRe))) { lat = +m[1]; lng = +m[2]; }
    let name = '';
    const pm = s.match(/\/maps\/place\/([^/@?]+)/);
    if (pm) { try { name = decodeURIComponent(pm[1].replace(/\+/g, ' ')); } catch { name = pm[1].replace(/\+/g, ' '); } }
    const rest = s.replace(/https?:\/\/\S+/g, ' ').replace(coordRe, ' ').replace(/\s+/g, ' ').trim();
    if (lat != null && isFinite(lat) && isFinite(lng)) {
      if (!name && rest && rest.length <= 80) name = rest.split(',')[0].trim();
      return { kind: inSingapore(lat, lng) ? 'exact' : 'outside', lat, lng, name: str(name, 80), source };
    }
    if (/(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|share\.google)/i.test(s)) return { kind: 'short', rest };
    if (hasUrl) return { kind: 'link', rest };
    return { kind: 'text', rest: s };
  }

  // OpenStreetMap place search (free, no key). Only called when someone taps a button or pastes coordinates.
  const ICON_BY_TYPE = {
    cafe: '☕', restaurant: '🍜', fast_food: '🍜', food_court: '🍜', bar: '🍸', pub: '🍸', nightclub: '🍸',
    museum: '🏛️', gallery: '🏛️', attraction: '🎡', theme_park: '🎢', zoo: '🦒', aquarium: '🦒',
    park: '🌳', garden: '🌳', nature_reserve: '🌳', beach: '🏖️', hotel: '🏨', place_of_worship: '🛕',
    mall: '🛍️', marketplace: '🛍️', department_store: '🛍️', viewpoint: '🌅',
  };
  function fromOsm(x) {
    const lat = Number(x.lat), lng = Number(x.lon);
    if (!isFinite(lat) || !isFinite(lng) || !inSingapore(lat, lng)) return null;
    const a = x.address || {};
    return {
      name: str(x.name || String(x.display_name || '').split(',')[0], 80),
      lat, lng,
      area: str(a.suburb || a.neighbourhood || a.quarter || a.city_district || a.road || '', 60),
      icon: ICON_BY_TYPE[x.type] || '📍',
      address: str(x.display_name, 160),
    };
  }
  async function osm(path, params) {
    const url = `https://nominatim.openstreetmap.org/${path}?` + new URLSearchParams({ format: 'jsonv2', addressdetails: '1', 'accept-language': 'en', ...params });
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('search failed');
    return r.json();
  }
  const osmSearch = async q => (await osm('search', { q, countrycodes: 'sg', limit: '5' })).map(fromOsm).filter(Boolean);
  const osmReverse = async (lat, lng) => { const x = await osm('reverse', { lat: String(lat), lon: String(lng), zoom: '18' }); return x && !x.error ? fromOsm(x) : null; };

  // The helper box above the message box. Only the person who sent the message sees it.
  const TIP = 'For an exact pin: in the Google Maps app, press and hold on the place, copy the numbers at the top (like 1.28473, 103.83251) and paste them here.';
  function assist(...kids) { const a = $('#assist'); a.replaceChildren(...kids); a.hidden = !kids.length; }
  function closeBtn(label) { const b = el('button', { class: 'ghost', type: 'button', text: label || 'OK' }); b.onclick = () => assist(); return b; }

  function offerSearch(q, intro) {
    const go = el('button', { class: 'primary', type: 'button', text: 'Search the map' });
    go.onclick = () => runSearch(q);
    assist(el('p', { text: intro }), el('div', { class: 'row2' }, go, closeBtn('No thanks')));
  }
  async function runSearch(q) {
    assist(el('p', {}, el('span', { class: 'spin', 'aria-hidden': 'true' }), ` Searching for "${str(q, 60)}"…`));
    try {
      const results = await osmSearch(q);
      if (!results.length) {
        assist(el('p', { text: 'No matches in Singapore. Try the full name, or add the street or area.' }), el('p', { class: 'small', text: TIP }), el('div', { class: 'row2' }, closeBtn()));
        return;
      }
      const list = el('ul', { class: 'results' });
      for (const r of results) {
        const b = el('button', { type: 'button' }, el('span', { 'aria-hidden': 'true', text: r.icon }),
          el('span', {}, el('b', { text: r.name }), el('small', { text: r.address })));
        b.onclick = () => { assist(); startAdd({ ...r, source: 'search' }); };
        list.append(el('li', {}, b));
      }
      assist(el('p', { text: 'Which one is it?' }), list, el('div', { class: 'row2' }, closeBtn('None of these')));
    } catch {
      assist(el('p', { text: "Search isn't working right now. Try again in a minute, or paste the coordinates." }), el('div', { class: 'row2' }, closeBtn()));
    }
  }

  $('#cInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').requestSubmit(); }
  });
  $('#composer').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('#cInput'), text = input.value.trim();
    if (!text || !db || !me) return;
    const send = $('#cSend');
    send.disabled = true;
    try { await postMessage({ kind: 'text', text: str(text, 1000) }); }
    catch { send.disabled = false; toast("Your message didn't send. Try again."); return; }
    input.value = ''; send.disabled = false;

    const r = parseInput(text);
    if (r.kind === 'exact') {
      assist();
      startAdd({ lat: r.lat, lng: r.lng, name: r.name, source: r.source });
      if (!r.name) {
        // Look up what's at that spot to suggest a name.
        osmReverse(r.lat, r.lng).then(x => {
          if (!x || !adding) return;
          const nm = $('#fName'), ar = $('#fArea');
          if (nm && !nm.value.trim()) nm.value = x.name;
          if (ar && !ar.value.trim()) ar.value = x.area;
          if (formIcon === '📍' && x.icon !== '📍') setIcon(x.icon);
        }).catch(() => {});
      }
    } else if (r.kind === 'outside') {
      assist(el('p', { text: "Those coordinates are outside Singapore, so there's no spot on this map for them." }), el('div', { class: 'row2' }, closeBtn()));
    } else if (r.kind === 'short') {
      if (r.rest) offerSearch(r.rest, "Short Google Maps links can't be opened here, but your message has a name in it. Search the map for it?");
      else assist(el('p', { text: "Short Google Maps links can't be opened here. Paste the place's name or its coordinates instead." }), el('p', { class: 'small', text: TIP }), el('div', { class: 'row2' }, closeBtn()));
    } else if (r.kind === 'link') {
      if (r.rest) offerSearch(r.rest, "This link can't be opened here. Search the map for the rest of your message?");
    } else {
      offerSearch(text, `Is "${str(text, 50)}" a place you want to suggest?`);
    }
  });

  // ---------- live data ----------
  function stopListening() {
    for (const u of unsubscribers) u();
    unsubscribers = [];
    places = []; ballots = {}; messages = []; loaded = false; voteBlocked = false;
  }
  function onDenied(err) {
    if (err && err.code === 'permission-denied') {
      showGate(`The Google account ${me && me.email ? me.email : ''} isn't on this trip's guest list. Ask the organiser to add it, or sign in with a different account.`, true);
    } else toast('Lost connection to the trip. Reload the page to reconnect.');
  }
  function startListening() {
    stopListening();
    unsubscribers.push(db.collection('places').onSnapshot(snap => {
      places = snap.docs.map(cleanPlace).filter(Boolean);
      loaded = true;
      renderAll();
    }, onDenied));
    unsubscribers.push(db.collection('votes').onSnapshot(snap => {
      const next = {};
      for (const doc of snap.docs) {
        const x = doc.data() || {};
        const votes = {};
        if (x.votes && typeof x.votes === 'object') for (const k in x.votes) if (x.votes[k] === 'yes' || x.votes[k] === 'no') votes[k] = x.votes[k];
        next[doc.id] = { votes, name: str(x.name, 60), photo: typeof x.photo === 'string' ? x.photo : '' };
      }
      ballots = next;
      renderAll();
    }, onDenied));
    unsubscribers.push(db.collection('messages').orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => {
      messages = snap.docs.map(doc => {
        const x = doc.data({ serverTimestamps: 'estimate' }) || {};
        return {
          id: doc.id, uid: str(x.uid, 128), name: str(x.name, 60), photo: typeof x.photo === 'string' ? x.photo : '',
          createdAt: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now(),
          kind: x.kind === 'added' ? 'added' : 'text', text: str(x.text, 1000),
          placeId: str(x.placeId, 128), placeName: str(x.placeName, 80), placeIcon: str(x.placeIcon, 2),
        };
      }).reverse();
      renderUnread(); renderChat();
    }, onDenied));
  }

  // ---------- sign-in ----------
  function showGate(text, signedIn) {
    $('#gate').hidden = false;
    $('#gateText').textContent = text;
    const btn = $('#signIn');
    btn.hidden = !auth;
    btn.textContent = signedIn ? 'Use a different Google account' : 'Sign in with Google';
    $('#gateErr').hidden = true;
  }
  function authErrorText(e) {
    const code = e && e.code;
    if (code === 'auth/unauthorized-domain') return "This web address isn't allowed to sign in yet. The organiser needs to add it in Firebase (SETUP.md, step 3).";
    if (code === 'auth/network-request-failed') return "Couldn't reach Google. Check your connection and try again.";
    if (code === 'auth/operation-not-allowed') return 'Google sign-in is switched off in Firebase. The organiser needs to turn it on (SETUP.md, step 2).';
    return 'Sign-in failed. Try again.';
  }
  $('#signIn').onclick = async () => {
    if (!auth) return;
    if (me) await auth.signOut();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return auth.signInWithRedirect(provider);
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      const err = $('#gateErr'); err.textContent = authErrorText(e); err.hidden = false;
    }
  };
  $('#signOut').onclick = () => auth && auth.signOut();

  renderAll();
  renderChat();

  if (location.protocol === 'file:') {
    showGate('Google sign-in only works when the app is on a website. Open the GitHub Pages link, or see SETUP.md to test it on your computer.', false);
    $('#signIn').hidden = true;
  } else if (!window.firebase) {
    showGate("Couldn't load Google sign-in. Check your internet connection and reload the page.", false);
  } else if (!configured) {
    showGate("This app isn't connected to Firebase yet. Follow SETUP.md, then reload.", false);
  } else {
    auth.getRedirectResult().catch(e => { const err = $('#gateErr'); err.textContent = authErrorText(e); err.hidden = false; });
    auth.onAuthStateChanged(user => {
      me = user;
      if (user) {
        $('#gate').hidden = true;
        $('#me').hidden = false;
        $('#meName').textContent = user.displayName || user.email || 'You';
        if (user.photoURL) $('#meAvatar').src = user.photoURL; else $('#meAvatar').removeAttribute('src');
        $('#addBtn').hidden = false;
        startListening();
      } else {
        stopListening();
        if (adding) stopAdd();
        $('#me').hidden = true;
        $('#addBtn').hidden = true;
        showGate('Sign in with your Google account to see the places and vote.', false);
        renderAll(); renderChat();
      }
    });
  }
})();
