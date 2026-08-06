/* ============================================
   오조록 제주 추천 지도 — app.js
   설정은 아래 CONFIG만 고치면 됩니다.
   ============================================ */

const CONFIG = {
  // 오조록 위치 (서귀포시 성산읍 오조로100번길 5) — 정확한 좌표로 교체하세요
  home: { lat: 33.4646, lng: 126.9159 },
  // 예약 링크 — 실제 링크로 교체하세요
  bookingAirbnb: "https://www.airbnb.co.kr/", // TODO: 오조록 에어비앤비 링크
  bookingNaver: "https://map.naver.com/",     // TODO: 오조록 네이버 예약 링크
  defaultLang: "ko",
  mapZoom: 12,
};

// 카테고리 정의 (places.json의 category 값과 일치해야 함)
const CATEGORIES = ["맛집", "카페", "명소", "산책·오름"];

// UI 문자열 (3개 언어)
const UI = {
  ko: {
    brand: "오조록",
    docTitle: "오조록 주인장의 제주 추천 지도",
    book: "예약",
    heroTitle: "오조리 주인장의 제주 노트",
    heroGreeting:
      "오조리에서 숙소를 하며 제가 실제로 다니는 곳들만 모았습니다. 검색으로는 안 나오는 주인장 한마디까지 담았어요.",
    share: "이 리스트 공유하기",
    shareCopied: "링크가 복사됐어요! 카톡에 붙여넣어 주세요 🍊",
    mapTitle: "지도로 보기",
    sortNear: "오조록에서 가까운 순",
    all: "전체",
    category: { "맛집": "맛집", "카페": "카페", "명소": "명소", "산책·오름": "산책·오름" },
    distance: (min) => `오조록에서 차로 ${min}분`,
    menuLabel: "추천 메뉴",
    tipLabel: "주인장 한마디",
    naverBtn: "네이버맵",
    googleBtn: "구글맵",
    homeMarker: "오조록 (숙소)",
    footerBrand: "오조록 · 제주 성산 오조리의 숙소",
    footerAddress: "제주특별자치도 서귀포시 성산읍 오조로100번길 5",
    bookAirbnb: "에어비앤비 예약",
    bookNaver: "네이버 예약",
    footerShareAsk: "이 리스트가 도움이 됐다면 친구에게 공유해주세요 🍊",
    empty: "이 카테고리에는 아직 추천이 없어요.",
  },
  en: {
    brand: "OJOROK",
    docTitle: "OJOROK Host's Jeju Guide Map",
    book: "Book",
    heroTitle: "The Ojo-ri Host's Jeju Notes",
    heroGreeting:
      "I run a stay in Ojo-ri, and these are only the places I actually go — with host tips you won't find by searching.",
    share: "Share this list",
    shareCopied: "Link copied! Paste it to your friends 🍊",
    mapTitle: "Map view",
    sortNear: "Nearest from OJOROK",
    all: "All",
    category: { "맛집": "Food", "카페": "Cafe", "명소": "Sights", "산책·오름": "Walks" },
    distance: (min) => `${min} min by car from OJOROK`,
    menuLabel: "Must-try",
    tipLabel: "Host's tip",
    naverBtn: "Naver Map",
    googleBtn: "Google Maps",
    homeMarker: "OJOROK (our stay)",
    footerBrand: "OJOROK · A stay in Ojo-ri, Seongsan, Jeju",
    footerAddress: "5, Ojoro 100beon-gil, Seongsan-eup, Seogwipo-si, Jeju",
    bookAirbnb: "Book on Airbnb",
    bookNaver: "Book on Naver",
    footerShareAsk: "If this list helped, share it with a friend 🍊",
    empty: "No picks in this category yet.",
  },
  zh: {
    brand: "OJOROK",
    docTitle: "OJOROK 主人的濟州推薦地圖",
    book: "預訂",
    heroTitle: "吾照里主人的濟州筆記",
    heroGreeting:
      "我在吾照里經營民宿，這裡只收錄我真正常去的地方，還有搜尋不到的主人小提示。",
    share: "分享這份清單",
    shareCopied: "已複製連結！貼到 LINE 分享給朋友吧 🍊",
    mapTitle: "地圖模式",
    sortNear: "離 OJOROK 最近優先",
    all: "全部",
    category: { "맛집": "美食", "카페": "咖啡廳", "명소": "景點", "산책·오름": "散步·小火山" },
    distance: (min) => `從 OJOROK 開車 ${min} 分鐘`,
    menuLabel: "推薦菜單",
    tipLabel: "主人小提示",
    naverBtn: "Naver 地圖",
    googleBtn: "Google 地圖",
    homeMarker: "OJOROK（我們的民宿）",
    footerBrand: "OJOROK · 濟州城山吾照里的民宿",
    footerAddress: "濟州特別自治道西歸浦市城山邑吾照路100號街5",
    bookAirbnb: "Airbnb 預訂",
    bookNaver: "Naver 預訂",
    footerShareAsk: "如果這份清單有幫助，請分享給朋友 🍊",
    empty: "這個分類目前還沒有推薦。",
  },
};

