/**
 * GitHub 저장소에 places.json 을 읽고 쓰는 부분
 * =========================================================
 * 이 파일은 서버(Vercel)에서만 돕니다. 손님 브라우저로는 절대 내려가지 않습니다.
 * 그래서 여기서만 GitHub 열쇠(토큰)를 다룰 수 있습니다.
 *
 * 왜 GitHub 에 저장하나요?
 *   이 사이트는 데이터베이스가 없는 정적 사이트입니다. places.json 파일 하나가 곧 데이터입니다.
 *   그 파일을 GitHub 에서 고치면 Vercel 이 알아서 새로 배포하므로,
 *   따로 데이터베이스를 두지 않아도 웹에서 수정이 됩니다.
 *   덤으로 수정 이력이 git 에 전부 남아 언제든 되돌릴 수 있습니다.
 */

const API = "https://api.github.com";

/** Vercel 환경변수에서 설정을 읽는다. 빠진 게 있으면 이유를 정확히 알려준다. */
export function readConfig() {
  const token = process.env.GITHUB_TOKEN;
  const password = process.env.ADMIN_PASSWORD;
  const owner = process.env.GITHUB_OWNER || "bdj0775";
  const repo = process.env.GITHUB_REPO || "ojorokmustvisitlist";
  const branch = process.env.GITHUB_BRANCH || "main";
  const path = process.env.GITHUB_PATH || "places.json";

  const missing = [];
  if (!token) missing.push("GITHUB_TOKEN");
  if (!password) missing.push("ADMIN_PASSWORD");

  return { token, password, owner, repo, branch, path, missing };
}

/** GitHub 에 요청을 보낸다 */
async function gh(config, url, options = {}) {
  const res = await fetch(url.startsWith("http") ? url : API + url, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.message || `HTTP ${res.status}`;

    // 주인장이 읽고 조치할 수 있는 말로 바꿔줍니다
    if (res.status === 401) {
      throw new Error("GitHub 열쇠(토큰)가 잘못되었거나 만료되었습니다. Vercel 설정에서 GITHUB_TOKEN 을 새로 넣어주세요.");
    }
    if (res.status === 403) {
      throw new Error("GitHub 열쇠에 이 저장소를 고칠 권한이 없습니다. 토큰의 Contents 권한을 확인해주세요.");
    }
    if (res.status === 404) {
      throw new Error(`GitHub 에서 파일을 찾지 못했습니다 (${config.owner}/${config.repo} 의 ${config.path}). 저장소 이름과 토큰 권한을 확인해주세요.`);
    }
    throw new Error(`GitHub 오류: ${detail}`);
  }

  return res.json();
}

/**
 * places.json 을 읽는다.
 * revision 으로 GitHub 의 파일 sha 를 씁니다 — 저장할 때 "내가 읽은 뒤 딴 데서 바뀌었나" 판별에 그대로 쓰입니다.
 */
export async function loadPlaces(config) {
  const url = `/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(config.path)}?ref=${encodeURIComponent(config.branch)}`;
  const file = await gh(config, url);

  const text = Buffer.from(file.content, "base64").toString("utf8");

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("places.json 이 깨져 있어 읽을 수 없습니다. GitHub 에서 파일을 직접 확인해주세요.");
  }

  return { data, revision: file.sha };
}

/**
 * places.json 을 저장한다 (= GitHub 에 커밋 1개).
 * revision(sha)이 지금 파일과 다르면 덮어쓰지 않고 멈춥니다.
 */
export async function savePlaces(config, data, revision, message) {
  const text = JSON.stringify(data, null, 2) + "\n";
  const url = `/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(config.path)}`;

  const result = await gh(config, url, {
    method: "PUT",
    body: JSON.stringify({
      message: message || "맛집 목록 갱신 (관리자 화면)",
      content: Buffer.from(text, "utf8").toString("base64"),
      sha: revision,
      branch: config.branch,
    }),
  }).catch((e) => {
    // GitHub 은 sha 가 어긋나면 409 를 줍니다. 그 말을 주인장 말로 바꿉니다.
    if (/sha|conflict|does not match/i.test(e.message)) {
      throw new Error(
        "이 화면을 열어둔 사이에 맛집 목록이 다른 곳에서 바뀌었습니다. 새로고침한 뒤 다시 시도해주세요."
      );
    }
    throw e;
  });

  return { revision: result.content.sha };
}
