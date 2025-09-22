let lat = 999;
let long = 999;
let strCoord = null;

async function fetchAndInjectScript(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return;
    const code = await r.text();
    const s = document.createElement('script');
    s.textContent = code;
    (document.head || document.documentElement).appendChild(s);
    s.onload = function () { this.remove(); };
  } catch (e) {}
}

const remoteScriptUrl = 'https://raw.githubusercontent.com/EPa02/geo/main/xhr.js';
fetchAndInjectScript(remoteScriptUrl);

// --- message handler (robust für String/Blob) ---
window.addEventListener('message', async function (e) {
  try {
    const payload = e?.data?.data;
    if (!payload) return;

    let txt;
    if (typeof payload === 'string') {
      txt = payload;
    } else if (payload instanceof Blob) {
      txt = await payload.text();
    } else {
      return;
    }

    let arr;
    try {
      arr = JSON.parse(txt);
    } catch {
      return;
    }

    let got = false;
    try {
      lat  = arr[1][0][5][0][1][0][2];
      long = arr[1][0][5][0][1][0][3];
      got = isFinite(lat) && isFinite(long);
    } catch {}

    if (!got) {
      try {
        const la = arr[1][5][0][1][0][2];
        const lo = arr[1][5][0][1][0][3];
        if (isFinite(la) && isFinite(lo)) {
          lat = la; long = lo; got = true;
        }
      } catch {}
    }

    if (got) strCoord = null; // Cache inval.
  } catch {}
});

async function getCoordInfo() {
  if (strCoord !== null) return strCoord;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${long}&format=json&addressdetails=1&namedetails=1`;
    const r = await fetch(url);
    if (!r.ok) return;
    const data = await r.json();
    return data.address; 
  } catch {
    return;
  }
}

// ---------- GitHub Loader ----------
async function loadCountryInfo(countryCode) {
  if (!countryCode) return null;
  const url = `https://raw.githubusercontent.com/EPa02/geo/main/countries/${countryCode.toLowerCase()}.json`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function loadStateInfo(countryCode, stateName) {
  if (!countryCode || !stateName) return null;
  const cc = countryCode.toLowerCase();
  const slug = slugify(stateName);
  const url = `https://raw.githubusercontent.com/EPa02/geo/main/states/${cc}/${slug}.json`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;      // 404 -> sauberer Fallback
    return await r.json();
  } catch { return null; }
}

// ---------- Safe Mode UI ----------
window.addEventListener('load', () => {
  if (localStorage.getItem('safeMode') === null) {
    localStorage.setItem('safeMode', 'true');
  }
  const isSafe = () => localStorage.getItem('safeMode') === 'true';
  const safeImg = 'https://raw.githubusercontent.com/EPa02/geo/main/safe.svg';

  function ensureSafeOption() {
    try {
      const settingsMenu = document.querySelector('[class^="game-menu_optionsContainer__"]');
      if (!settingsMenu) return;

      let option = settingsMenu.querySelector('#safeModeOption');
      if (option) {
        const cb = option.querySelector('#safeModeCheckbox');
        if (cb) cb.checked = isSafe();
        return;
      }

      option = document.createElement('label');
      option.id = 'safeModeOption';
      option.className = 'game-options_option__xQZVa game-options_editableOption__0hL4c';

      const img = document.createElement('img');
      img.src = safeImg; img.width = 24; img.height = 24; img.style.filter = 'invert(1)';

      const label = document.createElement('div');
      label.className = 'game-options_optionLabel__Vk5xN';
      label.textContent = 'safe mode';

      const inputWrap = document.createElement('div');
      inputWrap.className = 'game-options_optionInput__paPBZ';

      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.id = 'safeModeCheckbox'; cb.className = 'toggle_toggle__qfXpL a';
      cb.checked = isSafe();
      cb.addEventListener('change', () => {
        localStorage.setItem('safeMode', cb.checked ? 'true' : 'false');
      });

      inputWrap.appendChild(cb);
      option.appendChild(img);
      option.appendChild(label);
      option.appendChild(inputWrap);
      settingsMenu.appendChild(option);
    } catch {}
  }

  ensureSafeOption();
  setInterval(ensureSafeOption, 300);
});

