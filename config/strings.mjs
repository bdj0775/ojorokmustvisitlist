/**
 * 화면 문구 — 3개 언어
 * =========================================================
 * 카테고리 이름은 여기가 아니라 config/categories.mjs 에 있습니다.
 * (한 곳에서만 관리하려고 분리했습니다)
 *
 * 문구를 고치려면 해당 언어 블록의 값만 바꾸세요.
 * 새 언어를 추가하려면 블록을 하나 복사하고 config/site.mjs 의 languages 에 코드를 더하면 됩니다.
 */

export const STRINGS = {
  ko: {
    brand: "오조록",
    docTitle: "오조록 주인장의 제주 추천 지도",
    book: "예약",
    heroTitle: "오조리 주인장의 제주 노트",
    heroGreeting:
      "오조리에서 숙소를 하며 제가 실제로 다니는 곳들만 모았습니다. 검색으로는 안 나오는 주인장 한마디까지 담았어요.",
    share: "이 리스트 공유하기",
    shareCopied: "링크가 복사됐어요! 카톡에 붙여넣어 주세요 🍊",
    mapTitle: "지도로 보기",
    sortNear: "오조록에서 가까운 순",
    all: "전체",
    distance: (min) => `오조록에서 차로 ${min}분`,
    menuLabel: "추천 메뉴",
    tipLabel: "주인장 한마디",
    naverBtn: "네이버맵",
    googleBtn: "구글맵",
    homeMarker: "오조록 (숙소)",
    footerBrand: "오조록 · 제주 성산 오조리의 숙소",
    footerAddress: "제주특별자치도 서귀포시 성산읍 오조로100번길 5",
    bookAirbnb: "에어비앤비 예약",
    bookNaver: "네이버 예약",
    footerShareAsk: "이 리스트가 도움이 됐다면 친구에게 공유해주세요 🍊",
    empty: "이 카테고리에는 아직 추천이 없어요.",
    loadError: "추천 목록을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.",
  },

  en: {
    brand: "OJOROK",
    docTitle: "OJOROK Host's Jeju Guide Map",
    book: "Book",
    heroTitle: "The Ojo-ri Host's Jeju Notes",
    heroGreeting:
      "I run a stay in Ojo-ri, and these are only the places I actually go — with host tips you won't find by searching.",
    share: "Share this list",
    shareCopied: "Link copied! Paste it to your friends 🍊",
    mapTitle: "Map view",
    sortNear: "Nearest from OJOROK",
    all: "All",
    distance: (min) => `${min} min by car from OJOROK`,
    menuLabel: "Must-try",
    tipLabel: "Host's tip",
    naverBtn: "Naver Map",
    googleBtn: "Google Maps",
    homeMarker: "OJOROK (our stay)",
    footerBrand: "OJOROK · A stay in Ojo-ri, Seongsan, Jeju",
    footerAddress: "5, Ojoro 100beon-gil, Seongsan-eup, Seogwipo-si, Jeju",
    bookAirbnb: "Book on Airbnb",
    bookNaver: "Book on Naver",
    footerShareAsk: "If this list helped, share it with a friend 🍊",
    empty: "No picks in this category yet.",
    loadError: "Couldn't load the list. Please check your connection and refresh.",
  },

  zh: {
    brand: "OJOROK",
    docTitle: "OJOROK 主人的濟州推薦地圖",
    book: "預訂",
    heroTitle: "吾照里主人的濟州筆記",
    heroGreeting:
      "我在吾照里經營民宿，這裡只收錄我真正常去的地方，還有搜尋不到的主人小提示。",
    share: "分享這份清單",
    shareCopied: "已複製連結！貼到 LINE 分享給朋友吧 🍊",
    mapTitle: "地圖模式",
    sortNear: "離 OJOROK 最近優先",
    all: "全部",
    distance: (min) => `從 OJOROK 開車 ${min} 分鐘`,
    menuLabel: "推薦菜單",
    tipLabel: "主人小提示",
    naverBtn: "Naver 地圖",
    googleBtn: "Google 地圖",
    homeMarker: "OJOROK（我們的民宿）",
    footerBrand: "OJOROK · 濟州城山吾照里的民宿",
    footerAddress: "濟州特別自治道西歸浦市城山邑吾照路100號街5",
    bookAirbnb: "Airbnb 預訂",
    bookNaver: "Naver 預訂",
    footerShareAsk: "如果這份清單有幫助，請分享給朋友 🍊",
    empty: "這個分類目前還沒有推薦。",
    loadError: "無法載入推薦清單，請檢查網路連線後重新整理。",
  },
};
