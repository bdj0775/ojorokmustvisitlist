/**
 * 오조록 제주 추천 지도 — 화면 동작
 * =========================================================
 * 이 파일은 '로직'만 담당합니다. 고칠 일이 있으면 대부분 아래 파일들입니다:
 *   설정(좌표·예약링크)  → config/site.mjs
 *   태그                → config/tags.mjs
 *   화면 문구           → config/strings.mjs
 *   색·글꼴·간격        → styles/tokens.css
 *   추천 목록           → places.json
 */

import { SITE } from "./config/site.mjs";
import { TAGS, tagById, sortTagIds } from "./config/tags.mjs";
import { STRINGS } from "./config/strings.mjs";

// ---------- 상태 ----------
const state = {
  lang: readLangFromURL(),
  places: [],
  tag: "all", // "all" 또는 태그 id
  sortByDistance: false,
  loadFailed: false,
};

let map = null;
let markers = [];

// ---------- 언어 ----------
function readLangFromURL() {
  const p = new URLSearchParams(location.search).get("lang");
  return SITE.languages.includes(p) ? p : SITE.defaultLanguage;
}

function setLang(next) {
  if (!SITE.languages.includes(next)) return;
  state.lang = next;

  // 공유한 링크가 같은 언어로 열리도록 URL에 반영
  const url = new URL(location.href);
  if (next === SITE.defaultLanguage) url.searchParams.delete("lang");
  else url.searchParams.set("lang", next);
  history.replaceState(null, "", url);

  render();
}

/** 다국어 필드에서 현재 언어를 꺼내되, 비어 있으면 한국어로 대체 */
function t(field) {
  if (typeof field === "string") return field;
  return field?.[state.lang] || field?.ko || "";
}

/** 화면 문구 */
function s(key) {
  return STRINGS[state.lang]?.[key] ?? STRINGS.ko[key] ?? key;
}

// ---------- DOM 헬퍼 ----------
/** el("span", { class: "tag", dataset: { tagGroup: "kind" } }, "횟집") */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "dataset") Object.assign(node.dataset, v);
    else if (k === "class") node.className = v;
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c);
  }
  return node;
}

const $ = (sel) => document.querySelector(sel);

// ---------- 렌더링 ----------
function render() {
  document.documentElement.lang = state.lang === "zh" ? "zh-Hant" : state.lang;
  document.title = s("docTitle");

  // data-i18n 이 붙은 요소의 텍스트를 일괄 교체
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const value = s(node.dataset.i18n);
    if (typeof value === "string") node.textContent = value;
  });

  // 언어 토글 선택 상태
  document.querySelectorAll("#lang-toggle [data-lang]").forEach((b) => {
    b.setAttribute("aria-selected", String(b.dataset.lang === state.lang));
  });

  // 예약 링크 — 한국어는 네이버, 그 외는 에어비앤비를 우선 노출
  const bookingUrl = state.lang === "ko" ? SITE.booking.naver : SITE.booking.airbnb;
  $("#header-book-btn").href = bookingUrl;
  $("#hero-book-btn").href = bookingUrl;
  $("#footer-airbnb").href = SITE.booking.airbnb;
  $("#footer-naver").href = SITE.booking.naver;

  // 인스타그램 — 주소를 비워두면 버튼을 감춘다 (빈 링크로 가는 버튼이 남지 않도록)
  const instagram = $("#footer-instagram");
  if (instagram) {
    const url = SITE.social?.instagram;
    instagram.hidden = !url;
    if (url) instagram.href = url;
  }

  renderFilters();
  renderCards();
  renderMarkers();
}

/** 실제 목록에 쓰인 태그만 필터로 보여준다 (빈 필터가 생기지 않도록) */
function usedTagIds() {
  const used = new Set();
  for (const place of state.places) {
    for (const id of place.tags || []) if (tagById.has(id)) used.add(id);
  }
  return TAGS.filter((t) => used.has(t.id)).map((t) => t.id);
}

function renderFilters() {
  $("#filter-tabs").replaceChildren(
    filterChip("all", s("all")),
    ...usedTagIds().map((id) => filterChip(id, tagLabel(id)))
  );
}

function tagLabel(id) {
  const tag = tagById.get(id);
  return tag ? tag.label[state.lang] || tag.label.ko : id;
}

function filterChip(id, label) {
  const chip = el("button", {
    type: "button",
    class: "chip",
    role: "tab",
    "aria-selected": String(state.tag === id),
  }, label);
  chip.addEventListener("click", () => {
    state.tag = id;
    render();
  });
  return chip;
}

/** 현재 필터·정렬이 적용된 목록 */
function visiblePlaces() {
  let list = state.places.filter((p) => {
    if (state.tag === "all") return true;
    return (p.tags || []).includes(state.tag);
  });

  if (state.sortByDistance) {
    list = [...list].sort((a, b) => distanceRank(a) - distanceRank(b));
  }
  return list;
}

