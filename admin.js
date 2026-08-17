/**
 * 주인장 관리 페이지
 * ==================
 * 두 곳에서 똑같이 동작합니다.
 *
 *   내 컴퓨터 (npm run dev)   → 내 컴퓨터의 places.json 을 바로 고침. 올리려면 git push
 *   인터넷 (배포된 사이트)      → 비밀번호로 들어와 GitHub 에 바로 저장. 20초쯤 뒤 손님 화면에 반영
 *
 * "어디에 저장하는가" 는 admin-storage.js 가 혼자 담당합니다.
 * 이 파일은 어느 쪽인지 거의 신경 쓰지 않고, 안내 문구만 조금 달라집니다.
 */

import { TAGS, TAG_GROUPS, tagById, sortTagIds } from "./config/tags.mjs";
import { STRINGS } from "./config/strings.mjs";
import { pickStorage } from "./admin-storage.js";
// 손님 화면과 똑같은 카드를 씁니다. 흉내 낸 게 아니라 같은 함수라,
// 카드 디자인을 고치면 이 화면도 자동으로 따라갑니다.
import { placeCard } from "./place-card.js";

const $ = (sel) => document.querySelector(sel);

const state = {
  storage: null, // 지금 쓰는 저장 방식 (로컬 / 웹)
  data: null, // places.json 전체
  revision: null, // 내가 읽은 시점 표식 (딴 데서 먼저 고쳤는지 판별용)
  editingId: null,
  search: "",
  /** 아래 목록을 어느 언어로 미리 볼지. 번역이 제대로 들어갔는지 확인할 때 씁니다. */
  previewLang: "ko",
};

// ---------- 유틸 ----------

function setStatus(el, message, tone = "") {
  el.textContent = message;
  if (tone) el.dataset.tone = tone;
  else delete el.dataset.tone;
}

/** 저장 뒤 안내 문구 — 저장 방식에 따라 다음에 할 일이 다릅니다 */
function publishNote() {
  return state.storage?.publishesImmediately
    ? "잠시 뒤 손님 화면에 반영됩니다."
    : '아래 "손님 화면에 올리기" 를 따라 하면 실제 사이트에 반영됩니다.';
}

// ---------- 불러오기 / 저장 ----------

async function loadPlaces() {
  const { data, revision } = await state.storage.load();
  state.data = data;
  state.revision = revision;
  if (!Array.isArray(state.data.places)) state.data.places = [];
  renderList();
}

async function saveData(message) {
  const { revision } = await state.storage.save(state.data, state.revision, message);
  state.revision = revision;
}

// ---------- 태그 고르기 ----------

function renderTagPicker() {
  const container = $("#tag-picker");
  container.replaceChildren();

  for (const [groupId, group] of Object.entries(TAG_GROUPS)) {
    const items = TAGS.filter((t) => t.group === groupId);
    if (items.length === 0) continue;

    const box = document.createElement("div");
    box.className = "tag-group";
    box.innerHTML = `<p class="tag-group__title">${group.label.ko}</p>`;

    const list = document.createElement("div");
    list.className = "tag-group__items";

    for (const tag of items) {
      const wrap = document.createElement("label");
      wrap.className = "tag-toggle";
      wrap.innerHTML = `
        <input class="tag-toggle__input" type="checkbox" value="${tag.id}" />
        <span class="tag-toggle__label">${tag.label.ko}</span>`;
      list.append(wrap);
    }

    box.append(list);
    container.append(box);
  }
}

const selectedTags = () =>
  [...document.querySelectorAll(".tag-toggle__input:checked")].map((i) => i.value);

// ---------- 좌표 도우미 ----------

/** 구글지도 링크나 "33.44, 126.91" 형태에서 좌표를 뽑아낸다 */
function extractLatLng(text) {
  if (!text) return null;
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, //  .../@33.44,126.91,15z
    /[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, //  ...?q=33.44,126.91
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, //  ...!3d33.44!4d126.91
    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/, //  33.44, 126.91
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  }
  return null;
}

function applyLatLng(found) {
  if (!found) return false;
  $("#lat").value = found.lat;
  $("#lng").value = found.lng;

  // 좌표 영역은 접혀 있는 게 기본이라, 자동으로 채워졌으면 펴서 보여준다
  const box = $("#coords-help");
  if (box) box.open = true;
  return true;
}

