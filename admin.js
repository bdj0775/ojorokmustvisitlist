/**
 * 주인장 관리 페이지 — 내 컴퓨터의 places.json 을 고칩니다.
 * ======================================================
 * 저장 흐름:
 *   npm run dev 로 켠 개발 서버를 통해 로컬 places.json 을 읽음
 *   → 항목을 더하거나 고침 → 로컬 파일에 바로 저장
 *   → 손님 화면에 올리려면 내가 직접 git push
 *
 * 예전에는 이 페이지가 GitHub 에 직접 커밋했습니다. 그래서 열쇠(토큰)가 필요했고,
 * 내 컴퓨터의 파일은 옛날 버전으로 남아 자꾸 어긋났습니다. 지금은 그 문제가 없습니다.
 *
 * "어디에 저장하는가" 는 admin-storage.js 가 혼자 담당합니다.
 * 나중에 웹에서 쓰고 싶어지면 그 파일만 고치면 되고, 이 파일은 그대로 둡니다.
 */

import { TAGS, TAG_GROUPS, tagById, sortTagIds } from "./config/tags.mjs";
import { localFileStorage } from "./admin-storage.js";

const storage = localFileStorage;

const $ = (sel) => document.querySelector(sel);

const state = {
  data: null, // places.json 전체
  revision: null, // 내가 읽은 시점 표식 (딴 데서 먼저 고쳤는지 판별용)
  editingId: null,
};

// ---------- 유틸 ----------

function setStatus(el, message, tone = "") {
  el.textContent = message;
  if (tone) el.dataset.tone = tone;
  else delete el.dataset.tone;
}

// ---------- 불러오기 ----------

async function loadPlaces() {
  const { data, revision } = await storage.load();
  state.data = data;
  state.revision = revision;
  if (!Array.isArray(state.data.places)) state.data.places = [];
  renderList();
}

