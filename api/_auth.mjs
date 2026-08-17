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
 *
 * 로그인은 사실상 계속 유지됩니다.
 * -----------------------------------------------------
 * 이 화면은 한 사람이 오래 쓰는 것이라, 어느 날 갑자기 로그아웃되어
 * "비밀번호가 뭐였죠?" 하고 연락이 오는 일이 없어야 합니다. 그래서:
 *
 *   · 기한을 1년으로 잡습니다.
 *   · 쓸 때마다 기한이 다시 1년으로 늘어납니다(자동 갱신).
 *     → 1년에 한 번만 들어와도 영영 로그인 상태입니다.
 *
 * 로그아웃 버튼을 누르면 그 자리에서 끊깁니다.
 */

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const COOKIE = "ojorok_admin";
const MAX_AGE = 60 * 60 * 24 * 365; // 1년

/** 남은 기간이 이보다 적으면 출입증을 새로 발급해 기한을 늘립니다 (30일) */
const RENEW_WHEN_LEFT_UNDER = 60 * 60 * 24 * 30 * 1000;

/**
 * 서명에 쓸 비밀.
 *
 * SESSION_SECRET 을 Vercel 에 넣어두면 그것을 씁니다. 이때는 비밀번호를 바꿔도
 * 로그인이 유지됩니다.
 * 넣지 않으면 비밀번호와 열쇠를 섞어 만드는데, 그 경우 둘 중 하나만 바뀌어도
 * 모든 기기에서 로그아웃됩니다(그게 더 안전한 경우도 있어 기본값으로 둡니다).
 */
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

/**
 * 출입증을 살펴본다.
 * 돌려주는 값: { valid, needsRenewal }
 *   valid        진짜이고 아직 안 지났는가
 *   needsRenewal 기한이 얼마 안 남아 새로 발급하는 게 좋은가
 */
export function inspectSession(config, value) {
  const no = { valid: false, needsRenewal: false };
  if (!value) return no;

  const [payload, sig] = String(value).split(".");
  if (!payload || !sig) return no;

  const expected = createHmac("sha256", signingSecret(config)).update(payload).digest("hex");
  if (!safeEqual(sig, expected)) return no;

  const issued = Number(payload);
  if (!Number.isFinite(issued)) return no;

  const left = MAX_AGE * 1000 - (Date.now() - issued);
  if (left <= 0) return no;

  return { valid: true, needsRenewal: left < RENEW_WHEN_LEFT_UNDER };
}

/** 출입증이 진짜이고 아직 안 지났는지 */
export function verifySession(config, value) {
  return inspectSession(config, value).valid;
}

/**
 * 로그인 상태를 확인하고, 기한이 얼마 안 남았으면 조용히 늘려준다.
 * 쓸 때마다 기한이 다시 1년이 되므로 사실상 로그아웃되지 않습니다.
 */
export function touchSession(req, res, config) {
  const { valid, needsRenewal } = inspectSession(config, readSessionCookie(req));
  if (valid && needsRenewal) setSessionCookie(res, createSession(config));
  return valid;
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
  // 쓸 때마다 기한이 늘어납니다 (touchSession)
  if (touchSession(req, res, config)) return true;

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
