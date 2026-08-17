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
import { TAGS, tagById } from "./config/tags.mjs";
import { STRINGS } from "./config/strings.mjs";
// 카드 만드는 코드는 관리 화면과 함께 씁니다 (place-card.js 참고).
// 그래야 관리 화면에서 손님에게 보이는 모습 그대로 확인할 수 있습니다.
import {
  el,
  distanceKm,
  googleSearchUrl,
  placeCard as sharedPlaceCard,
} from "./place-card.js";

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

/** 카드를 다시 그린 뒤 '수정' 버튼을 다시 붙이는 함수.
 *  손님에게는 아무 일도 하지 않는 빈 함수로 남습니다. */
let decorateAdminCards = () => {};
// 네이버 지도는 말풍선을 여러 개 동시에 띄울 수 있어, 직전 것을 닫으려면 붙잡아둬야 합니다
let openPopup = null;

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
// el() 은 place-card.js 에 있습니다 (맨 위에서 가져옵니다)

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

  // 주인장이 로그인한 상태면 카드마다 '수정' 버튼을 다시 붙입니다.
  // 손님에게는 이 함수가 아무 일도 하지 않습니다 (admin-bar.js 참고).
  decorateAdminCards();
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

// googleSearchUrl() 과 distanceKm() 도 place-card.js 에 있습니다 (맨 위에서 가져옵니다)

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
 * 카드 한 장.
 * 실제로 만드는 코드는 place-card.js 에 있습니다 — 관리 화면도 같은 함수를 부르므로
 * 두 화면의 카드가 항상 똑같이 보입니다. 카드 모양을 고치려면 그 파일을 고치세요.
 * 여기서는 지금 화면 상태(언어·정렬)만 넘겨줍니다.
 */
function placeCard(place) {
  return sharedPlaceCard(place, {
    lang: state.lang,
    t,
    tagLabel,
    mapLabel: state.lang === "ko" ? s("naverBtn") : s("googleBtn"),
    sortByDistance: state.sortByDistance,
  });
}

// ---------- 지도 ----------
//
// 지도 그림은 두 가지 중에서 고릅니다 (config/site.mjs 의 map.provider).
//   naver  상호가 보이지만 글자가 한국어. 네이버가 만든 지도 프로그램을 씁니다.
//   osm    영문 표기. Leaflet + OpenStreetMap 을 씁니다.
// 둘은 아예 다른 프로그램이라 마커를 찍는 방법도 다릅니다.
// 그 차이는 아래 addMarker() 안에만 가둬두고, 나머지 코드는 신경 쓰지 않습니다.

const useNaver = () => SITE.map.provider === "naver";

/** 지도 로딩이 실패해도 추천 목록은 보여야 하므로 지도 실패는 조용히 삼킨다 */
function initMap() {
  try {
    if (useNaver()) {
      if (typeof naver === "undefined" || !naver.maps) return hideMap();
      map = new naver.maps.Map("map", {
        center: new naver.maps.LatLng(SITE.home.lat, SITE.home.lng),
        zoom: SITE.map.zoom,
      });
    } else {
      if (typeof L === "undefined") return hideMap();
      map = L.map("map").setView([SITE.home.lat, SITE.home.lng], SITE.map.zoom);
      L.tileLayer(SITE.map.tileUrl, {
        maxZoom: SITE.map.maxZoom,
        attribution: SITE.map.tileAttribution,
      }).addTo(map);
    }
  } catch (e) {
    console.error("지도 초기화 실패:", e);
    map = null;
    hideMap();
  }
}

/**
 * 마커 하나를 지도에 얹는다. 두 지도의 차이는 여기서만 다룬다.
 * onClick 을 주면 마커를 눌렀을 때 그 함수가 불린다.
 */