// ---------- 폼 ----------

const TEXT_FIELDS = [
  "#name-ko", "#name-en", "#name-zh",
  "#desc-ko", "#desc-en", "#desc-zh",
  "#menu-ko", "#menu-en", "#menu-zh",
  "#address", "#area", "#naver", "#google",
  "#lat", "#lng", "#distance", "#latlng-paste",
];

function readForm() {
  const text = (sel) => $(sel).value.trim();
  const num = (sel) => {
    const raw = $(sel).value.trim();
    return raw === "" ? null : Number(raw);
  };

  return {
    name: { ko: text("#name-ko"), en: text("#name-en"), zh: text("#name-zh") },
    desc: { ko: text("#desc-ko"), en: text("#desc-en"), zh: text("#desc-zh") },
    menu: { ko: text("#menu-ko"), en: text("#menu-en"), zh: text("#menu-zh") },
    tags: selectedTags(),
    address: text("#address"),
    area: text("#area"),
    naver: text("#naver"),
    google: text("#google"),
    lat: num("#lat"),
    lng: num("#lng"),
    distance: num("#distance"),
  };
}

function validate(form) {
  const problems = [];
  const mark = (sel, bad) => $(sel).setAttribute("aria-invalid", String(bad));

  mark("#name-ko", !form.name.ko);
  if (!form.name.ko) problems.push("식당 이름");

  if (form.tags.length === 0) problems.push("태그 (1개 이상)");

  // 좌표는 비워도 저장됩니다. 그 곳만 지도에 핀이 안 찍힐 뿐 카드는 정상입니다.
  // 다만 넣었다면 제대로 넣었는지는 확인합니다.
  const hasLat = form.lat != null && !Number.isNaN(form.lat);
  const hasLng = form.lng != null && !Number.isNaN(form.lng);
  mark("#lat", false);
  mark("#lng", false);

  if (hasLat !== hasLng) {
    mark("#lat", !hasLat);
    mark("#lng", !hasLng);
    problems.push("위도·경도는 둘 다 넣거나 둘 다 비워주세요");
  } else if (hasLat && hasLng) {
    const outside =
      form.lat < 33.1 || form.lat > 33.6 || form.lng < 126.1 || form.lng > 126.99;
    if (outside) {
      mark("#lat", true);
      mark("#lng", true);
      problems.push("위도·경도 (제주도 범위를 벗어났습니다. 순서가 바뀌지 않았나요?)");
    }
  }

  for (const [sel, key] of [["#naver", "naver"], ["#google", "google"]]) {
    const bad = form[key] !== "" && !/^https?:\/\//.test(form[key]);
    mark(sel, bad);
    if (bad) problems.push("지도 링크는 https:// 로 시작해야 합니다");
  }

  return problems;
}

function makeId(existing) {
  let id;
  do {
    id = "p-" + Math.random().toString(36).slice(2, 8);
  } while (existing.some((p) => p.id === id));
  return id;
}

/** 폼 입력 → places.json 항목 */
function toPlace(form, previous) {
  return {
    id: previous?.id ?? makeId(state.data.places),
    tags: form.tags,
    area: form.area,
    name: form.name,
    address: form.address,
    desc: form.desc,
    menu: form.menu,
    lat: form.lat,
    lng: form.lng,
    naver: form.naver,
    google: form.google,
    photo: previous?.photo ?? "",
    distance_min: form.distance,
  };
}

async function submit() {
  const statusEl = $("#form-status");
  const form = readForm();
  const problems = validate(form);

  if (problems.length) {
    setStatus(statusEl, "빠진 곳이 있어요 — " + problems.join(", "), "error");
    return;
  }

  const button = $("#submit");
  button.disabled = true;
  setStatus(statusEl, "저장 중…");

  try {
    const places = state.data.places;
    const previous = state.editingId
      ? places.find((p) => p.id === state.editingId)
      : null;
    const place = toPlace(form, previous);

    if (previous) {
      places[places.indexOf(previous)] = place;
    } else {
      places.push(place);
    }

    await saveData(
      previous ? `맛집 수정: ${place.name.ko}` : `맛집 추가: ${place.name.ko}`
    );
    renderList();
    resetForm();
    setStatus(statusEl, `저장했습니다 — ${place.name.ko}. ${publishNote()}`, "ok");
  } catch (e) {
    // 저장에 실패했으면 화면의 목록이 실제 파일과 어긋나 있으니 다시 읽어 맞춘다
    setStatus(statusEl, e.message, "error");
    await loadPlaces().catch(() => {});
  } finally {
    button.disabled = false;
  }
}

