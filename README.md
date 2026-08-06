# 오조록 주인장의 제주 추천 지도

성산 오조리 숙소 **오조록** 주인장이 직접 찍어주는 제주 맛집·명소 지도.
서버·DB 없는 정적 사이트 하나로 동작합니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 페이지 뼈대 (헤더 · 히어로 · 지도 · 필터 · 카드 · 푸터) |
| `style.css` | 디자인 (화이트 베이스 + 바다 블루 + 감귤 오렌지) |
| `app.js` | 동작 (3개 언어 전환, 필터/정렬, Leaflet 지도, 공유) + 상단 `CONFIG` |
| `places.json` | **추천 목록 데이터 — 평소에는 이 파일만 수정하면 됩니다** |
| `images/` | 장소 사진, OG 공유 이미지(`og.jpg`) |
| `tools/validate-places.mjs` | `places.json` 검사기 (아래 참고) |
| `.github/workflows/deploy.yml` | 올릴 때마다 자동 검사 → GitHub Pages 배포 |

## 로컬에서 확인하기

`places.json`을 fetch로 불러오기 때문에 파일을 더블클릭으로 열면 안 되고, 간단한 로컬 서버가 필요합니다:

```bash
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

## 추천 장소 추가/수정 — `places.json`

- 파일 상단 `_안내` 항목에 편집 방법이 적혀 있고, `_예시` 항목을 복사해서 시작하면 됩니다.
- `en` / `zh` 번역이 비어 있으면 자동으로 한국어가 표시되므로 **한국어만 채워도 사이트가 깨지지 않습니다.**
- `category`는 `맛집 / 카페 / 명소 / 산책·오름` 중 하나.
- 현재 들어 있는 5곳은 **예시 데이터**입니다. 실제 추천 20곳 목록이 확정되면 교체하세요.

### 고친 뒤 검사하기

손으로 JSON을 고치다 보면 쉼표 하나 때문에 사이트가 빈 화면이 되기 쉽습니다. 올리기 전에 한 번 돌려보세요:

```bash
node tools/validate-places.mjs
```

빠진 항목, 중복된 `id`, 잘못된 카테고리, 위도·경도를 바꿔 넣은 실수, 없는 사진 파일까지 짚어줍니다.
**GitHub에 올릴 때도 자동으로 실행되며, 여기서 걸리면 배포가 멈춥니다** — 깨진 데이터가 손님에게 보이는 일은 없습니다.

## 오픈 전에 채워야 할 것 (TODO)

`app.js` 상단 `CONFIG`에서:

1. **`home` 좌표** — 오조록 정확한 위도/경도 (현재는 오조포구 근처 근사값)
2. **`bookingAirbnb`** — 실제 에어비앤비 숙소 링크
3. **`bookingNaver`** — 실제 네이버 예약 링크

그 외:

4. `images/og.jpg` — 카톡/LINE 공유 미리보기 대표 이미지 (1200×630 권장)
5. `index.html`의 `og:image`를 배포 후 **절대 URL**로 변경 (예: `https://….github.io/…/images/og.jpg`) — 카톡은 상대 경로 OG 이미지를 읽지 못합니다
6. `places.json` 예시 데이터 → 실제 추천 20곳으로 교체

## 배포 (GitHub Pages)

처음 한 번만 설정하면 됩니다:

1. GitHub 저장소 → **Settings → Pages**
2. Source 를 **`GitHub Actions`** 로 선택 (`Deploy from a branch` 아님)
3. 이 브랜치를 `main` 에 머지하면 자동으로 배포가 돌아갑니다
4. 몇 분 뒤 `https://<계정>.github.io/ojorokmustvisitlist/` 로 접속 가능

이후에는 **`places.json` 을 고쳐서 `main` 에 올리기만 하면 자동으로 검사 → 배포**됩니다.
배포 상태는 저장소의 **Actions** 탭에서 볼 수 있습니다.

배포 주소가 정해지면 QR 코드를 만들어 숙소 안내판·방명록에 부착하세요.

언어별 공유 링크: URL 뒤에 `?lang=en` 또는 `?lang=zh`를 붙이면 해당 언어로 열립니다.
(예: 대만 손님에게는 `…/?lang=zh` 링크를 그대로 전달)