// ---------- 상태 ----------
let lang = getLangFromURL();
let places = [];
let activeCategory = "all";
let sortByDistance = false;
let map = null;
let markers = {}; // id -> Leaflet marker

// ---------- 언어 ----------
function getLangFromURL() {
  const p = new URLSearchParams(location.search).get("lang");
  return ["ko", "en", "zh"].includes(p) ? p : CONFIG.defaultLang;
}

function setLang(next) {
  lang = next;
  const url = new URL(location.href);
  if (next === CONFIG.defaultLang) url.searchParams.delete("lang");
  else url.searchParams.set("lang", next);
  history.replaceState(null, "", url);
  render();
}

// 번역이 비어 있으면 한국어로 대체
function t(field) {
  if (typeof field === "string") return field;
  return field?.[lang] || field?.ko || "";
}

function ui(key) {
  return UI[lang][key] ?? UI.ko[key] ?? key;
}

// ---------- 렌더링 ----------
function render() {
  document.documentElement.lang = lang === "zh" ? "zh-Hant" : lang;
  document.title = ui("docTitle");

  // data-i18n 요소 일괄 적용
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const val = ui(el.dataset.i18n);
    if (typeof val === "string") el.textContent = val;
  });

  // 언어 토글 활성 표시
  document.querySelectorAll(".lang-toggle button").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });

  // 예약 링크
  document.getElementById("header-book-btn").href =
    lang === "ko" ? CONFIG.bookingNaver : CONFIG.bookingAirbnb;
  document.getElementById("footer-airbnb").href = CONFIG.bookingAirbnb;
  document.getElementById("footer-naver").href = CONFIG.bookingNaver;

  renderTabs();
  renderCards();
  renderMarkers();
}

function renderTabs() {
  const tabs = document.getElementById("filter-tabs");
  tabs.innerHTML = "";
  const makeTab = (key, label) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.classList.toggle("active", activeCategory === key);
    b.addEventListener("click", () => {
      activeCategory = key;
      render();
    });
    tabs.appendChild(b);
  };
  makeTab("all", ui("all"));
  CATEGORIES.forEach((c) => makeTab(c, UI[lang].category[c] || c));
}

function visiblePlaces() {
  let list = places.filter(
    (p) => activeCategory === "all" || p.category === activeCategory
  );
  if (sortByDistance) {
    list = [...list].sort(
      (a, b) => (a.distance_min ?? 999) - (b.distance_min ?? 999)
    );
  }
  return list;
}

function categoryClass(category) {
  // "산책·오름" → "산책오름" (CSS 클래스에 쓸 수 있게 특수문자 제거)
  return "tag-" + String(category).replace(/[^\w가-힣]/g, "");
}

