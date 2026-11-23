# 기여하기

MOUM은 여러 분야의 웹 앱에 가져다 쓰는 범용 JavaScript 도구 모음입니다. 신규 기능은 공통으로 쓰이는 동작과 앱이 연결할 분야별 규칙을 구분해 제안해 주세요. 이슈와 PR은 한국어·영어로 작성할 수 있습니다. [개발 방향](docs/roadmap.md) · [지원 범위](docs/feature-catalog.md) · [검증 기록](docs/verification.md)

## 개발 환경

Node.js 22 이상을 사용합니다. 런타임 라이브러리는 외부 의존성이 없으며 개발 검증 도구만 devDependencies로 관리합니다.

```sh
npm ci
npm run check
npm run dev
```

`npm run check`는 단위 검사·배포 빌드·기능 카탈로그를 확인합니다. 브라우저 도구 없이 코어만 수정할 때도 실행할 수 있습니다. 인터넷 없는 환경에서는 npm 캐시/사내 레지스트리를 준비하거나 배포 파일을 사용하세요.

```sh
npx playwright install chromium firefox webkit
# 별도 터미널에서 npm run dev를 실행한 상태로
npm run test:browser
npm run test:recovery
npm run test:resilience
npm run test:usage
npm run test:suite-browser
```

Linux에서는 `npx playwright install --with-deps chromium firefox webkit`로 시스템 라이브러리도 준비할 수 있습니다. 테스트는 루프백 예제 API를 사용합니다. 운영 API에 실행하지 마세요. 포트가 겹치면 `MOUM_DEMO_PORT`와 `MOUM_DEMO_URL`을 같은 주소로 설정합니다. 기본 포트는 4173입니다. Windows PowerShell 예: `$env:MOUM_DEMO_PORT='4174'`, `$env:MOUM_DEMO_URL='http://127.0.0.1:4174'`.

## 디렉터리

```text
packages/grid/       라이브러리 소스·단위 검사·배포물·라이선스
examples/            바로 실행하거나 복사할 수 있는 사용 예제
docs/                API·사용법·지원 범위·검증 결과
scripts/             빌드·예제 서버·브라우저/Excel 검증
.github/             CI·이슈/PR 템플릿·패키지 생성 워크플로우
```

그리드·차트·간트·업로더·캘린더를 각각 독립 패키지로 제공하는 workspace 구조입니다. 데모와 라이브러리 소스를 분리합니다. 새 모듈을 추가할 때도 src/test/dist와 README/LICENSE를 갖춥니다.

## 변경 규칙

- 코어에서 CDN·원격 글꼴·텔레메트리·숨은 네트워크 요청을 추가하지 않습니다. 서버 주소와 인증은 호스트 콜백이 결정합니다.
- 사용자 데이터를 원자적으로 검증하고, 실패하면 기존 값·미저장 작업을 유지합니다. 복구 저장소의 계정 분리와 저장 오류를 숨기지 않습니다.
- 원본 유료 제품의 코드/리소스를 복제하지 않습니다. 공개 동작·문서를 참고한 독립 구현만 포함합니다.
- vendor 파일은 직접 수정하지 않습니다. 교체 시 출처·라이선스·버전·해시를 함께 검토합니다.
- 동작이 바뀌면 관련 단위/브라우저 검사, API 문서, 예제, CHANGELOG를 함께 갱신합니다. dist만 직접 편집하지 않습니다.
- `npm run build` 후 생성한 dist/SHA256SUMS와 카탈로그 변경도 PR에 포함합니다. `npm run check` 뒤 예상하지 않은 생성물 차이가 없어야 합니다.
- 여러 채팅/개발자가 작업하면 각자 worktree를 사용하세요. 다른 작업의 미완성 변경을 커밋하거나 배포하지 않습니다.

PR에는 해결하는 문제·변경 후 동작·실행한 검사·남은 한계를 적어주세요. 실제 화면/데이터를 첨부할 때는 비밀 값과 개인정보를 제거합니다. [PR 템플릿](.github/PULL_REQUEST_TEMPLATE.md)을 제공합니다.

## 릴리스

[릴리스 절차](docs/releasing.md)를 따릅니다. npm 등록/공개 릴리스는 별도 작업이며, PR을 병합했다고 자동 게시하지 않습니다.
