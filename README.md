# CEACK 메인 화면

React + Vite로 만든 캐릭터 스토리 탐색 화면입니다. Gemini 채팅용 로컬 서버와 대화 화면이 포함됩니다. 실제 대화에는 개인 API 키 설정이 필요하며 로그인·DB는 없습니다. 작품 3개는 편집 가능한 오리지널 샘플입니다. 표지는 작품별 PNG를 사용하며 다른 이미지로 교체할 수 있습니다.

## 실행

```sh
npm install
npm run dev
```

## 작품 수정과 PixAI 이미지 넣기

각 작품의 정보와 이미지가 같은 폴더에 있습니다.

- `public/works/lumina/` — 루미나 아카데미
- `public/works/midnight/` — 자정의 도서관
- `public/works/afterglow/` — 여름이 머무는 우체국

1. PixAI에서 내려받은 이미지를 해당 폴더에 `cover.webp` 또는 `cover.png` 등으로 저장합니다.
2. 같은 폴더의 `story.json`에서 `"cover": "cover.svg"`를 `"cover": "cover.webp"` 등 실제 파일명으로 바꿉니다.
3. `title`, `subtitle`, `description`, `author`, `category`, `tags`, `opening`을 자유롭게 수정한 뒤 브라우저를 새로고침합니다.

표지는 세로 3:4 비율을 권장합니다. 카드에서는 일부가 잘리므로 인물 얼굴이나 주요 피사체를 중앙에 배치하세요. 파일명은 영문을 권장합니다. `color`는 이미지 로드 실패 시 배경색입니다. JSON은 큰따옴표를 쓰고 마지막 항목 뒤에 쉼표를 붙이지 않습니다. `opening` 줄바꿈은 `\n`으로 입력합니다.

장르는 `전체`, `판타지`, `로맨스`, `미스터리`, `시뮬레이션`, `일상` 탭이 제공됩니다. 탭 변경은 `src/main.jsx`의 `genres`에서 가능합니다.

## 작품 추가

1. 기존 작품 폴더를 복사하고 폴더명을 바꿉니다.
2. `story.json`의 정보를 변경합니다.
3. `public/works/index.json` 배열에 새 폴더명을 추가합니다.

## 동작

- 검색: 작품 제목, 부제, 태그
- 장르 필터 / 신작(등록 목록 역순)
- 카드·상세 화면 태그 클릭: 정확히 같은 태그의 작품만 표시. 같은 태그를 다시 누르거나 선택 태그의 X로 해제. 장르·검색·보관함 조건과 함께 적용되며 주 메뉴 전환 시 초기화.
- 작품 상세와 프롤로그 미리보기
- 하트 보관: 현재 브라우저 localStorage에 저장
- 추천 배너: 화살표와 인디케이터로 전환
- 실제 JSON 로딩 중 스켈레톤 UI
- 하단 '로딩 UI 미리보기': 1.6초 스켈레톤 표시
- 이미지 누락, 작품 데이터 오류, 검색 결과 없음 처리

`npm run build`로 배포용 `dist`를 만듭니다. 배포 후에는 JSON과 이미지를 수정하고 다시 배포해야 합니다. 코드 작성 없이 웹에서 수정하는 관리자 화면은 현재 포함되어 있지 않습니다.

## Ollama(내 컴퓨터 AI)로 채팅하기

기본 설정은 내 컴퓨터에서 도는 Ollama입니다. API 키가 필요 없고 대화가 외부로 나가지 않습니다.

1. Ollama를 설치하고(`irm https://ollama.com/install.ps1 | iex`) `ollama pull qwen2.5:14b`로 모델을 받습니다.
2. `.env.example`을 `.env`로 복사합니다. `AI_PROVIDER=ollama`, `OLLAMA_MODEL=qwen2.5:14b`가 기본값입니다.
3. `npm run dev`를 실행하고 `http://127.0.0.1:5187/`을 엽니다.

- 다른 모델은 `ollama list`에 보이는 이름을 `OLLAMA_MODEL`에 적고 서버를 재시작합니다. 한국어는 qwen2.5 계열을 권장합니다.
- 컴퓨터 성능에 따라 답변에 수십 초가 걸릴 수 있고, 첫 메시지는 모델을 불러오느라 더 느립니다. 최대 약 3분까지 기다립니다.
- 화면의 '대화 준비됨'은 Ollama가 켜져 있고 설정한 모델이 설치되어 있다는 뜻입니다.
- Gemini를 쓰려면 `.env`에서 `AI_PROVIDER=gemini`로 바꾸고 아래 설정을 따릅니다.

## Gemini 채팅 실행 (추가됨)

Node.js 22 이상이 필요합니다. 채팅 화면과 로컬 API 서버를 함께 실행합니다.

1. `.env.example`을 참고해 프로젝트 루트의 `.env`에 `GEMINI_API_KEY`를 입력합니다. 키는 채팅이나 React 소스에 붙여넣지 않습니다.
2. `GEMINI_MODEL`을 계정에서 사용 가능한 모델 ID로 설정합니다. 기본값은 `gemini-3.8-flash`입니다.
3. `npm run dev`를 실행하고 `http://127.0.0.1:5187/`을 엽니다. 기존 개발 서버가 켜져 있다면 먼저 종료하세요.
4. 작품 상세 → **대화 시작 · 이어하기** → 메시지 전송.

