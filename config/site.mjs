/**
 * 사이트 설정 — 주인장이 고칠 값들만 모아둔 곳
 * =========================================================
 * 여기 있는 값 말고는 app.js 를 열 일이 없어야 합니다.
 */

export const SITE = {
  /** 오조록 위치 (서귀포시 성산읍 오조로100번길 5)
   *  TODO: 네이버지도에서 숙소를 길게 눌러 나온 정확한 좌표로 교체하세요 */
  home: { lat: 33.4646, lng: 126.9159 },

  /** 예약 링크 */
  booking: {
    airbnb: "https://www.airbnb.co.kr/rooms/1444791842994786207",
    naver: "https://naver.me/xYvOKvcN",
  },

  /** 숙소 SNS — 푸터에 버튼으로 나옵니다. 비워두면 그 버튼이 사라집니다. */
  social: {
    instagram: "https://www.instagram.com/ojorok.jeju",
  },

  /** 언어 설정 — 지원 언어를 늘리려면 config/strings.mjs 에도 같은 코드를 추가하세요 */
  languages: ["ko", "en", "zh"],
  defaultLanguage: "ko",

  /** 저장소 정보.
   *  관리자 페이지(admin.html)는 지금 내 컴퓨터의 파일을 직접 고치므로
   *  이 값을 쓰지 않습니다. 나중에 웹에서 쓰게 될 때를 위해 남겨둡니다. */
  github: {
    owner: "bdj0775",
    repo: "ojorokmustvisitlist",
    path: "places.json",
    /** 비워두면 저장소의 기본 브랜치에 저장합니다 */
    branch: "",
  },

  /** 지도 */
  map: {
    zoom: 12,
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileAttribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
};
