/**
 * 주인장 관리 페이지 — places.json 을 GitHub 에 직접 저장합니다.
 * =========================================================
 * 저장 흐름:
 *   GitHub 에서 places.json 을 읽어옴 → 항목을 더하거나 고침 → 다시 저장(커밋)
 *   → 저장소가 바뀌면 자동 검사·배포가 돌아 1~2분 뒤 손님 화면에 반영됩니다.
 *
 * 토큰(열쇠)은 이 파일에도, 저장소에도 들어 있지 않습니다.
 * 주인장이 화면에서 입력한 값을 그 사람 브라우저(localStorage)에만 보관합니다.
 */

import { SITE } from "./config/site.mjs";
import { TAGS, TAG_GROUPS, tagById, sortTagIds } from "./config/tags.mjs";

const API = "https://api.github.com";
const TOKEN_KEY = "ojorok.github.token";
const { owner, repo, path } = SITE.github;

const $ = (sel) => document.querySelector(sel);

const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  branch: SITE.github.branch || "",
  data: null, // places.json 전체
  sha: null, // 저장할 때 필요한 파일 버전 표시
  editingId: null,
};

// ---------- 유틸 ----------

/** 한글이 깨지지 않게 UTF-8 → base64 */
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** base64 → UTF-8 */
function fromBase64(b64) {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function setStatus(el, message, tone = "") {
  el.textContent = message;
  if (tone) el.dataset.tone = tone;
  else delete el.dataset.tone;
}

/** GitHub API 호출. 실패하면 사람이 읽을 수 있는 한국어 메시지로 바꿔 던진다. */
async function github(endpoint, options = {}) {
  const res = await fetch(API + endpoint, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${state.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (res.ok) return res.status === 204 ? null : res.json();

  const detail = await res.json().catch(() => ({}));
  const messages = {
    401: "열쇠가 올바르지 않거나 만료됐습니다. 새로 만들어 다시 저장해주세요.",
    403: "열쇠에 권한이 없습니다. Contents 권한을 'Read and write' 로 주셨는지 확인해주세요.",
    404: `저장소나 파일을 찾을 수 없습니다 (${owner}/${repo} · ${path}). 열쇠에 이 저장소를 선택하셨는지 확인해주세요.`,
    409: "다른 곳에서 먼저 저장했습니다. 화면을 새로고침한 뒤 다시 시도해주세요.",
    422: "저장 내용을 GitHub 이 거절했습니다. " + (detail.message || ""),
  };
  throw new Error(messages[res.status] || `GitHub 오류 (${res.status}) ${detail.message || ""}`);
}

// ---------- 열쇠 ----------

async function connect() {
  const statusEl = $("#auth-status");
  setStatus(statusEl, "확인 중…");

  try {
    if (!state.branch) {
      const info = await github(`/repos/${owner}/${repo}`);
      state.branch = info.default_branch;
    }
    await loadPlaces();

    localStorage.setItem(TOKEN_KEY, state.token);
    setStatus(statusEl, `연결됐습니다 (${state.branch} 브랜치)`, "ok");
    $("#form-panel").hidden = false;
    $("#list-panel").hidden = false;
  } catch (e) {
    setStatus(statusEl, e.message, "error");
    $("#form-panel").hidden = true;
    $("#list-panel").hidden = true;
  }
}

async function loadPlaces() {
  const file = await github(
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(state.branch)}`
  );
  state.sha = file.sha;
  state.data = JSON.parse(fromBase64(file.content));
  if (!Array.isArray(state.data.places)) state.data.places = [];
  renderList();
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

  const badLat = form.lat == null || Number.isNaN(form.lat);
  const badLng = form.lng == null || Number.isNaN(form.lng);
  mark("#lat", badLat);
  mark("#lng", badLng);
  if (badLat || badLng) problems.push("위도·경도");

  if (!badLat && !badLng) {
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
    // 다른 곳에서 먼저 바꿨을 수 있으니 항상 최신 파일을 다시 받아 그 위에 얹는다
    await loadPlaces();

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

    await github(`/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message: previous
          ? `맛집 수정: ${place.name.ko}`
          : `맛집 추가: ${place.name.ko}`,
        content: toBase64(JSON.stringify(state.data, null, 2) + "\n"),
        sha: state.sha,
        branch: state.branch,
      }),
    });

    await loadPlaces();
    resetForm();
    setStatus(
      statusEl,
      `저장했습니다. 1~2분 뒤 손님 화면에 반영됩니다.`,
      "ok"
    );
  } catch (e) {
    setStatus(statusEl, e.message, "error");
  } finally {
    button.disabled = false;
  }
}

async function remove(place) {
  if (!confirm(`"${place.name.ko}" 를 목록에서 지울까요?`)) return;

  const statusEl = $("#form-status");
  setStatus(statusEl, "삭제 중…");

  try {
    await loadPlaces();
    state.data.places = state.data.places.filter((p) => p.id !== place.id);

    await github(`/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `맛집 삭제: ${place.name.ko}`,
        content: toBase64(JSON.stringify(state.data, null, 2) + "\n"),
        sha: state.sha,
        branch: state.branch,
      }),
    });

    await loadPlaces();
    setStatus(statusEl, "지웠습니다. 1~2분 뒤 손님 화면에 반영됩니다.", "ok");
  } catch (e) {
    setStatus(statusEl, e.message, "error");
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

function init() {
  renderTagPicker();

  $("#token").value = state.token;

  $("#save-token").addEventListener("click", () => {
    state.token = $("#token").value.trim();
    if (!state.token) {
      setStatus($("#auth-status"), "열쇠를 붙여넣어 주세요.", "error");
      return;
    }
    connect();
  });

  $("#clear-token").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    state.token = "";
    $("#token").value = "";
    $("#form-panel").hidden = true;
    $("#list-panel").hidden = true;
    setStatus($("#auth-status"), "이 브라우저에서 열쇠를 지웠습니다.");
  });

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

  if (state.token) connect();
}

init();
