/**
 * 태그 목록 — 태그에 대한 단일 진실 공급원
 * =========================================================
 * 사이트 화면, 주인장 입력 페이지(admin.html), 검사기가 이 파일 하나를 함께 씁니다.
 *
 * 태그를 추가하려면 아래 배열에 한 줄만 더하면 됩니다.
 * 색은 group 에 따라 자동으로 정해지므로 CSS 는 손대지 않아도 됩니다.
 *
 *   id    : 영문 식별자 (places.json 에 저장되는 값, CSS 연결용)
 *   label : 화면에 보이는 이름 (언어별)
 *   group : 색 그룹 — place(업종) / kind(음식 종류) / vibe(특징)
 */

export const TAG_GROUPS = {
  place: { label: { ko: "업종", en: "Type", zh: "類型" } },
  kind: { label: { ko: "음식", en: "Food", zh: "餐點" } },
  vibe: { label: { ko: "특징", en: "Notes", zh: "特色" } },
};

export const TAGS = [
  // ── 업종 ──────────────────────────────────────────
  { id: "matjip", group: "place", label: { ko: "맛집", en: "Restaurant", zh: "美食" } },
  { id: "cafe", group: "place", label: { ko: "카페", en: "Cafe", zh: "咖啡廳" } },
  { id: "coffee", group: "place", label: { ko: "커피맛집", en: "Great coffee", zh: "咖啡專門" } },
  { id: "bakery", group: "place", label: { ko: "베이커리", en: "Bakery", zh: "烘焙坊" } },
  { id: "brunch", group: "place", label: { ko: "브런치", en: "Brunch", zh: "早午餐" } },
  { id: "bar", group: "place", label: { ko: "술집", en: "Bar", zh: "酒吧" } },

  // ── 음식 종류 ──────────────────────────────────────
  { id: "sashimi", group: "kind", label: { ko: "횟집", en: "Sashimi", zh: "生魚片" } },
  { id: "blackpork", group: "kind", label: { ko: "흑돼지", en: "Black pork", zh: "黑豬肉" } },
  { id: "hairtail", group: "kind", label: { ko: "갈치", en: "Hairtail", zh: "白帶魚" } },
  { id: "gogiguksu", group: "kind", label: { ko: "고기국수", en: "Pork noodles", zh: "豬肉麵" } },
  { id: "seafood", group: "kind", label: { ko: "해물", en: "Seafood", zh: "海鮮" } },
  { id: "abalone", group: "kind", label: { ko: "전복", en: "Abalone", zh: "鮑魚" } },
  { id: "seaurchin", group: "kind", label: { ko: "성게", en: "Sea urchin", zh: "海膽" } },
  { id: "haejangguk", group: "kind", label: { ko: "해장국", en: "Hangover soup", zh: "解酒湯" } },
  { id: "noodles", group: "kind", label: { ko: "국수", en: "Noodles", zh: "麵食" } },
  { id: "buckwheat", group: "kind", label: { ko: "메밀", en: "Buckwheat", zh: "蕎麥" } },
  { id: "meat", group: "kind", label: { ko: "고기", en: "Grilled meat", zh: "烤肉" } },
  { id: "dessert", group: "kind", label: { ko: "디저트", en: "Dessert", zh: "甜點" } },

  // ── 특징 ──────────────────────────────────────────
  { id: "local", group: "vibe", label: { ko: "현지인맛집", en: "Local favorite", zh: "在地人推薦" } },
  { id: "oceanview", group: "vibe", label: { ko: "오션뷰", en: "Ocean view", zh: "海景" } },
  { id: "value", group: "vibe", label: { ko: "가성비", en: "Great value", zh: "CP值高" } },
  { id: "waiting", group: "vibe", label: { ko: "웨이팅있음", en: "Expect a wait", zh: "需排隊" } },
  { id: "reservation", group: "vibe", label: { ko: "예약필수", en: "Reservation needed", zh: "需訂位" } },
  { id: "solo", group: "vibe", label: { ko: "혼밥가능", en: "Good for solo", zh: "適合單人" } },
  { id: "parking", group: "vibe", label: { ko: "주차편함", en: "Easy parking", zh: "停車方便" } },
  { id: "kids", group: "vibe", label: { ko: "아이동반", en: "Kid friendly", zh: "適合親子" } },
  { id: "takeout", group: "vibe", label: { ko: "포장가능", en: "Takeout", zh: "可外帶" } },
];

/** id → 태그 */
export const tagById = new Map(TAGS.map((t) => [t.id, t]));

/** places.json 에 쓸 수 있는 태그 id 목록 */
export const TAG_IDS = TAGS.map((t) => t.id);

/** 화면에 보일 때 업종 → 음식 → 특징 순서로 정렬 */
const GROUP_ORDER = ["place", "kind", "vibe"];

export function sortTagIds(ids = []) {
  return [...ids]
    .filter((id) => tagById.has(id))
    .sort((a, b) => {
      const ga = GROUP_ORDER.indexOf(tagById.get(a).group);
      const gb = GROUP_ORDER.indexOf(tagById.get(b).group);
      if (ga !== gb) return ga - gb;
      return TAG_IDS.indexOf(a) - TAG_IDS.indexOf(b);
    });
}
