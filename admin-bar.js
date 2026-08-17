/**
 * 관리 바 — 손님 화면에서 관리자 페이지로 가는 지름길
 * =========================================================
 * 손님 화면(index.html)을 보다가 "이 집 고쳐야겠다" 싶을 때,
 * 관리자 페이지에서 37곳 중에 다시 찾는 수고를 없애줍니다.
 *
 * 손님에게는 이 화면이 존재하지 않습니다.
 * -----------------------------------------------------
 * 아래 enableAdminBar() 는 서버에 "나 로그인돼 있나?" 를 한 번 묻고,
 * 아니라고 하면 **아무것도 그리지 않고 그대로 끝납니다.**
 * CSS 로 숨기는 게 아니라 HTML 자체가 만들어지지 않으므로,
 * 손님이 소스를 봐도 관리 바 흔적이 없습니다.
 *
 * 혹시 억지로 이 화면을 띄우더라도 고칠 수는 없습니다 —
 * 저장은 서버(api/places.mjs)가 담당하고, 서버는 출입증 없는 요청을 거절합니다.
 * 즉 이 파일은 '편의'만 담당하고 '보안'은 서버가 담당합니다.
 *
 * 이 화면은 주인장만 보므로 번역하지 않습니다 (한국어 고정).
 */

/** 로그인한 상태인지 서버에 물어본다. 배포 안 된 곳(로컬 등)에서는 조용히 false. */
async function isLoggedIn() {
  try {
    const res = await fetch("/api/login", { cache: "no-store" });
    if (!res.ok) return false;
    const body = await res.json();
    return Boolean(body.loggedIn);
  } catch {
    // 창구가 아예 없는 환경(개발 서버 등) — 관리 바 없이 평소대로 동작합니다
    return false;
  }
}

/** 관리 바 전용 CSS 를 이때 가져온다 (손님은 받지 않습니다) */
function loadStyles() {
  if (document.getElementById("admin-bar-css")) return;
  const link = document.createElement("link");
  link.id = "admin-bar-css";
  link.rel = "stylesheet";
  link.href = "./styles/admin-bar.css";
  document.head.append(link);
}

/** 화면 맨 위에 붙는 띠 */
function buildBar() {
  const bar = document.createElement("div");
  bar.className = "admin-bar";
  bar.innerHTML = `
    <span class="admin-bar__label">🔧 관리 중</span>
    <span class="admin-bar__hint">카드의 <b>수정</b>을 누르면 그 집이 열립니다</span>
    <span class="admin-bar__spacer"></span>
    <a class="admin-bar__btn" href="./admin.html">목록 · 추가</a>
    <button type="button" class="admin-bar__btn" data-action="logout">로그아웃</button>
  `;

  bar.querySelector('[data-action="logout"]').addEventListener("click", async () => {
    await fetch("/api/login", { method: "DELETE" }).catch(() => {});
    location.reload();
  });

  document.body.prepend(bar);
  document.body.classList.add("has-admin-bar");

  // 손님 화면의 헤더·필터도 sticky 라, 관리 바 높이만큼 아래로 밀어야 겹치지 않습니다.
  // 글자 크기나 화면 폭에 따라 높이가 달라지므로 실제로 재서 알려줍니다.
  const syncHeight = () => {
    const h = bar.getBoundingClientRect().height;
    document.documentElement.style.setProperty("--admin-bar-height", `${h}px`);
  };
  syncHeight();
  // 화면을 돌리거나 창 크기를 바꾸면 높이가 달라질 수 있습니다
  addEventListener("resize", syncHeight);
}

/**
 * 카드마다 '수정' 버튼을 붙인다.
 * 카드는 언어를 바꾸거나 필터를 누를 때마다 다시 그려지므로,
 * 그때마다 이 함수를 다시 불러야 합니다 (app.js 의 render 끝에서 부릅니다).
 */
function decorateCards() {
  for (const card of document.querySelectorAll(".card[id^='place-']")) {
    // 이미 껍데기로 감싼 카드는 건너뜁니다
    if (card.parentElement?.classList.contains("admin-row")) continue;

    const id = card.id.replace(/^place-/, "");

    const button = document.createElement("a");
    button.className = "admin-edit";
    button.href = `./admin.html?edit=${encodeURIComponent(id)}`;
    button.textContent = "✏";
    button.title = "이 맛집을 관리자 화면에서 열기";
    button.setAttribute("aria-label", "이 맛집 수정하기");

    // 카드 자체는 건드리지 않습니다.
    // 껍데기로 감싸 버튼을 옆에 세우기만 하므로, 카드는 손님이 보는 그대로입니다.
    const row = document.createElement("div");
    row.className = "admin-row";
    card.replaceWith(row);
    row.append(card, button);
  }
}

/**
 * 관리 바를 켠다 (로그인한 경우에만).
 * 돌려주는 값: 카드가 다시 그려진 뒤 불러야 하는 함수. 로그인 안 했으면 아무것도 안 하는 함수.
 */
export async function enableAdminBar() {
  if (!(await isLoggedIn())) return () => {};

  loadStyles();
  buildBar();
  decorateCards();
  return decorateCards;
}