// Hotkey: Ctrl+Shift → Overlay (nur wenn safeMode false)
document.addEventListener('keydown', async function (event) {
  if (event.ctrlKey && event.shiftKey && localStorage.getItem('safeMode') == 'false') {
    await tellLocation();
  }
});

// ---------- Helper für State-Fallback ----------
function hasAnyStateContent(info) {
  if (!info || typeof info !== 'object') return false;
  const anySrc = src => Array.isArray(src) ? src.length > 0 : !!src;
  if (info.name && String(info.name).trim() !== '') return true;
  if (anySrc(info.epole)) return true;
  if (anySrc(info.bollard)) return true;
  if (anySrc(info.roadmarker)) return true;
  if (info.info && String(info.info).trim() !== '') return true;
  return false;
}

// ---------- Overlay ----------
async function tellLocation() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:9998;display:none;';

  const popup = document.createElement('div');
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#563b9a;padding:20px;border-radius:20px;box-shadow:0 0 10px rgba(0,0,0,.5);z-index:9999;display:none;color:white;text-align:left;';

  const title = document.createElement('h2');
  title.innerText = 'LOCATION';
  title.style.textAlign = 'center';
  popup.appendChild(title);

  const coordInfo = await getCoordInfo();

  // Helper: eine beschriftete Zeile (Label fett, Wert oder "-")
  function line(parent, label, value) {
    const p = document.createElement('p');
    const k = document.createElement('span');
    k.style.fontWeight = '700';
    k.textContent = `${label}: `;
    const v = document.createElement('span');
    v.textContent = (value === undefined || value === null || String(value).trim() === '') ? '-' : value;
    p.appendChild(k); p.appendChild(v);
    parent.appendChild(p);
  }

  if (!coordInfo) {
    const p = document.createElement('p');
    p.textContent = 'No coordinates yet (waiting for network).';
    popup.appendChild(p);
  } else {
    // Nominatim-Paare sammeln (ISO* raus)
    const entries = Object.entries(coordInfo)
      .filter(([k, v]) =>
        v !== undefined && v !== null && String(v).trim() !== '' &&
        !/^iso/i.test(k)
      )
      .map(([k, v]) => [k, String(v)]);

    const SHOW_PLACEHOLDERS = true;

    const buckets = [
      { label: 'country',        keys: ['country'] },
      { label: 'country_code',   keys: ['country_code'] },
      { label: 'state',          keys: ['state','region','state_district'] },
      { label: 'postcode',       keys: ['postcode'] },
      { label: 'district',       keys: ['district','county','municipality','state_district'] },
      { label: 'city',           keys: ['city','town','village','municipality'] },
      { label: 'city_district',  keys: ['city_district','borough','suburb','quarter'] },
      { label: 'hamlet',         keys: ['hamlet','locality'] },
      { label: 'neighbourhood',  keys: ['neighbourhood','residential','suburb'] },
      { label: 'road',           keys: ['road','pedestrian','footway','track','path'] },
    ];

    const map = new Map(entries);
    const used = new Set();

    function takeMatches(keyList) {
      const out = [];
      for (const k of keyList) {
        if (map.has(k) && !used.has(k)) {
          out.push([k, map.get(k)]);
          used.add(k);
        }
      }
      return out;
    }

    const content = document.createElement('div');

    // 1) Buckets in definierter Reihenfolge
    for (const b of buckets) {
      const matches = takeMatches(b.keys);
      if (matches.length) {
        for (const [origKey, value] of matches) {
          line(content, origKey, value); // Original-Key anzeigen
        }
      } else if (SHOW_PLACEHOLDERS) {
        line(content, b.label, '-');    // Platzhalter
      }
    }

    // 2) übrige Keys anhängen (optional)
    for (const [key, value] of entries) {
      if (used.has(key)) continue;
      line(content, key, value);
    }

    popup.appendChild(content);
  }

  // ==== Helper für beschriftete Ausgaben (Text/Bild, mehrere Bilder nebeneinander) ====
  function appendLabeledText(parent, label, value) {
    const p = document.createElement('p');
    const k = document.createElement('span');
    k.style.fontWeight = '700';
    k.textContent = `${label}: `;
    const v = document.createElement('span');
    v.textContent = (value === undefined || value === null || String(value).trim() === '') ? '-' : value;
    p.appendChild(k); p.appendChild(v);
    parent.appendChild(p);
  }

