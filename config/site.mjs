/**
 * 사이트 설정 — 주인장이 고칠 값들만 모아둔 곳
 * =========================================================
 * 여기 있는 값 말고는 app.js 를 열 일이 없어야 합니다.
 */

export const SITE = {
  /** 오조록 위치 (서귀포시 성산읍 오조로100번길 5)
   *  TODO: 네이버지도에서 숙소를 길게 눌러 나온 정확한 좌표로 교체하세요 */
  home: { lat: 33.4646, lng: 126.9159 },

  /** 예약 링크 — TODO: 실제 링크로 교체하세요 */
  booking: {
    airbnb: "https://www.airbnb.co.kr/",
    naver: "https://map.naver.com/",
  },

  /** 언어 설정 — 지원 언어를 늘리려면 config/strings.mjs 에도 같은 코드를 추가하세요 */
  languages: ["ko", "en", "zh"],
  defaultLanguage: "ko",

  /** 지도 */
  map: {
    zoom: 12,
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileAttribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
};
