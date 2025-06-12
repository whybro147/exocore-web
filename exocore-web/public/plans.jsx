import { render } from 'solid-js/web';
import { createSignal, onMount, For, Show } from 'solid-js';

const PixelIcon = ({ color }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24" style={{ "image-rendering": "pixelated", fill: color || "currentColor" }}>
    <path d="M2 0H14V2H16V14H14V16H2V14H0V2H2V0ZM4 4V12H12V4H4Z" /> 
    <path d="M6 6H10V10H6V6Z" />
  </svg>
);

const planStylesConfig = {
  "Core Access": { 
    textGrad1: '#D0A9F5', textGrad2: '#E8D4F7', cardGrad1: '#6A0DAD', cardGrad2: '#A74AC7', 
    cardBorder: '#4B0082', textColor: '#FFFFFF', iconFill: '#E8D4F7', glowColor: '#E0BBE4'
  },
  "Prime Core": { 
    textGrad1: '#FFEB3B', textGrad2: '#FFF59D', cardGrad1: '#FBC02D', cardGrad2: '#FFD700', 
    cardBorder: '#B98B00', textColor: '#1A1A1A', iconFill: '#424242', glowColor: '#FFFACD'
  },
  "Alpha Core": { 
    textGrad1: '#00BCD4', textGrad2: '#80DEEA', cardGrad1: '#03A9F4', cardGrad2: '#4FC3F7', 
    cardBorder: '#0277BD', textColor: '#FFFFFF', iconFill: '#B2EBF2', glowColor: '#80DEEA'
  },
  "EXO Elite": { 
    textGrad1: '#F44336', textGrad2: '#FF8A80', cardGrad1: '#D32F2F', cardGrad2: '#E57373', 
    cardBorder: '#9A0007', textColor: '#FFFFFF', iconFill: '#FFCDD2', glowColor: '#FF8A80'
  },
  "Hacker Core": { 
    textGrad1: '#4CAF50', textGrad2: '#A5D6A7', cardGrad1: '#388E3C', cardGrad2: '#66BB6A', 
    cardBorder: '#1B5E20', textColor: '#FFFFFF', iconFill: '#C8E6C9', glowColor: '#A5D6A7'
  }
};
const defaultPlanStyle = { 
  textGrad1: '#B0BEC5', textGrad2: '#ECEFF1', cardGrad1: '#455A64', cardGrad2: '#607D8B',
  cardBorder: '#263238', textColor: '#FFFFFF', iconFill: '#ECEFF1', glowColor: '#90A4AE' 
};