function addMarker({ lat, lng, label, home = false, onClick }) {
  // 말풍선 안에 넣을 내용.
  // 카드로 갈 수 있는 곳이면 눌러서 이동할 수 있다고 알려줍니다.
  const popupHTML = onClick
    ? `<button type="button" class="map-popup map-popup--link">${escapeHTML(label)}<span class="map-popup__go">${escapeHTML(s("popupGo"))}</span></button>`
    : `<div class="map-popup">${escapeHTML(label)}</div>`;

  if (useNaver()) {
    const marker = new naver.maps.Marker({
      position: new naver.maps.LatLng(lat, lng),
      map,
      title: label,
      ...(home
        ? {
            icon: {
              content: `<div class="home-marker">🏠</div>`,
              anchor: new naver.maps.Point(13, 24),
            },
            zIndex: 1000,
          }
        : {}),
    });

    const info = new naver.maps.InfoWindow({
      content: popupHTML,
      borderWidth: 0,
      backgroundColor: "transparent",
      disableAnchor: true,
      pixelOffset: new naver.maps.Point(0, -4),
    });

    // 마커를 누르면 말풍선만 엽니다. 카드로 내려가는 건 말풍선을 눌렀을 때입니다.
    // 마커를 누르자마자 목록이 움직이면 지도를 훑어보기가 어렵습니다.
    naver.maps.Event.addListener(marker, "click", () => {
      if (openPopup && openPopup !== info) openPopup.close();
      info.open(map, marker);
      openPopup = info;

      if (!onClick) return;
      // 말풍선은 열린 뒤에야 화면에 생기므로 그때 눌림을 붙입니다.
      // 같은 요소를 다시 쓰는 경우가 있어, 먼저 떼고 붙여 두 번 불리지 않게 합니다.
      const box = info.getContentElement();
      if (!box) return;
      box.removeEventListener("click", onClick);
      box.addEventListener("click", onClick);
    });

    return marker;
  }

  const marker = L.marker(
    [lat, lng],
    home
      ? {
          icon: L.divIcon({
            className: "home-marker",
            html: "🏠",
            iconSize: [26, 26],
            iconAnchor: [13, 24],
          }),
          zIndexOffset: 1000,
        }
      : {}
  )
    .addTo(map)
    .bindPopup(popupHTML, { closeButton: false });

  if (onClick) {
    // 말풍선이 열릴 때마다 눌림을 붙입니다.
    // 같은 요소를 다시 쓰는 경우가 있어, 먼저 떼고 붙여 두 번 불리지 않게 합니다.
    marker.on("popupopen", (e) => {
      const box = e.popup.getElement()?.querySelector(".map-popup--link");
      if (!box) return;
      box.removeEventListener("click", onClick);
      box.addEventListener("click", onClick);
    });
  }
  return marker;
}

/** 지도에서 마커를 모두 지운다 */
function clearMarkers() {
  // 마커가 사라지면 그 마커에 매달린 말풍선도 갈 곳이 없어지므로 함께 닫습니다
  openPopup?.close();
  openPopup = null;

  for (const m of markers) {
    if (useNaver()) m.setMap(null);
    else map.removeLayer(m);
  }
  markers = [];
}

function hideMap() {
  const section = $(".map-section");
  if (section) section.hidden = true;
}

function renderMarkers() {
  if (!map) return;
  clearMarkers();

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
    addMarker({
      lat: SITE.home.lat,
      lng: SITE.home.lng,
      label: s("homeMarker"),
      home: true,
    })
  );

  for (const place of visiblePlaces()) {
    if (place.lat == null || place.lng == null) continue;

    markers.push(
      addMarker({
        lat: place.lat,
        lng: place.lng,
        label: t(place.name),
        // 말풍선을 누르면 해당 카드로 내려가고 잠깐 강조합니다
        onClick: () => {
          const card = document.getElementById(`place-${place.id}`);
          if (!card) return;

          // 목록으로 내려간 뒤 지도 위에 말풍선만 남아 있으면 지저분합니다
          if (useNaver()) {
            openPopup?.close();
            openPopup = null;
          } else {
            map.closePopup();
          }

          card.scrollIntoView({ behavior: "smooth", block: "center" });
          card.classList.add("card--highlight");
          setTimeout(() => card.classList.remove("card--highlight"), 2000);
        },
      })
    );
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

  // 관리 바 — 주인장이 로그인했을 때만 나타납니다.
  // 손님 화면에는 아무것도 그려지지 않으므로 여기서 실패해도 목록은 그대로입니다.
  try {
    const { enableAdminBar } = await import("./admin-bar.js");
    decorateAdminCards = await enableAdminBar();
    decorateAdminCards();
  } catch {
    // 관리 바를 못 불러와도 손님 화면은 정상 동작해야 합니다
  }
}

init();
