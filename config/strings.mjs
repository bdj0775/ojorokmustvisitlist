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
    docTitle: "오조록의 제주 맛집 목록",
    book: "예약하기",
    heroTitle: "오조록의 제주 맛집 목록",
    heroGreeting:
      "책 읽기 좋은 민박, 오조록에서 손님을 위해 직접 고른 맛집 목록입니다. 주인장 취향이 반영되었으니 참고하세요! 내돈내산! 광고아님!",
    share: "공유하기",
    shareCopied: "링크가 복사됐어요! 카톡에 붙여넣어 주세요 🍊",
    mapTitle: "지도로 보기",
    sortNear: "오조록에서 가까운 순",
    all: "전체",
    distance: (min) => `오조록에서 차로 ${min}분`,
    menuLabel: "추천 메뉴",
    addressLabel: "주소",
    naverBtn: "네이버맵",
    googleBtn: "구글맵",
    homeMarker: "오조록 (숙소)",
    footerBrand: "오조록 · 제주 성산 오조리의 숙소",
    footerAddress: "제주특별자치도 서귀포시 성산읍 오조로100번길 5",
    bookAirbnb: "에어비앤비 예약",
    bookNaver: "네이버 예약",
    footerShareAsk: "이 리스트가 도움이 됐다면 친구에게 공유해주세요 🍊",
    empty: "이 태그에 해당하는 곳이 아직 없어요.",
    loadError: "추천 목록을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.",
  },

  en: {
    brand: "OJOROK",
    docTitle: "OJOROK's Jeju Restaurant List",
    book: "Book",
    heroTitle: "OJOROK's Jeju Restaurant List",
    heroGreeting:
      "OJOROK is a guesthouse made for reading. These are the places we picked ourselves, for our guests. They reflect the host's own taste — we paid for every meal, and nothing here is sponsored.",
    share: "Share",
    shareCopied: "Link copied! Paste it to your friends 🍊",
    mapTitle: "Map view",
    sortNear: "Nearest from OJOROK",
    all: "All",
    distance: (min) => `${min} min by car from OJOROK`,
    menuLabel: "Must-try",
    addressLabel: "Address",
    naverBtn: "Naver Map",
    googleBtn: "Google Maps",
    homeMarker: "OJOROK (our stay)",
    footerBrand: "OJOROK · A stay in Ojo-ri, Seongsan, Jeju",
    footerAddress: "5, Ojoro 100beon-gil, Seongsan-eup, Seogwipo-si, Jeju",
    bookAirbnb: "Book on Airbnb",
    bookNaver: "Book on Naver",
    footerShareAsk: "If this list helped, share it with a friend 🍊",
    empty: "No places with this tag yet.",
    loadError: "Couldn't load the list. Please check your connection and refresh.",
  },

  zh: {
    brand: "OJOROK",
    docTitle: "OJOROK 的濟州美食清單",
    book: "預訂",
    heroTitle: "OJOROK 的濟州美食清單",
    heroGreeting:
      "OJOROK 是一間適合閱讀的民宿。這是我們親自為客人挑選的餐廳清單，反映了主人的口味。全部自費，絕非廣告。",
    share: "分享",
    shareCopied: "已複製連結！貼到 LINE 分享給朋友吧 🍊",
    mapTitle: "地圖模式",
    sortNear: "離 OJOROK 最近優先",
    all: "全部",
    distance: (min) => `從 OJOROK 開車 ${min} 分鐘`,
    menuLabel: "推薦菜單",
    addressLabel: "地址",
    naverBtn: "Naver 地圖",
    googleBtn: "Google 地圖",
    homeMarker: "OJOROK（我們的民宿）",
    footerBrand: "OJOROK · 濟州城山吾照里的民宿",
    footerAddress: "濟州特別自治道西歸浦市城山邑吾照路100號街5",
    bookAirbnb: "Airbnb 預訂",
    bookNaver: "Naver 預訂",
    footerShareAsk: "如果這份清單有幫助，請分享給朋友 🍊",
    empty: "目前還沒有符合此標籤的店家。",
    loadError: "無法載入推薦清單，請檢查網路連線後重新整理。",
  },
};