const countryCurrencyMap = {
  "Afghanistan": "AFN", "Albania": "ALL", "Algeria": "DZD", "Angola": "AOA",
  "Argentina": "ARS", "Armenia": "AMD", "Australia": "AUD", "Austria": "EUR", "Azerbaijan": "AZN",
  "Bahamas": "BSD", "Bahrain": "BHD", "Bangladesh": "BDT", "Barbados": "BBD", "Belarus": "BYN",
  "Belgium": "EUR", "Belize": "BZD", "Benin": "XOF", "Bhutan": "BTN", "Bolivia": "BOB",
  "Bosnia and Herzegovina": "BAM", "Botswana": "BWP", "Brazil": "BRL", "Brunei": "BND",
  "Bulgaria": "BGN", "Burkina Faso": "XOF", "Burundi": "BIF", "Cambodia": "KHR", "Cameroon": "XAF",
  "Canada": "CAD", "Cape Verde": "CVE", "Central African Republic": "XAF", "Chad": "XAF",
  "Chile": "CLP", "China": "CNY", "Colombia": "COP", "Comoros": "KMF", "Congo, Dem. Rep.": "CDF",
  "Congo, Rep.": "XAF", "Costa Rica": "CRC", "Cote d'Ivoire": "XOF", "Croatia": "EUR",
  "Cuba": "CUP", "Cyprus": "EUR", "Czech Republic": "CZK", "Denmark": "DKK", "Djibouti": "DJF",
  "Dominican Republic": "DOP", "Ecuador": "USD", "Egypt": "EGP", "El Salvador": "USD",
  "Equatorial Guinea": "XAF", "Eritrea": "ERN", "Estonia": "EUR", "Eswatini": "SZL", "Ethiopia": "ETB",
  "Fiji": "FJD", "Finland": "EUR", "France": "EUR", "Gabon": "XAF", "Gambia": "GMD",
  "Georgia": "GEL", "Germany": "EUR", "Ghana": "GHS", "Greece": "EUR", "Guatemala": "GTQ",
  "Guinea": "GNF", "Guinea-Bissau": "XOF", "Guyana": "GYD", "Haiti": "HTG", "Honduras": "HNL",
  "Hong Kong": "HKD", "Hungary": "HUF", "Iceland": "ISK", "India": "INR", "Indonesia": "IDR",
  "Iran": "IRR", "Iraq": "IQD", "Ireland": "EUR", "Israel": "ILS", "Italy": "EUR", "Jamaica": "JMD",
  "Japan": "JPY", "Jordan": "JOD", "Kazakhstan": "KZT", "Kenya": "KES", "Kiribati": "AUD",
  "Korea, North": "KPW", "Korea, South": "KRW", "Kuwait": "KWD", "Kyrgyzstan": "KGS", "Laos": "LAK",
  "Latvia": "EUR", "Lebanon": "LBP", "Lesotho": "LSL", "Liberia": "LRD", "Libya": "LYD",
  "Liechtenstein": "CHF", "Lithuania": "EUR", "Luxembourg": "EUR", "Macao": "MOP", "Madagascar": "MGA",
  "Malawi": "MWK", "Malaysia": "MYR", "Maldives": "MVR", "Mali": "XOF", "Malta": "EUR",
  "Mauritania": "MRU", "Mauritius": "MUR", "Mexico": "MXN", "Micronesia": "USD", "Moldova": "MDL",
  "Monaco": "EUR", "Mongolia": "MNT", "Montenegro": "EUR", "Morocco": "MAD", "Mozambique": "MZN",
  "Myanmar": "MMK", "Namibia": "NAD", "Nauru": "AUD", "Nepal": "NPR", "Netherlands": "EUR",
  "New Zealand": "NZD", "Nicaragua": "NIO", "Niger": "XOF", "Nigeria": "NGN", "North Macedonia": "MKD",
  "Norway": "NOK", "Oman": "OMR", "Pakistan": "PKR", "Palau": "USD", "Panama": "PAB",
  "Papua New Guinea": "PGK", "Paraguay": "PYG", "Peru": "PEN", "Philippines": "PHP",
  "Poland": "PLN", "Portugal": "EUR", "Puerto Rico": "USD", "Qatar": "QAR", "Romania": "RON",
  "Russia": "RUB", "Rwanda": "RWF", "Samoa": "WST", "San Marino": "EUR", "Sao Tome and Principe": "STN",
  "Saudi Arabia": "SAR", "Senegal": "XOF", "Serbia": "RSD", "Seychelles": "SCR", "Sierra Leone": "SLL",
  "Singapore": "SGD", "Slovakia": "EUR", "Slovenia": "EUR", "Solomon Islands": "SBD", "Somalia": "SOS",
  "South Africa": "ZAR", "South Sudan": "SSP", "Spain": "EUR", "Sri Lanka": "LKR", "Sudan": "SDG",
  "Suriname": "SRD", "Sweden": "SEK", "Switzerland": "CHF", "Syria": "SYP", "Taiwan": "TWD",
  "Tajikistan": "TJS", "Tanzania": "TZS", "Thailand": "THB", "Timor-Leste": "USD", "Togo": "XOF",
  "Tonga": "TOP", "Trinidad and Tobago": "TTD", "Tunisia": "TND", "Turkey": "TRY", "Turkmenistan": "TMT",
  "Tuvalu": "AUD", "Uganda": "UGX", "Ukraine": "UAH", "United Arab Emirates": "AED",
  "United Kingdom": "GBP", "United States": "USD", "Uruguay": "UYU", "Uzbekistan": "UZS",
  "Vanuatu": "VUV", "Venezuela": "VES", "Vietnam": "VND", "Yemen": "YER", "Zambia": "ZMW", "Zimbabwe": "ZWL"
};

