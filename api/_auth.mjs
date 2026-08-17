/**
 * 로그인 확인 — "지금 요청한 사람이 주인장이 맞는가"
 * =========================================================
 * 이 파일도 서버에서만 돕니다.
 *
 * 동작 방식:
 *   1. 주인장이 비밀번호를 보냄 → 맞으면 서명된 '출입증'을 쿠키로 발급
 *   2. 그 뒤 요청은 쿠키만 보면 됨 (비밀번호를 매번 주고받지 않음)
 *
 * 출입증은 서버만 아는 비밀로 서명되어 있어 손님이 위조할 수 없습니다.
 * 브라우저를 닫아도 30일간 유지되고, 로그아웃하면 즉시 사라집니다.
 */

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const COOKIE = "ojorok_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

/** 서명에 쓸 비밀. 따로 설정하지 않았으면 비밀번호와 열쇠를 섞어 만듭니다. */
function signingSecret(config) {
  return process.env.SESSION_SECRET || `${config.password}:${config.token}`;
}

/** 글자 수가 달라도 안전하게 비교 (맞은 글자 수가 시간으로 새어나가지 않도록) */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // 길이가 다르면 어차피 틀렸지만, 비교 시간은 똑같이 쓰고 나갑니다
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** 비밀번호가 맞는지 */
export function passwordMatches(config, given) {
  if (!given) return false;
  return safeEqual(given, config.password);
}

/** 출입증 만들기 — "발급시각.서명" 형태 */
export function createSession(config) {
  const issued = Date.now();
  const payload = String(issued);
  const sig = createHmac("sha256", signingSecret(config)).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** 출입증이 진짜이고 아직 안 지났는지 */
export function verifySession(config, value) {
  if (!value) return false;

  const [payload, sig] = String(value).split(".");
  if (!payload || !sig) return false;

  const expected = createHmac("sha256", signingSecret(config)).update(payload).digest("hex");
  if (!safeEqual(sig, expected)) return false;

  const issued = Number(payload);
  if (!Number.isFinite(issued)) return false;

  return Date.now() - issued < MAX_AGE * 1000;
}

/** 요청에 들어 있는 쿠키에서 출입증을 꺼낸다 */
export function readSessionCookie(req) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** 출입증을 쿠키로 심는다 */
export function setSessionCookie(res, value) {
  res.setHeader("Set-Cookie",
    `${COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE}; ` +
    `HttpOnly; Secure; SameSite=Strict`
  );
}

/** 출입증을 없앤다 (로그아웃) */
export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
}

/**
 * 로그인 안 된 요청을 막는다.
 * 통과하면 true, 막았으면 false (그때는 이미 응답을 보낸 상태).
 */
export function requireSession(req, res, config) {
  if (verifySession(config, readSessionCookie(req))) return true;

  res.status(401).json({ error: "로그인이 필요합니다. 새로고침한 뒤 비밀번호를 다시 입력해주세요." });
  return false;
}

/**
 * 비밀번호를 마구 찍어보는 것을 늦춘다.
 * 서버가 여러 대로 나뉘면 완벽하진 않지만, 자동 대입 공격 속도를 크게 떨어뜨립니다.
 */
const attempts = new Map();

export function tooManyAttempts(req) {
  const who = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const record = attempts.get(who);

  // 10분이 지났으면 기록을 지웁니다
  if (record && now - record.first > 10 * 60 * 1000) {
    attempts.delete(who);
    return false;
  }

  return Boolean(record && record.count >= 10);
}

export function noteFailedAttempt(req) {
  const who = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const record = attempts.get(who);

  if (!record || now - record.first > 10 * 60 * 1000) {
    attempts.set(who, { first: now, count: 1 });
  } else {
    record.count += 1;
  }
}

export function clearAttempts(req) {
  const who = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  attempts.delete(who);
}

/** 무작위 비밀번호 제안 (설정 안내에서 씁니다) */
export function suggestPassword() {
  return randomBytes(9).toString("base64url");
}