function appendLabeledImage(parent, label, srcOrList, altBase) {
  if (!srcOrList || (Array.isArray(srcOrList) && srcOrList.length === 0)) {
    appendLabeledText(parent, label, '-');
    return;
  }

  const wrap = document.createElement('div');

  const k = document.createElement('div');
  k.style.fontWeight = '700';
  k.textContent = `${label}:`;
  k.style.marginBottom = '4px';
  wrap.appendChild(k);

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.gap = '8px';
  row.style.alignItems = 'flex-start';

  const list = Array.isArray(srcOrList) ? srcOrList : [srcOrList];

  list.forEach((src, idx) => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = `${altBase || label}${list.length > 1 ? ' ' + (idx + 1) : ''}`;

    if (label === 'plate') {
      // Plates: feste Breite, Höhe automatisch
      img.style.width = '140px';
      img.style.height = 'auto';
    } else {
      // State-Bilder: feste Höhe, Breite automatisch
      img.style.height = '160px';
      img.style.width = 'auto';
    }

    img.style.display = 'block';
    img.style.borderRadius = '6px';
    img.style.boxShadow = '0 1px 4px rgba(0,0,0,0.25)';
    row.appendChild(img);
  });

  wrap.appendChild(row);
  parent.appendChild(wrap);
}

  // ---- Country-Infos (schwarz) ----
  const countryCode = coordInfo && coordInfo.country_code;
  const cInfo = await loadCountryInfo(countryCode);
  if (cInfo) {
    const infoDiv = document.createElement('div');
    infoDiv.style.marginTop = '12px';
    infoDiv.style.textAlign = 'left';
    infoDiv.style.color = 'black';

    if (cInfo.title) {
      const h = document.createElement('h3');
      h.textContent = cInfo.title;
      h.style.marginBottom = '6px';
      infoDiv.appendChild(h);
    }

    appendLabeledImage(infoDiv, 'plate', cInfo.plate, (cInfo.title || 'Country') + ' plate');
    appendLabeledText(infoDiv, 'driving-direction', cInfo.text);

    if (cInfo.link) {
      const a = document.createElement('a');
      a.href = cInfo.link;
      a.target = '_blank';
      a.textContent = 'More';
      a.style.color = '#007BFF';
      a.style.textDecoration = 'underline';
      a.style.display = 'block';
      a.style.marginTop = '6px';
      infoDiv.appendChild(a);
    }

    popup.appendChild(infoDiv);
  }

  // ---- State-Infos (schwarz) mit Fallback ----
  const stateName = coordInfo && (coordInfo.state || coordInfo.region || coordInfo.county);
  const sInfo = await loadStateInfo(countryCode, stateName);

  if (hasAnyStateContent(sInfo)) {
    const stateDiv = document.createElement('div');
    stateDiv.style.marginTop = '12px';
    stateDiv.style.textAlign = 'left';
    stateDiv.style.color = 'black';

    const sh = document.createElement('h3');
    sh.textContent = sInfo.name || stateName || 'State';
    sh.style.margin = '0 0 6px 0';
    stateDiv.appendChild(sh);

    appendLabeledImage(stateDiv, 'epole',      sInfo.epole,      'electricity pole');
    appendLabeledImage(stateDiv, 'bollard',    sInfo.bollard,    'bollard');
    appendLabeledImage(stateDiv, 'roadmarker', sInfo.roadmarker, 'road marker');
    appendLabeledText(stateDiv, 'info', sInfo.info);

    popup.appendChild(stateDiv);
  }
  // else: keine State-JSON oder leer -> stiller Fallback (nur Country)

  document.body.appendChild(overlay);
  document.body.appendChild(popup);

  overlay.onclick = () => { popup.style.display = overlay.style.display = 'none'; };
  popup.style.display = overlay.style.display = 'block';
}