const currencySymbolsMap = {
  "AFN": "؋", "ALL": "L", "DZD": "د.ج", "AOA": "Kz", "ARS": "$", "AMD": "֏", "AUD": "A$",
  "AZN": "₼", "BSD": "B$", "BHD": ".د.ب", "BDT": "৳", "BBD": "Bds$", "BYN": "Br", "EUR": "€",
  "BZD": "BZ$", "XOF": "CFA", "BTN": "Nu.", "BOB": "Bs.", "BAM": "KM", "BWP": "P", "BRL": "R$",
  "BND": "B$", "BGN": "лв", "BIF": "FBu", "KHR": "៛", "XAF": "FCFA", "CAD": "C$", "CVE": "Esc",
  "CLP": "CLP$", "CNY": "¥", "COP": "COL$", "KMF": "CF", "CDF": "FC", "CRC": "₡", "CUP": "$MN",
  "CZK": "Kč", "DKK": "kr.", "DJF": "Fdj", "DOP": "RD$", "USD": "$", "EGP": "E£", "ERN": "Nfk",
  "SZL": "L", "ETB": "Br", "FJD": "FJ$", "GMD": "D", "GEL": "₾", "GHS": "₵", "GTQ": "Q",
  "GNF": "FG", "GYD": "G$", "HTG": "G", "HNL": "L", "HKD": "HK$", "HUF": "Ft", "ISK": "kr",
  "INR": "₹", "IDR": "Rp", "IRR": "﷼", "IQD": "ع.د", "ILS": "₪", "JMD": "J$", "JPY": "¥",
  "JOD": "JD", "KZT": "₸", "KES": "KSh", "KPW": "₩", "KRW": "₩", "KWD": "KD", "KGS": "сом",
  "LAK": "₭", "LBP": "ل.ل", "LSL": "M", "LRD": "L$", "LYD": "LD", "CHF": "Fr.", "MOP": "MOP$",
  "MGA": "Ar", "MWK": "MK", "MYR": "RM", "MVR": ".ރ", "MRU": "UM", "MUR": "₨", "MXN": "Mex$",
  "MDL": "L", "MNT": "₮", "MAD": "د.م.", "MZN": "MT", "MMK": "K", "NAD": "N$", "NPR": "₨",
  "NZD": "NZ$", "NIO": "C$", "NGN": "₦", "MKD": "ден", "NOK": "kr", "OMR": "﷼", "PKR": "₨",
  "PAB": "B/.", "PGK": "K", "PYG": "₲", "PEN": "S/.", "PHP": "₱", "PLN": "zł", "QAR": "﷼",
  "RON": "lei", "RUB": "₽", "RWF": "RF", "WST": "WS$", "STN": "Db", "SAR": "﷼", "RSD": "дин.",
  "SCR": "₨", "SLL": "Le", "SGD": "S$", "SBD": "SI$", "SOS": "Sh.So.", "ZAR": "R", "SSP": "£",
  "LKR": "Rs", "SDG": "ج.س.", "SRD": "$", "SEK": "kr", "SYP": "£S", "TWD": "NT$", "TJS": "ЅМ",
  "TZS": "TSh", "THB": "฿", "TOP": "T$", "TTD": "TT$", "TND": "د.ت", "TRY": "₺", "TMT": "m",
  "UGX": "USh", "UAH": "₴", "AED": "د.إ", "GBP": "£", "UYU": "$U", "UZS": "сўм", "VUV": "VT",
  "VES": "Bs.S.", "VND": "₫", "YER": "﷼", "ZMW": "ZK", "ZWL": "$"
};

