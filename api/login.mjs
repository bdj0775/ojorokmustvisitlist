/**
 * POST /api/login    — 비밀번호를 확인하고 출입증을 발급
 * GET  /api/login    — 지금 로그인 상태인지 확인
 * DELETE /api/login  — 로그아웃
 */

import { readConfig } from "./_github.mjs";
import {
  passwordMatches, createSession, touchSession,
  setSessionCookie, clearSessionCookie,
  tooManyAttempts, noteFailedAttempt, clearAttempts,
} from "./_auth.mjs";

export default async function handler(req, res) {
  const config = readConfig();

  // 설정이 덜 됐으면, 무엇이 빠졌는지 정확히 알려줍니다 (비밀번호 자체는 알려주지 않습니다)
  if (config.missing.length) {
    res.status(503).json({
      error: `아직 설정이 끝나지 않았습니다. Vercel 에 ${config.missing.join(", ")} 을(를) 넣어주세요.`,
      setup: true,
      missing: config.missing,
    });
    return;
  }

  if (req.method === "GET") {
    // 손님 화면·관리 화면을 열 때마다 여기를 지나갑니다.
    // 그때마다 기한이 다시 1년으로 늘어나므로 사실상 로그아웃되지 않습니다.
    res.status(200).json({ loggedIn: touchSession(req, res, config) });
    return;
  }

  if (req.method === "DELETE") {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "지원하지 않는 방식입니다" });
    return;
  }

  if (tooManyAttempts(req)) {
    res.status(429).json({ error: "비밀번호를 너무 여러 번 틀렸습니다. 10분 뒤에 다시 시도해주세요." });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

  if (!passwordMatches(config, body.password)) {
    noteFailedAttempt(req);
    res.status(401).json({ error: "비밀번호가 맞지 않습니다." });
    return;
  }

  clearAttempts(req);
  setSessionCookie(res, createSession(config));
  res.status(200).json({ ok: true });
}
