# Grid 0.8.0 검증 기록

2026-11-22 KST, 로컬 `codex/grid-types`에서 실행했습니다. TypeScript 5.9.3은 개발 검사에만 사용합니다.

| 검사 | 결과 |
| --- | --- |
| `npm run check` | 단위 107/107, 8개 패키지 빌드, 기능 카탈로그 통과 |
| `npm run test:grid-types` | tgz의 선언/해시·CJS/ESM 실행·주/이행 진입점 통과. NodeNext ESM/CJS 및 Bundler strict, 정상 사용·추론·의도한 타입 오류 검사 통과 |
| `npm run test:validation-browser` | Chromium·Firefox·WebKit에서 숨긴 행의 원본 좌표, 활성 편집창/모델 보존, 서버 추가 초안 검증 통과 |
| `npm run test:browser` | 기존 6개 그리드 검사 스크립트 통과. 서버 조회·편집 3엔진, 저장 24흐름 포함 |
| `npm run test:usage` | 오프라인 tgz 설치·해시·브라우저 ESM, 실제 React/Vue 컴포넌트, 3엔진 파일 실행/복사본 통과 |
| `npm run test:packages` | 8종 tgz 생성, 기존 7종 격리 소비자 exports·타입 파일·해시 검사 통과 |
| `node node_modules/typescript/bin/tsc -p output/suite-consumer` | 기존 7종 소비자 strict 컴파일 통과 |
| `git diff --check` | 공백 오류 없음 |

단위 검사에서 필수값·숫자/불리언·사용자 검증의 오류 수집, 읽기 전용 컬럼/모델, 빈 모델, 수식 오류/결과/opt-out, 원본 값·revision·알림·Undo/Redo 보존을 확인했습니다. 브라우저 회귀 검사의 접근성/폭 검사는 기존 화면 대상이며 새 UI를 추가하지 않았습니다.

로컬 증거는 `output/grid-types-check.log`, `output/grid-types-build.log`, `output/grid-types-browser.log`, `output/grid-types-usage.log`, `output/grid-types-packages.log`와 `output/grid-types-consumer/`입니다. 새 검사 명령은 Check/Browser 워크플로우에 추가했으며 원격 CI는 아직 실행하지 않았습니다.

서버 전체 행 검증·행 조합 검증·오류 위치 자동 이동 UI·실제 스크린리더/기기 시험은 포함하지 않습니다. npm 게시와 원격 반영은 수행하지 않았습니다. 사용 계약은 [입력 검증·타입](grid-validation-types.md)을 확인하세요.
