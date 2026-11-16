> 이 문서는 MOA 이름으로 수행한 이전 작업의 기록입니다. MOUM 전환 후 검증은 [MOUM 검증 기록](moum-verification.md)을 참고하세요.

# Moa suite 0.1.0 검증 기록

확인일: 2026-11-16 KST. 그리드 0.6.0 기준에 독립 charts/gantt/uploader/calendar 0.1.0을 추가했습니다. 브랜치 `codex/charts-gantt-uploader`, 작업 트리 `C:/Users/user/Documents/public/moa-js-suite`. 원래 폴더의 다른 그리드 작업과 분리했습니다. npm 게시·원격 push·main 병합은 하지 않았습니다.

## 확인한 동작

| 검사 | 결과 |
| --- | --- |
| `npm run check` | 기존 그리드 포함 Node 77/77, 배포 빌드, 카탈로그 일치 통과 |
| `node scripts/browser-suite-check.mjs` | Chromium·Firefox·WebKit 각 6개 시나리오 묶음, 총 18개 통과 |
| 접근성 자동 검사 | 세 엔진에서 차트·간트·캘린더 월/일·업로더 WCAG A/AA 검사, 위반 0건 |
| 브라우저 회귀 | 7종 차트·선택·SVG·빈 상태, 간트 드래그/키보드/폼/계층/되돌리기, 캘린더 4보기/CRUD/반복/드래그/겹침/자정 경계 통과 |
| 업로더 회귀 | 다중 시트 Excel·CSV·열 매핑·셀 수정/재검증·HTML 텍스트 처리·그리드 전달 통과 |
| 전송 경계 | 실제 로컬 multipart HTTP 2xx/422, 진행률, 취소/늦은 응답, 타임아웃, 재시도, 순차 전송, 읽기 중 제거, 완료 콜백 예외 통과 |
| 독립 설치 파일 | 네 tgz에서 CJS/ESM exports, CSS·타입·라이선스·SHA-256 검증 통과 |
| TypeScript | 격리 소비자에서 네 패키지 사용 예제 strict/NodeNext 컴파일 통과 (개발 도구 7.0.2) |
| 기존 그리드 브라우저 회귀 | 복사/붙여넣기·범위 선택·편집/검증·undo/redo·CSV·file:// 오프라인 통과 |
| 반응형 | 네 경로 각각 320~2560px, 640px 경계 포함 38개 폭 스캔. 문서 가로 넘침·브라우저 오류 0건 |
| 렌더 검토 | 84개 화면과 186개 원본 뷰포트 캡처를 색인된 15개 contact sheet 및 주요 원본 이미지로 검토. 자동 visual gate pass |

## 수정한 주요 결함

- 차트 SVG의 이미지 역할이 내부 키보드 항목을 가리던 문제를 그룹 역할로 수정했습니다. 범례를 토글해도 키보드 포커스를 유지합니다.
- 좁은 화면의 차트 축/글자를 고정 900px 캔버스에서 축소하지 않고 실제 컨테이너 너비로 다시 계산합니다. ResizeObserver 렌더는 다음 프레임에 실행해 반복 알림 오류를 방지합니다.
- 예제 출력은 블록 스크롤 영역으로 만들고 키보드 초점을 허용했습니다.
- 간트에서 잘못된 드래그 변경을 거절하면 원래 막대 위치를 복원합니다.
- 캘린더 자정 경계 일정 선택은 표시용으로 잘린 시간이 아닌 원본 발생 시간을 전달합니다. WebKit file://에서 사용자 MIME 타입이 제거되는 차이는 인스턴스 내부 드래그 상태로 해결했습니다.
- 사용자 업로드 함수가 취소를 무시해도 대기 상태를 끝내며, 즉시 취소하면 전송을 시작하지 않습니다. 전송 완료 콜백이 실패해도 서버 성공을 전송 실패로 바꾸지 않습니다.
- CSV/JSON/Excel 크기·행·열·문자열·압축 선언 크기와 전체 시트 사용 셀 합계를 제한합니다. CSV 출력은 수식처럼 해석될 값을 중화합니다.

## 근거와 범위

런타임 회귀 근거: `C:/Users/user/Documents/public/moa-js/output/playwright/suite/results.json`, `output/suite-browser.log`, `output/grid-regression.log`. 반응형 근거: 같은 폴더의 `.codex/design/reviews/suite-v010-reviewed/reviewed-manifest.json`과 `output/playwright/suite/contacts/index.json`. 새 작업 트리의 `output/suite-check.log`, `output/suite-visual-gate.json`, `output/suite-pack.json`에 재검증 결과가 있습니다. 분리 전후 네 모듈 모델/배포 JS 바이트 일치도 확인했습니다. 생성된 증거는 로컬 전용이며 Git에 포함하지 않습니다.

캡처 도구의 Windows 심볼릭 링크 직접 실행 문제와 Chromium RGB PNG 문제는 로컬 실행 복사본에서 처리했습니다. 원본 스크린샷 픽셀이나 전역 스킬 파일은 변경하지 않았습니다. 본문에 나온 화면 폭은 브라우저 에뮬레이션이며 실제 휴대폰·NVDA/VoiceOver 시험이나 WCAG 인증은 수행하지 않았습니다.

이 버전의 실사용 계약은 각 패키지 README와 index.d.ts 범위입니다. 서버 저장/인증/권한은 실제 서비스에 연결하지 않았으며 업로더 전송 테스트는 로컬 테스트 서버입니다. 캘린더 시간대 변환·RRULE/ICS, 간트 자동 스케줄/자원 관리, 차트 누적/줌/이중 축, 업로더 청크/이어올리기는 포함하지 않습니다. Excel 파싱은 메인 스레드이므로 큰 파일은 나누어 업로드하세요. 상한값은 모든 장치의 성능 보증이 아닙니다.

미병합 변경은 새 패키지/예제/공통 빌드·테스트 명령·문서·CI 범위입니다. 원래 작업 폴더의 사본은 다른 채팅 작업을 보호하기 위해 그대로 두었습니다. 다른 그리드 변경과 통합할 때 package.json/build/README/CI 변경만 검토해서 병합해야 합니다.
