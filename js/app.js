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
  let projectId = null; // the project on screen; null means the start page (your projects)
  if (configured && window.firebase) {
    firebase.initializeApp(cfg);
    // App Check proves requests come from this website, not a bot. Off until a site key is set.
    if (window.APP_CHECK_SITE_KEY && firebase.appCheck) {
      try { firebase.appCheck().activate(new firebase.appCheck.ReCaptchaV3Provider(window.APP_CHECK_SITE_KEY), true); }
      catch { /* keep working without it */ }
    }
    auth = firebase.auth();
    db = firebase.firestore();
  }
  const now = () => firebase.firestore.FieldValue.serverTimestamp();
  // Everything saved carries an expiry date 12 months ahead. With Firestore's TTL setting switched
  // on (SETUP.md), Firebase deletes it automatically after that. Using a project pushes its date back.
  const RETAIN_MS = 365 * 864e5;
  const expiry = () => firebase.firestore.Timestamp.fromMillis(Date.now() + RETAIN_MS);

  // ---------- settings (saved on this device only) ----------
  const SETTING_DEFAULTS = { theme: 'system', mrtLines: true, stationNames: true, busStops: true, placeLabels: 'zoom', enterToSend: true };
  const SETTING_CHOICES = { theme: ['system', 'light', 'dark'], placeLabels: ['zoom', 'always'] };
  const settings = { ...SETTING_DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem('wanderly-settings') || '{}');
    for (const k in SETTING_DEFAULTS) {
      const v = saved[k];
      if (SETTING_CHOICES[k] ? SETTING_CHOICES[k].includes(v) : typeof v === typeof SETTING_DEFAULTS[k]) settings[k] = v;
    }
  } catch { /* storage blocked or unreadable: use defaults */ }
  const saveSettings = () => { try { localStorage.setItem('wanderly-settings', JSON.stringify(settings)); } catch { /* storage blocked */ } };

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
    const detailed = mapMode === 'detailed' && !!projectId; // the start page always uses the simple map
    if (detailed) { try { addStreetMap(); } catch { streetsState = 'failed'; } }
    const showStreets = detailed && streetsState === 'ready';
    map.getPane('streets').style.display = showStreets ? '' : 'none';
    $('#map').classList.toggle('streets-on', showStreets);
    map.getPane('transit').style.display = detailed ? '' : 'none';
    if (showStreets) map.removeLayer(handDrawn); else if (!map.hasLayer(handDrawn)) handDrawn.addTo(map);
    // MRT lines show on both maps, unless switched off in Settings.
    if (settings.mrtLines) { if (!map.hasLayer(mrtLines)) mrtLines.addTo(map); } else map.removeLayer(mrtLines);
    for (const b of document.querySelectorAll('#mapMode button')) b.setAttribute('aria-pressed', String(b.dataset.mode === (detailed ? 'detailed' : 'simple')));
  }
  function setMapMode(m) {
    mapMode = m;
    try { localStorage.setItem('wanderly-map-mode', m); } catch { /* storage blocked */ }
    applyMapMode();
    if (m === 'detailed') loadBusStops().catch(() => {});
  }
  for (const b of document.querySelectorAll('#mapMode button')) b.onclick = () => setMapMode(b.dataset.mode);

  // Map key: opens and closes with the Key button, or closes with Escape.
  function showKey(open) {
    $('#mapKey').hidden = !open;
    $('#keyBtn').setAttribute('aria-expanded', String(open));
  }
  $('#keyBtn').onclick = () => showKey($('#mapKey').hidden);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#mapKey').hidden) showKey(false); });
  L.DomEvent.disableClickPropagation($('#mapKey'));
  L.DomEvent.disableScrollPropagation($('#mapKey'));

  // ---------- Settings panel ----------
  function applySettings() {
    if (settings.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = settings.theme;
    $('#map').classList.toggle('no-stnames', !settings.stationNames);
    $('#map').classList.toggle('labels-always', settings.placeLabels === 'always');
    applyMapMode();
    loadBusStops().catch(() => {});
  }
  function renderSettings() {
    for (const seg of document.querySelectorAll('#settings .seg')) {
      const key = seg.dataset.setting;
      const current = key === 'mapMode' ? mapMode : settings[key];
      for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.value === current));
    }
    for (const sw of document.querySelectorAll('#settings .switch')) sw.setAttribute('aria-checked', String(!!settings[sw.dataset.setting]));
  }
  for (const seg of document.querySelectorAll('#settings .seg')) {
    for (const b of seg.querySelectorAll('button')) {
      b.onclick = () => {
        const key = seg.dataset.setting;
        if (key === 'mapMode') setMapMode(b.dataset.value);
        else { settings[key] = b.dataset.value; saveSettings(); applySettings(); }
        renderSettings();
      };
    }
  }
  for (const sw of document.querySelectorAll('#settings .switch')) {
    sw.onclick = () => { settings[sw.dataset.setting] = !settings[sw.dataset.setting]; saveSettings(); applySettings(); renderSettings(); };
  }
  $('#clearMapData').onclick = () => {
    try { for (const k of ['wanderly-mrt-lines-v2', 'wanderly-mrt-lines-v1', 'wanderly-mrt-v1']) localStorage.removeItem(k); } catch { /* storage blocked */ }
    toast('Cleared. The MRT lines will download again next time you open Wanderly.');
  };
  $('#resetSettings').onclick = () => {
    Object.assign(settings, SETTING_DEFAULTS);
    saveSettings();
    setMapMode('simple');
    applySettings(); renderSettings();
    toast('Settings reset');
  };
  function showSettings(open) {
    $('#settings').hidden = !open;
    if (open) { renderSettings(); $('#settingsClose').focus(); }
    else $('#settingsBtn').focus();
  }
  $('#settingsBtn').onclick = () => showSettings(true);
  $('#settingsClose').onclick = () => showSettings(false);
  $('#settings').addEventListener('click', e => { if (e.target === e.currentTarget) showSettings(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#settings').hidden) showSettings(false); });

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

  const busLayer = L.layerGroup().addTo(map);
  // A small bus drawing (not an emoji, which can look like a train at this size).
  const BUS_SVG = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="8" height="8" rx="1.6" fill="currentColor"/><rect x="3.2" y="2.8" width="5.6" height="3" rx=".5" fill="#fff"/><circle cx="4" cy="7.6" r=".8" fill="#fff"/><circle cx="8" cy="7.6" r=".8" fill="#fff"/><rect x="3" y="9.5" width="1.6" height="1.5" rx=".4" fill="currentColor"/><rect x="7.4" y="9.5" width="1.6" height="1.5" rx=".4" fill="currentColor"/></svg>';
  const busIcon = L.divIcon({ className: 'transit bus', html: `<span class="tsym">${BUS_SVG}</span>`, iconSize: [18, 18], iconAnchor: [9, 9] });

  // MRT/LRT lines and stations (both maps): stations joined in order, in each line's official colour.
  map.createPane('mrtlines').style.zIndex = 190; // above the hand-drawn land and the street map
  map.createPane('stationlabels').style.zIndex = 195;
  const mrtLines = L.layerGroup();
  let mrtStations = []; // { name, lat, lng, lrtOnly } once the MRT data loads; used to suggest meeting stations
  const ZOOM_HINT = matchMedia('(hover: hover)').matches ? 'Double-click to zoom in' : 'Double-tap to zoom in';
  const LINE_COLOURS = { NS: '#D42E12', EW: '#009645', CG: '#009645', NE: '#9900AA', CC: '#FA9E0D', CE: '#FA9E0D', DT: '#005EC4', TE: '#9D5B25' };
  const hexColour = c => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');
  // Lines that OpenStreetMap already lists but that aren't open yet: Jurong Region Line (JRL)
  // and Cross Island Line (CRL). Matched by name/code, and by stations only those lines have.
  const NOT_OPEN_LINE = /Jurong Region|Cross Island|^(JR|JS|JE|JW|CR|CP)\b/i;
  const NOT_OPEN_STATIONS = new Set(['tengah', 'tengah plantation', 'tengah park', 'hong kah', 'corporation', 'jurong west', 'bahar junction', 'gek poh', 'tawas', 'nanyang gateway', 'nanyang crescent', 'peng kang hill', 'enterprise', 'tukang', 'jurong hill', 'jurong pier', 'toh guan', 'pandan reservoir', 'bukit batok west', 'aviation park', 'loyang', 'elias', 'pasir ris east', 'tampines north', 'defu', 'teck ghee', 'turf city']);
  const isOpenLine = line => !NOT_OPEN_LINE.test(line.name || '') && !NOT_OPEN_LINE.test(line.ref || '')
    && !line.stops.some(s => NOT_OPEN_STATIONS.has(String(s[2] || '').toLowerCase()));
  // Bukit Panjang LRT, used if OpenStreetMap's data doesn't include it: Choa Chu Kang to
  // Bukit Panjang, then the loop through Petir ... Senja and back to Bukit Panjang.
  const BP_LRT = [['Choa Chu Kang', 1.3854, 103.7443], ['South View', 1.3802, 103.7452], ['Keat Hong', 1.3786, 103.7491], ['Teck Whye', 1.3767, 103.7536],
    ['Phoenix', 1.3786, 103.7580], ['Bukit Panjang', 1.3780, 103.7631], ['Petir', 1.3778, 103.7667], ['Pending', 1.3762, 103.7710], ['Bangkit', 1.3802, 103.7726],
    ['Fajar', 1.3845, 103.7708], ['Segar', 1.3877, 103.7697], ['Jelapang', 1.3869, 103.7646], ['Senja', 1.3827, 103.7624], ['Bukit Panjang', 1.3780, 103.7631]];
  async function loadMrtLines() {
    let lines = cacheGet('wanderly-mrt-lines-v2', 30 * 864e5);
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
        lines.push({ colour: hexColour(t.colour) || LINE_COLOURS[prefix] || '#748477', lrt, stops, name: str(t.name, 80), ref: str(t.ref, 12) });
      }
      if (lines.length) cacheSet('wanderly-mrt-lines-v2', lines);
    }
    lines = lines.filter(isOpenLine);
    if (!lines.some(l => l.stops.some(s => /^(Bangkit|Senja|Fajar|Jelapang)$/i.test(s[2] || '')))) {
      lines.push({ colour: '#748477', lrt: true, name: 'Bukit Panjang LRT', ref: 'BP', stops: BP_LRT.map(([n, lat, lng]) => [lat, lng, n]) });
    }
    // OpenStreetMap stores each line twice (one per direction, on parallel tracks).
    // Keep one copy of each route: two routes are the same if they stop at the same stations.
    const routeKey = line => line.stops.map(s => s[2] || `${s[0].toFixed(3)},${s[1].toFixed(3)}`).sort().join('|');
    const unique = new Map();
    for (const line of lines) {
      const key = routeKey(line);
      if (!unique.has(key) || unique.get(key).stops.length < line.stops.length) unique.set(key, line);
    }
    lines = [...unique.values()];
    // Each line records its own platform, so at an interchange (Bugis, Promenade, Bayfront...)
    // the lines' points sit a few hundred metres apart. Merge every stop with the same station
    // name into one point, so all the lines meet exactly at the station.
    const stationKey = (lat, lng, name) => {
      const n = String(name || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/\b(mrt|lrt|station)\b/g, '').replace(/\s+/g, ' ').trim();
      return n || `${lat.toFixed(3)},${lng.toFixed(3)}`;
    };
    const stations = new Map(); // key -> { lat, lng, name, count, colours:Set, mrt, lrt }
    for (const line of lines) {
      for (const [lat, lng, name] of line.stops) {
        const key = stationKey(lat, lng, name);
        const st = stations.get(key) || { latSum: 0, lngSum: 0, count: 0, name, colours: new Set(), mrt: false, lrt: false };
        st.latSum += lat; st.lngSum += lng; st.count += 1;
        st.colours.add(line.colour);
        if (line.lrt) st.lrt = true; else st.mrt = true;
        if (!st.name && name) st.name = name;
        stations.set(key, st);
      }
    }
    for (const st of stations.values()) { st.lat = st.latSum / st.count; st.lng = st.lngSum / st.count; }
    mrtStations = [...stations.values()].filter(s => s.name).map(s => ({ name: s.name, lat: s.lat, lng: s.lng, lrtOnly: s.lrt && !s.mrt }));
    const at = (lat, lng, name) => { const st = stations.get(stationKey(lat, lng, name)); return [st.lat, st.lng]; };

    // Draw LRT first so the MRT lines sit on top.
    lines.sort((a, b) => Number(b.lrt) - Number(a.lrt));
    // Faint dotted lines: a hint of each line's colour without overpowering the map.
    for (const line of lines) {
      L.polyline(line.stops.map(s => at(s[0], s[1], s[2])), {
        pane: 'mrtlines', color: line.colour, weight: line.lrt ? 1.5 : 2.2,
        opacity: line.lrt ? 0.3 : 0.45, dashArray: '0.1 6', lineCap: 'round', lineJoin: 'round', interactive: false,
      }).addTo(mrtLines);
    }

    // Station dots. Each small visible dot has a larger invisible circle around it, so the
    // mouse or a finger doesn't have to land exactly on the dot to show the station name.
    for (const st of stations.values()) {
      const interchange = st.colours.size > 1;
      const colour = interchange ? '#5B6B66' : [...st.colours][0];
      const size = interchange ? 3.2 : st.mrt ? 2.4 : 1.8;
      const rest = { radius: size, fillOpacity: interchange ? 0.7 : st.mrt ? 0.5 : 0.35 };
      const dot = L.circleMarker([st.lat, st.lng], {
        pane: 'mrtlines', stroke: interchange, color: '#FFFFFF', weight: 1, fillColor: colour,
        interactive: false, ...rest,
      }).addTo(mrtLines);
      if (!st.name) continue;
      // Station name next to the dot, shown when zoomed in (see .stlabel in the CSS).
      L.marker([st.lat, st.lng], {
        pane: 'stationlabels', interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'stlabel', html: `<span>${esc(st.name)}</span>`, iconSize: null }),
      }).addTo(mrtLines);
      const kind = st.mrt && st.lrt ? 'MRT/LRT' : st.lrt ? 'LRT' : 'MRT';
      const hit = L.circleMarker([st.lat, st.lng], {
        pane: 'mrtlines', radius: 11, stroke: false, fillColor: '#000000', fillOpacity: 0, bubblingMouseEvents: false,
      })
        .bindTooltip(
          `<b class="tipname">${esc(st.name)}</b><span class="tipsub">${interchange ? 'Interchange' : `${kind} station`}</span><span class="tiphint">${ZOOM_HINT}</span>`,
          { direction: 'top', offset: [0, -8], className: 'wtip' })
        .on('mouseover', () => dot.setStyle({ radius: size + 2.5, fillOpacity: 0.95 }))
        .on('mouseout', () => dot.setStyle(rest))
        // While adding a place, a tap near a station should still drop the pin there.
        .on('click', e => { if (adding) handleMapClick(e.latlng); })
        // Double-click (double-tap on phones): zoom in and centre on the station.
        .on('dblclick', e => {
          L.DomEvent.stop(e);
          const z = map.getZoom();
          map.flyTo([st.lat, st.lng], z < 16 ? 16 : Math.min(z + 1, map.getMaxZoom()), { duration: reduceMotion ? 0 : 0.6 });
        })
        .addTo(mrtLines);
    }
  }
  loadMrtLines().catch(() => { /* the simple map works without the lines */ });

  // Bus stops only show when zoomed in close, and load for the area on screen.
  const BUS_ZOOM = 16;
  let busBounds = null, busTimer = 0, busSeq = 0;
  async function loadBusStops() {
    if (mapMode !== 'detailed' || !projectId || !settings.busStops) { busLayer.clearLayers(); busBounds = null; return; }
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
      L.marker([e.lat, e.lon], { pane: 'transit', keyboard: false, title: `Bus stop: ${name}`, icon: busIcon })
        .bindTooltip(`<b class="tipname">${esc(name)}</b><span class="tipsub">Bus stop${code ? ' ' + esc(code) : ''}</span>`, { direction: 'top', offset: [0, -8], className: 'wtip' })
        .addTo(busLayer);
    }
  }
  map.on('moveend', () => { clearTimeout(busTimer); busTimer = setTimeout(() => loadBusStops().catch(() => {}), 500); });
  applySettings(); // first run: needs the MRT and bus stop layers above to exist

  const updateLabels = () => {
    const z = map.getZoom();
    $('#map').classList.toggle('show-labels', z >= 14);
    $('#map').classList.toggle('show-stations', z >= 15.5); // names only when zoomed right in, so they don't crowd
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
  let renamingPlace = null;   // id of the place whose name is being edited
  let editingLimit = null;    // id of the place whose voting time limit is being changed
  let detailHold = false;     // true while a confirm step is open, so the countdown refresh doesn't reset it
  let votesLoaded = false;    // true once everyone's votes have arrived (needed before ending votes by deadline)
  let adding = false, draft = null, draftMarker = null, prefill = null;
  let voteBlocked = false;
  let activeTab = 'vote', seenAt = Date.now();
  let unsubscribers = [];
  let itinerary = [];         // this project's plan: stops with meeting points
  let reservations = [];      // this project's reservations checklist
  const markers = new Map();  // placeId -> { marker, key }

  // Projects: each has its own places, votes and chat, stored under projects/{id}/...
  // (projectId, the project on screen, is declared with the Firebase setup above.)
  let projects = [];          // projects I'm in
  let projectsLoaded = false;
  let projectsUnsub = null;
  const col = name => db.collection('projects').doc(projectId).collection(name);
  const currentProject = () => projects.find(p => p.id === projectId) || null;

  function cleanPlace(doc) {
    const x = doc.data() || {};
    const lat = Number(x.lat), lng = Number(x.lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return {
      id: doc.id, name: str(x.name, 80) || 'Untitled place', icon: str(x.icon, 2) || '📍',
      area: str(x.area, 60), mrt: str(x.mrt, 60), address: str(x.address, 160), blurb: str(x.blurb, 300),
      activities: Array.isArray(x.activities) ? x.activities.slice(0, 12).map(a => str(a, 160)).filter(Boolean) : [],
      lat, lng, addedBy: typeof x.addedBy === 'string' ? x.addedBy : null, addedByName: str(x.addedByName, 60),
      source: str(x.source, 12),
      // Voting: open or closed (ended by hand, by its deadline, or by confirming), which round it's
      // in (reopening starts a new round), when it closes, and the results of earlier rounds.
      status: x.status === 'closed' ? 'closed' : 'open',
      result: x.result === 'in' || x.result === 'out' ? x.result : null,
      round: Number.isInteger(x.round) && x.round > 0 ? x.round : 1,
      voteEndsAt: typeof x.voteEndsAt === 'number' ? x.voteEndsAt : null,
      history: Array.isArray(x.history) ? x.history.slice(-10).map(h => ({
        round: Number(h && h.round) || 1, result: h && h.result === 'in' ? 'in' : 'out',
        yes: Number(h && h.yes) || 0, no: Number(h && h.no) || 0, at: Number(h && h.at) || 0, how: str(h && h.how, 10),
      })) : [],
    };
  }
  // Each voting round has its own key in people's ballots, so reopening a place starts fresh
  // without touching anyone's earlier votes: round 1 uses the place id, round 2 "id~r2", and so on.
  const voteKey = p => (p.round > 1 ? `${p.id}~r${p.round}` : p.id);
  function tally(pid) {
    const p = places.find(q => q.id === pid);
    const key = p ? voteKey(p) : pid;
    const yes = [], no = [];
    for (const [uid, b] of Object.entries(ballots)) {
      if (b.votes[key] === 'yes') yes.push(uid);
      else if (b.votes[key] === 'no') no.push(uid);
    }
    return { yes, no };
  }
  // Voting result: 'in' (going), 'out' (not going), or null while voting is still open.
  // Once the deadline passes, the result is fixed from the votes cast in time, even before
  // someone's app has saved it.
  const deadlinePassed = p => !!p.voteEndsAt && Date.now() >= p.voteEndsAt;
  function outcome(p, t) {
    if (p.status === 'closed') return p.result || 'out';
    if (deadlinePassed(p)) return t.yes.length > t.no.length ? 'in' : 'out';
    return null;
  }
  const votingOpen = p => p.status !== 'closed' && !deadlinePassed(p);
  // A place is greyed out when its voting ended as "not going" (including nobody voting),
  // or while voting is open and more people said No than Yes.
  const isVotedOut = (t, p) => { const o = p ? outcome(p, t) : null; return o === 'out' || (o === null && t.no.length > t.yes.length); };
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
      const t = tally(p.id), yes = t.yes.length, sel = p.id === selectedId, out = isVotedOut(t, p);
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
    renamingPlace = null; editingLimit = null;
    showTab('vote');
    const p = places.find(q => q.id === id);
    if (p && fly) map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 15), { duration: reduceMotion ? 0 : 0.6 });
    renderAll();
    if (narrow() && fly) scrollToEl($('#detail'));
  }

  let voteChain = Promise.resolve();
  function vote(pid, v) {
    if (!db || !me || voteBlocked) return;
    const place = places.find(q => q.id === pid);
    if (!place || !votingOpen(place)) { toast('Voting on this place has ended. Reopen it to vote again.'); return; }
    const key = voteKey(place);
    const mine = { ...((ballots[me.uid] || {}).votes || {}) };
    if (mine[key] === v) delete mine[key]; else mine[key] = v;
    ballots = { ...ballots, [me.uid]: { votes: mine, name: me.displayName || '', photo: me.photoURL || '' } };
    renderAll();
    voteChain = voteChain
      .then(() => col('votes').doc(me.uid).set({
        votes: mine, name: me.displayName || null, photo: me.photoURL || '', updatedAt: now(), expireAt: expiry(),
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
    // Keep "Nearest MRT" in step with the pin, unless someone typed their own.
    const m = $('#fMrt');
    if (m && draft && m.value === mrtAuto) { mrtAuto = nearestMrtText(draft.lat, draft.lng); m.value = mrtAuto; }
    // Same for "Area", which needs a lookup, so wait until the pin stops moving.
    clearTimeout(areaTimer);
    if (draft) areaTimer = setTimeout(refreshArea, 700);
  }
  let mrtAuto = '';  // the last "Nearest MRT" the form filled in by itself
  let areaAuto = ''; // the last "Area" the form filled in by itself
  let areaTimer = null, areaSeq = 0;
  async function refreshArea() {
    const a = $('#fArea');
    if (!a || !draft || a.value !== areaAuto) return;
    const seq = ++areaSeq, name = ($('#fName') || {}).value || '';
    const found = await areaAt(draft.lat, draft.lng, name);
    const now2 = $('#fArea');
    if (seq !== areaSeq || !now2 || now2.value !== areaAuto || !found) return;
    areaAuto = found; now2.value = found;
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
    search: "This pin comes from an address search. Check it's the right spot and drag the pin if needed.",
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
      el('label', { for: 'fAddr', text: 'Address (optional)' }), el('input', { id: 'fAddr', maxlength: '160', placeholder: 'e.g. 1 Stadium Place, Singapore 397628' }),
      el('label', { for: 'fArea', text: 'Area' }), el('input', { id: 'fArea', maxlength: '60', placeholder: 'e.g. East Coast Park' }),
      el('label', { for: 'fMrt', text: 'Nearest MRT' }), el('input', { id: 'fMrt', maxlength: '60', placeholder: 'e.g. Clarke Quay MRT', list: 'fMrtList' }),
      el('datalist', { id: 'fMrtList' }, ...mrtStations.filter(s => !s.lrtOnly).map(s => el('option', { value: `${s.name} MRT` }))),
      el('p', { class: 'small limitnote', text: 'Area and nearest MRT are filled in from the pin (MRT distance is a straight line). Change them if you know better.' }),
      el('label', { for: 'fBlurb', text: 'Why go? (optional)' }), el('input', { id: 'fBlurb', maxlength: '300', placeholder: 'One line to sell it to the group' }),
      el('label', { for: 'fActs', text: 'Things to do, one per line' }), el('textarea', { id: 'fActs', placeholder: 'River cruise\nDinner by the water\nBar hopping' }),
      el('label', { for: 'fLimit', text: 'Voting time limit' }), limitSelect('fLimit', 0),
      el('p', { class: 'small limitnote', text: 'When time runs out, the votes so far decide: going if Yes is ahead of No, otherwise greyed out.' }),
      err,
      el('div', { class: 'factions' }, save, el('button', { class: 'ghost', type: 'button', id: 'fCancel', text: 'Cancel' })));
    box.append(form);
    $('#fName').value = pre.name || '';
    areaAuto = pre.area || ''; $('#fArea').value = areaAuto; // may be swapped for a better one from the pin
    $('#fAddr').value = pre.address || '';
    mrtAuto = ''; $('#fMrt').value = ''; // filled in from the pin below
    $('#fBlurb').value = pre.blurb || '';
    $('#fActs').value = (pre.activities || []).join('\n');

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('#fName').value.trim();
      if (!name) { err.textContent = 'Give the place a name.'; err.hidden = false; $('#fName').focus(); return; }
      const doc = {
        name: str(name, 80), icon: formIcon,
        area: str($('#fArea').value.trim(), 60), mrt: str($('#fMrt').value.trim(), 60), address: str($('#fAddr').value.trim(), 160),
        blurb: str($('#fBlurb').value.trim(), 300),
        activities: $('#fActs').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12).map(s => str(s, 160)),
        lat: +draft.lat.toFixed(6), lng: +draft.lng.toFixed(6),
        addedBy: me.uid, addedByName: me.displayName || null, createdAt: now(),
        source: pre.source || 'map', expireAt: expiry(), voteEndsAt: deadlineIn(Number($('#fLimit').value) || 0),
      };
      save.disabled = true; save.textContent = 'Saving…'; err.hidden = true;
      try {
        const ref = await col('places').add(doc);
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
        batch.set(col('places').doc(), {
          ...s, addedBy: me.uid, addedByName: me.displayName || null, createdAt: now(), source: 'starter', expireAt: expiry(), voteEndsAt: null,
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
    detailHold = false;
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
      if (me && projectsLoaded && !projectId) {
        const go = el('button', { class: 'primary', type: 'button', text: 'Start a project' });
        go.onclick = () => { showTab('project'); $('#newProjName').focus(); };
        intro.append(el('h2', { text: 'Start a project' }),
          el('p', { text: 'A project holds one trip: its places, votes and chat. Create one, then send the invite link to your friends. If a friend already made one, ask them for the invite link.' }), go);
      } else if (!loaded) intro.append(el('h2', { text: 'Loading places…' }));
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
    const open = votingOpen(p);
    const result = outcome(p, t);
    const mine = me ? ((ballots[me.uid] || {}).votes || {})[voteKey(p)] : undefined;
    const meta = [p.area, p.mrt || nearestMrtText(p.lat, p.lng)].filter(Boolean).join(' · ');
    const gmaps = el('a', { href: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`, target: '_blank', rel: 'noopener', text: 'Open in Google Maps' });
    const byline = p.addedByName ? `Suggested by ${p.addedBy === (me && me.uid) ? 'you' : p.addedByName}` : '';
    const out = isVotedOut(t, p);

    // Place name, with Rename for anyone in the project.
    let nameEl;
    if (renamingPlace === p.id) {
      const input = el('input', { id: 'placeRename', maxlength: '80', 'aria-label': 'Place name', required: '' });
      input.value = p.name;
      const save = el('button', { class: 'primary', type: 'submit', text: 'Save' });
      const cancel = el('button', { class: 'ghost', type: 'button', text: 'Cancel' });
      nameEl = el('form', { class: 'inlineform renameform' }, input, save, cancel);
      cancel.onclick = () => { renamingPlace = null; renderDetail(); };
      nameEl.onsubmit = async e => {
        e.preventDefault();
        const v = input.value.trim();
        if (!v || v === p.name) { renamingPlace = null; renderDetail(); return; }
        save.disabled = true;
        try { await renamePlace(p, v); renamingPlace = null; renderDetail(); toast('Renamed'); }
        catch { save.disabled = false; toast("Couldn't rename the place. Try again."); }
      };
      setTimeout(() => { input.focus(); input.select(); });
    } else {
      const rn = el('button', { class: 'linkbtn renamebtn', type: 'button', text: 'Rename' });
      rn.onclick = () => { renamingPlace = p.id; renderDetail(); };
      nameEl = el('div', { class: 'namerow' }, el('h2', { text: p.name }), me ? rn : null);
    }
    const outText = result === 'out'
      ? `Voting ended: not going (${t.yes.length} Yes, ${t.no.length} No). It's greyed out on the map. You can reopen voting below.`
      : `More people voted No than Yes (${t.no.length} to ${t.yes.length}), so it's greyed out for now. Votes can still change.`;
    box.append(el('div', { class: 'place' + (out ? ' out' : '') },
      out ? el('p', { class: 'outnote', text: outText }) : null,
      el('div', { class: 'phead' },
        el('div', { class: 'bigicon', 'aria-hidden': 'true', text: p.icon }),
        el('div', { class: 'pheadtext' }, nameEl, meta ? el('p', { class: 'meta', text: meta }) : null,
          p.address ? el('p', { class: 'paddr', text: p.address }) : null,
          el('div', { class: 'coords' }, coordText(p.lat, p.lng), gmaps))),
      p.blurb ? el('p', { class: 'blurb', text: p.blurb }) : null,
      p.activities.length ? el('p', { class: 'eyebrow', text: 'Things to do' }) : null,
      p.activities.length ? el('ul', { class: 'acts' }, ...p.activities.map(a => el('li', { text: a }))) : null,
      byline ? el('p', { class: 'srcnote', text: byline }) : null));

    // Voting status: time left, or how it ended, plus the results of earlier rounds.
    const status = el('div', { class: 'votestatus' });
    if (open && p.round > 1) status.append(el('p', { class: 'roundlabel', text: `Round ${p.round}: voting was reopened, so everyone votes again.` }));
    // Each place has its own time limit, which anyone can set, change or clear while voting is open.
    if (open && editingLimit === p.id) {
      const sel = limitSelect('placeLimit', 120);
      const save = el('button', { class: 'primary', type: 'submit', text: 'Save' });
      const cancel = el('button', { class: 'ghost', type: 'button', text: 'Cancel' });
      const form = el('form', { class: 'inlineform limitform' }, sel, save, cancel);
      cancel.onclick = () => { editingLimit = null; renderDetail(); };
      form.onsubmit = async e => {
        e.preventDefault();
        const mins = Number(sel.value) || 0;
        save.disabled = true;
        try {
          await setVoteLimit(p, mins); editingLimit = null; renderDetail();
          toast(mins ? `Voting on ${p.name} ends in ${fmtLimit(mins)}.` : `No time limit on ${p.name}.`);
        } catch { save.disabled = false; toast("Couldn't save the time limit. Try again."); }
      };
      status.append(el('p', { class: 'small', text: 'Counts from now. When time runs out, the votes so far decide.' }), form);
    } else if (open && me) {
      const change = el('button', { class: 'linkbtn renamebtn', type: 'button', text: p.voteEndsAt ? 'Change' : 'Set a time limit' });
      change.onclick = () => { editingLimit = p.id; renderDetail(); };
      status.append(el('div', { class: 'namerow limitrow' },
        el('p', { class: p.voteEndsAt ? 'deadline' : 'nolimit',
          text: p.voteEndsAt ? `⏱ Voting ends in ${timeLeft(p.voteEndsAt)} (${fmtWhen(p.voteEndsAt)})` : 'No time limit on voting' }),
        change));
    }
    if (!open) {
      status.append(el('p', { class: 'ended ' + (result === 'in' ? 'in' : 'out'),
        text: `${result === 'in' ? 'Voting ended: going ✓' : 'Voting ended: not going'} · ${t.yes.length} Yes, ${t.no.length} No` }));
    }
    for (const h of p.history.filter(x => x.round < p.round)) {
      const how = h.how === 'deadline' ? ' when time ran out' : h.how === 'allvoted' ? ' when everyone had voted' : h.how === 'manual' ? ' early' : h.how === 'confirm' ? ' by confirming' : '';
      status.append(el('p', { class: 'pastround',
        text: `${h.round === 1 ? 'First vote' : `Round ${h.round}`}: ${h.result === 'in' ? 'going' : 'not going'} · ${h.yes} Yes, ${h.no} No · ended${how}, ${fmtWhen(h.at)}` }));
    }

    const yesB = el('button', { class: 'vbtn yes', type: 'button', 'aria-pressed': String(mine === 'yes'), text: "Yes, I'm in" });
    const noB = el('button', { class: 'vbtn no', type: 'button', 'aria-pressed': String(mine === 'no'), text: 'No, skip it' });
    yesB.disabled = noB.disabled = !me || voteBlocked || !open;
    yesB.onclick = () => vote(p.id, 'yes');
    noB.onclick = () => vote(p.id, 'no');
    const total = t.yes.length + t.no.length;
    const pct = n => `width:${total ? (n / total) * 100 : 0}%`;
    const voterList = ids => {
      const ul = el('ul', { class: 'chips' });
      if (!ids.length) ul.append(el('li', { class: 'none', text: 'Nobody' + (open ? ' yet' : '') }));
      for (const uid of ids) {
        const b = ballots[uid] || {};
        ul.append(el('li', {},
          b.photo ? el('img', { src: b.photo, alt: '', referrerpolicy: 'no-referrer' }) : null,
          el('span', { text: uid === (me && me.uid) ? 'You' : (b.name || 'Someone') })));
      }
      return ul;
    };
    const vnote = voteBlocked ? "You can't vote on this trip. Ask the organiser to add your Google account."
      : !open ? 'Voting has ended. Reopen it below to vote again.'
      : mine ? 'Tap your vote again to take it back.' : 'Everyone on the trip can see your vote.';
    box.append(
      el('p', { class: 'eyebrow', text: 'Do you want to go?' }),
      status.childNodes.length ? status : null,
      el('div', { class: 'votebtns' }, yesB, noB),
      el('p', { class: 'vnote', text: vnote }),
      el('div', { class: 'tbar', 'aria-hidden': 'true' }, el('span', { class: 'y', style: pct(t.yes.length) }), el('span', { class: 'n', style: pct(t.no.length) })),
      el('div', { class: 'voters' },
        el('div', {}, el('h4', { class: 'yh', text: `Yes · ${t.yes.length}` }), voterList(t.yes)),
        el('div', {}, el('h4', { class: 'nh', text: `No · ${t.no.length}` }), voterList(t.no))));

    // End voting now (while open) or reopen it (once ended). Both ask to confirm first.
    if (me) {
      // extra: shown only during the confirm step (e.g. the new round's time limit).
      const armed = (label, confirmText, note, action, extra) => {
        const b = el('button', { class: 'ghost small-btn', type: 'button', text: label });
        const cancel = el('button', { class: 'ghost small-btn', type: 'button', text: 'Cancel', hidden: '' });
        const why = el('p', { class: 'small', hidden: '' });
        if (extra) extra.hidden = true;
        let ready = false;
        const reset = () => { ready = false; detailHold = false; b.textContent = label; cancel.hidden = true; why.hidden = true; if (extra) extra.hidden = true; };
        cancel.onclick = reset;
        b.onclick = async () => {
          if (!ready) { ready = true; detailHold = true; b.textContent = confirmText; why.textContent = note; why.hidden = false; cancel.hidden = false; if (extra) extra.hidden = false; return; }
          b.disabled = true; cancel.hidden = true;
          try { await action(); detailHold = false; } catch { b.disabled = false; reset(); toast("That didn't work. Check your connection and try again."); }
        };
        return el('div', { class: 'confirmbox votectl' }, why, extra || null, el('div', { class: 'row2' }, b, cancel));
      };
      if (open) {
        box.append(armed('End voting now', 'Yes, end voting',
          `Ends voting with the votes so far (${t.yes.length} Yes, ${t.no.length} No). If Yes is ahead, ${p.name} goes into the itinerary; otherwise it's greyed out.`,
          async () => { const r = await concludeVoting(p, 'manual'); toast(r === 'in' ? `Voting ended: ${p.name} is going, and it's in the itinerary.` : `Voting ended: ${p.name} is not going.`); }));
      } else {
        const sel = limitSelect('reopenLimit', 0);
        box.append(armed('Reopen voting', 'Yes, reopen',
          "Starts a new round where everyone votes again. This round's result stays visible. Pick how long the new round lasts:",
          async () => {
            const mins = Number(sel.value) || 0;
            await reopenVoting(p, mins);
            toast(mins ? `Voting reopened for ${fmtLimit(mins)}.` : 'Voting reopened. Everyone can vote again.');
          }, sel));
      }
    }

    // Itinerary: confirmed places are in it. You can confirm a place without enough votes,
    // or take a place out of the itinerary even if it was voted in.
    const stops = itinerary.filter(s => s.placeId === p.id);
    const need = votesNeeded();
    const confirmBox = el('div', { class: 'confirmzone' });
    if (stops.length) {
      const stop = stops[0];
      const see = el('button', { class: 'linkbtn', type: 'button', text: 'See it in the itinerary' });
      see.onclick = () => showTab('itin');
      const when = [stop.date ? fmtDate(stop.date) : '', stop.time ? fmtTime(stop.time) : ''].filter(Boolean).join(', ');
      const remove = el('button', { class: 'msgbtn', type: 'button', text: 'Remove from itinerary' });
      let ready = false;
      remove.onclick = async () => {
        if (!ready) { ready = true; remove.textContent = 'Tap again to remove it'; remove.classList.add('armed'); return; }
        remove.disabled = true;
        try { await removeFromItinerary(p); toast(`${p.name} was taken out of the itinerary.`); }
        catch { remove.disabled = false; toast("Couldn't remove it. Try again."); }
      };
      confirmBox.append(el('p', { class: 'confirmed', text: `✓ In the itinerary${when ? ` · ${when}` : ''}` }), el('div', { class: 'row2' }, see, remove));
    } else if (me) {
      const eligible = open && t.yes.length > t.no.length && t.yes.length >= need;
      const label = eligible ? '✓ Confirm location' : result === 'in' ? 'Add to itinerary' : 'Confirm anyway';
      const btn = el('button', { class: eligible || result === 'in' ? 'primary' : 'ghost small-btn', type: 'button', text: label });
      btn.onclick = async () => {
        btn.disabled = true; btn.textContent = 'Adding…';
        try { await confirmPlace(p); }
        catch { btn.disabled = false; btn.textContent = label; toast("Couldn't add it to the itinerary. Try again."); }
      };
      const note = eligible ? 'Most of the group wants to go. Confirming ends voting and adds it to the itinerary, where you can set the meeting time.'
        : result === 'in' ? 'Voting said going, but it isn’t in the itinerary right now.'
        : result === 'out' ? 'Voting said not going. If plans changed, you can still add it.'
        : `Not enough votes to confirm yet (needs ${need} Yes, ahead of No). If the group decided another way, you can confirm it anyway.`;
      confirmBox.append(btn, el('p', { class: 'small', text: note }));
    }
    box.append(confirmBox);

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
          await col('places').doc(p.id).delete();
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
    const rejected = places.filter(p => isVotedOut(tally(p.id), p));
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
        for (const p of rejected) batch.delete(col('places').doc(p.id));
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
      const out = isVotedOut(t, p);
      const b = el('button', { class: 'row' + (out ? ' out' : ''), type: 'button', 'aria-current': String(p.id === selectedId) },
        el('span', { class: 'pos', text: String(i + 1) }),
        el('span', { class: 'ic', 'aria-hidden': 'true', text: p.icon }),
        el('span', { class: 'nm' }, p.name, itinerary.some(s => s.placeId === p.id)
          ? el('span', { class: 'ar confirmedtag', text: '✓ In the itinerary' })
          : out ? el('span', { class: 'ar', text: votingOpen(p) ? 'Voted out' : 'Voting ended: not going' })
          : votingOpen(p) && p.voteEndsAt ? el('span', { class: 'ar deadlinetag', text: `⏱ ${timeLeft(p.voteEndsAt)} left to vote` })
          : el('span', { class: 'ar', text: p.area || coordText(p.lat, p.lng) })),
        el('span', { class: 'ct' }, el('span', { class: 'y', text: `${t.yes.length} yes` }), el('span', { class: 'n', text: `${t.no.length} no` })),
        el('span', { class: 'mini', 'aria-hidden': 'true' }, el('span', { class: 'y', style: pct(t.yes.length) }), el('span', { class: 'n', style: pct(t.no.length) })));
      b.onclick = () => { if (adding) stopAdd(); select(p.id, true); };
      ul.append(el('li', {}, b));
    });
  }

  function renderStats() {
    $('#nPlaces').textContent = places.length;
    const ids = new Set(places.map(p => p.id));
    $('#nVoters').textContent = Object.values(ballots).filter(b => Object.keys(b.votes).some(k => ids.has(k.split('~')[0]))).length;
  }

  function renderAll() {
    if (selectedId && !places.some(p => p.id === selectedId)) selectedId = null;
    renderPins(); renderRows(); renderStats(); renderDetail(); renderBulk();
    renderItinerary(); // stop names link to places on the map, which may have changed
  }

  // ---------- tabs ----------
  function showTab(t) {
    activeTab = t;
    for (const [tab, pane, name] of [['#tabVote', '#paneVote', 'vote'], ['#tabChat', '#paneChat', 'chat'], ['#tabItin', '#paneItin', 'itin'], ['#tabProject', '#paneProject', 'project']]) {
      $(tab).setAttribute('aria-selected', String(t === name));
      $(pane).hidden = t !== name;
    }
    if (t === 'chat') { const m = $('#msgs'); m.scrollTop = m.scrollHeight; }
    renderUnread();
  }
  $('#tabVote').onclick = () => showTab('vote');
  $('#tabChat').onclick = () => showTab('chat');
  $('#tabItin').onclick = () => showTab('itin');
  $('#tabProject').onclick = () => showTab('project');
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
      } else if (m.kind === 'confirmed') {
        const see = el('button', { class: 'linkbtn', type: 'button', text: 'See the itinerary' });
        see.onclick = () => showTab('itin');
        body.append('confirmed ', el('b', { text: `${m.placeIcon || '📍'} ${m.placeName || 'a place'}` }), ". It's on the itinerary. ", see);
      } else if (m.kind === 'rename') {
        body.append('renamed the project from ', el('b', { text: `"${m.from || 'Untitled'}"` }), ' to ', el('b', { text: `"${m.to || 'Untitled'}"` }), '.');
      } else body.append(linkify(m.text));
      box.append(el('li', { class: 'msg' + (m.kind !== 'text' ? ' added' : '') },
        m.photo ? el('img', { class: 'av', src: m.photo, alt: '', referrerpolicy: 'no-referrer' }) : el('span'),
        el('div', {}, el('span', { class: 'who', text: who }), el('span', { class: 'when', text: whenText(m.createdAt) }), body, messageActions(m))));
    }
    if (atBottom || activeTab !== 'chat') box.scrollTop = box.scrollHeight;
  }

  // Moderation: delete your own messages, report other people's. The project owner sees
  // reports and can remove any message.
  function messageActions(m) {
    if (!me) return null;
    const p = currentProject();
    const isOwner = !!p && p.createdBy === me.uid;
    const mine = m.uid === me.uid;
    const row = el('span', { class: 'msgacts' });
    if (isOwner && m.reportedBy.length) {
      row.append(el('span', { class: 'flag', text: `Reported by ${m.reportedBy.length} ${m.reportedBy.length === 1 ? 'person' : 'people'}` }));
    }
    if (mine || isOwner) {
      const del = el('button', { class: 'msgbtn', type: 'button', text: mine ? 'Delete' : 'Remove' });
      let armed = false;
      del.onclick = async () => {
        if (!armed) { armed = true; del.textContent = 'Tap again to delete'; del.classList.add('armed'); return; }
        del.disabled = true;
        try { await col('messages').doc(m.id).delete(); }
        catch { del.disabled = false; toast("Couldn't delete the message. Try again."); }
      };
      row.append(del);
    }
    if (!mine && m.kind === 'text') {
      if (m.reportedBy.includes(me.uid)) row.append(el('span', { class: 'msgnote', text: 'You reported this' }));
      else {
        const rep = el('button', { class: 'msgbtn', type: 'button', text: 'Report' });
        rep.onclick = async () => {
          rep.disabled = true;
          try {
            await col('messages').doc(m.id).update({ reportedBy: firebase.firestore.FieldValue.arrayUnion(me.uid) });
            toast('Reported. The project owner can see it and remove it.');
          } catch { rep.disabled = false; toast("Couldn't report the message. Try again."); }
        };
        row.append(rep);
      }
    }
    return row.childNodes.length ? row : null;
  }

  function postMessage(extra) {
    return col('messages').add({
      uid: me.uid, name: me.displayName || null, photo: me.photoURL || '', createdAt: now(), expireAt: expiry(), ...extra,
    });
  }

  // Reading what people paste: an address, a postal code, a place name, coordinates, or a Google Maps
  // link (or the whole message Google Maps writes when you tap Share: name, address and link).
  const decodePart = s => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return s.replace(/\+/g, ' '); } };
  function parseInput(text) {
    const s = text.trim();
    const urls = s.match(/https?:\/\/\S+/gi) || [];
    const coordRe = /(-?\d{1,2}\.\d{3,})\s*[,\s]\s*(-?\d{2,3}\.\d{3,})/;
    let lat = null, lng = null, source = 'coords', m;
    if ((m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/))) { lat = +m[1]; lng = +m[2]; source = 'link'; }            // the place itself
    else if ((m = s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i))) { lat = +m[1]; lng = +m[2]; source = 'link'; }
    else if ((m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/))) { lat = +m[1]; lng = +m[2]; source = 'link'; }            // map centre
    else if ((m = s.match(coordRe))) { lat = +m[1]; lng = +m[2]; }

    // Name and address written inside a long Google Maps link: /maps/place/Name,+Address/…
    // or ?q=Name,+Address, or /maps/search/Name.
    let name = '', address = '';
    const pm = s.match(/\/maps\/place\/([^/@?]+)/) || s.match(/\/maps\/search\/([^/@?]+)/)
      || s.match(/google\.[a-z.]+\/maps\S*?[?&](?:q|query)=([^&\s]+)/i);
    if (pm) {
      const full = decodePart(pm[1]).trim();
      if (!coordRe.test(full)) {
        const bits = full.split(',').map(x => x.trim()).filter(Boolean);
        if (/^\d/.test(bits[0] || '')) address = full;       // it's just an address
        else { name = bits[0] || ''; address = bits.slice(1).join(', '); }
      }
    }
    // Words around the link: Google's Share message puts the name first, then the address.
    const rest = s.replace(/https?:\/\/\S+/g, ' ').replace(coordRe, ' ').replace(/[ \t]+/g, ' ').trim();
    const lines = rest.split(/\n+/).map(x => x.trim().replace(/^[,\s]+|[,\s]+$/g, '')).filter(Boolean);

    if (lat != null && isFinite(lat) && isFinite(lng)) {
      if (!name && lines[0] && lines[0].length <= 80) name = lines[0].split(',')[0].trim();
      if (!address && lines.length > 1) address = lines.slice(1).join(', ');
      return { kind: inSingapore(lat, lng) ? 'exact' : 'outside', lat, lng, name: str(name, 80), address: str(address, 160), source };
    }
    const fromLink = urls.length > 0;
    const query = [name, address].filter(Boolean).join(', ') || lines.join(', ');
    // The name to suggest: from the link, or the first line when the message has a name above an address.
    const hint = name || (lines.length > 1 && !/^\d/.test(lines[0]) ? lines[0] : '')
      || (fromLink && lines[0] && !/^\d/.test(lines[0]) ? lines[0].split(',')[0] : '');
    if (query) return { kind: fromLink ? 'linktext' : 'text', query, hint: str(hint, 80) };
    if (urls.some(u => /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|share\.google)/i.test(u))) return { kind: 'short' };
    if (fromLink) return { kind: 'link' };
    return { kind: 'text', query: s, hint: '' };
  }

  // ---------- place and address search ----------
  // Addresses and postal codes: OneMap (Singapore Land Authority, free, no key) knows every building.
  // Place names: OpenStreetMap's Nominatim. Only called when someone sends a place, a link or an address.
  const ICON_BY_TYPE = {
    cafe: '☕', restaurant: '🍜', fast_food: '🍜', food_court: '🍜', bar: '🍸', pub: '🍸', nightclub: '🍸',
    museum: '🏛️', gallery: '🏛️', attraction: '🎡', theme_park: '🎢', zoo: '🦒', aquarium: '🦒',
    park: '🌳', garden: '🌳', nature_reserve: '🌳', beach: '🏖️', hotel: '🏨', place_of_worship: '🛕',
    mall: '🛍️', marketplace: '🛍️', department_store: '🛍️', viewpoint: '🌅',
  };
  const titleCase = s => String(s || '').toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const sgAddress = (line1, building, postal) => [line1, building, postal ? `Singapore ${postal}` : ''].filter(Boolean).join(', ');
  const postalOf = q => (String(q).match(/(?:^|\D)(\d{6})(?!\d)/) || [])[1] || '';
  // "1000 ECP, #01-05 Marine Cove, Singapore 449876" → "1000 East Coast Parkway, Marine Cove"
  const SG_ABBR = [[/\bECP\b/gi, 'East Coast Parkway'], [/\bAve\b\.?/gi, 'Avenue'], [/\bRd\b\.?/gi, 'Road'], [/\bSt\b\.?/gi, 'Street'],
    [/\bDr\b\.?/gi, 'Drive'], [/\bPl\b\.?/gi, 'Place'], [/\bCres\b\.?/gi, 'Crescent'], [/\bBlvd\b\.?/gi, 'Boulevard'], [/\bCtr\b\.?/gi, 'Centre'],
    [/\bPk\b\.?/gi, 'Park'], [/\bUpp\b\.?/gi, 'Upper'], [/\bNth\b\.?/gi, 'North'], [/\bSth\b\.?/gi, 'South'], [/\bJln\b\.?/gi, 'Jalan'],
    [/\bLor\b\.?/gi, 'Lorong'], [/\bBt\b\.?/gi, 'Bukit'], [/\bTg\b\.?/gi, 'Tanjong'], [/\bKg\b\.?/gi, 'Kampong'], [/\bPkwy\b\.?/gi, 'Parkway'],
    [/\bBlk\b\.?\s*/gi, '']];
  function cleanAddress(q) {
    let s = String(q)
      .replace(/#\s*[\dA-Z]{1,3}\s*-\s*[\dA-Z]{1,5}/gi, ' ')     // unit numbers like #01-05
      .replace(/\b(?:Singapore|S'?pore|SG)\s*\d{6}\b/gi, ' ')     // "Singapore 449876"
      .replace(/\b\d{6}\b/g, ' ')
      .replace(/\bSingapore\b/gi, ' ');
    for (const [re, full] of SG_ABBR) s = s.replace(re, full);
    return s.split(',').map(x => x.replace(/\s+/g, ' ').trim()).filter(x => x.length > 1).join(', ');
  }

  async function oneMapSearch(q) {
    const url = 'https://www.onemap.gov.sg/api/common/elastic/search?' + new URLSearchParams({ searchVal: q, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: '1' });
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('onemap ' + r.status);
    const j = await r.json();
    const nil = v => (!v || v === 'NIL' ? '' : String(v));
    return (j.results || []).map(x => {
      const lat = Number(x.LATITUDE), lng = Number(x.LONGITUDE);
      if (!isFinite(lat) || !isFinite(lng) || !inSingapore(lat, lng)) return null;
      const building = titleCase(nil(x.BUILDING));
      const line1 = titleCase([nil(x.BLK_NO), nil(x.ROAD_NAME)].filter(Boolean).join(' '));
      return {
        name: str(building || titleCase(nil(x.SEARCHVAL)) || line1, 80), lat, lng, area: '', icon: '📍',
        address: str(sgAddress(line1, building, nil(x.POSTAL)), 160),
      };
    }).filter(Boolean);
  }
  function fromOsm(x) {
    const lat = Number(x.lat), lng = Number(x.lon);
    if (!isFinite(lat) || !isFinite(lng) || !inSingapore(lat, lng)) return null;
    const a = x.address || {};
    const line1 = [a.house_number, a.road].filter(Boolean).join(' ');
    const name = str(x.name || String(x.display_name || '').split(',')[0], 80);
    const shortName = String(x.display_name || '').split(',').map(v => v.trim()).filter(v => v && v !== 'Singapore').slice(0, 4).join(', ');
    return {
      name, lat, lng,
      area: str(a.suburb || a.neighbourhood || a.quarter || a.city_district || '', 60),
      icon: ICON_BY_TYPE[x.type] || '📍',
      address: str(line1 ? sgAddress(line1, a.building && a.building !== name ? a.building : '', a.postcode) : shortName, 160),
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

  // The area a spot is in, for a place's "Area": first a park, beach, island or attraction the pin
  // is inside (e.g. East Coast Park, Sentosa), then its neighbourhood, then the town (e.g. Bedok).
  // From OpenStreetMap's list of areas containing the spot; falls back to Nominatim's suburb.
  const LANDMARK = {
    leisure: ['park', 'nature_reserve', 'garden', 'beach_resort', 'marina', 'sports_centre', 'stadium', 'golf_course', 'water_park'],
    tourism: ['attraction', 'theme_park', 'zoo', 'aquarium', 'resort'],
    natural: ['beach', 'wood'], place: ['island', 'islet'], amenity: ['university', 'college'],
    landuse: ['recreation_ground'],
  };
  const NEIGHBOURHOOD = ['neighbourhood', 'quarter', 'suburb', 'village', 'town'];
  const TOO_BIG = /^Singapore$|Region$|District$|Council$|Constituency$|GRC$|SMC$/i;
  function areaTier(t) {
    if (Object.entries(LANDMARK).some(([k, vals]) => vals.includes(t[k]))) return 0;
    if (NEIGHBOURHOOD.includes(t.place)) return 1;
    if (t.boundary === 'administrative' && Number(t.admin_level) >= 5) return 2;
    return -1;
  }
  async function areaAt(lat, lng, placeName) {
    try {
      const els = await overpass(`[out:json][timeout:10];is_in(${lat},${lng})->.a;area.a[name];out tags;`);
      const skip = String(placeName || '').trim().toLowerCase();
      const best = els.map(e => e.tags || {})
        .map(t => ({ t, name: str(t['name:en'] || t.name, 60), tier: areaTier(t) }))
        .filter(a => a.tier >= 0 && a.name && !TOO_BIG.test(a.name) && a.name.toLowerCase() !== skip && !a.t.building && !a.t.shop)
        .sort((a, b) => a.tier - b.tier || Number(b.t.admin_level || 0) - Number(a.t.admin_level || 0))[0];
      if (best) return best.name;
    } catch { /* fall back to Nominatim */ }
    try { const x = await osmReverse(lat, lng); return x ? x.area : ''; } catch { return ''; }
  }

  // Addresses: the postal code first, then the whole address, then each part of it (e.g. the building
  // name), on OneMap, then OpenStreetMap. Place names: OpenStreetMap first, then OneMap.
  // Stops at the first search that finds something.
  async function findPlaces(q) {
    const postal = postalOf(q), cleaned = cleanAddress(q);
    const parts = cleaned.split(', ').filter(x => x.length > 2);
    const viaOneMap = async () => {
      for (const t of [...new Set([postal, cleaned, ...parts].filter(Boolean))].slice(0, 5)) {
        let found = [];
        try { found = await oneMapSearch(t); } catch { return []; } // OneMap is down: use OpenStreetMap
        if (found.length) return found;
      }
      return [];
    };
    const viaOsm = async () => {
      for (const t of [...new Set([q.trim(), cleaned, ...parts].filter(Boolean))].slice(0, 3)) {
        const found = await osmSearch(t);
        if (found.length) return found;
      }
      return [];
    };
    const order = looksLikeAddress(q) ? [viaOneMap, viaOsm] : [viaOsm, viaOneMap];
    for (const run of order) {
      let found = [];
      try { found = await run(); } catch { /* try the other one */ }
      if (found.length) return { results: dedupe(found).slice(0, 8) };
    }
    return { results: [] };
  }
  function dedupe(list) {
    const seen = new Set();
    return list.filter(r => { const k = `${r.name.toLowerCase()}|${r.lat.toFixed(4)}|${r.lng.toFixed(4)}`; if (seen.has(k)) return false; seen.add(k); return true; });
  }

  // An address (Singapore postal code, or "1 Stadium Pl") can hold a whole mall, so for addresses
  // we also list every named place around that spot, from OpenStreetMap.
  const looksLikeAddress = q => !!postalOf(q) || /^\s*(blk\s*)?\d+[a-z]?\s+[a-z]/i.test(q);
  const SKIP_AMENITY = new Set(['parking', 'parking_entrance', 'parking_space', 'motorcycle_parking', 'bicycle_parking', 'toilets', 'atm',
    'bench', 'waste_basket', 'waste_disposal', 'recycling', 'vending_machine', 'telephone', 'post_box', 'shelter', 'taxi',
    'charging_station', 'drinking_water', 'loading_dock', 'smoking_area']);
  const KIND_KEYS = ['shop', 'amenity', 'leisure', 'tourism', 'sport', 'office', 'craft', 'building'];
  const kindOf = tags => {
    const k = KIND_KEYS.find(key => tags[key]);
    if (!k) return '';
    const v = tags[k] === 'yes' ? k : tags[k];
    return v.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  };
  async function placesAt(lat, lng, baseAddress) {
    const els = await overpass(`[out:json][timeout:15];
      nwr(around:70,${lat},${lng})["name"][~"^(shop|amenity|leisure|tourism|sport|office|craft|building)$"~"."];
      out center tags 60;`);
    const seen = new Set(), list = [];
    for (const e of els) {
      const t = e.tags || {}, name = str(t['name:en'] || t.name, 80);
      const la = e.lat != null ? e.lat : e.center && e.center.lat, ln = e.lon != null ? e.lon : e.center && e.center.lon;
      if (!name || la == null || SKIP_AMENITY.has(t.amenity) || t.highway || t.railway || t.public_transport) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const type = t.shop || t.amenity || t.leisure || t.tourism || '';
      const big = t.shop === 'mall' || (t.building && !t.shop && !t.amenity && !t.leisure) ? 0 : 1; // the building or mall first
      const unit = t['addr:unit'] ? `#${t['addr:unit']}` : '';
      const line1 = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
      const address = line1 ? sgAddress([line1, unit].filter(Boolean).join(' '), '', t['addr:postcode']) : [unit, baseAddress].filter(Boolean).join(', ');
      list.push({ name, lat: +la, lng: +ln, icon: ICON_BY_TYPE[type] || '📍', big, address: str(address, 160), sub: [kindOf(t), unit].filter(Boolean).join(' · ') });
    }
    return list.sort((a, b) => a.big - b.big || a.name.localeCompare(b.name));
  }

  // The helper box above the message box. Only the person who sent the message sees it.
  function assist(...kids) { const a = $('#assist'); a.replaceChildren(...kids); a.hidden = !kids.length; }
  function closeBtn(label) { const b = el('button', { class: 'ghost', type: 'button', text: label || 'OK' }); b.onclick = () => assist(); return b; }

  function offerSearch(q, intro, hint) {
    const go = el('button', { class: 'primary', type: 'button', text: 'Find it on the map' });
    go.onclick = () => runSearch(q, hint);
    assist(el('p', { text: intro }), el('div', { class: 'row2' }, go, closeBtn('No thanks')));
  }
  let searchSeq = 0;
  async function runSearch(q, hint) {
    const seq = ++searchSeq;
    assist(el('p', {}, el('span', { class: 'spin', 'aria-hidden': 'true' }), ` Looking up "${str(q, 60)}"…`));
    try {
      const { results } = await findPlaces(q);
      if (seq !== searchSeq) return;
      if (!results.length) {
        assist(el('p', { text: "Couldn't find that in Singapore. Try the postal code, the building's name, or the block number and street." }),
          el('div', { class: 'row2' }, closeBtn()));
        return;
      }
      // A name from a Google Maps link that the search didn't return (e.g. a shop inside a mall): offer it first.
      if (hint && !results.some(r => r.name.toLowerCase() === hint.toLowerCase())) {
        results.unshift({ ...results[0], name: hint, icon: '📍', sub: results[0].address, fromHint: true });
      }
      const resultList = items => {
        const list = el('ul', { class: 'results' });
        for (const r of items) {
          const b = el('button', { type: 'button' }, el('span', { 'aria-hidden': 'true', text: r.icon }),
            el('span', {}, el('b', { text: r.name }), el('small', { text: r.sub || r.address })));
          b.onclick = () => {
            assist();
            startAdd({ name: r.name, lat: r.lat, lng: r.lng, icon: r.icon, area: r.area || results[0].area || '', address: r.address || '', source: 'search' });
          };
          list.append(el('li', {}, b));
        }
        return list;
      };
      const more = looksLikeAddress(q) || hint ? el('div', { class: 'atplace' },
        el('p', { class: 'small' }, el('span', { class: 'spin', 'aria-hidden': 'true' }), ' Looking for other places at this address…')) : null;
      assist(el('p', { text: results.length > 1 ? 'Which one is it?' : 'Is this it?' }), resultList(results), more, el('div', { class: 'row2' }, closeBtn('None of these')));
      if (more) {
        const top = results[0];
        placesAt(top.lat, top.lng, top.address).then(found => {
          if (seq !== searchSeq || !more.isConnected) return;
          const shown = new Set(results.map(r => r.name.toLowerCase()));
          const extra = found.filter(r => !shown.has(r.name.toLowerCase())).slice(0, 30);
          more.replaceChildren(...(extra.length
            ? [el('p', { class: 'eyebrow', text: `Also at this address (${extra.length})` }), resultList(extra)]
            : [el('p', { class: 'small', text: 'No other places found at this address.' })]));
        }).catch(() => { if (more.isConnected) more.replaceChildren(el('p', { class: 'small', text: "Couldn't look up other places at this address." })); });
      }
    } catch {
      assist(el('p', { text: "Search isn't working right now. Try again in a minute." }), el('div', { class: 'row2' }, closeBtn()));
    }
  }

  // The message box grows with what's typed, up to a few lines.
  const growInput = () => { const i = $('#cInput'); i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight + 2, 132) + 'px'; };
  $('#cInput').addEventListener('input', growInput);
  $('#cInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && settings.enterToSend) { e.preventDefault(); $('#composer').requestSubmit(); }
  });
  $('#composer').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('#cInput'), text = input.value.trim();
    if (!text || !db || !me || !projectId) return;
    const send = $('#cSend');
    send.disabled = true;
    try { await postMessage({ kind: 'text', text: str(text, 1000) }); }
    catch { send.disabled = false; toast("Your message didn't send. Try again."); return; }
    input.value = ''; growInput(); send.disabled = false;

    const r = parseInput(text);
    if (r.kind === 'exact') {
      assist();
      startAdd({ lat: r.lat, lng: r.lng, name: r.name, address: r.address, source: r.source });
      if (!r.name || !r.address) {
        // Look up what's at that spot to fill in the name and address.
        osmReverse(r.lat, r.lng).then(x => {
          if (!x || !adding) return;
          const nm = $('#fName'), ad = $('#fAddr'); // the Area fills in from the pin by itself
          if (nm && !nm.value.trim()) nm.value = x.name;
          if (ad && !ad.value.trim()) ad.value = x.address;
          if (formIcon === '📍' && x.icon !== '📍') setIcon(x.icon);
        }).catch(() => {});
      }
    } else if (r.kind === 'outside') {
      assist(el('p', { text: "That spot is outside Singapore, so it can't go on this map." }), el('div', { class: 'row2' }, closeBtn()));
    } else if (r.kind === 'linktext') {
      runSearch(r.query, r.hint); // a Google Maps link with a name or address: look it up straight away
    } else if (r.kind === 'short') {
      assist(el('p', { text: "This short link doesn't say which place it is. In Google Maps, tap Share, then Copy, and paste the whole message: it includes the place's name and address. Or paste the address." }),
        el('div', { class: 'row2' }, closeBtn()));
    } else if (r.kind === 'link') {
      // any other link: nothing to look up
    } else if (looksLikeAddress(r.query)) {
      runSearch(r.query, r.hint); // an address or postal code: look it up straight away
    } else {
      offerSearch(r.query, `Is "${str(r.query, 50)}" a place you want to suggest?`, r.hint);
    }
  });

  // ---------- itinerary ----------
  // Each stop: where and when, plus two ways to meet up: by car/motorbike (usually at the place
  // itself) or by public transport (usually at the nearest MRT station, a bit earlier to walk over).
  const hhmm = v => (/^\d{2}:\d{2}$/.test(v || '') ? v : '');
  const ymd = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
  function cleanStop(doc) {
    const x = doc.data() || {};
    return {
      id: doc.id, title: str(x.title, 80) || 'Untitled stop', icon: str(x.icon, 2) || '📍',
      placeId: typeof x.placeId === 'string' ? x.placeId : null,
      date: ymd(x.date), time: hhmm(x.time),
      carWhere: str(x.carWhere, 80), carTime: hhmm(x.carTime),
      ptWhere: str(x.ptWhere, 80), ptTime: hhmm(x.ptTime),
      notes: str(x.notes, 300),
    };
  }
  const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  const fmtDate = d => { if (!d) return 'Date to be decided'; const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };
  const minusMinutes = (t, n) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const total = (h * 60 + m - n + 1440) % 1440; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };
  // The closest MRT station to a spot, and how far it is in a straight line (metres).
  function nearestStationInfo(lat, lng) {
    let best = null, bestD = Infinity;
    for (const s of mrtStations) {
      if (s.lrtOnly) continue;
      const dx = (s.lng - lng) * Math.cos(lat * Math.PI / 180), dy = s.lat - lat, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = s; }
    }
    return best ? { name: `${best.name} MRT`, m: Math.round(Math.sqrt(bestD) * 111320) } : null;
  }
  function nearestStation(lat, lng) { const s = nearestStationInfo(lat, lng); return s ? s.name : ''; }
  // For a place's "Nearest MRT": e.g. "Stadium MRT (~350 m)".
  function nearestMrtText(lat, lng) {
    const s = nearestStationInfo(lat, lng);
    if (!s) return '';
    const dist = s.m < 1000 ? `~${Math.max(50, Math.round(s.m / 50) * 50)} m` : `~${(s.m / 1000).toFixed(1)} km`;
    return str(`${s.name} (${dist})`, 60);
  }
  const sortStops = list => [...list].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99').localeCompare(b.time || '99') || a.title.localeCompare(b.title));

  // Yes votes needed before a place can be confirmed: more than half the people in the project.
  function votesNeeded() {
    const p = currentProject();
    return Math.floor(((p && p.members.length) || 1) / 2) + 1;
  }
  // ---------- ending, reopening and confirming votes ----------
  // A place confirmed into the itinerary uses the stop id "p_<place id>", so however many people's
  // apps confirm it at once (or it's confirmed again later), there's only ever one such stop.
  const stopIdFor = p => 'p_' + p.id;
  // A voting deadline this many minutes from now (none for 0). Each place has its own.
  const deadlineIn = mins => (mins > 0 ? Date.now() + mins * 60000 : null);
  // A new itinerary stop for a place that's in: today if it's a trip day (else the first day),
  // at the nearest whole hour to now, meeting at the nearest MRT 15 minutes earlier.
  // Everyone can change these afterwards.
  const nearestHour = (d = new Date()) => `${String((d.getHours() + (d.getMinutes() >= 30 ? 1 : 0)) % 24).padStart(2, '0')}:00`;
  function newStopFor(p, endedAt) {
    const days = tripDays(currentProject());
    const t = new Date(endedAt || Date.now()), today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const time = nearestHour(t);
    return {
      title: p.name, icon: p.icon, placeId: p.id, date: days.includes(today) ? today : days[0] || '', time,
      ptWhere: nearestStation(p.lat, p.lng), ptTime: minusMinutes(time, 15), carWhere: '', carTime: '', notes: '',
      createdBy: me.uid, createdAt: now(), updatedAt: now(), expireAt: expiry(),
    };
  }

  // End voting on a place and act on the result, all in one step so two people's apps can't
  // both do it: "in" (Yes ahead of No) adds it to the itinerary, "out" takes it off.
  // how: 'manual' (End voting now), 'deadline' (time ran out), 'allvoted' (everyone voted)
  // or 'confirm' (confirmed by hand, always "in").
  // Returns the result, or null if someone else had already ended it.
  async function concludeVoting(p, how) {
    const placeRef = col('places').doc(p.id);
    const stopRef = col('itinerary').doc(stopIdFor(p));
    const t = tally(p.id);
    const addedByHand = itinerary.some(s => s.placeId === p.id && s.id !== stopIdFor(p)); // don't add it twice
    let outcomeNow = null, addedStop = false;
    await db.runTransaction(async tx => {
      const snap = await tx.get(placeRef);
      const stopSnap = await tx.get(stopRef);
      if (!snap.exists) return;
      const cur = cleanPlace(snap);
      const alreadyClosed = cur.status === 'closed';
      if (alreadyClosed && how !== 'confirm') return; // someone else just ended it
      const result = how === 'confirm' ? 'in' : (t.yes.length > t.no.length ? 'in' : 'out');
      // When time ran out, it ended at the deadline, even if nobody had the app open right then.
      const endedAt = how === 'deadline' && cur.voteEndsAt ? Math.min(cur.voteEndsAt, Date.now()) : Date.now();
      if (!alreadyClosed) {
        const entry = { round: cur.round, result, yes: t.yes.length, no: t.no.length, at: endedAt, how };
        tx.update(placeRef, { status: 'closed', result, closedAt: endedAt, history: [...cur.history, entry].slice(-10), updatedAt: now() });
      } else if (cur.result !== 'in') {
        tx.update(placeRef, { result: 'in', updatedAt: now() });
      }
      if (result === 'in' && !stopSnap.exists && !addedByHand) { tx.set(stopRef, newStopFor(cur, endedAt)); addedStop = true; }
      if (result === 'out' && stopSnap.exists) tx.delete(stopRef);
      outcomeNow = result;
    });
    if (addedStop) postMessage({ kind: 'confirmed', placeId: p.id, placeName: p.name, placeIcon: p.icon }).catch(() => {});
    return outcomeNow;
  }

  // Confirm a place by hand (with or without enough votes): ends voting as "going", adds it to
  // the itinerary, then opens the stop so someone can set the time and where to meet.
  async function confirmPlace(p) {
    await concludeVoting(p, 'confirm');
    const stop = itinerary.find(s => s.id === stopIdFor(p));
    openItinForm({ id: stopIdFor(p), fresh: !stop || !stop.time, pre: stop || newStopFor(p) });
    toast(`${p.name} is in the itinerary. Set the time and where to meet.`);
  }

  // Reopen voting: a new round where everyone votes again. Earlier results stay in the history.
  async function reopenVoting(p, mins) {
    await col('places').doc(p.id).update({
      status: 'open', result: null, round: p.round + 1, voteEndsAt: deadlineIn(mins), updatedAt: now(),
    });
  }

  // Set, change or clear the voting time limit on one place while its voting is open.
  async function setVoteLimit(p, mins) {
    await col('places').doc(p.id).update({ voteEndsAt: deadlineIn(mins), updatedAt: now() });
  }

  // Take a place out of the itinerary (every stop for it), even if it was voted in.
  async function removeFromItinerary(p) {
    const batch = db.batch();
    for (const s of itinerary.filter(x => x.placeId === p.id)) batch.delete(col('itinerary').doc(s.id));
    await batch.commit();
  }

  // Rename a place, and any itinerary stop for it that still has the old name.
  async function renamePlace(p, name) {
    const batch = db.batch();
    batch.update(col('places').doc(p.id), { name: str(name, 80), updatedAt: now() });
    for (const s of itinerary.filter(x => x.placeId === p.id && x.title === p.name)) {
      batch.update(col('itinerary').doc(s.id), { title: str(name, 80), updatedAt: now() });
    }
    await batch.commit();
  }

  // True once everyone in the project has voted Yes or No in this place's current round.
  function everyoneVoted(p) {
    const proj = currentProject();
    if (!proj || !proj.memberIds.length) return false;
    const key = voteKey(p);
    return proj.memberIds.every(uid => { const v = ((ballots[uid] || {}).votes || {})[key]; return v === 'yes' || v === 'no'; });
  }
  // Voting ends by itself when its deadline passes or when everyone has voted; whoever has the
  // project open saves it. Only once everyone's votes have loaded, so the result counts every vote.
  const concluding = new Set();
  function checkDeadlines() {
    if (!projectId || !me || !votesLoaded) return;
    for (const p of places) {
      if (p.status === 'closed' || concluding.has(p.id)) continue;
      const how = deadlinePassed(p) ? 'deadline' : everyoneVoted(p) ? 'allvoted' : null;
      if (!how) continue;
      concluding.add(p.id);
      concludeVoting(p, how).then(r => {
        if (how !== 'allvoted' || !r) return;
        const stop = r === 'in' && itinerary.find(s => s.id === stopIdFor(p));
        toast(r === 'in'
          ? `Everyone voted: ${p.name} is going. It's in the itinerary${stop && stop.time ? ` at ${fmtTime(stop.time)}` : ''}.`
          : `Everyone voted: ${p.name} is not going.`);
      }).catch(() => {}).finally(() => concluding.delete(p.id));
    }
  }
  // Every 30 seconds: close any voting whose time is up, and refresh the countdowns.
  setInterval(() => {
    if (!projectId) return;
    checkDeadlines();
    if (places.some(p => p.voteEndsAt && p.status !== 'closed')) { renderPins(); renderRows(); if (!(adding && draft) && !renamingPlace && !editingLimit && !detailHold) renderDetail(); }
  }, 30000);

  // Time helpers for voting deadlines.
  function timeLeft(ms) {
    const mins = Math.max(1, Math.ceil((ms - Date.now()) / 60000));
    if (mins >= 1440) { const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60); return `${d} d${h ? ` ${h} h` : ''}`; }
    if (mins >= 60) { const h = Math.floor(mins / 60), m = mins % 60; return `${h} h${m ? ` ${m} min` : ''}`; }
    return `${mins} min`;
  }
  function fmtWhen(ms) {
    const d = new Date(ms), today = new Date();
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return d.toDateString() === today.toDateString() ? t : `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${t}`;
  }
  const VOTE_LIMITS = [[0, 'No time limit'], [30, '30 minutes'], [60, '1 hour'], [120, '2 hours'], [360, '6 hours'], [720, '12 hours'], [1440, '24 hours'], [4320, '3 days']];
  const fmtLimit = mins => (VOTE_LIMITS.find(([m]) => m === mins) || [0, `${mins} minutes`])[1];
  function limitSelect(id, value) {
    const sel = el('select', { id, class: 'limitsel', 'aria-label': 'Voting time limit' },
      ...VOTE_LIMITS.map(([m, label]) => el('option', { value: String(m), text: m ? `Vote within ${label}` : label })));
    sel.value = String(value);
    return sel;
  }

  let itinForm = null; // null, or { id: stop id or null for a new one, pre: starting values }
  function renderItinerary() {
    const box = $('#itinList');
    box.replaceChildren();
    // Trip dates at the top; ask for them if they aren't set yet.
    const proj = currentProject();
    if (proj) {
      const setDates = el('button', { class: 'linkbtn', type: 'button', text: proj.startDate ? 'Change' : 'Set trip dates' });
      setDates.onclick = () => { editingDates = true; showTab('project'); renderProjectCard(); };
      box.append(el('p', { class: proj.startDate ? 'tripline' : 'tripline missing' },
        el('span', { text: proj.startDate ? `🗓 ${fmtTrip(proj)}` : '🗓 Set your trip dates so every stop lands on the right day.' }), ' ', setDates));
    }
    if (!itinerary.length && !itinForm) box.append(el('p', { class: 'empty', text: 'Nothing planned yet. Once the group votes Yes on a place, open it and tap Confirm location, or add a stop yourself.' }));
    let lastDate = null;
    for (const s of sortStops(itinerary)) {
      if (itinForm && itinForm.id === s.id) continue; // being edited below
      if (s.date !== lastDate) { box.append(el('h4', { class: 'itinday', text: fmtDate(s.date) })); lastDate = s.date; }
      const onMap = s.placeId && places.some(p => p.id === s.placeId);
      const name = onMap ? el('button', { class: 'linkbtn itinplace', type: 'button', text: s.title }) : el('span', { class: 'itinplace', text: s.title });
      if (onMap) name.onclick = () => select(s.placeId, true);
      const meet = el('div', { class: 'meet' });
      if (s.ptWhere || s.ptTime) meet.append(el('p', {}, el('span', { class: 'mode', 'aria-hidden': 'true', text: '🚆' }),
        el('span', {}, el('b', { text: 'Public transport: ' }), `meet at ${s.ptWhere || 'the MRT station'}${s.ptTime ? ` by ${fmtTime(s.ptTime)}` : ' (time to be set)'}`)));
      if (s.carWhere || s.carTime) meet.append(el('p', {}, el('span', { class: 'mode', 'aria-hidden': 'true', text: '🚗' }),
        el('span', {}, el('b', { text: 'Car or motorbike: ' }), `meet at ${s.carWhere || s.title}${s.carTime ? ` by ${fmtTime(s.carTime)}` : ''}`)));
      const edit = el('button', { class: 'msgbtn', type: 'button', text: 'Edit' });
      edit.onclick = () => openItinForm({ id: s.id, pre: s });
      const del = el('button', { class: 'msgbtn', type: 'button', text: 'Delete' });
      let armed = false;
      del.onclick = async () => {
        if (!armed) { armed = true; del.textContent = 'Tap again to delete'; del.classList.add('armed'); return; }
        del.disabled = true;
        try { await col('itinerary').doc(s.id).delete(); } catch { del.disabled = false; toast("Couldn't delete the stop. Try again."); }
      };
      box.append(el('div', { class: 'stop' },
        el('div', { class: 'stoptime', text: s.time ? fmtTime(s.time) : '—' }),
        el('div', { class: 'stopbody' },
          el('div', { class: 'stophead' }, el('span', { class: 'stopicon', 'aria-hidden': 'true', text: s.icon }), name),
          meet.childNodes.length ? meet : null,
          s.notes ? el('p', { class: 'stopnotes', text: s.notes }) : null,
          el('div', { class: 'msgacts' }, edit, del))));
    }
    $('#itinAddBtn').hidden = !!itinForm;
  }

  // Add or edit a stop. pre can hold a placeId (from "Add to itinerary" on a place) or a whole stop.
  // The date follows the trip dates: fixed for a one-day trip, a list of trip days otherwise.
  // Public transport is the default way to meet; car or motorbike is an extra, ticked option.
  function openItinForm(opts) {
    itinForm = opts;
    const pre = opts.pre || {};
    const proj = currentProject();
    const days = tripDays(proj);
    const place = pre.placeId ? places.find(p => p.id === pre.placeId) : null;
    const box = $('#itinFormBox');
    box.replaceChildren();
    const f = (id, attrs = {}) => el('input', { id, ...attrs });

    const placeSel = el('select', { id: 'itPlace', 'aria-label': 'Place' },
      el('option', { value: '', text: 'Somewhere else (type below)' }),
      ...places.map(p => el('option', { value: p.id, text: `${p.icon} ${p.name}` })));
    placeSel.value = place ? place.id : '';

    // Date: fixed for one-day trips, a list of trip days for longer ones, a date picker if no dates are set.
    let dateCtl;
    if (days.length === 1) {
      dateCtl = el('div', {}, el('span', { class: 'fieldlabel', text: 'Date' }), el('p', { class: 'fixeddate', text: fmtDate(days[0]) }), f('itDate', { type: 'hidden', value: days[0] }));
    } else if (days.length > 1) {
      const sel = el('select', { id: 'itDate' }, el('option', { value: '', text: 'Not decided yet' }),
        ...days.map((d, i) => el('option', { value: d, text: `Day ${i + 1}: ${fmtDate(d)}` })));
      sel.value = days.includes(pre.date) ? pre.date : (opts.id ? '' : days[0]);
      dateCtl = el('div', {}, el('label', { for: 'itDate', text: 'Date' }), sel);
    } else {
      dateCtl = el('div', {}, el('label', { for: 'itDate', text: 'Date' }), f('itDate', { type: 'date' }));
    }

    // Ways to meet: public transport, car or motorbike, both, or neither. Public transport is
    // ticked for new stops, since most people in Singapore take the MRT.
    const hasPt = opts.id ? !!(pre.ptWhere || pre.ptTime) : true;
    const ptTick = f('itHasPt', { type: 'checkbox' });
    ptTick.checked = hasPt;
    const ptFields = el('div', { id: 'itPtFields' },
      el('div', { class: 'formrow' },
        el('div', {}, el('label', { for: 'itPtWhere', text: 'Meet at' }), f('itPtWhere', { maxlength: '80', placeholder: 'e.g. Bugis MRT', list: 'itStations' })),
        el('div', {}, el('label', { for: 'itPtTime', text: 'By' }), f('itPtTime', { type: 'time' }))),
      el('datalist', { id: 'itStations' }, ...mrtStations.filter(s => !s.lrtOnly).map(s => el('option', { value: `${s.name} MRT` }))),
      el('p', { class: 'small', id: 'itHint' }));
    ptFields.hidden = !hasPt;

    const hasCar = !!(pre.carWhere || pre.carTime);
    const carTick = f('itHasCar', { type: 'checkbox' });
    carTick.checked = hasCar;
    const carFields = el('div', { class: 'formrow', id: 'itCarFields' },
      el('div', {}, el('label', { for: 'itCarWhere', text: 'Meet at' }), f('itCarWhere', { maxlength: '80', placeholder: 'e.g. the restaurant' })),
      el('div', {}, el('label', { for: 'itCarTime', text: 'By' }), f('itCarTime', { type: 'time' })));
    carFields.hidden = !hasCar;

    const form = el('form', { class: 'form itinform' },
      el('h2', { text: opts.id ? 'Edit stop' : 'Add to itinerary' }),
      el('label', { for: 'itPlace', text: 'Place' }), placeSel,
      el('label', { for: 'itTitle', text: 'Name' }), f('itTitle', { maxlength: '80', required: '', placeholder: 'e.g. Dinner at Zam Zam' }),
      el('div', { class: 'formrow' }, dateCtl,
        el('div', {}, el('label', { for: 'itTime', text: 'Time at the place' }), f('itTime', { type: 'time' }))),
      el('p', { class: 'eyebrow', text: 'Where to meet' }),
      el('p', { class: 'small', text: 'Tick one, both, or neither.' }),
      el('label', { class: 'tickrow', for: 'itHasPt' }, ptTick, el('span', { text: '🚆 By public transport' })),
      ptFields,
      el('label', { class: 'tickrow', for: 'itHasCar' }, carTick, el('span', { text: '🚗 By car or motorbike' })),
      carFields,
      el('label', { for: 'itNotes', text: 'Notes (optional)' }), el('textarea', { id: 'itNotes', maxlength: '300', placeholder: 'e.g. Booking under Faz. Bring cash.' }),
      el('p', { class: 'err', id: 'itErr', hidden: '' }),
      el('div', { class: 'factions' }, el('button', { class: 'primary', type: 'submit', text: opts.id ? 'Save' : 'Add' }), el('button', { class: 'ghost', type: 'button', id: 'itCancel', text: 'Cancel' })));
    box.append(form);

    $('#itTitle').value = pre.title || (place ? place.name : '');
    if (!days.length) $('#itDate').value = pre.date || '';
    $('#itTime').value = pre.time || '';
    $('#itPtWhere').value = pre.ptWhere || (place ? nearestStation(place.lat, place.lng) : '');
    $('#itPtTime').value = pre.ptTime || '';
    $('#itCarWhere').value = pre.carWhere || (place ? place.name : '');
    $('#itCarTime').value = pre.carTime || '';
    $('#itNotes').value = pre.notes || '';

    // Suggestions that follow what you pick, without overwriting anything you've typed yourself.
    const touched = new Set(opts.id ? ['itTitle', 'itCarWhere', 'itPtWhere'] : []);
    if (opts.fresh) touched.clear(); // a just-confirmed place: everything is still a suggestion
    for (const id of ['itTitle', 'itCarWhere', 'itPtWhere']) $('#' + id).addEventListener('input', () => touched.add(id));
    const suggest = (id, value) => { if (!touched.has(id)) $('#' + id).value = value; };
    const hint = () => {
      const p = places.find(x => x.id === placeSel.value);
      $('#itHint').textContent = p && $('#itPtWhere').value ? `${$('#itPtWhere').value} is the nearest MRT station to ${p.name}. The suggested meeting time is 15 minutes earlier, to walk over.` : '';
    };
    placeSel.onchange = () => {
      const p = places.find(x => x.id === placeSel.value);
      if (p) { suggest('itTitle', p.name); suggest('itCarWhere', p.name); suggest('itPtWhere', nearestStation(p.lat, p.lng)); }
      hint();
    };
    // Changing the time at the place moves the meeting times with it: 15 minutes earlier at the
    // MRT (to walk over), and the same time for car or motorbike. They can be changed afterwards.
    const followTime = () => { const t = $('#itTime').value; $('#itPtTime').value = minusMinutes(t, 15); $('#itCarTime').value = t; };
    $('#itTime').addEventListener('input', followTime);
    $('#itTime').addEventListener('change', followTime);
    ptTick.onchange = () => {
      ptFields.hidden = !ptTick.checked;
      if (ptTick.checked && !$('#itPtTime').value && $('#itTime').value) $('#itPtTime').value = minusMinutes($('#itTime').value, 15);
    };
    carTick.onchange = () => {
      carFields.hidden = !carTick.checked;
      if (carTick.checked && !$('#itCarTime').value && $('#itTime').value) $('#itCarTime').value = $('#itTime').value;
    };
    hint();

    $('#itCancel').onclick = closeItinForm;
    form.onsubmit = async e => {
      e.preventDefault();
      const title = $('#itTitle').value.trim();
      if (!title) { $('#itErr').textContent = 'Give the stop a name.'; $('#itErr').hidden = false; return; }
      const p = places.find(x => x.id === placeSel.value);
      const car = carTick.checked, pt = ptTick.checked;
      const data = {
        title: str(title, 80), icon: p ? p.icon : (pre.icon || '📍'), placeId: p ? p.id : null,
        date: ymd($('#itDate').value), time: hhmm($('#itTime').value),
        ptWhere: pt ? str($('#itPtWhere').value.trim(), 80) : '', ptTime: pt ? hhmm($('#itPtTime').value) : '',
        carWhere: car ? str($('#itCarWhere').value.trim(), 80) : '', carTime: car ? hhmm($('#itCarTime').value) : '',
        notes: str($('#itNotes').value.trim(), 300), updatedAt: now(), expireAt: expiry(),
      };
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        if (opts.id) await col('itinerary').doc(opts.id).update(data);
        else await col('itinerary').add({ ...data, createdBy: me.uid, createdAt: now() });
        closeItinForm();
        toast(opts.id ? 'Stop updated' : 'Added to the itinerary');
      } catch {
        btn.disabled = false;
        $('#itErr').textContent = "The stop didn't save. Check your connection and try again."; $('#itErr').hidden = false;
      }
    };
    renderItinerary();
    showTab('itin');
    if (narrow()) scrollToEl(box);
    if (opts.fresh) $('#itTime').focus({ preventScroll: true });
    else if (!opts.id && !place) $('#itTitle').focus({ preventScroll: true });
  }
  function closeItinForm() { itinForm = null; $('#itinFormBox').replaceChildren(); renderItinerary(); }
  $('#itinAddBtn').onclick = () => openItinForm({ id: null, pre: {} });

  // Reservations checklist.
  function renderReservations() {
    const list = $('#resList');
    list.replaceChildren();
    if (!reservations.length) { list.append(el('li', { class: 'empty', text: 'No reservations yet.' })); return; }
    for (const r of reservations) {
      const box = el('input', { type: 'checkbox', id: 'res-' + r.id });
      box.checked = r.done;
      box.onchange = async () => {
        box.disabled = true;
        const update = box.checked
          ? { done: true, doneBy: me.uid, doneByName: me.displayName || null }
          : { done: false, doneBy: null, doneByName: null };
        try { await col('reservations').doc(r.id).update(update); }
        catch { box.checked = !box.checked; toast("Couldn't update the checklist. Try again."); }
        finally { box.disabled = false; }
      };
      const del = el('button', { class: 'msgbtn', type: 'button', text: 'Delete', 'aria-label': `Delete ${r.title}` });
      del.onclick = async () => { try { await col('reservations').doc(r.id).delete(); } catch { toast("Couldn't delete it. Try again."); } };
      const who = r.done ? (r.doneBy === (me && me.uid) ? 'Done by you' : `Done by ${r.doneByName || 'someone'}`) : '';
      list.append(el('li', { class: r.done ? 'done' : '' },
        box,
        el('label', { for: 'res-' + r.id }, el('span', { class: 'restitle', text: r.title }), who ? el('span', { class: 'small', text: who }) : null),
        del));
    }
  }
  $('#resForm').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $('#resInput'), title = input.value.trim();
    if (!title || !projectId) return;
    input.value = '';
    try { await col('reservations').add({ title: str(title, 120), done: false, doneBy: null, doneByName: null, createdBy: me.uid, createdAt: now(), expireAt: expiry() }); }
    catch { input.value = title; toast("Couldn't add it. Try again."); }
  });

  // ---------- live data ----------
  function stopListening() {
    for (const u of unsubscribers) u();
    unsubscribers = [];
    places = []; ballots = {}; messages = []; itinerary = []; reservations = []; loaded = false; voteBlocked = false; votesLoaded = false; renamingPlace = null; editingLimit = null;
    itinForm = null; $('#itinFormBox').replaceChildren(); renderItinerary(); renderReservations();
  }
  function onDenied(err) {
    if (err && err.code === 'permission-denied') {
      showGate(`The Google account ${me && me.email ? me.email : ''} isn't on this trip's guest list. Ask the organiser to add it, or sign in with a different account.`, true);
    } else toast('Lost connection to the trip. Reload the page to reconnect.');
  }
  // A project's data stops being readable when you leave it or it's deleted: go back to your projects.
  // Only treat it as "you've left" when your project list agrees (that list updates separately).
  // Otherwise the security rules refused something, usually because the rules in Firebase are
  // older than the app, so say that instead of leaving the project.
  let rulesWarned = false;
  function onDataError(err) {
    if (!(err && err.code === 'permission-denied')) { toast('Lost connection to the trip. Reload the page to reconnect.'); return; }
    if (!projectId) return;
    if (!currentProject()) { closeProject(); toast("You're no longer in that project."); return; }
    if (!rulesWarned) {
      rulesWarned = true;
      toast("Part of this project couldn't load. The Firebase security rules may need updating (see SETUP.md).");
    }
  }
  function startListening() {
    stopListening();
    if (!projectId) return;
    unsubscribers.push(col('places').onSnapshot(snap => {
      places = snap.docs.map(cleanPlace).filter(Boolean);
      loaded = true;
      checkDeadlines();
      renderAll();
    }, onDataError));
    unsubscribers.push(col('votes').onSnapshot(snap => {
      const next = {};
      for (const doc of snap.docs) {
        const x = doc.data() || {};
        const votes = {};
        if (x.votes && typeof x.votes === 'object') for (const k in x.votes) if (x.votes[k] === 'yes' || x.votes[k] === 'no') votes[k] = x.votes[k];
        next[doc.id] = { votes, name: str(x.name, 60), photo: typeof x.photo === 'string' ? x.photo : '' };
      }
      ballots = next;
      votesLoaded = true;
      checkDeadlines();
      renderAll();
    }, onDataError));
    unsubscribers.push(col('messages').orderBy('createdAt', 'desc').limit(200).onSnapshot(snap => {
      messages = snap.docs.map(doc => {
        const x = doc.data({ serverTimestamps: 'estimate' }) || {};
        return {
          id: doc.id, uid: str(x.uid, 128), name: str(x.name, 60), photo: typeof x.photo === 'string' ? x.photo : '',
          createdAt: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now(),
          kind: ['added', 'rename', 'confirmed'].includes(x.kind) ? x.kind : 'text', text: str(x.text, 1000),
          placeId: str(x.placeId, 128), placeName: str(x.placeName, 80), placeIcon: str(x.placeIcon, 2),
          from: str(x.from, 60), to: str(x.to, 60),
          reportedBy: Array.isArray(x.reportedBy) ? x.reportedBy.filter(s => typeof s === 'string') : [],
        };
      }).reverse();
      renderUnread(); renderChat();
    }, onDataError));
    unsubscribers.push(col('itinerary').onSnapshot(snap => {
      itinerary = snap.docs.map(cleanStop);
      renderAll(); // also refreshes the Confirmed labels on places
    }, onDataError));
    unsubscribers.push(col('reservations').orderBy('createdAt').onSnapshot(snap => {
      reservations = snap.docs.map(doc => {
        const x = doc.data({ serverTimestamps: 'estimate' }) || {};
        return { id: doc.id, title: str(x.title, 120), done: x.done === true, doneBy: typeof x.doneBy === 'string' ? x.doneBy : null, doneByName: str(x.doneByName, 60) };
      });
      renderReservations();
    }, onDataError));
  }

  // ---------- projects ----------
  // Invite links always use the Firebase Hosting address (the same site as Firebase's sign-in
  // helper), because Google sign-in on phones fails from other addresses like GitHub Pages.
  const APP_URL = cfg.authDomain ? `https://${cfg.authDomain}/` : `${location.origin}${location.pathname}`;
  const inviteLink = pid => `${APP_URL}?p=${encodeURIComponent(pid)}`;

  function cleanProject(doc) {
    const x = doc.data() || {};
    const memberIds = Array.isArray(x.memberIds) ? x.memberIds.filter(id => typeof id === 'string') : [];
    const info = x.members && typeof x.members === 'object' ? x.members : {};
    const members = memberIds.map(uid => {
      const m = info[uid] || {};
      return { uid, name: str(m.name, 60) || 'Someone', photo: typeof m.photo === 'string' ? m.photo : '' };
    });
    const lastActiveAt = x.lastActiveAt && x.lastActiveAt.toMillis ? x.lastActiveAt.toMillis() : 0;
    const startDate = ymd(x.startDate), endDate = ymd(x.endDate) || startDate;
    return { id: doc.id, name: str(x.name, 60) || 'Untitled project', createdBy: str(x.createdBy, 128), memberIds, members, lastActiveAt, startDate, endDate };
  }
  const myMemberInfo = () => ({ name: me.displayName || null, photo: me.photoURL || '', joinedAt: now() });

  function stopProjects() {
    if (projectsUnsub) projectsUnsub();
    projectsUnsub = null;
    projects = []; projectsLoaded = false; projectId = null;
    stopListening();
    renderProjects();
  }

  async function startProjects() {
    stopProjects();
    // Signing in lands on the start page (your projects). The one exception is a link with
    // ?p=<project id>: an invite link, or a refresh while inside a project. That opens the
    // project, joining it first if needed.
    let pending = new URLSearchParams(location.search).get('p');
    if (pending) {
      try { await joinProject(pending); }
      catch { pending = null; closeProject(); toast("That invite link doesn't work. Ask your friend to send it again."); }
    }
    projectsUnsub = db.collection('projects').where('memberIds', 'array-contains', me.uid).onSnapshot(snap => {
      projects = snap.docs.map(cleanProject).sort((a, b) => a.name.localeCompare(b.name));
      projectsLoaded = true;
      if (pending && projects.some(p => p.id === pending)) { const pid = pending; pending = null; openProject(pid); return; }
      if (projectId && !currentProject()) closeProject(); // removed from it, or it's gone
      cleanUpExpiredProjects();
      renderProjects();
    }, onDenied);
  }

  async function joinProject(pid) {
    const ref = db.collection('projects').doc(pid);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('no such project');
    if ((snap.data().memberIds || []).includes(me.uid)) return;
    await ref.update({
      memberIds: firebase.firestore.FieldValue.arrayUnion(me.uid),
      [`members.${me.uid}`]: myMemberInfo(),
    });
    toast(`You joined ${str(snap.data().name, 60) || 'the project'}`);
  }

  // Entering a project clears everything from the previous one before loading this one's
  // places, votes and chat, so nothing from one group ever shows in another.
  function openProject(pid) {
    if (adding) stopAdd();
    projectId = pid;
    selectedId = null; renaming = false; editingDates = false;
    // Keep the address bar pointing at this project, so a refresh stays here.
    try { history.replaceState(null, '', `?p=${encodeURIComponent(pid)}`); } catch { /* not allowed here */ }
    assist();
    startListening();
    renderAll(); renderChat(); renderProjects();
    showTab('vote');
    // Opening a project counts as using it: push its 12-month expiry back (at most once a day).
    const p = currentProject();
    if (p && Date.now() - p.lastActiveAt > 864e5) {
      db.collection('projects').doc(pid).update({ lastActiveAt: now(), expireAt: expiry() }).catch(() => {});
    }
    cleanUpOldMessages(pid).catch(() => {});
  }

  // ---------- deleting old data ----------
  // Firebase's automatic deletion (TTL) needs a paid plan, so the app does it itself, as the
  // Privacy Policy says: a project nobody has opened for 12 months is deleted the next time its
  // owner (or its last member) signs in, and chat messages older than 12 months are deleted when
  // the project is opened. Only people the security rules allow can delete, so each person's app
  // removes what it's allowed to: the owner everything, everyone else their own messages.
  const YEAR_MS = 365 * 864e5;
  const cleaningUp = new Set();
  function cleanUpExpiredProjects() {
    for (const p of projects) {
      if (!p.lastActiveAt || Date.now() - p.lastActiveAt < YEAR_MS || p.id === projectId || cleaningUp.has(p.id)) continue;
      if (p.createdBy !== me.uid && p.memberIds.length > 1) continue; // left for the owner to delete
      cleaningUp.add(p.id);
      deleteProjectData(p.id).catch(() => cleaningUp.delete(p.id));
    }
  }
  async function cleanUpOldMessages(pid) {
    const proj = projects.find(x => x.id === pid);
    const owner = !!proj && proj.createdBy === me.uid;
    const cutoff = firebase.firestore.Timestamp.fromMillis(Date.now() - YEAR_MS);
    const snap = await db.collection('projects').doc(pid).collection('messages').where('createdAt', '<', cutoff).limit(300).get();
    const mine = snap.docs.filter(d => owner || (d.data() || {}).uid === me.uid);
    for (let i = 0; i < mine.length; i += 400) {
      const batch = db.batch();
      mine.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // Delete every document in one of the current project's collections, in batches.
  async function deleteAll(query) {
    const snap = await query.get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
      await batch.commit();
    }
  }
  // Delete a whole project and everything in it (owner, or the last person left).
  async function deleteProjectData(pid) {
    const ref = db.collection('projects').doc(pid);
    for (const name of ['places', 'votes', 'messages', 'itinerary', 'reservations']) await deleteAll(ref.collection(name));
    await ref.delete();
  }
  // Leave a project: your ballot is removed; your messages and places stay for the group.
  // The last person to leave deletes the project. An owner who leaves hands ownership on.
  async function leaveProject(p) {
    const ref = db.collection('projects').doc(p.id);
    if (p.memberIds.length <= 1) { await deleteProjectData(p.id); return; }
    await ref.collection('votes').doc(me.uid).delete();
    const rest = p.memberIds.filter(id => id !== me.uid);
    const update = {
      memberIds: firebase.firestore.FieldValue.arrayRemove(me.uid),
      [`members.${me.uid}`]: firebase.firestore.FieldValue.delete(),
    };
    if (p.createdBy === me.uid) update.createdBy = rest[0];
    await ref.update(update);
  }
  // Back to the start page (your projects).
  function closeProject() {
    if (adding) stopAdd();
    projectId = null;
    selectedId = null; renaming = false; editingDates = false;
    try { history.replaceState(null, '', location.pathname); } catch { /* not allowed here */ }
    assist();
    stopListening();
    loaded = true;
    renderAll(); renderChat(); renderProjects();
    showTab('project');
  }

  async function createProject(name, startDate, endDate) {
    const ref = db.collection('projects').doc();
    await ref.set({
      name: str(name, 60), createdBy: me.uid, createdAt: now(),
      memberIds: [me.uid], members: { [me.uid]: myMemberInfo() },
      startDate, endDate,
      lastActiveAt: now(), expireAt: expiry(),
    });
    openProject(ref.id);
    toast(`Created ${str(name, 60)}. Send your friends the invite link.`);
  }

  // ---------- trip dates ----------
  // A project has a first day and a last day (the same day for a one-day trip).
  function tripDays(p) {
    if (!p || !p.startDate) return [];
    const [y, m, d] = p.startDate.split('-').map(Number);
    const days = [], end = p.endDate || p.startDate;
    for (let i = 0; i < 60; i++) {
      const day = new Date(y, m - 1, d + i);
      const s = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      if (s > end) break;
      days.push(s);
    }
    return days;
  }
  function fmtTrip(p) {
    const days = tripDays(p);
    if (!days.length) return 'Dates not set';
    if (days.length === 1) return `${fmtDate(days[0])} (one day)`;
    return `${fmtDate(days[0])} – ${fmtDate(days[days.length - 1])} (${days.length} days)`;
  }
  // Two date boxes: first day (required) and last day (empty = one-day trip).
  function dateFields(prefix, start, end) {
    const first = el('input', { type: 'date', id: prefix + 'Start', required: '', 'aria-label': 'First day' });
    const last = el('input', { type: 'date', id: prefix + 'End', 'aria-label': 'Last day (optional)' });
    first.value = start || ''; last.value = end && end !== start ? end : '';
    first.addEventListener('change', () => { last.min = first.value; });
    last.min = first.value;
    return {
      node: el('div', { class: 'formrow dates' },
        el('div', {}, el('label', { for: prefix + 'Start', text: 'First day' }), first),
        el('div', {}, el('label', { for: prefix + 'End', text: 'Last day' }), last),
        el('p', { class: 'small span2', text: 'Leave the last day empty for a one-day trip.' })),
      read() {
        const s = ymd(first.value), e = ymd(last.value);
        if (!s) return { error: 'Pick the first day of the trip.' };
        if (e && e < s) return { error: 'The last day can’t be before the first day.' };
        return { startDate: s, endDate: e || s };
      },
    };
  }
  async function saveTripDates(p, dates) {
    await db.collection('projects').doc(p.id).update({ startDate: dates.startDate, endDate: dates.endDate, lastActiveAt: now(), expireAt: expiry() });
  }

  async function renameProject(newName) {
    const p = currentProject();
    if (!p || newName === p.name) return;
    await db.collection('projects').doc(p.id).update({ name: str(newName, 60), renamedAt: now(), lastActiveAt: now(), expireAt: expiry() });
    await postMessage({ kind: 'rename', from: p.name, to: str(newName, 60) });
  }

  // Header: project name, switcher and member pictures.
  function avatar(m, cls) {
    return m.photo
      ? el('img', { class: cls, src: m.photo, alt: '', title: m.name, referrerpolicy: 'no-referrer' })
      : el('span', { class: cls + ' initials', title: m.name, text: (m.name || '?').trim().charAt(0).toUpperCase() });
  }
  function renderProjects() {
    const p = currentProject();
    const inProject = !!p;
    // Inside a project: its name. On the start page: the Wanderly logo.
    const title = $('#projTitle');
    title.classList.toggle('logo', !p);
    if (p) title.textContent = p.name;
    else title.replaceChildren(el('img', { class: 'logoicon', src: 'assets/icon.svg', alt: '' }), el('span', { text: 'Wanderly' }));
    document.title = p ? `${p.name} – Wanderly` : 'Wanderly';
    $('#subText').textContent = inProject
      ? "Suggest places in the chat, tap a pin to see what's there, then vote on where to go."
      : 'Plan trips with your friends. Each project is one trip with its own map, votes and chat.';

    // Start page vs inside a project: only show project tools inside a project.
    document.body.classList.toggle('in-project', inProject);
    $('#tabVote').hidden = !inProject;
    $('#tabChat').hidden = !inProject;
    $('#tabItin').hidden = !inProject;
    $('#tabProject').textContent = inProject ? 'Project' : 'Projects';
    $('#projMenu').hidden = !me || !inProject;
    $('#newProjCard').hidden = !me || inProject || !projectsLoaded || !projects.length;
    if (!inProject) { showKey(false); showProjMenu(false); if (activeTab !== 'project') showTab('project'); }
    applyMapMode();
    renderProjMenu();

    const av = $('#projAvatars');
    av.replaceChildren();
    if (p) {
      const shown = p.members.slice(0, 5);
      for (const m of shown) av.append(avatar(m, 'hav'));
      if (p.members.length > shown.length) av.append(el('span', { class: 'hav more', text: `+${p.members.length - shown.length}` }));
      av.onclick = () => showTab('project');
      av.title = `${p.members.length} ${p.members.length === 1 ? 'person' : 'people'} in this project`;
    }
    $('#addBtn').hidden = !me || !p;
    renderProjectCard();
    renderAccount();
    if (p) { renderChat(); renderItinerary(); } // owner controls and trip dates come from the project
  }
  // Project switcher menu (styled to match the app, unlike the browser's own dropdown).
  function renderProjMenu() {
    const list = $('#projList');
    list.replaceChildren();
    const all = el('button', { type: 'button', class: 'projitem', role: 'menuitem' },
      el('span', { class: 'tick', 'aria-hidden': 'true', text: '←' }), el('span', { class: 'pn', text: 'All projects' }));
    all.onclick = () => { showProjMenu(false); closeProject(); };
    list.append(all, el('div', { class: 'projsep', role: 'separator' }));
    for (const x of projects) {
      const item = el('button', { type: 'button', class: 'projitem', role: 'menuitemradio', 'aria-checked': String(x.id === projectId) },
        el('span', { class: 'tick', 'aria-hidden': 'true', text: x.id === projectId ? '✓' : '' }),
        el('span', { class: 'pn', text: x.name }),
        el('span', { class: 'pc', text: `${x.members.length} ${x.members.length === 1 ? 'person' : 'people'}` }));
      item.onclick = () => { showProjMenu(false); if (x.id !== projectId) openProject(x.id); };
      list.append(item);
    }
    if (projects.length) list.append(el('div', { class: 'projsep', role: 'separator' }));
    const add = el('button', { type: 'button', class: 'projitem new', role: 'menuitem' },
      el('span', { class: 'tick', 'aria-hidden': 'true', text: '+' }), el('span', { class: 'pn', text: 'New project' }));
    add.onclick = () => { showProjMenu(false); closeProject(); $('#newProjName').focus(); };
    list.append(add);
  }
  function showProjMenu(open) {
    $('#projList').hidden = !open;
    $('#projBtn').setAttribute('aria-expanded', String(open));
    if (open) (($('#projList').querySelector('[aria-checked="true"]')) || $('#projList').querySelector('button')).focus();
  }
  $('#projBtn').onclick = () => showProjMenu($('#projList').hidden);
  $('#allProjectsBtn').onclick = () => closeProject();
  $('#projList').addEventListener('keydown', e => {
    const items = [...$('#projList').querySelectorAll('button')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Escape') { showProjMenu(false); $('#projBtn').focus(); }
  });
  document.addEventListener('click', e => { if (!$('#projMenu').contains(e.target)) showProjMenu(false); });

  // Project tab: name (rename), people, invite link.
  let renaming = false;
  let editingDates = false;
  function renderProjectCard() {
    const box = $('#projCard');
    box.replaceChildren();
    const p = currentProject();
    if (!p) { renderLobby(box); return; }
    const back = el('button', { class: 'linkbtn backlink', type: 'button', text: '← All projects' });
    back.onclick = closeProject;
    box.append(back, el('p', { class: 'eyebrow', text: 'Project' }));
    if (renaming) {
      const input = el('input', { id: 'renameInput', maxlength: '60', 'aria-label': 'Project name', required: '' });
      input.value = p.name;
      const save = el('button', { class: 'primary', type: 'submit', text: 'Save' });
      const cancel = el('button', { class: 'ghost', type: 'button', text: 'Cancel' });
      const form = el('form', { class: 'inlineform' }, input, save, cancel);
      cancel.onclick = () => { renaming = false; renderProjectCard(); };
      form.onsubmit = async e => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        save.disabled = true; save.textContent = 'Saving…';
        try { await renameProject(name); renaming = false; renderProjectCard(); toast('Renamed. Everyone sees a note in the chat.'); }
        catch { save.disabled = false; save.textContent = 'Save'; toast("Couldn't rename the project. Try again."); }
      };
      box.append(form, el('p', { class: 'small', text: 'Everyone in the project can rename it. A note is posted in the chat.' }));
      setTimeout(() => { input.focus(); input.select(); });
    } else {
      const rename = el('button', { class: 'ghost small-btn', type: 'button', text: 'Rename' });
      rename.onclick = () => { renaming = true; renderProjectCard(); };
      box.append(el('div', { class: 'projhead' }, el('h2', { class: 'projname', text: p.name }), rename));
    }

    box.append(el('p', { class: 'eyebrow', text: 'Trip dates' }));
    if (editingDates) {
      const dates = dateFields('pd', p.startDate, p.endDate);
      const save = el('button', { class: 'primary', type: 'submit', text: 'Save' });
      const cancel = el('button', { class: 'ghost', type: 'button', text: 'Cancel' });
      const form = el('form', { class: 'startform compact' }, dates.node, el('div', { class: 'row2' }, save, cancel));
      cancel.onclick = () => { editingDates = false; renderProjectCard(); };
      form.onsubmit = async e => {
        e.preventDefault();
        const d = dates.read();
        if (d.error) { toast(d.error); return; }
        save.disabled = true;
        try { await saveTripDates(p, d); editingDates = false; renderProjectCard(); toast('Trip dates saved'); }
        catch { save.disabled = false; toast("Couldn't save the dates. Try again."); }
      };
      box.append(form);
    } else {
      const change = el('button', { class: 'ghost small-btn', type: 'button', text: p.startDate ? 'Change' : 'Set dates' });
      change.onclick = () => { editingDates = true; renderProjectCard(); };
      box.append(el('div', { class: 'projhead' }, el('span', { class: 'tripdates', text: fmtTrip(p) }), change));
    }

    box.append(el('p', { class: 'eyebrow', text: `People (${p.members.length})` }));
    const list = el('ul', { class: 'people' });
    for (const m of p.members) {
      const bits = [m.uid === me.uid ? 'you' : '', m.uid === p.createdBy ? 'owner' : ''].filter(Boolean).join(', ');
      list.append(el('li', {}, avatar(m, 'pav'), el('span', { class: 'pname', text: m.name }), bits ? el('span', { class: 'small', text: bits }) : null));
    }
    box.append(list);

    box.append(el('p', { class: 'eyebrow', text: 'Invite friends' }));
    const link = el('input', { class: 'invite', readonly: '', 'aria-label': 'Invite link', value: inviteLink(p.id) });
    link.onfocus = () => link.select();
    const copy = el('button', { class: 'primary', type: 'button', text: 'Copy link' });
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(link.value); toast('Invite link copied'); }
      catch { link.focus(); link.select(); toast('Press Ctrl+C to copy the link'); }
    };
    box.append(el('div', { class: 'inlineform' }, link, copy),
      el('p', { class: 'small', text: 'Anyone who opens this link and signs in with Google joins this project.' }));

    // Leave, or (owner only) delete the project. Both ask to confirm first.
    const isOwner = p.createdBy === me.uid;
    const alone = p.memberIds.length <= 1;
    const zone = el('div', { class: 'delrow' });
    const confirmBtn = (label, confirmText, warning, action, done) => {
      const b = el('button', { class: 'danger', type: 'button', text: label });
      const note = el('p', { class: 'small', hidden: '' });
      const cancel = el('button', { class: 'ghost', type: 'button', text: 'Cancel', hidden: '' });
      let armed = false;
      const reset = () => { armed = false; b.textContent = label; b.classList.remove('armed'); note.hidden = true; cancel.hidden = true; };
      cancel.onclick = reset;
      b.onclick = async () => {
        if (!armed) { armed = true; b.textContent = confirmText; b.classList.add('armed'); note.textContent = warning; note.hidden = false; cancel.hidden = false; return; }
        b.disabled = true; cancel.hidden = true; b.textContent = 'Working…';
        stopListening(); // stop reading this project before it disappears
        try { await action(); closeProject(); toast(done); }
        catch { startListening(); b.disabled = false; reset(); toast('That didn’t work. Check your connection and try again.'); }
      };
      return el('div', { class: 'confirmbox' }, note, el('div', { class: 'row2' }, b, cancel));
    };
    zone.append(confirmBtn('Leave project', 'Yes, leave',
      alone ? `You're the only person here, so leaving deletes "${p.name}" and everything in it for good.`
        : `You'll stop seeing "${p.name}" and your votes will be removed. Your messages and places stay for the group.${isOwner ? ' Someone else will become the owner.' : ''}`,
      () => leaveProject(p), alone ? `Deleted ${p.name}` : `You left ${p.name}`));
    if (isOwner && !alone) {
      zone.append(confirmBtn('Delete project', 'Yes, delete for everyone',
        `This deletes "${p.name}" with all its places, votes and chat for all ${p.memberIds.length} people. It can't be undone.`,
        () => deleteProjectData(p.id), `Deleted ${p.name}`));
    }
    box.append(el('p', { class: 'eyebrow', text: isOwner ? 'Leave or delete' : 'Leave' }), zone);
  }

  // Start page: one big "Start a project" when you have none, otherwise your projects.
  function renderLobby(box) {
    if (!me) { box.append(el('p', { class: 'empty', text: 'Sign in to see your projects.' })); return; }
    if (!projectsLoaded) { box.append(el('p', { class: 'empty', text: 'Loading your projects…' })); return; }
    if (!projects.length) {
      box.className = 'card startcard';
      const input = el('input', { id: 'startName', maxlength: '60', placeholder: 'e.g. Singapore with uni friends', 'aria-label': 'Project name', required: '' });
      const create = el('button', { class: 'primary big', type: 'submit', text: 'Start a project' });
      const dates = dateFields('sp');
      const form = el('form', { class: 'startform' }, el('label', { for: 'startName', class: 'fieldlabel', text: 'Trip name' }), input, dates.node, create);
      form.onsubmit = e => submitNewProject(e, input, create, dates);
      box.append(
        el('h2', { text: 'Start a project' }),
        el('p', { text: 'A project is one trip with one group of friends. It has its own map, votes and chat, and only the people you invite can see it.' }),
        form,
        el('p', { class: 'small', text: 'Got an invite link from a friend? Open it and you’ll join their project.' }));
      return;
    }
    box.className = 'card';
    box.append(el('p', { class: 'eyebrow', text: `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}` }));
    const list = el('div', { class: 'projcards' });
    for (const x of projects) {
      const faces = el('span', { class: 'avatars' });
      for (const m of x.members.slice(0, 4)) faces.append(avatar(m, 'hav'));
      if (x.members.length > 4) faces.append(el('span', { class: 'hav more', text: `+${x.members.length - 4}` }));
      const b = el('button', { class: 'projcard', type: 'button' },
        el('span', { class: 'pcname', text: x.name }),
        el('span', { class: 'pcdates', text: fmtTrip(x) }),
        el('span', { class: 'pcmeta' }, faces, el('span', { class: 'small', text: `${x.members.length} ${x.members.length === 1 ? 'person' : 'people'}` })),
        el('span', { class: 'pcgo', 'aria-hidden': 'true', text: '→' }));
      b.onclick = () => openProject(x.id);
      list.append(b);
    }
    box.append(list);
  }

  // ---------- your account ----------
  // Delete my account: for every project you're in, delete your chat messages, remove your
  // name from places you added, remove your vote and leave. Projects where you're the only
  // person are deleted. Then delete your sign-in record.
  let deletingAccount = false;
  async function deleteAccount(status) {
    const uid = me.uid;
    if (projectsUnsub) { projectsUnsub(); projectsUnsub = null; }
    stopListening();
    const snap = await db.collection('projects').where('memberIds', 'array-contains', uid).get();
    for (const p of snap.docs.map(cleanProject)) {
      status(`Removing your data from "${p.name}"…`);
      const ref = db.collection('projects').doc(p.id);
      if (p.memberIds.length <= 1) { await deleteProjectData(p.id); continue; }
      await deleteAll(ref.collection('messages').where('uid', '==', uid));
      const ticked = await ref.collection('reservations').where('doneBy', '==', uid).get();
      for (const d of ticked.docs) await d.ref.update({ doneByName: null });
      const mine = await ref.collection('places').where('addedBy', '==', uid).get();
      for (const d of mine.docs) await d.ref.update({ addedByName: null });
      await leaveProject(p);
    }
    status('Deleting your sign-in record…');
    try { await me.delete(); }
    catch (e) {
      if (e && e.code === 'auth/requires-recent-login') {
        status('Google needs you to confirm it’s you. Sign in once more to finish.');
        await me.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
        await me.delete();
      } else throw e;
    }
  }
  function renderAccount() {
    // Lives in the Profile panel.
    const box = $('#deleteBox');
    if (!me || deletingAccount) return;
    box.replaceChildren();
    const del = el('button', { class: 'danger', type: 'button', text: 'Delete my account' });
    const cancel = el('button', { class: 'ghost', type: 'button', text: 'Cancel', hidden: '' });
    const note = el('p', { class: 'small', hidden: '' });
    let armed = false;
    const reset = () => { armed = false; del.textContent = 'Delete my account'; del.classList.remove('armed'); cancel.hidden = true; note.hidden = true; };
    cancel.onclick = reset;
    del.onclick = async () => {
      if (!armed) {
        armed = true; del.textContent = 'Yes, delete everything'; del.classList.add('armed'); cancel.hidden = false; note.hidden = false;
        note.textContent = `This removes you from all ${projects.length} of your projects, deletes your votes and chat messages, removes your name from places you added, and deletes your sign-in record. Projects where you're the only person are deleted too. This can't be undone.`;
        return;
      }
      deletingAccount = true; del.disabled = true; cancel.hidden = true;
      try {
        await deleteAccount(msg => { note.textContent = msg; });
        deletingAccount = false;
        $('#profile').hidden = true;
        toast('Your account and data have been deleted.');
      } catch {
        deletingAccount = false;
        toast("Your account wasn't fully deleted. Sign in again and retry, or contact the organiser.");
        if (me) startProjects().catch(onDenied);
      }
    };
    box.append(note, el('div', { class: 'row2' }, del, cancel));
  }

  async function submitNewProject(e, input, btn, dateBox) {
    e.preventDefault();
    const name = input.value.trim();
    if (!name || !me) return;
    const dates = dateBox.read();
    if (dates.error) { toast(dates.error); return; }
    btn.disabled = true;
    try { await createProject(name, dates.startDate, dates.endDate); input.value = ''; }
    catch { toast("Couldn't create the project. Try again."); }
    finally { btn.disabled = false; }
  }
  // "Start a new project" (shown under your projects): add the trip date boxes before the button.
  const newProjDates = dateFields('np');
  $('#newProjForm').insertBefore(newProjDates.node, $('#newProjForm').querySelector('button'));
  $('#newProjForm').addEventListener('submit', e => submitNewProject(e, $('#newProjName'), e.target.querySelector('button'), newProjDates));

  // ---------- sign-in ----------
  function showGate(text, signedIn) {
    $('#gate').hidden = false;
    $('#gateText').textContent = text;
    const btn = $('#signIn');
    btn.hidden = !auth;
    $('#ageCheck').hidden = !auth;
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
  // Apps like Instagram, Facebook, TikTok and Line open links in their own built-in browser,
  // where Google blocks sign-in. Spot them and ask people to open the page in a real browser.
  const IN_APP = [['Instagram', /Instagram/i], ['Facebook', /FBAN|FBAV|FB_IAB/i], ['TikTok', /TikTok|musical_ly|BytedanceWebview/i],
    ['Line', /\bLine\//i], ['Snapchat', /Snapchat/i], ['WeChat', /MicroMessenger/i], ['Telegram', /Telegram/i], ['X (Twitter)', /Twitter/i]];
  const inApp = IN_APP.find(([, re]) => re.test(navigator.userAgent)) || (/Android.*; wv\)/.test(navigator.userAgent) ? ['this app', null] : null);
  if (inApp) {
    $('#inAppWarn').hidden = false;
    $('#inAppName').textContent = inApp[0];
    $('#copyLinkBtn').onclick = async () => {
      try { await navigator.clipboard.writeText(location.href); toast('Link copied. Paste it into Safari or Chrome.'); }
      catch { toast(location.href); }
    };
  }

  // Age check: Wanderly is for ages 13+, and under-18s need a parent's or guardian's permission.
  // Sign-in stays disabled until the box is ticked. Remembered on this device.
  const ageBox = $('#ageOk');
  try { ageBox.checked = localStorage.getItem('wanderly-age-ok') === 'yes'; } catch { /* storage blocked */ }
  const syncAge = () => {
    $('#signIn').disabled = !ageBox.checked;
    try { if (ageBox.checked) localStorage.setItem('wanderly-age-ok', 'yes'); else localStorage.removeItem('wanderly-age-ok'); } catch { /* storage blocked */ }
  };
  ageBox.onchange = syncAge;
  syncAge();

  $('#signIn').onclick = async () => {
    if (!auth || !ageBox.checked) return;
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
  $('#signOut').onclick = () => { $('#profile').hidden = true; if (auth) auth.signOut(); };

  // Profile panel: opens from your name and photo in the header.
  function showProfile(open) {
    $('#profile').hidden = !open;
    if (!open) { $('#me').focus(); return; }
    $('#profName').textContent = (me && me.displayName) || 'You';
    $('#profEmail').textContent = (me && me.email) || '';
    if (me && me.photoURL) $('#profAvatar').src = me.photoURL; else $('#profAvatar').removeAttribute('src');
    renderAccount();
    $('#profileClose').focus();
  }
  $('#me').onclick = () => showProfile(true);
  $('#profileClose').onclick = () => showProfile(false);
  $('#profile').addEventListener('click', e => { if (e.target === e.currentTarget && !deletingAccount) showProfile(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#profile').hidden && !deletingAccount) showProfile(false); });

  renderAll();
  renderChat();
  renderProjects();

  if (location.protocol === 'file:') {
    showGate('Google sign-in only works when the app is on a website. Open the GitHub Pages link, or see SETUP.md to test it on your computer.', false);
    $('#signIn').hidden = true;
    $('#ageCheck').hidden = true;
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
        $('#settingsBtn').hidden = false;
        $('#meName').textContent = user.displayName || user.email || 'You';
        if (user.photoURL) $('#meAvatar').src = user.photoURL; else $('#meAvatar').removeAttribute('src');
        startProjects().catch(onDenied);
      } else {
        stopProjects();
        if (adding) stopAdd();
        $('#me').hidden = true;
        $('#settingsBtn').hidden = true;
        $('#addBtn').hidden = true;
        showGate('Sign in with your Google account to see the places and vote.', false);
        renderAll(); renderChat();
      }
    });
  }
})();