function renderCards() {
  const listEl = document.getElementById("card-list");
  listEl.innerHTML = "";
  const list = visiblePlaces();

  if (list.length === 0) {
    const p = document.createElement("p");
    p.className = "empty-message";
    p.textContent = ui("empty");
    listEl.appendChild(p);
    return;
  }

  for (const place of list) {
    const card = document.createElement("article");
    card.className = "place-card";
    card.id = `place-${place.id}`;

    if (place.photo) {
      const img = document.createElement("img");
      img.className = "card-photo";
      img.src = place.photo;
      img.alt = t(place.name);
      img.loading = "lazy";
      card.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "card-body";

    const top = document.createElement("div");
    top.className = "card-top";

    const nameEl = document.createElement("h2");
    nameEl.className = "card-name";
    nameEl.textContent = t(place.name);
    top.appendChild(nameEl);

    const tag = document.createElement("span");
    tag.className = `tag ${categoryClass(place.category)}`;
    tag.textContent = UI[lang].category[place.category] || place.category;
    top.appendChild(tag);

    if (place.distance_min != null) {
      const badge = document.createElement("span");
      badge.className = "distance-badge";
      badge.textContent = UI[lang].distance(place.distance_min);
      top.appendChild(badge);
    }
    body.appendChild(top);

    if (t(place.desc)) {
      const desc = document.createElement("p");
      desc.className = "card-desc";
      desc.textContent = t(place.desc);
      body.appendChild(desc);
    }

    if (t(place.menu)) {
      const menu = document.createElement("p");
      menu.className = "card-menu";
      const label = document.createElement("strong");
      label.textContent = ui("menuLabel") + " · ";
      menu.appendChild(label);
      menu.appendChild(document.createTextNode(t(place.menu)));
      body.appendChild(menu);
    }

    if (t(place.tip)) {
      const tip = document.createElement("p");
      tip.className = "card-tip";
      tip.textContent = `💬 ${ui("tipLabel")}: ${t(place.tip)}`;
      body.appendChild(tip);
    }

    // 길찾기 버튼 — KR은 네이버 우선, EN/中은 구글 우선
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const naverBtn = mapButton(place.naver, ui("naverBtn"));
    const googleBtn = mapButton(place.google, ui("googleBtn"));
    const [primary, secondary] =
      lang === "ko" ? [naverBtn, googleBtn] : [googleBtn, naverBtn];
    if (primary) primary.classList.add("btn-map-primary");
    if (secondary) secondary.classList.add("btn-map-secondary");
    [primary, secondary].forEach((b) => b && actions.appendChild(b));
    if (actions.children.length) body.appendChild(actions);

    card.appendChild(body);
    listEl.appendChild(card);
  }
}

function mapButton(href, label) {
  if (!href) return null;
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = label;
  return a;
}

// ---------- 지도 ----------
// 네트워크가 느리거나 Leaflet CDN이 막혀도 추천 리스트는 항상 보여야 하므로,
// 지도 초기화 실패는 조용히 삼키고 지도 영역만 감춘다.
function initMap() {
  if (typeof L === "undefined") return hideMapSection();
  try {
    map = L.map("map").setView([CONFIG.home.lat, CONFIG.home.lng], CONFIG.mapZoom);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
  } catch (e) {
    console.error("지도 초기화 실패:", e);
    map = null;
    hideMapSection();
  }
}

function hideMapSection() {
  const section = document.querySelector(".map-section");
  if (section) section.hidden = true;
}

function renderMarkers() {
  if (!map) return;
  Object.values(markers).forEach((m) => map.removeLayer(m));
  markers = {};

  // 오조록 집 마커 — 항상 표시 (지도 자체가 브랜딩)
  const homeIcon = L.divIcon({
    className: "home-marker",
    html: "🏠",
    iconSize: [26, 26],
    iconAnchor: [13, 24],
  });
  markers.__home = L.marker([CONFIG.home.lat, CONFIG.home.lng], {
    icon: homeIcon,
    zIndexOffset: 1000,
  })
    .addTo(map)
    .bindPopup(`<b>${ui("homeMarker")}</b>`);

  for (const place of visiblePlaces()) {
    if (place.lat == null || place.lng == null) continue;
    const m = L.marker([place.lat, place.lng])
      .addTo(map)
      .bindPopup(`<b>${escapeHTML(t(place.name))}</b>`);
    // 마커 클릭 → 해당 카드로 스크롤 + 강조
    m.on("click", () => {
      const card = document.getElementById(`place-${place.id}`);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("highlight");
      setTimeout(() => card.classList.remove("highlight"), 2000);
    });
    markers[place.id] = m;
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- 공유 ----------
async function share() {
  const url = location.href;
  const data = { title: ui("docTitle"), url };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // 사용자가 취소
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    alert(ui("shareCopied"));
  } catch {
    prompt("URL", url);
  }
}

// ---------- 초기화 ----------
async function init() {
  document.querySelectorAll(".lang-toggle button").forEach((b) => {
    b.addEventListener("click", () => setLang(b.dataset.lang));
  });

  document.getElementById("share-btn").addEventListener("click", share);

  document.getElementById("sort-distance").addEventListener("change", (e) => {
    sortByDistance = e.target.checked;
    render();
  });

  const mapSection = document.querySelector(".map-section");
  const mapToggle = document.getElementById("map-toggle");
  mapToggle.addEventListener("click", () => {
    const collapsed = mapSection.classList.toggle("collapsed");
    mapToggle.setAttribute("aria-expanded", String(!collapsed));
    if (!collapsed && map) map.invalidateSize();
  });

  try {
    const res = await fetch("places.json");
    const data = await res.json();
    places = data.places || [];
  } catch (e) {
    console.error("places.json 로딩 실패:", e);
    places = [];
  }

  initMap();
  render();
}

init();