function App() {
  const [loading, setLoading] = createSignal(true);
  const [status, setStatus] = createSignal('');
  const [userData, setUserData] = createSignal(null);
  const [plans, setPlans] = createSignal([]);
  const [initialLoadComplete, setInitialLoadComplete] = createSignal(false);

  const [targetCurrency, setTargetCurrency] = createSignal('USD');
  const [exchangeRate, setExchangeRate] = createSignal(1);
  const [currencySymbol, setCurrencySymbol] = createSignal('$');

  const getToken = () => localStorage.getItem('exocore-token') || '';
  const getCookies = () => localStorage.getItem('exocore-cookies') || '';

  async function fetchExchangeRatesForUser(countryName) {
    const currencyCode = countryCurrencyMap[countryName] || 'USD';
    const symbol = currencySymbolsMap[currencyCode] || (currencyCode + ' ');

    setTargetCurrency(currencyCode);
    setCurrencySymbol(symbol);

    if (currencyCode === 'USD') {
      setExchangeRate(1);
      return;
    }
    try {
      const response = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currencyCode}`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      if (data.rates && data.rates[currencyCode]) {
        setExchangeRate(data.rates[currencyCode]);
      } else {
        setExchangeRate(1); setTargetCurrency('USD'); setCurrencySymbol('$');
      }
    } catch (error) {
      setStatus('Could not load local currency. Displaying prices in USD.');
      setExchangeRate(1); setTargetCurrency('USD'); setCurrencySymbol('$');
    }
  }

  async function fetchPlans() {
    try {
      const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://pastebin.com/raw/zddjxUGr')}`;
      const res = await fetch(proxiedUrl);
      if (!res.ok) throw new Error(`Failed to fetch plans: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlans(data);
      } else {
        setPlans([]);
      }
    } catch (err) {
      setStatus('Failed to load subscription plans. Please try refreshing.');
      setPlans([]);
    }
  }

  async function fetchUserInfo() {
    setLoading(true); setStatus('');
    const token = getToken(); const cookies = getCookies();

    if (!token || !cookies) {
      setLoading(false); setInitialLoadComplete(true);
      window.location.href = '/private/server/exocore/web/public/login'; return;
    }
    try {
      const res = await fetch('/private/server/exocore/web/userinfo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cookies }),
      });
      if (!res.ok) {
        let errorMsg = `Server error: ${res.status}`;
        try { const errorData = await res.json(); errorMsg = errorData.message || errorMsg; } catch (e) {}
        throw new Error(errorMsg);
      }
      const data = await res.json(); 

      if (data.data?.user && data.data.user.verified === 'success') {
        setUserData(data.data.user); 
        setStatus('');
        if (data.data.user.country) {
          await fetchExchangeRatesForUser(data.data.user.country);
        } else { 
          setTargetCurrency('USD'); setExchangeRate(1); setCurrencySymbol('$');
        }
        await fetchPlans();
      } else {
        setUserData(null); setPlans([]);
        setStatus(data.message || 'User verification failed. Redirecting to login...');
        localStorage.removeItem('exocore-token'); localStorage.removeItem('exocore-cookies');
        setTimeout(() => { window.location.href = '/private/server/exocore/web/public/login'; }, 2500);
      }
    } catch (err) {
      setUserData(null); setPlans([]);
      setStatus('Failed to fetch user info: ' + (err.message || 'Unknown error') + '. Redirecting...');
      localStorage.removeItem('exocore-token'); localStorage.removeItem('exocore-cookies');
      setTimeout(() => { window.location.href = '/private/server/exocore/web/public/login'; }, 2500);
    } finally {
      setLoading(false); setInitialLoadComplete(true);
    }
  }

  onMount(() => {
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    document.body.style.margin = '0';
    document.body.style.fontFamily = "'Pixelify Sans', sans-serif";
    document.body.style.background = 'linear-gradient(160deg, #1A073C 0%, #2C0F3A 50%, #4A1B4D 100%)';
    document.body.style.color = '#EAEAEA';
    document.body.style.setProperty('image-rendering', 'pixelated', 'important');
    document.body.style.setProperty('-webkit-font-smoothing', 'none', 'important');
    document.body.style.setProperty('font-smooth', 'never', 'important');

    fetchUserInfo();
  });

  const handleBuyClick = () => {
    window.location.href = 'https://www.facebook.com/share/16TsfAhA3z/';
  };

  return (
    <div class="main-container">
      <style>
        {`
          * {
            image-rendering: pixelated !important;
            -ms-interpolation-mode: nearest-neighbor !important; 
            -webkit-font-smoothing: none !important;
            font-smooth: never !important;
            box-sizing: border-box;
          }
          body, input, button, textarea, select {
            font-family: 'Pixelify Sans', sans-serif !important;
          }
          .main-container {
            padding: 2vh 2vw; display: flex; flex-direction: column;
            justify-content: center; align-items: center; min-height: 100vh;
            animation: fadeIn 0.7s 0.1s ease forwards; opacity: 0;
          }
          @keyframes fadeIn { to { opacity: 1; } }
          .greeting {
            font-size: 2.3rem; font-weight: 700; color: #00EFFF;
            margin-bottom: 1.5rem; text-shadow: 2px 2px 0px #110522; 
            letter-spacing: 1px;
          }
          .status-box {
            margin-bottom: 1rem; padding: 10px 15px; border-radius: 2px;
            color: #FEE2E2; background-color: #7F1D1D; border: 2px solid #5F1212;
            box-shadow: 2px 2px 0px #400A0A; font-weight: 700;
            max-width: 500px; width: 90%; text-align: center;
            font-size: 0.8rem; line-height: 1.3; letter-spacing: 0.5px;
          }
          .loading-text {
            font-size: 1.2rem; color: #909090; font-weight: 700; letter-spacing: 0.5px;
          }
          .content-box {
            width: 100%; max-width: 860px; min-height: 350px;
            background-color: rgba(10, 2, 20, 0.9); 
            border-radius: 3px; border: 2px solid #2A0B4A; 
            box-shadow: 3px 3px 0px #0A0314; 
            padding: 1.5rem; text-align: center; user-select: none;
          }
          .plans-outer-container { width: 100%; }
          .plans-container {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 1.3rem; width: 100%; margin-top: 1rem;
          }
          .plan-card {
            display: flex; align-items: flex-start; padding: 12px;
            border-radius: 3px; border: 2px solid var(--card-border);
            color: var(--card-text);
            background: linear-gradient(145deg, var(--card-grad1), var(--card-grad2));
            animation: cardGlow 2.5s infinite alternate;
            transition: transform 0.15s ease-out;
          }
          @keyframes cardGlow {
            from { box-shadow: 2px 2px 0px var(--card-border), 0 0 4px 0px var(--glow-color); }
            to { box-shadow: 2px 2px 0px var(--card-border), 0 0 14px 3px var(--glow-color); }
          }
          .plan-icon-area {
            margin-right: 10px; flex-shrink: 0; padding-top: 2px; 
            width: 24px; height: 24px;
          }
          .plan-details {
            display: flex; flex-direction: column; flex-grow: 1; text-align: left;
          }
          .plan-name {
            font-size: 1.3rem; font-weight: 700; line-height: 1.15; margin-bottom: 5px; 
            letter-spacing: 0.5px;
            background: linear-gradient(60deg, var(--text-grad1, #FFFDE7), var(--text-grad2, #FFF59D));
            -webkit-background-clip: text; background-clip: text; color: transparent;
            padding-bottom: 1px;
          }
          .plan-price {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            font-size: 1.05rem; 
            font-weight: 500; /* Medium weight for standard font */
            margin-bottom: 10px; 
            opacity: 0.95; /* Slightly more opaque */
            color: var(--card-text); 
            letter-spacing: 0.1px; /* More standard letter spacing */
            image-rendering: auto !important; 
            -webkit-font-smoothing: auto !important; /* Enable smoothing for standard font */
            font-smooth: auto !important; /* Enable smoothing for standard font */
          }
          .buy-button {
            background-color: rgba(0,0,0,0.4); color: var(--card-text); 
            border: 2px solid var(--card-text); opacity: 0.95; padding: 7px 14px; 
            border-radius: 2px; box-shadow: 1px 1px 0px rgba(0,0,0,0.6);
            text-transform: uppercase; font-weight: 700; font-size: 0.8rem; 
            letter-spacing: 0.5px; cursor: pointer; align-self: flex-start;
            transition: transform 0.08s linear, background-color 0.08s linear;
          }
          .buy-button:hover { background-color: rgba(20,20,20,0.55); opacity: 1; }
          .buy-button:active { transform: translate(1px, 1px); box-shadow: 0px 0px 0px rgba(0,0,0,0.6); }
          @media (max-width: 600px) {
            .greeting { font-size: 1.9rem; }
            .content-box { padding: 1rem; }
            .plans-container { grid-template-columns: 1fr; gap: 1rem; }
            .plan-name { font-size: 1.15rem; }
            .plan-price { font-size: 0.95rem; } /* Adjust if needed */
            .buy-button { font-size: 0.75rem; padding: 6px 10px; }
          }
        `}
      </style>

      <Show when={status() && !loading()}>
        <div class="status-box">{status()}</div>
      </Show>

      <div class="content-box">
        <Show when={loading() && !initialLoadComplete()}>
          <p class="loading-text">LOADING USER DATA...</p>
        </Show>

        <Show when={!loading() && initialLoadComplete() && userData()}>
          <div class="greeting">
            HELLO, {(userData()?.user || userData()?.user?.user || userData()?.data?.user?.user || 'USER').toUpperCase()}!
          </div>

          <Show when={plans().length > 0}>
            <div class="plans-outer-container">
              <div class="plans-container">
                <For each={plans()}>
                  {(planItem) => {
                    if (!planItem || typeof planItem.plan !== 'string') {
                      return null; 
                    }
                    const style = planStylesConfig[planItem.plan] || defaultPlanStyle;

                    let displayPrice = planItem.price || "$0";
                    const originalPriceStr = planItem.price || "$0";
                    const numericUsdPrice = parseFloat(originalPriceStr.replace('$', ''));

                    if (!isNaN(numericUsdPrice) && exchangeRate() !== null && exchangeRate() !== undefined) {
                      if (numericUsdPrice === 0 && targetCurrency() !== 'USD') {
                          displayPrice = `${currencySymbol()}0`;
                      } else if (numericUsdPrice === 0 && targetCurrency() === 'USD') {
                          displayPrice = `$0`;
                      }
                      else {
                        const convertedPrice = numericUsdPrice * exchangeRate();
                        let formattedConvertedPrice;
                        if (targetCurrency() === 'JPY' || targetCurrency() === 'KRW') {
                            formattedConvertedPrice = Math.round(convertedPrice);
                        } else {
                            formattedConvertedPrice = convertedPrice.toFixed(2);
                        }
                        displayPrice = `${currencySymbol()}${formattedConvertedPrice}`;
                      }
                    }

                    return (
                      <div 
                        class="plan-card" 
                        style={{
                          '--card-grad1': style.cardGrad1, '--card-grad2': style.cardGrad2,
                          '--card-border': style.cardBorder, '--card-text': style.textColor,
                          '--icon-color': style.iconFill, '--text-grad1': style.textGrad1,
                          '--text-grad2': style.textGrad2, '--glow-color': style.glowColor
                        }}
                      >
                        <div class="plan-icon-area">
                          <PixelIcon color={style.iconFill} />
                        </div>
                        <div class="plan-details">
                          <div class="plan-name">{(planItem.plan || "PLAN").toUpperCase()}</div>
                          <div class="plan-price">{displayPrice}</div>
                          <button class="buy-button" onClick={handleBuyClick}>BUY</button>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>
          <Show when={plans().length === 0 && !status().includes('Failed to load subscription plans')}>
            <p style={{color: '#A0A0A0', 'font-weight': '700', 'letter-spacing':'0.5px', 'font-size': '0.9rem'}}>NO PLANS AVAILABLE.</p>
          </Show>
        </Show>

        <Show when={!loading() && initialLoadComplete() && !userData() && !status().includes('Redirecting')}>
           <p style={{color: '#B0B0B0', 'font-weight': '700', 'letter-spacing':'0.5px', 'font-size': '0.9rem'}}>CANNOT LOAD USER. TRY LOGIN.</p>
        </Show>
      </div>
    </div>
  );
}

render(() => <App />, document.getElementById('app'));

