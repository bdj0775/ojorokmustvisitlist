/**
 * places.json 검사기
 *
 * 사용법:  node tools/validate-places.mjs
 *
 * 손으로 JSON을 고치다 보면 쉼표 하나, 따옴표 하나 때문에 사이트 전체가
 * 빈 화면이 됩니다. 배포 전에 이 검사기가 먼저 잡아줍니다.
 * (GitHub에 올릴 때마다 자동으로도 실행됩니다 — .github/workflows/deploy.yml)
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// 카테고리·언어 목록은 사이트와 같은 설정 파일에서 가져옵니다 (목록이 두 벌 생기지 않도록)
import { TAG_IDS, tagById } from "../config/tags.mjs";
import { SITE } from "../config/site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = SITE.languages;
const TEXT_FIELDS = ["name", "desc", "menu"];

// 제주도 대략적인 경계 — 좌표를 잘못 붙여넣으면 여기서 걸린다
const JEJU_BOUNDS = { latMin: 33.1, latMax: 33.6, lngMin: 126.1, lngMax: 126.99 };

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// ---------- 1. JSON 문법 ----------
const jsonPath = join(ROOT, "places.json");
let data;
try {
  data = JSON.parse(readFileSync(jsonPath, "utf8"));
} catch (e) {
  console.error("❌ places.json 을 읽을 수 없습니다 (JSON 문법 오류).");
  console.error("   " + e.message);
  console.error("\n   흔한 원인: 마지막 항목 뒤에 쉼표가 남아 있음, 따옴표 짝이 안 맞음,");
  console.error("   중괄호 { } 나 대괄호 [ ] 가 하나 빠짐.");
  process.exit(1);
}

// ---------- 2. 전체 구조 ----------
if (!Array.isArray(data.places)) {
  console.error('❌ places.json 에 "places": [ ... ] 배열이 없습니다.');
  process.exit(1);
}

const places = data.places;
const seenIds = new Map();

// ---------- 3. 항목별 검사 ----------
places.forEach((p, i) => {
  const where = `${i + 1}번째 항목${p?.id ? ` (id: ${p.id})` : ""}`;

  // id
  if (!p.id || typeof p.id !== "string") {
    err(`${where}: "id" 가 없습니다. 영문 소문자로 겹치지 않게 적어주세요.`);
  } else {
    if (!/^[a-z0-9-]+$/.test(p.id)) {
      err(`${where}: "id"는 영문 소문자·숫자·하이픈만 쓸 수 있습니다 (현재: "${p.id}").`);
    }
    if (seenIds.has(p.id)) {
      err(`${where}: "id"가 ${seenIds.get(p.id) + 1}번째 항목과 중복됩니다 ("${p.id}").`);
    } else {
      seenIds.set(p.id, i);
    }
  }

  // tags
  if (!Array.isArray(p.tags) || p.tags.length === 0) {
    err(`${where}: "tags"에 태그를 하나 이상 넣어주세요. (예: ["matjip", "sashimi"])`);
  } else {
    for (const tag of p.tags) {
      if (!TAG_IDS.includes(tag)) {
        err(`${where}: "${tag}"는 등록되지 않은 태그입니다. config/tags.mjs 에서 확인하거나 새로 추가해주세요.`);
      }
    }
    if (new Set(p.tags).size !== p.tags.length) {
      warn(`${where}: 같은 태그가 두 번 들어 있습니다.`);
    }
  }

  // 주소
  if (!p.address) warn(`${where}: "address"(주소)가 비어 있어 카드에 주소가 표시되지 않습니다.`);

  // 다국어 필드
  for (const f of TEXT_FIELDS) {
    const v = p[f];
    if (v == null) {
      if (f === "name") err(`${where}: "name"이 없습니다.`);
      continue;
    }
    if (typeof v !== "object" || Array.isArray(v)) {
      err(`${where}: "${f}"는 { "ko": "...", "en": "...", "zh": "..." } 형태여야 합니다.`);
      continue;
    }
    for (const k of Object.keys(v)) {
      if (!LANGS.includes(k)) {
        warn(`${where}: "${f}" 안의 "${k}"는 쓰이지 않는 언어 키입니다 (ko / en / zh 만 사용).`);
      }
    }
    if (!v.ko) {
      const msg = `${where}: "${f}"의 한국어(ko)가 비어 있습니다.`;
      f === "name" ? err(msg) : warn(msg);
    }
  }

  // 좌표
  const { lat, lng } = p;
  if (typeof lat !== "number" || typeof lng !== "number") {
    err(`${where}: "lat"/"lng"(위도·경도)가 숫자가 아닙니다. 따옴표 없이 숫자로 적어주세요.`);
  } else if (
    lat < JEJU_BOUNDS.latMin || lat > JEJU_BOUNDS.latMax ||
    lng < JEJU_BOUNDS.lngMin || lng > JEJU_BOUNDS.lngMax
  ) {
    err(`${where}: 좌표(${lat}, ${lng})가 제주도 밖입니다. 위도·경도를 바꿔 넣지 않았는지 확인해주세요.`);
  }

  // 거리
  if (p.distance_min != null && (typeof p.distance_min !== "number" || p.distance_min < 0)) {
    err(`${where}: "distance_min"은 0 이상의 숫자(분)여야 합니다.`);
  }
  if (p.distance_min == null) {
    warn(`${where}: "distance_min"이 없어 '오조록에서 차로 O분' 배지가 표시되지 않습니다.`);
  }

  // 링크
  for (const key of ["naver", "google"]) {
    if (p[key] && !/^https?:\/\//.test(p[key])) {
      err(`${where}: "${key}" 링크는 http:// 또는 https:// 로 시작해야 합니다.`);
    }
  }
  if (!p.naver && !p.google) {
    warn(`${where}: 지도 링크(naver/google)가 둘 다 없어 길찾기 버튼이 표시되지 않습니다.`);
  }

  // 사진 파일 존재 여부
  if (p.photo) {
    if (!existsSync(join(ROOT, p.photo))) {
      err(`${where}: 사진 파일을 찾을 수 없습니다 — "${p.photo}". images/ 폴더에 넣었는지, 파일명 철자가 맞는지 확인해주세요.`);
    }
  }
});

// ---------- 4. 결과 ----------
// 많이 쓰인 태그 순으로 요약
const tagCount = new Map();
for (const p of places) {
  for (const tag of p.tags || []) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
}
const summary = [...tagCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([tag, n]) => `${tagById.get(tag)?.label.ko ?? tag} ${n}`)
  .join(" · ");

console.log(`📍 총 ${places.length}곳${summary ? ` — ${summary}` : ""}`);

if (warnings.length) {
  console.log(`\n⚠️  참고 ${warnings.length}건 (사이트는 정상 동작합니다)`);
  warnings.forEach((w) => console.log("   - " + w));
}

if (errors.length) {
  console.log(`\n❌ 고쳐야 할 문제 ${errors.length}건`);
  errors.forEach((e) => console.log("   - " + e));
  console.log("");
  process.exit(1);
}

console.log("\n✅ 이상 없습니다. 배포해도 좋습니다.");
if (places.length < 20) {
  console.log(`   (기획서 목표는 20곳 이상 — 현재 ${places.length}곳)`);
}
