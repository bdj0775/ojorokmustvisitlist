# 카톡 공유 미리보기 이미지 만들기

`images/og.png` — 카톡·라인에 링크를 붙였을 때 뜨는 그림입니다.

`og.html` 이 그 그림의 원본입니다. 문구나 색을 바꾸려면 이 파일을 고친 뒤
아래 명령으로 사진을 다시 찍으면 됩니다.

## 문구 바꾸기

`og.html` 아래쪽 세 줄만 고치면 됩니다.

```html
<p class="eyebrow">오조록이 추천하는</p>
<h1 class="title">제주 맛집 목록</h1>
<p class="sub">Local Favorites in Jeju</p>
```

## 다시 만들기

PowerShell 에서 프로젝트 폴더에 들어간 뒤 아래를 그대로 붙여넣으세요.

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --hide-scrollbars --screenshot="$PWD\images\og.png" --window-size=1200,630 "$PWD\tools\og\og.html"
```

엣지 브라우저로 화면을 찍는 것뿐이라 따로 설치할 것은 없습니다.
찍고 나면 `images/og.png` 가 새 그림으로 바뀝니다.

## 확인

카톡은 한 번 읽은 미리보기를 며칠 저장해둡니다.
바꿔도 예전 그림이 뜨면 아래에서 초기화하세요.

<https://developers.kakao.com/tool/debugger/sharing>

## 지켜야 할 것

- **크기는 1200x630 을 유지하세요.** 카톡이 이 비율을 기준으로 자릅니다.
- 색은 `styles/tokens.css` 의 값을 그대로 옮겨 적었습니다.
  디자인 색을 바꾸면 이 파일의 색도 함께 고쳐야 어긋나지 않습니다.
- 글자와 배경의 명도 대비는 4.5:1 이상으로 두세요.
  작은 화면에서 미리보기가 흐릿하게 보이는 것을 막아줍니다.