/**
 * 오조록에서 얼마나 먼지. 작을수록 가깝습니다.
 *
 * distance_min(차로 몇 분)을 손으로 적어두면 그 값을 그대로 씁니다.
 * 비어 있으면 좌표로 직선거리를 재서 대신합니다 — 곳마다 시간을 재어
 * 적어 넣는 건 현실적으로 어렵고, 순서를 정하는 데는 직선거리로 충분합니다.
 * (실제 도로는 돌아가지만, 가까운 곳이 먼 곳보다 앞에 오면 되는 용도입니다)
 */
function distanceRank(place) {
  if (typeof place.distance_min === "number") return place.distance_min;
  const km = distanceKm(place);
  if (km == null) return Infinity; // 좌표도 시간도 없으면 맨 뒤로
  return km;
}

/**
 * 구글맵 링크.
 *
 * 좌표만 넘기면 지도에 핀만 찍히고 "여기가 무슨 가게인지" 는 안 나옵니다.
 * 가게 이름을 함께 넘기면 그 자리에 있는 실제 업장을 찾아 영업시간·리뷰까지
 * 보여줍니다. 이름이 흔해 엉뚱한 곳이 잡히지 않도록 좌표도 같이 보냅니다.
 */
function googleSearchUrl(place) {
  const name = place.name?.ko;
  if (!name) return place.google || "";

  const params = new URLSearchParams({ api: "1", query: name });
  if (place.lat != null && place.lng != null) {
    params.set("query", `${name} ${place.lat},${place.lng}`);
  }
  return "https://www.google.com/maps/search/?" + params;
}

