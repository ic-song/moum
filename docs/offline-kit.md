# MOUM 오프라인 배포본

배포본은 11개 독립 라이브러리의 설치 파일, 브라우저용 JS·CSS, 한국어 예제, API 문서와 라이선스를 담습니다.

## 브라우저에서 바로 사용

압축을 푼 뒤 [그리드 빠른 시작](../examples/quick-start/index.html)을 열어 셀을 편집하세요. [전체 예제](../examples/grid/index.html)의 상단 메뉴에서 기존 도구를 열 수 있습니다. [탭·아코디언·대화상자](../examples/controls/index.html)도 파일에서 바로 실행할 수 있습니다. 일반 HTML이나 JSP에는 필요한 패키지의 `packages/<이름>/dist/moum-<이름>.js`와 CSS를 복사하세요. 패키지의 LICENSE도 배포에 포함하세요.

서버 조회·편집 예제와 업로더 Worker를 시험하려면 압축을 푼 폴더에서 `node scripts/serve.mjs`를 실행하고 `http://127.0.0.1:4173/`을 여세요. 서버는 로컬 샘플 데이터를 사용합니다. Excel 기능과 업로더 Worker를 배포할 때는 해당 패키지의 `vendor/sheetjs`와 제3자 라이선스도 함께 복사하세요.

## npm 프로젝트에 설치

필요한 tgz를 대상 프로젝트의 `vendor/moum`에 복사한 뒤 프로젝트 루트에서 설치합니다.

```sh
npm install --offline ./vendor/moum/moum-grid-0.8.0.tgz
```

프로젝트에 기존 의존성이 있다면 해당 패키지는 npm 캐시에 준비돼 있어야 합니다. 아래와 같이 JavaScript와 CSS를 불러옵니다.

```js
import Grid from '@moum/grid';
import '@moum/grid/style.css';
```

CommonJS에서는 `const { Grid } = require('@moum/grid')`를 사용합니다. 타입 선언은 tgz에 포함돼 있습니다. 패키지별 API와 예제는 `packages/<이름>/README.md`에 있습니다.

## 전달받은 파일 확인

```sh
node scripts/verify-offline.mjs
```

압축에 포함된 파일의 SHA-256을 목록과 비교합니다. 신뢰하는 경로에서 배포본을 받으세요.

저장소에서 새 배포본을 만들려면 Node.js 22 이상과 npm, `tar`가 있는 환경에서 `npm run pack:offline`을 실행하세요. 완성 파일은 `output/moum-offline.tar.gz`입니다. GitHub Actions의 수동 **Package** 작업도 같은 파일을 생성합니다.
