# MOUM 전환·통합 검증

이 문서는 초기 전환 시점 기록입니다. 이후 신규 컴포넌트·공통 UI 검증은 [컴포넌트 검증](components-verification.md), DatePicker/Charts/Gantt/Uploader 최신 고도화는 [업무 컴포넌트 검증](business-components-verification.md)을 참고하세요.

2026-11-16 KST. 기존 Moa JS 통합 커밋 18580f8(그리드 0.7.0 복구/OSS 정비와 독립 도구 4종)을 새 Git 저장소로 가져왔습니다. 소스·예제·타입·문서·워크플로우·설치 이름을 MOUM으로 전환했습니다. 그리드 0.7.0과 새 도구 각 0.1.0의 기능 범위를 유지합니다.

전환 전 기능 검증은 과거 [그리드 기록](verification.md)과 [독립 도구 기록](suite-verification.md)에 보존합니다. 다음 검사는 MOUM 이름으로 전환한 새 독립 작업 폴더에서 실행했습니다.

| 검사 | 결과 |
| --- | --- |
| 독립 개발 환경 | 새 폴더에서 npm ci 성공. 저장소 밖 개발 도구에 의존하지 않음 |
| npm run check | 단위 82/82, browser/ESM/CJS/CSS 빌드, 기능 카탈로그 일치 통과 |
| test:suite-browser | Chromium·Firefox·WebKit 18개 시나리오 묶음 통과. Excel 파싱·수정/검증·그리드 전달·실제 multipart HTTP·취소/시간 초과/재시도·간트/캘린더 드래그·일정 편집 포함 |
| test:browser | 기존 그리드의 기본·고급·확장·페이징·서버 조회·서버 편집 6개 검사 스크립트 통과. 서버 편집 3엔진 24흐름 포함 |
| test:recovery | 3엔진 27개 복구 흐름·자동 접근성·9개 화면 폭 통과 |
| test:usage | 새 @moum/grid tgz의 독립 설치, HTML/복사본/ESM/CJS 및 실제 React·Vue 사용 예제 3엔진 통과 |
| test:resilience | 격리된 브라우저 프로세스 강제 종료·프로필 재개, 미확정 서버 저장 요청 ID 복구, 2,000회 편집·25회 생성/제거 후 데이터 복구·DOM/이벤트 수 제한 통과 |
| 배포 패키지 | 5개 tgz 생성. 차트/간트/업로더/캘린더의 격리 소비자 CJS/ESM exports·CSS·타입·라이선스·SHA-256 검사 통과 |
| 타입 | 네 독립 패키지 사용 예제 TypeScript strict/NodeNext 컴파일 통과 |
| 제3자 원본 | SheetJS 두 사본과 LICENSE가 기존 원본 및 Git 인덱스와 바이트 일치함을 확인 |

브라우저 검사 중 선언한 WCAG A/AA 자동 검사에서 위반이 없고, 페이지 단위 가로 넘침/예기치 않은 JS 오류가 없음을 확인했습니다. 이는 실제 스크린리더 인증을 뜻하지 않습니다. 로컬 근거는 output/moum-*.log 및 output/playwright/에 있으며 개인정보/프로필/로컬 출력은 Git에 포함하지 않습니다.

공개 저장소는 [ic-song/moum](https://github.com/ic-song/moum)입니다. 해당 소스 커밋의 서버 검사 결과는 저장소의 [Check](https://github.com/ic-song/moum/actions/workflows/check.yml)와 [Browser](https://github.com/ic-song/moum/actions/workflows/browser.yml) Actions에서 확인할 수 있습니다. 기존 moa-js 원격 저장소는 수정하지 않았고 새 저장소에는 독립 initial commit으로 게시합니다.

실서비스 서버/인증/DB 연결, 실제 휴대폰·스크린리더 인증, npm 공개 게시 범위는 포함하지 않습니다. 브랜드 전환이 과거 기록의 미검증 항목을 새로 검증한 것으로 바꾸지는 않습니다.