/** 오조록에서 직선거리(km). 좌표가 없으면 null */
function distanceKm(place) {
  if (place.lat == null || place.lng == null) return null;

  // 제주도만 다루므로 위도 1도 ≈ 111km, 경도 1도 ≈ 93km 로 놓고 평면처럼 계산합니다.
  // 좁은 지역에서는 이 근사로 충분하고, 삼각함수를 쓰는 정식 계산보다 읽기 쉽습니다.
  const dLat = (place.lat - SITE.home.lat) * 111;
  const dLng = (place.lng - SITE.home.lng) * 93;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function renderCards() {
  const list = visiblePlaces();
  const container = $("#card-list");

  if (list.length === 0) {
    container.replaceChildren(
      el("p", { class: "empty-state" }, s(state.loadFailed ? "loadError" : "empty"))
    );
    return;
  }

  container.replaceChildren(...list.map(placeCard));
}

/**
 * 태그 하나. 색은 태그가 속한 그룹(업종/음식/특징)이 정합니다.
 * 태그를 늘려도 CSS 는 손댈 필요가 없습니다.
 */
function tagChip(id) {
  const tag = tagById.get(id);
  return el("span", {
    class: "tag",
    dataset: { tagGroup: tag?.group ?? "" },
  }, tagLabel(id));
}

/**
 * 카드 한 장. 목록을 훑는 화면이므로 담는 것은 네 가지뿐입니다:
 *   이름 + 태그 / 한 줄 소개 / 추천 메뉴 / 길찾기
 * 주소와 '차로 O분' 배지는 길찾기 버튼과 역할이 겹쳐 뺐습니다.
 * (distance_min 은 '가까운 순' 정렬에 그대로 쓰입니다)
 */
function placeCard(place) {
  // 1. 간단한 주소 추출 (예: '제주특별자치도 서귀포시 성산읍...' -> '서귀포시 성산읍')
  let shortAddress = "";
  if (place.address) {
    const parts = place.address.split(" ");
    if (parts.length >= 3) {
      shortAddress = parts.slice(1, 3).join(" ");
    } else {
      shortAddress = place.address;
    }
  }

  // 2. 상단 줄 (좌: 제목, 우: 주소 + 지도 아이콘)
  //
  // 한국어 손님은 네이버 지도로, 그 외 언어는 구글맵으로 보냅니다.
  // 네이버 지도는 한국 가게 정보가 가장 정확하지만 외국 손님에게는
  // 앱 설치를 요구하고 화면도 한국어라 벽이 됩니다.
  const mapHref = state.lang === "ko"
    ? place.naver || googleSearchUrl(place)
    : googleSearchUrl(place) || place.naver;

  // '가까운 순'을 켰을 때는 주소 대신 거리를 보여줍니다.
  // 근거가 안 보이면 왜 이 순서인지 알 수 없고, 줄을 새로 만들면 카드가 높아집니다.
  const km = distanceKm(place);
  const rightText = state.sortByDistance && km != null
    ? (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`)
    : shortAddress;

  const locationWrap = el("div", { class: "card__location" },
    rightText ? el("span", { class: "card__address" }, rightText) : null,
    mapHref ? el("a", {
      class: "card__map-icon", href: mapHref, target: "_blank", rel: "noopener",
      title: state.lang === "ko" ? s("naverBtn") : s("googleBtn"),
      innerHTML: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
    }) : null
  );

  const topRow = el("div", { class: "card__row card__row--top" },
    el("h2", { class: "card__title" }, t(place.name)),
    locationWrap
  );

  // 3. 하단 줄 (좌: 한줄소개, 우: 태그 뱃지들)
  const bottomRow = el("div", { class: "card__row card__row--bottom" },
    t(place.desc) ? el("p", { class: "card__text" }, t(place.desc)) : el("div"),
    el("div", { class: "card__labels" }, ...sortTagIds(place.tags).map(tagChip))
  );

  return el("article", {
    class: "card",
    id: `place-${place.id}`,
  },
    topRow,
    bottomRow,
    t(place.menu) && el("p", { class: "card__meta" },
      el("strong", {}, s("menuLabel")), " · ", t(place.menu)
    )
  );
}

// ---------- 지도 ----------
/** Leaflet 로딩이 실패해도 추천 목록은 보여야 하므로 지도 실패는 조용히 삼킨다 */
function initMap() {
  if (typeof L === "undefined") return hideMap();
  try {
    map = L.map("map").setView([SITE.home.lat, SITE.home.lng], SITE.map.zoom);
    L.tileLayer(SITE.map.tileUrl, {
      maxZoom: SITE.map.maxZoom,
      attribution: SITE.map.tileAttribution,
    }).addTo(map);
  } catch (e) {
    console.error("지도 초기화 실패:", e);
    map = null;
    hideMap();
  }
}

function hideMap() {
  const section = $(".map-section");
  if (section) section.hidden = true;
}

function renderMarkers() {
  if (!map) return;
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  // 좌표를 넣은 곳이 하나도 없으면 집 마커만 덩그러니 남아 지도가 빈 화면처럼 보입니다.
  // 그럴 때는 지도를 통째로 감춥니다. 좌표를 채우면 저절로 다시 나타납니다.
  if (!state.places.some((p) => p.lat != null && p.lng != null)) {
    hideMap();
    return;
  }
  const section = $(".map-section");
  if (section) section.hidden = false;

  // 오조록 집 마커 — 필터와 무관하게 항상 표시 (지도 자체가 브랜딩)
  markers.push(
    L.marker([SITE.home.lat, SITE.home.lng], {
      icon: L.divIcon({
        className: "home-marker",
        html: "🏠",
        iconSize: [26, 26],
        iconAnchor: [13, 24],
      }),
      zIndexOffset: 1000,
    })
      .addTo(map)
      .bindPopup(`<b>${escapeHTML(s("homeMarker"))}</b>`)
  );

  for (const place of visiblePlaces()) {
    if (place.lat == null || place.lng == null) continue;

    const marker = L.marker([place.lat, place.lng])
      .addTo(map)
      .bindPopup(`<b>${escapeHTML(t(place.name))}</b>`);

    // 마커를 누르면 해당 카드로 이동하고 잠깐 강조
    marker.on("click", () => {
      const card = document.getElementById(`place-${place.id}`);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("card--highlight");
      setTimeout(() => card.classList.remove("card--highlight"), 2000);
    });

    markers.push(marker);
  }
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- 공유 ----------
async function share() {
  const url = location.href;

  // 모바일에서는 기기의 공유 시트(카톡·LINE 등)를 띄운다
  if (navigator.share) {
    try {
      await navigator.share({ title: s("docTitle"), url });
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // 사용자가 취소한 경우
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    alert(s("shareCopied"));
  } catch {
    prompt("URL", url);
  }
}

// ---------- 초기화 ----------
function bindEvents() {
  $("#lang-toggle").addEventListener("click", (e) => {
    const button = e.target.closest("[data-lang]");
    if (button) setLang(button.dataset.lang);
  });

  $("#share-btn").addEventListener("click", share);

  $("#sort-distance").addEventListener("change", (e) => {
    state.sortByDistance = e.target.checked;
    render();
  });

  const disclosure = $("#map-disclosure");
  const trigger = $("#map-toggle");
  trigger.addEventListener("click", () => {
    const collapsed = disclosure.dataset.collapsed !== "true";
    disclosure.dataset.collapsed = String(collapsed);
    trigger.setAttribute("aria-expanded", String(!collapsed));
    // 숨겼다 다시 펴면 Leaflet이 크기를 다시 계산해야 한다
    if (!collapsed && map) map.invalidateSize();
  });
}

async function loadPlaces() {
  try {
    const res = await fetch("places.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.places = Array.isArray(data.places) ? data.places : [];
  } catch (e) {
    console.error("places.json 로딩 실패:", e);
    state.places = [];
    state.loadFailed = true;
  }
}

async function init() {
  bindEvents();
  await loadPlaces();
  initMap();
  render();
}

init();
