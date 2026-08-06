/**
 * 색 대비 검사기
 *
 * 사용법:  node tools/check-contrast.mjs
 *
 * 색 토큰을 바꾸면 글자가 배경에 묻혀 안 보이는 조합이 생기기 쉽습니다.
 * 특히 손님들은 제주 햇빛 아래 야외에서 휴대폰으로 이 사이트를 봅니다.
 * 이 검사기가 styles/tokens.css 를 직접 읽어 주요 조합의 명도 대비를 계산하고,
 * WCAG AA 기준(작은 글자 4.5:1) 미달이면 배포를 막습니다.
 *
 * 브라우저 없이 동작하므로 GitHub Actions 에서도 그대로 돌아갑니다.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 검사할 조합: [글자색 토큰, 배경색 토큰, 최소 대비, 설명] */
const PAIRS = [
  ["--color-text",            "--color-bg",              4.5, "본문"],
  ["--color-text",            "--color-surface",         4.5, "카드 본문"],
  ["--color-text-muted",      "--color-surface",         4.5, "보조 설명"],
  ["--color-text-subtle",     "--color-surface",         3.0, "흐린 텍스트"],
  ["--color-on-accent",       "--color-accent",          4.5, "예약 버튼"],
  ["--color-on-accent",       "--color-accent-hover",    4.5, "예약 버튼(눌렀을 때)"],
  ["--color-on-brand",        "--color-brand",           4.5, "네이버맵 버튼"],
  ["--color-on-brand",        "--color-brand-hover",     4.5, "네이버맵 버튼(눌렀을 때)"],
  ["--color-brand-text",      "--color-brand-subtle",    4.5, "거리 배지 · 아웃라인 버튼"],
  ["--color-brand-text",      "--color-surface",         4.5, "아웃라인 버튼 글자"],
  ["--color-accent-text",     "--color-accent-subtle",   4.5, "강조 라벨(필수 표시)"],
  ["--color-inverse-text",    "--color-inverse-bg",      4.5, "푸터 본문"],
  ["--color-inverse-heading", "--color-inverse-bg",      4.5, "푸터 제목"],
  ["--tag-place-fg",          "--tag-place-bg",          4.5, "태그 · 업종(맛집·카페)"],
  ["--tag-kind-fg",           "--tag-kind-bg",           4.5, "태그 · 음식(횟집·흑돼지)"],
  ["--tag-vibe-fg",           "--tag-vibe-bg",           4.5, "태그 · 특징(현지인맛집)"],
];

// ---------- tokens.css 읽기 ----------
const css = readFileSync(join(ROOT, "styles/tokens.css"), "utf8");

/** 중괄호 짝을 세어 블록 본문을 잘라낸다 */
function blockAfter(source, startIndex) {
  const open = source.indexOf("{", startIndex);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

function parseDeclarations(block) {
  const map = new Map();
  if (!block) return map;
  // 주석 제거 후 "--이름: 값;" 을 뽑는다
  const clean = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

// 밝은 모드: 첫 번째 :root
const lightBlock = blockAfter(css, css.indexOf(":root"));
const light = parseDeclarations(lightBlock);

// 어두운 모드: prefers-color-scheme: dark 안의 :root (밝은 모드를 물려받고 덮어씀)
const darkMediaIndex = css.indexOf("prefers-color-scheme: dark");
const darkRootIndex = darkMediaIndex === -1 ? -1 : css.indexOf(":root", darkMediaIndex);
const darkOverrides = parseDeclarations(
  darkRootIndex === -1 ? null : blockAfter(css, darkRootIndex)
);
const dark = new Map([...light, ...darkOverrides]);

// ---------- 값 해석 ----------
/** var(--a) 를 따라가 최종 색 문자열을 얻는다 */
function resolve(name, tokens, seen = new Set()) {
  if (seen.has(name)) throw new Error(`토큰이 서로를 순환 참조합니다: ${name}`);
  seen.add(name);

  const raw = tokens.get(name);
  if (raw == null) throw new Error(`토큰을 찾을 수 없습니다: ${name}`);

  const varMatch = raw.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
  if (varMatch) {
    try {
      return resolve(varMatch[1], tokens, seen);
    } catch (e) {
      if (varMatch[2]) return varMatch[2].trim(); // var() 의 대체값
      throw e;
    }
  }
  return raw;
}

function toRGB(color) {
  const hex = color.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16));
  }
  const rgb = color.match(/rgba?\(([^)]+)\)/i);
  if (rgb) return rgb[1].split(",").slice(0, 3).map((n) => parseFloat(n));
  throw new Error(`색을 해석할 수 없습니다: "${color}" (이 검사기는 #RRGGBB 와 rgb() 만 압니다)`);
}

function luminance([r, g, b]) {
  const channel = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(fg, bg) {
  const l1 = luminance(toRGB(fg));
  const l2 = luminance(toRGB(bg));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ---------- 실행 ----------
let failures = 0;

for (const [modeName, tokens] of [["밝은 모드", light], ["어두운 모드", dark]]) {
  console.log(`\n── ${modeName} ─────────────────────────────`);

  for (const [fgToken, bgToken, min, label] of PAIRS) {
    let ratio;
    try {
      ratio = contrast(resolve(fgToken, tokens), resolve(bgToken, tokens));
    } catch (e) {
      console.log(`  ⚠️  ${label}: ${e.message}`);
      failures++;
      continue;
    }
    const rounded = Math.round(ratio * 100) / 100;
    const ok = ratio >= min;
    if (!ok) failures++;
    console.log(
      `  ${ok ? "✅" : "❌"} ${String(rounded).padStart(6)}:1 (기준 ${min})  ${label}`
    );
  }
}

if (failures > 0) {
  console.log(`\n❌ 기준 미달 ${failures}건 — 글자가 배경에 묻혀 잘 안 보입니다.`);
  console.log("   styles/tokens.css 에서 해당 색을 더 진하게(또는 배경을 더 연하게) 조정해주세요.");
  console.log("   팁: 선명한 색 위에는 흰 글자보다 진한 글자가 대비가 잘 나옵니다.\n");
  process.exit(1);
}

console.log(`\n✅ ${PAIRS.length * 2}개 조합 모두 WCAG AA 기준을 넘습니다.`);
