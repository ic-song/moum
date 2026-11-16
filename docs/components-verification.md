# 독립 컴포넌트 확장·고도화 검증

2026-11-16 KST. 신규3종과 기존5종의 이번 고도화 범위는 [컴포넌트 현황](components.md)을 기준으로 합니다. 초기 MOUM 전환 시점의 [검증 기록](moum-verification.md)은 그대로 보존합니다.

| 검사 | 결과 |
| --- | --- |
| npm run check | Node 93/93, 8개 패키지 배포 빌드 및 기존 기능 카탈로그 검사 통과 |
| test:components-browser | Chromium/Firefox/WebKit 각각 날짜 선택·페이지 조회·커서 목록·시간 초과/취소·기존5종 추가 기능·공통 UI 검사 통과. 총18개 시나리오 묶음 |
| test:mini-gantt | 3엔진 모두 Bars/Compact/Summary/Milestones, 공통·잘린 범위, 부모 중복 제외 요약, 키보드 선택/조회 전용, 전체 보기 전환, API undo, 빈 상태, 7개 폭·자동 접근성 통과 |
| test:suite-browser | 기존4종의 3엔진18개 묶음 통과. 차트·간트·캘린더·업로더의 원래 편집/드래그/전송 흐름 보존 |
| test:browser | 기존 그리드의 기본/고급/확장/페이징/서버조회/서버편집 6개 스크립트 통과, 3엔진 서버편집24흐름 포함 |
| test:recovery | 3엔진27개 복구 흐름·자동 접근성·9개 화면 폭 통과 |
| test:usage | 실제 0.7.1 tgz 격리 설치·파일 복사·ESM/CJS·React/Vue 마운트/갱신/제거 검사 통과 |
| 배포 | 8개 tgz 생성. 일곱 독립 도구의 격리 ESM/CJS·CSS/타입/라이선스·SHA-256 검사 통과, grid는 test:usage에서 검사 |
| 타입 | 7개 도구 사용 예제의 TypeScript strict/NodeNext 컴파일 통과 |
| UI/접근성 | 8개 컴포넌트의 공통 글꼴·크기·줄높이·반경, 상위 요소 테마 상속, 320–2560px 7개 폭에서 문서 가로 넘침 없음. 선언한 WCAG A/AA 자동 검사 위반0 |

주요 예외 검사는 날짜의 윤년·기간 내부 제외일·부분 선택·잠금·키보드, 페이지 총건수 감소와 한 차례 재조회, 서버 오류 시 기존 데이터 보존, AbortSignal 무시/응답 없음/취소 이후 늦은 결과, 목록 중복 키·커서 정체·표시 한도·HTML 문자열의 비실행, 제한된 병렬 전송과 전체 취소를 포함합니다.

공통 UI 캡처·리뷰: 9개 대표 경로·21개 상태·179개 화면/원본426조각과 369개 폭 샘플 검토 완료. 시각 품질 게이트 pass, blocking0. 테이블/간트/월간 달력의 내부 가로 스크롤은 문서 넘침과 구별해 검토했습니다. 반응형 미디어 쿼리가 없는 공통/페이지/목록/미니 예제 CSS의 비차단 소스 경고4건은 flex-wrap·intrinsic minmax와 실제 화면 검사로 확인했습니다. 로컬 근거는 `.codex/design/reviews/components/` 및 `output/components-*.log`, `output/playwright/components/`입니다. 캡처 도구는 RGB PNG를 지원하도록 로컬 사본에서 보정했으며 원본 스킬 파일은 변경하지 않았습니다. RGBA 픽셀 결과를 Pillow와 SHA-256으로 대조했습니다.

이 결과는 실제 서비스 서버/인증/DB 연결, 물리 기기·스크린리더 인증, 무제한 데이터 성능 보증을 뜻하지 않습니다. 예제의 Pagination/InfiniteScroll 서버 동작은 지연·실패를 재현하는 로컬 로더이며 실제 HTTP 전송 검사는 기존 업로더/그리드 테스트에서 별도로 수행했습니다. npm에는 게시하지 않습니다.
