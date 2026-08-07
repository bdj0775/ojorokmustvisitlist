/**
 * 개발용 서버
 *
 * 사용법:  npm run dev
 *
 * 이 사이트는 빌드가 필요 없는 정적 사이트지만, places.json 을 불러오는 방식 때문에
 * index.html 을 더블클릭으로 열면 동작하지 않습니다(브라우저 보안 정책).
 * 그래서 아주 작은 서버가 필요합니다.
 *
 * 외부 패키지를 하나도 쓰지 않습니다. npm install 없이 그냥 실행됩니다.
 */

import { createServer } from "node:http";
import { readFile, writeFile, rename, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname, sep } from "node:path";
import { networkInterfaces } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLACES = join(ROOT, "places.json");
const START_PORT = Number(process.env.PORT) || 5173;

// .mjs 를 빠뜨리면 설정 파일을 못 읽어 화면이 비어버리므로 주의
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

// ---------- 관리자 페이지 저장 창구 ----------
//
// admin.html 이 맛집 목록을 읽고 쓰는 통로입니다.
// 이 개발 서버는 내 컴퓨터에서만 도니까, 이 창구도 내 컴퓨터에만 있습니다.
// 배포된 사이트에는 이 기능이 아예 존재하지 않습니다.

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

/** 요청 본문을 통째로 받아 문자열로 만든다 (1MB 넘으면 거절) */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let text = "";
    req.on("data", (chunk) => {
      text += chunk;
      if (text.length > 1_000_000) reject(new Error("보낸 내용이 너무 큽니다"));
    });
    req.on("end", () => resolve(text));
    req.on("error", reject);
  });
}

/** places.json 이 마지막으로 바뀐 시각. "내가 읽은 뒤 딴 데서 고쳤나" 를 판별하는 표식 */
async function placesRevision() {
  const info = await stat(PLACES);
  return String(info.mtimeMs);
}

async function handleAdmin(req, res, pathname) {
  // 서버가 살아 있는지 확인용
  if (pathname === "/__admin/ping") {
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname !== "/__admin/places") return false;

  // 읽기
  if (req.method === "GET") {
    try {
      const text = await readFile(PLACES, "utf8");
      sendJson(res, 200, { data: JSON.parse(text), revision: await placesRevision() });
    } catch (e) {
      const message =
        e instanceof SyntaxError
          ? "places.json 이 깨져 있어 읽을 수 없습니다. 파일을 직접 확인해주세요."
          : `places.json 을 읽지 못했습니다: ${e.message}`;
      sendJson(res, 500, { error: message });
    }
    return true;
  }

  // 쓰기
  if (req.method === "PUT") {
    try {
      const body = JSON.parse(await readBody(req));

      // 화면을 띄워둔 사이에 파일이 바뀌었다면 덮어쓰지 않고 멈춘다
      const now = await placesRevision();
      if (body.revision && body.revision !== now) {
        sendJson(res, 409, {
          error:
            "이 화면을 열어둔 사이에 places.json 이 다른 곳에서 바뀌었습니다. " +
            "새로고침한 뒤 다시 시도해주세요.",
        });
        return true;
      }

      let text = JSON.stringify(body.data, null, 2) + "\n";

      // 윈도우에서 만든 파일은 줄바꿈 방식이 다릅니다(CRLF).
      // 저장할 때마다 방식이 뒤집히면 실제로 고친 곳을 찾기 어려워지므로,
      // 원래 파일이 쓰던 방식을 그대로 따라갑니다.
      const before = await readFile(PLACES, "utf8").catch(() => "");
      if (before.includes("\r\n")) text = text.replace(/\n/g, "\r\n");

      // 쓰는 도중 문제가 생겨도 원본이 반쯤 망가지지 않도록,
      // 임시 파일에 먼저 다 쓴 뒤 한 번에 바꿔치기한다
      const temp = PLACES + ".tmp";
      await writeFile(temp, text, "utf8");
      await rename(temp, PLACES);

      console.log(`  저장됨  places.json (${body.data?.places?.length ?? 0}곳)`);
      sendJson(res, 200, { revision: await placesRevision() });
    } catch (e) {
      sendJson(res, 500, { error: `저장하지 못했습니다: ${e.message}` });
    }
    return true;
  }

  sendJson(res, 405, { error: "지원하지 않는 방식입니다" });
  return true;
}

const server = createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("잘못된 주소입니다");
    return;
  }

  if (pathname.startsWith("/__admin/")) {
    if (await handleAdmin(req, res, pathname)) return;
  }

  if (pathname.endsWith("/")) pathname += "index.html";

  // 프로젝트 폴더 바깥 파일이 새어나가지 않도록 막는다
  const filePath = join(ROOT, normalize(pathname));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
    res.writeHead(403).end("접근할 수 없습니다");
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) {
      res.writeHead(302, { Location: pathname + "/" }).end();
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream",
      // 고친 내용이 바로 보이도록 캐시를 끈다
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (e) {
    if (e.code === "ENOENT") {
      console.log(`  404  ${pathname}`);
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" })
         .end(`<h1>404</h1><p>파일을 찾을 수 없습니다: ${pathname}</p>`);
    } else {
      console.error(e);
      res.writeHead(500).end("서버 오류");
    }
  }
});

/** 포트가 이미 쓰이고 있으면 다음 번호로 옮겨 간다 */
function listen(port, attemptsLeft = 10) {
  server.once("error", (e) => {
    if (e.code === "EADDRINUSE" && attemptsLeft > 0) {
      console.log(`포트 ${port} 는 이미 쓰이고 있어 ${port + 1} 로 넘어갑니다.`);
      listen(port + 1, attemptsLeft - 1);
    } else {
      console.error(e.message);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    // 포트가 밀렸을 수 있으니 실제로 열린 번호를 서버에서 직접 읽는다
    const actual = server.address().port;

    const lan = Object.values(networkInterfaces())
      .flat()
      .find((n) => n && n.family === "IPv4" && !n.internal)?.address;

    console.log(`
  오조록 제주 추천 지도 — 개발 서버

  사이트        http://localhost:${actual}/
  맛집 관리     http://localhost:${actual}/admin.html
  디자인 문서   http://localhost:${actual}/styleguide.html
${lan ? `  같은 와이파이의 휴대폰에서: http://${lan}:${actual}/\n` : ""}
  파일을 고치고 브라우저를 새로고침하면 바로 반영됩니다.
  끄려면 Ctrl+C
`);
  });
}

listen(START_PORT);
