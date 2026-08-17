/**
 * 맛집 카드 한 장 — 손님 화면과 관리 화면이 함께 쓰는 부품
 * =========================================================
 * 왜 따로 떼어냈나요?
 *   관리 화면에서 "손님에게 어떻게 보이는지" 를 그 자리에서 확인하려면
 *   카드가 똑같이 생겨야 합니다. 관리 화면에 비슷하게 생긴 카드를 하나 더
 *   만들어두면, 나중에 카드 디자인을 고칠 때 두 곳을 다 고쳐야 하고
 *   한쪽을 깜빡하면 슬그머니 달라집니다.
 *
 *   그래서 카드를 만드는 코드는 이 파일 하나뿐입니다.
 *   손님 화면(app.js)과 관리 화면(admin.js)이 같은 함수를 부릅니다.
 *   여기를 고치면 양쪽이 자동으로 같이 바뀝니다.
 *
 * 이 파일은 화면 상태(현재 언어·정렬 여부)를 모릅니다.
 * 필요한 것은 부르는 쪽이 넘겨줍니다. 그래야 두 화면에서 똑같이 동작합니다.
 */

import { SITE } from "./config/site.mjs";
import { tagById, sortTagIds } from "./config/tags.mjs";

/** el("span", { class: "tag" }, "횟집") */
export function el(tag, attrs = {}, ...children) {
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

/** 오조록에서 직선거리(km). 좌표가 없으면 null */
export function distanceKm(place) {
  if (place.lat == null || place.lng == null) return null;

  // 제주도만 다루므로 위도 1도 ≈ 111km, 경도 1도 ≈ 93km 로 놓고 평면처럼 계산합니다.
  // 좁은 지역에서는 이 근사로 충분하고, 삼각함수를 쓰는 정식 계산보다 읽기 쉽습니다.
  const dLat = (place.lat - SITE.home.lat) * 111;
  const dLng = (place.lng - SITE.home.lng) * 93;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * 구글맵 링크.
 *
 * 좌표만 넘기면 지도에 핀만 찍히고 "여기가 무슨 가게인지" 는 안 나옵니다.
 * 가게 이름을 함께 넘기면 그 자리에 있는 실제 업장을 찾아 영업시간·리뷰까지
 * 보여줍니다. 이름이 흔해 엉뚱한 곳이 잡히지 않도록 좌표도 같이 보냅니다.
 */
export function googleSearchUrl(place) {
  const name = place.name?.ko;
  if (!name) return place.google || "";

  const params = new URLSearchParams({ api: "1", query: name });
  if (place.lat != null && place.lng != null) {
    params.set("query", `${name} ${place.lat},${place.lng}`);
  }
  return "https://www.google.com/maps/search/?" + params;
}

/**
 * 카드 한 장. 목록을 훑는 화면이므로 담는 것은 네 가지뿐입니다:
 *   이름 + 태그 / 한 줄 소개 / 추천 메뉴 / 길찾기
 *
 * 넘겨야 하는 것(ctx):
 *   lang            현재 언어 ("ko" | "en" | "zh")
 *   t(field)        다국어 필드에서 현재 언어를 꺼내는 함수
 *   tagLabel(id)    태그 id → 현재 언어 이름
 *   mapLabel        지도 아이콘에 마우스를 올렸을 때 나올 말
 *   sortByDistance  '가까운 순'이 켜져 있으면 주소 대신 거리를 보여줍니다
 */
export function placeCard(place, ctx) {
  const { t, tagLabel, lang, mapLabel, sortByDistance = false } = ctx;

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
  const mapHref = lang === "ko"
    ? place.naver || googleSearchUrl(place)
    : googleSearchUrl(place) || place.naver;

  // '가까운 순'을 켰을 때는 주소 대신 거리를 보여줍니다.
  // 근거가 안 보이면 왜 이 순서인지 알 수 없고, 줄을 새로 만들면 카드가 높아집니다.
  const km = distanceKm(place);
  const rightText = sortByDistance && km != null
    ? (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`)
    : shortAddress;

  const locationWrap = el("div", { class: "card__location" },
    rightText ? el("span", { class: "card__address" }, rightText) : null,
    mapHref ? el("a", {
      class: "card__map-icon", href: mapHref, target: "_blank", rel: "noopener",
      title: mapLabel,
      innerHTML: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
    }) : null
  );

  // 추천 메뉴는 이름 바로 옆에 작게 붙입니다.
  // 손님이 카드를 훑을 때 "여기서 뭘 먹지"가 이름 다음으로 궁금한 것이라,
  // 아래 별도 줄로 내리면 한 박자 늦게 눈에 들어옵니다.
  // 쉼표로 나눠 앞의 3개만 보여줍니다 — 더 늘어놓으면 이름을 밀어냅니다.
  const menus = t(place.menu)
    .split(/\s*[,·]\s*/)
    .map((m) => m.trim())
    .filter(Boolean)
    .slice(0, 3);

  const topRow = el("div", { class: "card__row card__row--top" },
    // 영어·중국어 이름은 길어서 두 줄에서 잘립니다. 마우스를 올리면 전체가 보입니다.
    el("h2", { class: "card__title", title: t(place.name) }, t(place.name)),
    menus.length
      ? el("span", { class: "card__menus", title: t(place.menu) },
          ...menus.map((m) => el("span", { class: "card__menu" }, m))
        )
      : null,
    locationWrap
  );

  // 3. 하단 줄 (좌: 한줄소개, 우: 태그 뱃지들)
  const bottomRow = el("div", { class: "card__row card__row--bottom" },
    t(place.desc) ? el("p", { class: "card__text" }, t(place.desc)) : el("div"),
    el("div", { class: "card__labels" },
      ...sortTagIds(place.tags).map((id) => el("span", {
        class: "tag",
        dataset: { tagGroup: tagById.get(id)?.group ?? "" },
      }, tagLabel(id)))
    )
  );

  return el("article", {
    class: "card",
    id: `place-${place.id}`,
  },
    topRow,
    bottomRow
  );
}