async function remove(place) {
  if (!confirm(`"${place.name?.ko ?? ""}" 를 목록에서 지울까요?`)) return;

  const statusEl = $("#form-status");
  setStatus(statusEl, "삭제 중…");

  const before = state.data.places;
  try {
    state.data.places = before.filter((p) => p.id !== place.id);
    await saveData(`맛집 삭제: ${place.name?.ko ?? place.id}`);
    renderList();
    setStatus(statusEl, `지웠습니다 — ${place.name?.ko ?? ""}. ${publishNote()}`, "ok");
  } catch (e) {
    setStatus(statusEl, e.message, "error");
    await loadPlaces().catch(() => {});
  }
}

function edit(place) {
  state.editingId = place.id;
  $("#form-title").textContent = `맛집 수정 — ${place.name?.ko ?? ""}`;
  $("#reset-form").hidden = false;

  const set = (sel, value) => ($(sel).value = value ?? "");

  set("#name-ko", place.name?.ko);
  set("#name-en", place.name?.en);
  set("#name-zh", place.name?.zh);
  set("#desc-ko", place.desc?.ko);
  set("#desc-en", place.desc?.en);
  set("#desc-zh", place.desc?.zh);
  set("#menu-ko", place.menu?.ko);
  set("#menu-en", place.menu?.en);
  set("#menu-zh", place.menu?.zh);
  set("#address", place.address);
  set("#area", place.area);
  set("#naver", place.naver);
  set("#google", place.google);
  set("#lat", place.lat);
  set("#lng", place.lng);
  set("#distance", place.distance_min);
  set("#latlng-paste", "");

  // 좌표가 이미 있는 곳이면 접힌 영역을 펴서, 값이 들어 있다는 걸 보이게 한다
  const coords = $("#coords-help");
  if (coords) coords.open = place.lat != null && place.lng != null;

  // 번역이 하나라도 채워져 있으면 펴서 보여준다
  const i18n = $("#i18n-help");
  if (i18n) {
    i18n.open = Boolean(
      place.name?.en || place.name?.zh || place.desc?.en || place.desc?.zh ||
      place.menu?.en || place.menu?.zh
    );
  }

  const tags = new Set(place.tags || []);
  document.querySelectorAll(".tag-toggle__input").forEach((input) => {
    input.checked = tags.has(input.value);
  });

  $("#form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  state.editingId = null;
  $("#form-title").textContent = "맛집 추가";
  $("#reset-form").hidden = true;

  for (const sel of TEXT_FIELDS) {
    $(sel).value = "";
    $(sel).removeAttribute("aria-invalid");
  }

  // 선택 항목들은 새로 입력할 때 접어둔다
  for (const sel of ["#coords-help", "#i18n-help"]) {
    const box = $(sel);
    if (box) box.open = false;
  }

  document.querySelectorAll(".tag-toggle__input").forEach((i) => (i.checked = false));
}

// ---------- 등록된 목록 ----------

/** 검색어에 걸리는지 — 이름·소개·메뉴·지역을 언어 구분 없이 봅니다 */
function matchesSearch(place, needle) {
  if (!needle) return true;
  const haystack = [
    place.name?.ko, place.name?.en, place.name?.zh,
    place.desc?.ko, place.desc?.en, place.desc?.zh,
    place.menu?.ko, place.menu?.en, place.menu?.zh,
    place.area, place.address,
    ...(place.tags || []).map((id) => tagById.get(id)?.label.ko ?? id),
  ];
  return haystack.some((v) => v && String(v).toLowerCase().includes(needle));
}

/** 이 곳에서 아직 안 채워진 것 — 목록에서 한눈에 보이게 합니다 */
function gaps(place) {
  const list = [];
  if (place.lat == null || place.lng == null) list.push("좌표 없음");
  if (!place.name?.en || !place.name?.zh) list.push("번역 없음");
  if (!place.desc?.ko) list.push("소개 없음");
  return list;
}

/** 손님 화면에서 쓰는 것과 같은 방식으로 다국어 필드를 꺼낸다 */
function pick(field) {
  if (typeof field === "string") return field;
  return field?.[state.previewLang] || field?.ko || "";
}

/** 태그 이름 — 지금 미리보기 언어로 */
function previewTagLabel(id) {
  const tag = tagById.get(id);
  return tag ? tag.label[state.previewLang] || tag.label.ko : id;
}

/** 손님 화면의 문구를 지금 미리보기 언어로 */
function previewString(key) {
  return STRINGS[state.previewLang]?.[key] ?? STRINGS.ko[key] ?? key;
}

function renderList() {
  const container = $("#place-list");
  const all = state.data?.places ?? [];
  const needle = state.search.trim().toLowerCase();
  const places = all.filter((p) => matchesSearch(p, needle));

  $("#place-count").textContent = needle
    ? `${places.length} / ${all.length}곳`
    : `${all.length}곳`;

  container.replaceChildren();

  if (all.length === 0) {
    container.innerHTML = `<p class="panel__hint">아직 등록된 곳이 없습니다.</p>`;
    return;
  }

  if (places.length === 0) {
    container.innerHTML = `<p class="panel__hint">찾는 곳이 없습니다.</p>`;
    return;
  }

  for (const place of places) {
    // 손님 화면과 똑같은 카드. '가까운 순'은 손님이 켜야 보이는 것이라 여기서는 끕니다.
    const card = placeCard(place, {
      lang: state.previewLang,
      t: pick,
      tagLabel: previewTagLabel,
      mapLabel: state.previewLang === "ko"
        ? previewString("naverBtn")
        : previewString("googleBtn"),
      sortByDistance: false,
    });

    const wrap = document.createElement("div");
    wrap.className = "preview-item";
    if (place.id === state.editingId) wrap.dataset.editing = "true";

    // 아직 안 채운 것 — 손님에게는 안 보이지만 주인장은 알아야 합니다
    const missing = gaps(place);
    if (missing.length) {
      const flags = document.createElement("div");
      flags.className = "preview-item__gaps";
      for (const gap of missing) {
        const flag = document.createElement("span");
        flag.className = "place-row__gap";
        flag.textContent = gap;
        flags.append(flag);
      }
      wrap.append(flags);
    }

    wrap.append(card);

    // 카드 위에 얹는 수정·삭제 버튼.
    // 손님 화면의 관리 바와 같은 자리(카드 오른쪽 아래)에 둡니다.
    const actions = document.createElement("div");
    actions.className = "preview-item__actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn--outline btn--sm";
    editBtn.textContent = "수정";
    editBtn.addEventListener("click", () => edit(place));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn--ghost btn--sm";
    delBtn.textContent = "삭제";
    delBtn.addEventListener("click", () => remove(place));

    actions.append(editBtn, delBtn);
    wrap.append(actions);

    container.append(wrap);
  }
}

// ---------- 화면 전환 ----------

function show(which) {
  const panels = {
    offline: $("#offline-panel"),
    login: $("#login-panel"),
    editor: null, // 아래에서 여러 개를 함께 켭니다
  };

  for (const el of Object.values(panels)) if (el) el.hidden = true;
  $("#form-panel").hidden = true;
  $("#list-panel").hidden = true;
  $("#publish-panel").hidden = true;

  if (which === "offline") panels.offline.hidden = false;
  if (which === "login") panels.login.hidden = false;

  if (which === "editor") {
    $("#form-panel").hidden = false;
    $("#list-panel").hidden = false;
    // "git push 하세요" 안내는 내 컴퓨터에서 고칠 때만 의미가 있습니다
    $("#publish-panel").hidden = Boolean(state.storage?.publishesImmediately);
    $("#logout").hidden = !state.storage?.logout;
  }
}

/** 지금 어느 방식으로 저장하는지 헤더에 표시 */
function showMode() {
  const badge = $("#mode-badge");
  if (!state.storage) {
    badge.hidden = true;
    return;
  }
  badge.hidden = false;
  badge.textContent = state.storage.publishesImmediately ? "웹에서 바로 저장" : "내 컴퓨터";
  badge.dataset.mode = state.storage.id;
}

// ---------- 로그인 ----------

async function doLogin() {
  const statusEl = $("#login-status");
  const password = $("#password").value;

  if (!password) {
    setStatus(statusEl, "비밀번호를 입력해주세요.", "error");
    return;
  }

  const button = $("#login-btn");
  button.disabled = true;
  setStatus(statusEl, "확인 중…");

  try {
    await state.storage.login(password);
    $("#password").value = "";
    setStatus(statusEl, "");
    await startEditing();
  } catch (e) {
    setStatus(statusEl, e.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function doLogout() {
  await state.storage.logout?.();
  location.reload();
}

// ---------- 시작 ----------

/**
 * 손님 화면의 '수정' 버튼으로 들어왔으면(?edit=아이디) 그 집을 바로 폼에 채운다.
 * 관리자 페이지에서 37곳 중에 다시 찾는 수고를 없애는 부분입니다.
 */
function openRequestedPlace() {
  const wanted = new URLSearchParams(location.search).get("edit");
  if (!wanted) return;

  const place = state.data.places.find((p) => p.id === wanted);
  if (!place) {
    setStatus($("#form-status"), "그 맛집을 찾지 못했습니다. 목록에서 다시 골라주세요.", "error");
    return;
  }

  edit(place);

  // 주소창의 ?edit= 는 지워둡니다.
  // 남겨두면 새로고침할 때마다 같은 집이 다시 열려, 다른 집을 고치다 헷갈립니다.
  history.replaceState(null, "", location.pathname);
}

async function startEditing() {
  try {
    await loadPlaces();
    show("editor");
    openRequestedPlace();
  } catch (e) {
    show("offline");
    $("#offline-panel").insertAdjacentHTML(
      "beforeend",
      `<p class="status" data-tone="error"></p>`
    );
    $("#offline-panel").querySelector(".status:last-child").textContent = e.message;
  }
}

async function init() {
  renderTagPicker();

  $("#submit").addEventListener("click", submit);
  $("#reset-form").addEventListener("click", resetForm);
  $("#login-btn").addEventListener("click", doLogin);
  $("#logout").addEventListener("click", doLogout);

  $("#password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  $("#add-new").addEventListener("click", () => {
    resetForm();
    $("#form-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#name-ko").focus();
  });

  $("#search").addEventListener("input", (e) => {
    state.search = e.target.value;
    renderList();
  });

  // 미리보기 언어 — 번역이 제대로 들어갔는지 그 자리에서 확인할 수 있습니다
  $("#preview-lang").addEventListener("click", (e) => {
    const button = e.target.closest("[data-lang]");
    if (!button) return;

    state.previewLang = button.dataset.lang;
    for (const b of $("#preview-lang").querySelectorAll("[data-lang]")) {
      b.setAttribute("aria-selected", String(b.dataset.lang === state.previewLang));
    }
    renderList();
  });

  // 구글맵 링크를 붙여넣으면 좌표를 자동으로 채워준다
  $("#google").addEventListener("input", (e) => {
    if ($("#lat").value || $("#lng").value) return; // 이미 채웠으면 건드리지 않는다
    applyLatLng(extractLatLng(e.target.value));
  });

  $("#latlng-paste").addEventListener("input", (e) => {
    if (applyLatLng(extractLatLng(e.target.value))) {
      $("#lat").removeAttribute("aria-invalid");
      $("#lng").removeAttribute("aria-invalid");
    }
  });

  state.storage = await pickStorage();

  if (!state.storage) {
    show("offline");
    return;
  }

  showMode();

  // 웹 방식이면 로그인이 필요한지 먼저 확인합니다
  try {
    if (await state.storage.needsLogin()) {
      show("login");
      $("#password").focus();
      return;
    }
  } catch (e) {
    // 설정이 덜 된 경우 (환경변수 누락) — 무엇이 빠졌는지 그대로 보여줍니다
    show("offline");
    $("#offline-panel").querySelector(".panel__title").textContent = "설정이 더 필요합니다";
    const hint = $("#offline-panel").querySelector(".panel__hint");
    hint.textContent = e.message;
    return;
  }

  await startEditing();
}

init();