`.env` 변경 후에는 개발 서버를 재시작하세요. 키가 없어도 홈과 채팅 화면은 열리지만 실제 전송은 비활성화됩니다. '대화 준비됨'은 키가 설정되었다는 의미이며 키의 유효성·할당량은 실제 요청 시 확인됩니다.

### 실제 파일 구조

```text
.env                         # 개인 API 키 (Git 제외)
.env.example                 # 키 없이 공유 가능한 예시
vite.config.js               # /api 요청을 로컬 3001 서버로 전달
scripts/dev.js               # 프런트·서버 동시 실행
server/
  index.js                   # .env 읽기 및 서버 실행
  app.js                     # 검증, 작품 읽기, Gemini 호출, 오류 처리
  app.test.js                # 모의 Gemini 응답으로 서버 테스트
  prompts/
    lumina.txt               # 작품별 성격·세계관 추가 지침
    midnight.txt
    afterglow.txt
src/
  main.jsx                   # 메인·상세 및 채팅 진입
  Chat.jsx                   # 대화 화면, 로컬 저장, 전송·중지
  chat.css                   # PC·모바일 채팅 스타일
public/works/                # 작품 정보·표지 (기존 구조 유지)
```

### 요청 흐름

`React Chat → POST /api/chat → 서버의 작품 설정 + 최근 대화 → Gemini generateContent → JSON 응답 → 채팅 화면`

- `GET /api/health`: API 키 설정 여부와 모델 ID만 반환. 키는 반환하지 않습니다.
- `POST /api/chat`: `{storyId, messages: [{role: "user" | "model", text}]}` → `{reply, truncated}`.
- 입력 2,000자, 최근 10회 대화 + 새 메시지를 전송합니다. 장기 기억·요약 기능은 없습니다.
- 작품별 최근 50회 대화를 브라우저 localStorage에 저장합니다. 기기·브라우저 간 동기화는 없습니다.
- 실패하거나 중지한 요청은 기록에 저장하지 않으며 입력 내용을 유지합니다. 중지가 이미 처리된 API 비용을 취소하는 것은 아닙니다.
- 현재는 완성된 답변을 한 번에 표시합니다. 스트리밍은 구현하지 않았습니다.
- 새 대화는 해당 작품의 브라우저 기록만 삭제합니다. 삭제 전 확인창이 표시됩니다.
- `server/prompts/*.txt`를 수정하면 다음 메시지부터 적용됩니다. 새 작품의 지침 파일은 선택사항입니다.

### 실행·검증 명령

- `npm run dev`: 화면과 서버 동시 실행
- `npm run dev:web`: 화면만 실행
- `npm run dev:server`: 서버만 개발 모드로 실행
- `npm run start:server`: API 서버 실행
- `npm run test`: 요청 검증·Gemini 응답 파싱·오류·HTTP 테스트 (실제 유료 API 호출 없음)
- `npm run build`: 프런트 빌드
- `npm run preview`: 빌드된 프런트 확인 (별도로 API 서버 실행 필요)

이 서버는 로컬 사용용으로 127.0.0.1에 바인딩됩니다. 공개 운영용 인증·사용자별 할당량·DB는 아직 없습니다. `dist`만 정적 호스팅하면 Gemini API는 동작하지 않습니다. 외부 배포 시 별도 Node 서버와 동일 출처 `/api` 프록시, 로그인·사용량 통제를 구성해야 합니다.

참고: https://ai.google.dev/api/generate-content

## 행동에 따라 장면 사진 표시

각 작품 폴더의 `scenes.json`에서 행동 문구와 사진을 연결합니다. AI 답변이 성공한 뒤 사진이 함께 표시되며 대화 기록에도 이미지 경로가 저장됩니다.

예: `public/works/lumina/images/a.png`에 PixAI 이미지를 넣고 `public/works/lumina/scenes.json`을 아래처럼 설정하세요.

```json
[
  {
    "enabled": true,
    "keywords": ["천문탑 문을 연다", "천문탑 문을 열어"],
    "image": "images/a.png",
    "caption": "천문탑에 들어선 순간"
  }
]
```

- `keywords` 중 하나가 최신 사용자 메시지에 포함되면 발동합니다. 공백·영문 대소문자는 무시합니다.
- 여러 설정이 맞으면 위에서부터 첫 번째 사진 하나를 표시합니다. 매번 조건이 맞으면 다시 표시합니다.
- 의미를 이해하는 AI 판정이 아니라 문구 매칭입니다. 부정문·가정문에도 문구가 포함되면 발동할 수 있으므로 구체적인 행동 문구로 설정하세요.
- 파일명은 영문·숫자·하이픈·밑줄을 사용하세요. PNG/JPG/JPEG/WebP/GIF/SVG를 지원하며 외부 URL은 받지 않습니다.
- 키워드가 없으면 사진은 표시하지 않습니다. 누락된 이미지에는 안내가 표시됩니다.
- 기본 예시는 `천문탑 문을 연다`, `책을 펼친다`, `편지를 읽는다`입니다. 샘플 SVG는 사진 교체 위치를 알려주는 임시 그림입니다.
- 수정한 설정은 다음 요청부터 적용됩니다. 이미 저장된 대화는 당시 사진 경로를 유지합니다.
