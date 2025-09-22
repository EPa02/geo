let lat = 999;
let long = 999;
let coordInfo = '';
let strCoord = null;

async function fetchAndInjectScript(url) {
    try {
        const response = await fetch(url);
        if (response.ok) {
            const scriptContent = await response.text();

            const scriptElement = document.createElement('script');
            scriptElement.textContent = scriptContent;

            (document.head || document.documentElement).appendChild(scriptElement);

            scriptElement.onload = function () {
                this.remove();
            };
        }
    } catch (e) {
        // useless to output
    }
}

const remoteScriptUrl = 'https://raw.githubusercontent.com/EPa02/geo/refs/heads/main/xhr.js';
fetchAndInjectScript(remoteScriptUrl);

function convertToMinutes(decimal) {
    return Math.floor(decimal * 60);
}

function convertToSeconds(decimal) {
    return (decimal * 3600 % 60).toFixed(1);
}

function getLatDirection(lat) {
    return lat >= 0 ? "N" : "S";
}

function getLongDirection(long) {
    return long >= 0 ? "E" : "W";
}

window.addEventListener('message', async function (e) {
    const msg = e.data.data;
    if (msg) {
        try {
            const arr = JSON.parse(msg);
            let x = false;
            try {
                lat = arr[1][0][5][0][1][0][2];
                long = arr[1][0][5][0][1][0][3];
                x = true;
            } catch (e) {
                // first
            }

            if (!x) {
                try {
                    if (isDecimal(arr[1][5][0][1][0][2]) && isDecimal(arr[1][5][0][1][0][3])) {
                        lat = arr[1][5][0][1][0][2];
                        long = arr[1][5][0][1][0][3];
                    }
                } catch (e) {
                    // alt
                }
            }

            strCoord = null;
        } catch {
            return;
        }
    }
});

function isDecimal(str) {
    str = String(str);
    return !isNaN(str) && str.includes('.') && !isNaN(parseFloat(str));
}

function convertCoords(lat, long) {
    var latResult, longResult, dmsResult;
    latResult = Math.abs(lat);
    longResult = Math.abs(long);
    dmsResult = Math.floor(latResult) + "°" + convertToMinutes(latResult % 1) + "'" + convertToSeconds(latResult % 1) + '"' + getLatDirection(lat);
    dmsResult += "+" + Math.floor(longResult) + "°" + convertToMinutes(longResult % 1) + "'" + convertToSeconds(longResult % 1) + '"' + getLongDirection(long);
    return dmsResult;
}

async function getCoordInfo() {
    if (strCoord !== null) {
        return strCoord;
    }

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${long}&format=json`);

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        return data.address;
    } catch {
        return;
    }
}

function stringToBool(str) {
    if (str === 'true') return true;
    if (str === 'false') return false;
    return null;
}


window.addEventListener('load', () => {
  if (localStorage.getItem('safeMode') === null) {
    localStorage.setItem('safeMode', 'true');
  }
  const isSafe = () => localStorage.getItem('safeMode') === 'true';
  const safeImg = 'https://raw.githubusercontent.com/EPa02/geo/refs/heads/main/safe.svg';

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
      img.alt = 'Emoji icon';
      img.loading = 'lazy';
      img.width = 24;
      img.height = 24;
      img.decoding = 'async';
      img.className = 'game-menu_emoteIcon__t4FxY';
      img.src = safeImg;
      img.style.color = 'transparent';
      img.style.filter = 'invert(1)';

      const label = document.createElement('div');
      label.className = 'game-options_optionLabel__Vk5xN';
      label.textContent = 'safe mode';

      const inputWrap = document.createElement('div');
      inputWrap.className = 'game-options_optionInput__paPBZ';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'toggle_toggle__qfXpL a';
      cb.id = 'safeModeCheckbox';
      cb.checked = isSafe();
      cb.addEventListener('change', () => {
        localStorage.setItem('safeMode', cb.checked ? 'true' : 'false');
      });

      inputWrap.appendChild(cb);
      option.appendChild(img);
      option.appendChild(label);
      option.appendChild(inputWrap);
      settingsMenu.appendChild(option);
    } catch (err) {
    }
  }

  ensureSafeOption();

  const iv = setInterval(ensureSafeOption, 300);
});

document.addEventListener('keydown', async function (event) {
    if (event.ctrlKey && event.shiftKey && localStorage.getItem('safeMode') == 'false') {
        await tellLocation();
    }
});

async function tellLocation() {
    console.log('tell')

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.zIndex = '9998';
    overlay.style.display = 'none';

    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%)';
    popup.style.backgroundColor = 'rgb(86, 59, 154)';
    popup.style.padding = '20px';
    popup.style.borderRadius = '20px';
    popup.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    popup.style.zIndex = '9999';
    popup.style.display = 'none';
    popup.style.color = 'white';
    popup.style.textAlign = 'center';

    const title = document.createElement('h2');
    title.style.color = '#a19bd9';
    title.style.fontStyle = 'italic';
    title.style.fontWeight = '700';
    title.style.fontFamily = 'neo-sans, sans-serif';
    title.innerText = 'LOCATION';
    popup.appendChild(title);

    const content = document.createElement('p');
    content.style.fontFamily = 'neo-sans, sans-serif';
    content.style.paddingLeft = '20px';
    content.style.paddingRight = '20px';
    content.style.marginTop = '20px';
    content.style.maxWidth = '400px';
    const coordInfo = await getCoordInfo();

    for (const [key, value] of Object.entries(coordInfo)) {
        const infoItem = document.createElement('p');
        infoItem.style.display = 'flex';
        infoItem.style.justifyContent = 'flex-start';
        infoItem.style.flexWrap = 'wrap';
        infoItem.style.gap = '10px';

        const keySpan = document.createElement('span');
        keySpan.style.textAlign = 'left';
        keySpan.style.fontWeight = '700';
        keySpan.style.textTransform = 'uppercase';

        keySpan.innerText = `${key}:`;

        infoItem.appendChild(keySpan);

        const valueSpan = document.createElement('span');
        valueSpan.style.textAlign = 'left';
        valueSpan.innerText = ` ${value}`;

        infoItem.appendChild(valueSpan);
        content.appendChild(infoItem);
    }

    popup.appendChild(content);

    const closeButton = document.createElement('button');
    closeButton.innerText = 'Close';
    closeButton.style.marginTop = '20px';
    closeButton.style.color = 'white';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '10px 20px';
    closeButton.style.borderRadius = '15px';
    closeButton.style.backgroundColor = '#6cb928';
    closeButton.style.fontFamily = 'neo-sans, sans-serif';
    closeButton.style.fontStyle = 'italic';
    closeButton.style.fontWeight = '700';
    closeButton.style.fontSize = '16px';
    closeButton.style.width = '100%';

    closeButton.onclick = function () {
        popup.style.display = 'none';
        overlay.style.display = 'none';
    };
    overlay.onclick = function () {
        popup.style.display = 'none';
        overlay.style.display = 'none';
    };

    popup.appendChild(closeButton);

    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    function showPopup() {
        popup.style.display = 'block';
        overlay.style.display = 'block';
    }

    showPopup();
}
