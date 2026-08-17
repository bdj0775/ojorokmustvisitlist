/**
 * GET /api/places  — 맛집 목록을 GitHub 에서 읽어온다
 * PUT /api/places  — 맛집 목록을 GitHub 에 저장한다 (커밋 1개)
 *
 * 둘 다 로그인한 사람만 쓸 수 있습니다.
 * (손님 화면은 이 창구를 쓰지 않고 places.json 파일을 직접 읽습니다)
 */

import { readConfig, loadPlaces, savePlaces } from "./_github.mjs";
import { requireSession } from "./_auth.mjs";

export default async function handler(req, res) {
  const config = readConfig();

  if (config.missing.length) {
    res.status(503).json({
      error: `아직 설정이 끝나지 않았습니다. Vercel 에 ${config.missing.join(", ")} 을(를) 넣어주세요.`,
    });
    return;
  }

  if (!requireSession(req, res, config)) return;

  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const { data, revision } = await loadPlaces(config);
      res.status(200).json({ data, revision });
      return;
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

      if (!body.data || !Array.isArray(body.data.places)) {
        res.status(400).json({ error: "보낸 내용이 올바르지 않습니다 (맛집 목록이 없습니다)." });
        return;
      }

      const { revision } = await savePlaces(config, body.data, body.revision, body.message);
      res.status(200).json({ revision });
      return;
    }

    res.status(405).json({ error: "지원하지 않는 방식입니다" });
  } catch (e) {
    // 저장 충돌은 "다시 해보세요" 라서 오류(500)가 아니라 409 로 알려줍니다
    const conflict = /다른 곳에서 바뀌었습니다/.test(e.message);
    res.status(conflict ? 409 : 500).json({ error: e.message });
  }
}