/** 저장 직전에 항상 다시 읽어, 내가 화면을 열어둔 사이 생긴 변경 위에 얹는다 */
async function saveData(message) {
  const { revision } = await storage.save(state.data, state.revision);
  state.revision = revision;
  return message;
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

function readForm() {
  const num = (sel) => {
    const raw = $(sel).value.trim();
    return raw === "" ? null : Number(raw);
  };

  return {
    name: $("#name-ko").value.trim(),
    tags: selectedTags(),
    address: $("#address").value.trim(),
    naver: $("#naver").value.trim(),
    google: $("#google").value.trim(),
    lat: num("#lat"),
    lng: num("#lng"),
    desc: $("#desc-ko").value.trim(),
    menu: $("#menu-ko").value.trim(),
    distance: num("#distance"),
  };
}

function validate(form) {
  const problems = [];
  const mark = (sel, bad) => $(sel).setAttribute("aria-invalid", String(bad));

  mark("#name-ko", !form.name);
  if (!form.name) problems.push("식당 이름");

  if (form.tags.length === 0) problems.push("태그 (1개 이상)");

  // 좌표는 비워도 저장됩니다. 그 곳만 지도에 핀이 안 찍힐 뿐 카드는 정상입니다.
  // 한 곳씩 좌표를 찾아 넣는 게 번거로워 필수에서 뺐습니다.
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

/** 폼 입력 → places.json 항목. 수정일 때는 기존 번역을 지키기 위해 이어붙인다. */
function toPlace(form, previous) {
  const multilingual = (value, before) => ({
    ko: value,
    en: value === before?.ko ? before?.en ?? "" : before?.en ?? "",
    zh: value === before?.ko ? before?.zh ?? "" : before?.zh ?? "",
  });

  return {
    id: previous?.id ?? makeId(state.data.places),
    tags: form.tags,
    area: previous?.area ?? "",
    name: multilingual(form.name, previous?.name),
    address: form.address,
    desc: multilingual(form.desc, previous?.desc),
    menu: multilingual(form.menu, previous?.menu),
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

    await saveData();
    renderList();
    resetForm();
    setStatus(
      statusEl,
      `저장했습니다 — ${place.name.ko}. 아래 "손님 화면에 올리기" 를 따라 하면 실제 사이트에 반영됩니다.`,
      "ok"
    );
  } catch (e) {
    // 저장에 실패했으면 화면의 목록이 파일과 어긋나 있으니 다시 읽어 맞춘다
    setStatus(statusEl, e.message, "error");
    await loadPlaces().catch(() => {});
  } finally {
    button.disabled = false;
  }
}

async function remove(place) {
  if (!confirm(`"${place.name.ko}" 를 목록에서 지울까요?`)) return;

  const statusEl = $("#form-status");
  setStatus(statusEl, "삭제 중…");

  try {
    state.data.places = state.data.places.filter((p) => p.id !== place.id);
    await saveData();
    renderList();
    setStatus(
      statusEl,
      `지웠습니다 — ${place.name.ko}. 아래 "손님 화면에 올리기" 를 따라 하면 실제 사이트에 반영됩니다.`,
      "ok"
    );
  } catch (e) {
    setStatus(statusEl, e.message, "error");
    await loadPlaces().catch(() => {});
  }
}

function edit(place) {
  state.editingId = place.id;
  $("#form-title").textContent = `맛집 수정 — ${place.name.ko}`;
  $("#reset-form").hidden = false;

  $("#name-ko").value = place.name?.ko ?? "";
  $("#address").value = place.address ?? "";
  $("#naver").value = place.naver ?? "";
  $("#google").value = place.google ?? "";
  $("#lat").value = place.lat ?? "";
  $("#lng").value = place.lng ?? "";
  $("#desc-ko").value = place.desc?.ko ?? "";
  $("#menu-ko").value = place.menu?.ko ?? "";
  $("#distance").value = place.distance_min ?? "";

  // 좌표가 이미 있는 곳이면 접힌 영역을 펴서, 값이 들어 있다는 걸 보이게 한다
  const coords = $("#coords-help");
  if (coords) coords.open = place.lat != null && place.lng != null;

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

  for (const sel of ["#name-ko", "#address", "#naver", "#google", "#lat",
                     "#lng", "#desc-ko", "#menu-ko", "#distance", "#latlng-paste"]) {
    $(sel).value = "";
    $(sel).removeAttribute("aria-invalid");
  }
  // 좌표는 선택 사항이라 새로 입력할 때는 접어둔다
  const coords = $("#coords-help");
  if (coords) coords.open = false;

  document.querySelectorAll(".tag-toggle__input").forEach((i) => (i.checked = false));
}

// ---------- 등록된 목록 ----------

function renderList() {
  const container = $("#place-list");
  const places = state.data?.places ?? [];
  $("#place-count").textContent = `${places.length}곳`;
  container.replaceChildren();

  if (places.length === 0) {
    container.innerHTML = `<p class="panel__hint">아직 등록된 곳이 없습니다.</p>`;
    return;
  }

  for (const place of places) {
    const row = document.createElement("div");
    row.className = "place-row";

    const main = document.createElement("div");
    main.className = "place-row__main";

    const name = document.createElement("p");
    name.className = "place-row__name";
    name.textContent = place.name?.ko ?? "(이름 없음)";
    main.append(name);

    const tags = document.createElement("div");
    tags.className = "place-row__tags";
    for (const id of sortTagIds(place.tags)) {
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.dataset.tagGroup = tagById.get(id)?.group ?? "";
      chip.textContent = tagById.get(id)?.label.ko ?? id;
      tags.append(chip);
    }
    main.append(tags);
    row.append(main);

    const actions = document.createElement("div");
    actions.className = "place-row__actions";

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
    row.append(actions);
    container.append(row);
  }
}

// ---------- 시작 ----------

/** 저장할 곳이 없으면(개발 서버가 꺼져 있으면) 안내만 띄우고 폼은 감춘다 */
function showOffline() {
  $("#offline-panel").hidden = false;
  $("#form-panel").hidden = true;
  $("#list-panel").hidden = true;
  $("#publish-panel").hidden = true;
}

function showEditor() {
  $("#offline-panel").hidden = true;
  $("#form-panel").hidden = false;
  $("#list-panel").hidden = false;
  $("#publish-panel").hidden = false;
}

async function init() {
  renderTagPicker();

  $("#submit").addEventListener("click", submit);
  $("#reset-form").addEventListener("click", resetForm);

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

  if (!(await storage.available())) {
    showOffline();
    return;
  }

  try {
    await loadPlaces();
    showEditor();
  } catch (e) {
    showOffline();
    $("#offline-panel").insertAdjacentHTML(
      "beforeend",
      `<p class="status" data-tone="error">${e.message}</p>`
    );
  }
}

init();
