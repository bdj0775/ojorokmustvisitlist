/**
 * 카테고리 레지스트리 — 카테고리에 대한 단일 진실 공급원
 * =========================================================
 * 사이트 코드(app.js)와 검사기(tools/validate-places.mjs)가 이 파일 하나를 함께 씁니다.
 *
 * 카테고리를 추가하려면:
 *   1) 아래 배열에 한 줄 추가
 *   2) styles/tokens.css 에 --category-{id}-bg / --category-{id}-fg 두 줄 추가
 *   끝입니다. 필터 탭·태그 색·검사기가 모두 자동으로 따라옵니다.
 *
 *   id     : CSS와 연결되는 영문 식별자 (data-category="food" → --category-food-bg)
 *   value  : places.json 의 "category" 에 적는 값. 주인장이 한글로 편하게 쓰도록 한글 그대로.
 *   label  : 화면에 보이는 이름 (언어별)
 */

export const CATEGORIES = [
  {
    id: "food",
    value: "맛집",
    label: { ko: "맛집", en: "Food", zh: "美食" },
  },
  {
    id: "cafe",
    value: "카페",
    label: { ko: "카페", en: "Cafe", zh: "咖啡廳" },
  },
  {
    id: "sight",
    value: "명소",
    label: { ko: "명소", en: "Sights", zh: "景點" },
  },
  {
    id: "walk",
    value: "산책·오름",
    label: { ko: "산책·오름", en: "Walks", zh: "散步·小火山" },
  },
];

/** places.json 의 category 값 → 레지스트리 항목 */
export const categoryByValue = new Map(CATEGORIES.map((c) => [c.value, c]));

/** 주인장이 places.json 에 적을 수 있는 값 목록 */
export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);

/** '추천 메뉴'가 있는 게 자연스러운 카테고리 (검사기가 참고) */
export const CATEGORIES_WITH_MENU = ["food", "cafe"];
