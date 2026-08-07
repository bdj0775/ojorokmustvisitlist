/**
 * 맛집 목록을 읽고 쓰는 창구
 * ==========================
 * 관리자 화면(admin.js)은 "어디에 저장하는지" 를 전혀 모릅니다.
 * 아래 두 가지 약속만 지키면 됩니다.
 *
 *   load()        → { data, revision } 을 돌려준다
 *   save(data, revision) → 저장하고 새 revision 을 돌려준다
 *
 * 지금은 로컬 파일(개발 서버)에 저장하는 방식 하나만 들어 있습니다.
 * 나중에 웹에서 쓰고 싶어지면 이 파일에 GitHub 방식을 하나 더 만들어 붙이면 되고,
 * admin.js 는 한 줄도 고칠 필요가 없습니다.
 *
 * revision 은 "내가 읽은 뒤에 딴 데서 먼저 바꾸지 않았나" 를 확인하는 표식입니다.
 * 로컬 방식에서는 파일이 마지막으로 바뀐 시각을 씁니다.
 */

/** 개발 서버(tools/dev-server.mjs)를 통해 내 컴퓨터의 places.json 을 직접 읽고 씁니다. */
export const localFileStorage = {
  /** 이 방식을 지금 쓸 수 있는지 (개발 서버가 켜져 있는지) */
  async available() {
    try {
      const res = await fetch("/__admin/ping");
      return res.ok;
    } catch {
      return false;
    }
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

/** 서버가 보낸 한국어 오류 메시지를 꺼낸다 */
async function readError(res) {
  const body = await res.json().catch(() => ({}));
  return body.error || `저장소 오류 (${res.status})`;
}
