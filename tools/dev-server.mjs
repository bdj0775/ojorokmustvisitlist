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
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname, sep } from "node:path";
import { networkInterfaces } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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

const server = createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end("잘못된 주소입니다");
    return;
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
    const lan = Object.values(networkInterfaces())
      .flat()
      .find((n) => n && n.family === "IPv4" && !n.internal)?.address;

    console.log(`
  오조록 제주 추천 지도 — 개발 서버

  사이트        http://localhost:${port}/
  디자인 문서   http://localhost:${port}/styleguide.html
${lan ? `  같은 와이파이의 휴대폰에서: http://${lan}:${port}/\n` : ""}
  파일을 고치고 브라우저를 새로고침하면 바로 반영됩니다.
  끄려면 Ctrl+C
`);
  });
}

listen(START_PORT);
