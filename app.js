/**
 * 오조록 제주 추천 지도 — 화면 동작
 * =========================================================
 * 이 파일은 '로직'만 담당합니다. 고칠 일이 있으면 대부분 아래 파일들입니다:
 *   설정(좌표·예약링크)  → config/site.mjs
 *   카테고리            → config/categories.mjs
 *   화면 문구           → config/strings.mjs
 *   색·글꼴·간격        → styles/tokens.css
 *   추천 목록           → places.json
 */

import { SITE } from "./config/site.mjs";
import { CATEGORIES, categoryByValue } from "./config/categories.mjs";
import { STRINGS } from "./config/strings.mjs";

// ---------- 상태 ----------
const state = {
  lang: readLangFromURL(),
  places: [],
  category: "all", // "all" 또는 카테고리 id
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
/** el("span", { class: "tag", dataset: { category: "food" } }, "맛집") */
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
  $("#header-book-btn").href =
    state.lang === "ko" ? SITE.booking.naver : SITE.booking.airbnb;
  $("#footer-airbnb").href = SITE.booking.airbnb;
  $("#footer-naver").href = SITE.booking.naver;

  renderFilters();
  renderCards();
  renderMarkers();
}

function renderFilters() {
  const container = $("#filter-tabs");
  container.replaceChildren(
    filterChip("all", s("all")),
    ...CATEGORIES.map((c) => filterChip(c.id, c.label[state.lang] || c.label.ko, c.id))
  );
}

function filterChip(id, label, categoryId) {
  const chip = el("button", {
    type: "button",
    class: "chip",
    role: "tab",
    "aria-selected": String(state.category === id),
    dataset: categoryId ? { category: categoryId } : {},
  }, label);
  chip.addEventListener("click", () => {
    state.category = id;
    render();
  });
  return chip;
}

/** 현재 필터·정렬이 적용된 목록 */
function visiblePlaces() {
  let list = state.places.filter((p) => {
    if (state.category === "all") return true;
    return categoryByValue.get(p.category)?.id === state.category;
  });

  if (state.sortByDistance) {
    list = [...list].sort(
      (a, b) => (a.distance_min ?? Infinity) - (b.distance_min ?? Infinity)
    );
  }
  return list;
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
 * 카테고리 태그.
 * 색은 CSS에 카테고리별 규칙을 두지 않고, 여기서 --category-{id}-* 토큰을 가리키게 합니다.
 * 그래서 카테고리를 추가할 때 고칠 곳은 config/categories.mjs 와 styles/tokens.css 두 곳뿐입니다.
 * 토큰이 없는 카테고리는 var() 의 대체값 덕분에 무채색으로 안전하게 표시됩니다.
 */
function categoryTag(category, rawValue) {
  const label = category
    ? category.label[state.lang] || category.label.ko
    : rawValue;

  const tag = el("span", {
    class: "tag",
    dataset: { category: category?.id ?? "" },
  }, label);

  if (category) {
    tag.style.setProperty("--tag-bg", `var(--category-${category.id}-bg, var(--color-surface-sunken))`);
    tag.style.setProperty("--tag-fg", `var(--category-${category.id}-fg, var(--color-text-muted))`);
  }
  return tag;
}

function placeCard(place) {
  const category = categoryByValue.get(place.category);

  const labels = el("div", { class: "card__labels" },
    categoryTag(category, place.category),
    place.distance_min != null &&
      el("span", { class: "badge" }, s("distance")(place.distance_min))
  );

  const body = el("div", { class: "card__body" },
    labels,
    el("h2", { class: "card__title" }, t(place.name)),
    t(place.desc) && el("p", { class: "card__text" }, t(place.desc)),
    t(place.menu) && el("p", { class: "card__meta" },
      el("strong", {}, s("menuLabel")), " · ", t(place.menu)
    ),
    t(place.tip) && el("p", { class: "note" },
      el("span", { class: "note__icon", "aria-hidden": "true" }, "💬"),
      el("span", {},
        el("span", { class: "note__label" }, s("tipLabel") + ": "),
        t(place.tip)
      )
    ),
    directionButtons(place)
  );

  return el("article", {
    class: "card",
    id: `place-${place.id}`,
  },
    place.photo && el("img", {
      class: "card__media",
      src: place.photo,
      alt: t(place.name),
      loading: "lazy",
    }),
    body
  );
}

/** 길찾기 버튼 — 한국어는 네이버맵을, 그 외 언어는 구글맵을 앞에 둔다 */
function directionButtons(place) {
  const naver = mapLink(place.naver, s("naverBtn"));
  const google = mapLink(place.google, s("googleBtn"));
  const ordered = state.lang === "ko" ? [naver, google] : [google, naver];
  const shown = ordered.filter(Boolean);
  if (shown.length === 0) return null;

  shown[0].classList.add("btn--brand");
  shown.slice(1).forEach((b) => b.classList.add("btn--outline"));

  return el("div", { class: "card__actions" }, ...shown);
}

function mapLink(href, label) {
  if (!href) return null;
  return el("a", {
    class: "btn btn--grow",
    href,
    target: "_blank",
    rel: "noopener",
  }, label);
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
