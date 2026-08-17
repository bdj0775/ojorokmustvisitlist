/**
 * 맛집 목록을 읽고 쓰는 창구
 * ==========================
 * 관리자 화면(admin.js)은 "어디에 저장하는지" 를 전혀 모릅니다.
 * 아래 약속만 지키면 됩니다.
 *
 *   available()          → 지금 이 방식을 쓸 수 있는지
 *   load()               → { data, revision } 을 돌려준다
 *   save(data, revision) → 저장하고 새 revision 을 돌려준다
 *
 * 두 가지 방식이 들어 있습니다.
 *
 *   localFileStorage   내 컴퓨터의 places.json 을 직접 고침 (npm run dev 로 켰을 때)
 *   webStorage         인터넷에서 GitHub 저장소에 바로 커밋 (비밀번호 필요)
 *
 * pickStorage() 가 상황에 맞는 쪽을 알아서 고릅니다.
 * 내 컴퓨터에서 열면 예전처럼 파일을 고치고, 인터넷에서 열면 GitHub 에 저장합니다.
 *
 * revision 은 "내가 읽은 뒤에 딴 데서 먼저 바꾸지 않았나" 를 확인하는 표식입니다.
 * 로컬은 파일이 바뀐 시각, 웹은 GitHub 의 파일 sha 를 씁니다.
 */

/** 개발 서버(tools/dev-server.mjs)를 통해 내 컴퓨터의 places.json 을 직접 읽고 씁니다. */
export const localFileStorage = {
  id: "local",

  /** 저장한 내용이 손님 화면에 바로 나가지 않습니다 (git push 가 따로 필요) */
  publishesImmediately: false,

  /** 이 방식을 지금 쓸 수 있는지 (개발 서버가 켜져 있는지) */
  async available() {
    try {
      const res = await fetch("/__admin/ping");
      return res.ok;
    } catch {
      return false;
    }
  },

  /** 로컬은 내 컴퓨터라 비밀번호가 필요 없습니다 */
  async needsLogin() {
    return false;
  },

  async load() {
    const res = await fetch("/__admin/places", { cache: "no-store" });
    if (!res.ok) throw new Error(await readError(res));
    const body = await res.json();
    return { data: body.data, revision: body.revision };
  },

  async save(data, revision) {
    const res = await fetch("/__admin/places", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, revision }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const body = await res.json();
    return { revision: body.revision };
  },
};

/** 배포된 사이트에서 GitHub 저장소의 places.json 을 직접 고칩니다. */
export const webStorage = {
  id: "web",

  /** 저장하면 GitHub 에 커밋되고, Vercel 이 20초쯤 뒤 사이트에 반영합니다 */
  publishesImmediately: true,

  /** 서버 창구가 살아 있는지 */
  async available() {
    try {
      const res = await fetch("/api/login", { cache: "no-store" });
      // 503 은 "창구는 있는데 설정이 덜 됐다" — 이때도 화면에서 안내해야 하므로 쓸 수 있다고 봅니다
      return res.ok || res.status === 503;
    } catch {
      return false;
    }
  },

  /** 지금 로그인해야 하는 상태인지 */
  async needsLogin() {
    const res = await fetch("/api/login", { cache: "no-store" });
    if (res.status === 503) throw new Error(await readError(res));
    if (!res.ok) return true;
    const body = await res.json();
    return !body.loggedIn;
  },

  async login(password) {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return true;
  },

  async logout() {
    await fetch("/api/login", { method: "DELETE" });
  },

  async load() {
    const res = await fetch("/api/places", { cache: "no-store" });
    if (!res.ok) throw new Error(await readError(res));
    const body = await res.json();
    return { data: body.data, revision: body.revision };
  },

  async save(data, revision, message) {
    const res = await fetch("/api/places", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, revision, message }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const body = await res.json();
    return { revision: body.revision };
  },
};

/**
 * 지금 상황에 맞는 저장 방식을 고른다.
 * 내 컴퓨터에서 개발 서버로 열었으면 로컬, 아니면 웹.
 * 둘 다 안 되면 null (화면이 안내를 띄웁니다).
 */
export async function pickStorage() {
  if (await localFileStorage.available()) return localFileStorage;
  if (await webStorage.available()) return webStorage;
  return null;
}

/** 서버가 보낸 한국어 오류 메시지를 꺼낸다 */
async function readError(res) {
  const body = await res.json().catch(() => ({}));
  return body.error || `저장소 오류 (${res.status})`;
}
