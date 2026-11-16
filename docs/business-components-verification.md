# 업무 컴포넌트 고도화 검증

2026-11-16 KST. DatePicker 0.2.0, Charts/Gantt/Uploader 0.3.0. [현재 지원 범위](components.md), [이전 컴포넌트 검증](components-verification.md).

| 검사 | 결과 |
| --- | --- |
| npm run check | Node 99/99, 8개 패키지 배포 빌드, 기능 카탈로그 검사 통과 |
| test:business-browser | Chromium/Firefox/WebKit에서 새 기능과 오류·취소·제거·시간 초과 검증 통과 |
| test:components-browser | 기존 8종 컴포넌트 18개 그룹, 상속 테마·접근성·반응형·오프라인 회귀 통과 |
| test:suite-browser | 기존 18개 그룹, 실제 multipart HTTP 성공/422/취소/시간 초과 포함 통과 |
| test:mini-gantt | 3개 엔진에서 미니4종·기간 정렬·가중 요약·키보드·라이프사이클 통과 |
| test:packages | 8종 tgz 생성, 그리드 외7종 격리 CJS/ESM·타입/CSS/라이선스·SHA-256 검사 통과. Worker 하위 경로 확인 |
| TypeScript | 격리 소비자에서 팝업·복합/이중 축·PNG·업무일 달력·Worker 콜백을 포함한 strict noEmit 통과 |
| 화면 검토 | 4개 경로·14개 상태, 111개 캡처와 원본245개 조각 검토. 7개 기준 화면·480/640px 경계, 320~2560px 164개 폭 표본. 문서 가로 넘침0, 캡처 오류0, 시각 게이트 pass/차단0 |

DatePicker는 단일/기간 팝업 선택·수동 오류·Escape/외부 닫기·포커스 복귀·월 이동·제거를 확인했습니다. 본문 포털은 표시 영역 안에서 위치와 높이를 조정하며 낮은 화면에서는 내부 스크롤합니다. 연결 입력도 공통44px 스타일을 사용합니다. fixed 팝업이 긴 합성 이미지에서 반복되는 현상은 캡처 방식 때문이며 원본 조각에서 확인했습니다.

Charts는 막대+선과 각각 다른 수치 크기의 좌우 축을 확인했습니다. 잘못된 변경은 기존 데이터를 보존하고, 단위가 선택 상태/기본 툴팁에 반영됩니다. PNG는 실제 Blob MIME·파일 시그니처와 크기를 확인했습니다.

Gantt는 주말·지정 휴일·윤년·사용자 주말·업무일 없는 기간·최대 날짜 초과를 확인했습니다. 명시적인 일정 조정 후 업무일 수를 유지하고 단일 undo/redo로 복원합니다. 기존 달력일 기본값은 보존합니다. 전체 일정표는 읽을 수 있는 일 단위를 유지하기 위해 내부 가로 스크롤을 사용하며 미니4종은 업무일 음영을 공유합니다.

Uploader는 실제 HTTP 출처에서 배포 Worker와 동봉 SheetJS로 다중 시트 Excel, 10,000행 CSV를 파싱했습니다. 미리보기 DOM은 기본25행으로 제한됩니다. reading 단계에서 cancel/remove/clear/destroy를 각각 실행하고 실제 Worker terminate 호출과 남은 Worker0을 확인했습니다. 오류/행 제한/시간 초과와 이미 취소된 요청도 검사했습니다. 로컬 예제에서 짧게 끝나는 파싱 단계는 기능 검사로 확인하며 안정된 로딩 화면 전체 캡처는 수행하지 않았습니다.

로컬 시각 증거: `.codex/design/reviews/business/reviewed-manifest.json`, `output/business-visual-gate.json`. 초기17개 연락 시트와 최종 DatePicker4개·Gantt 미니 조각을 검토했으며 변경 없는 Gantt 기본 원본67개는 재캡처와 SHA-256이 같았습니다. 브라우저 실행 증거는 `output/playwright/business`, `components`, `suite`, `mini-gantt`입니다. 로컬 캡처는 Git에 넣지 않습니다. CI는 브라우저 검사 결과를 artifact로 보관합니다.

물리 모바일 기기·운영 업무 데이터·실서비스 서버 수신은 이번에 검증하지 않았습니다. 업무일 휴일은 호스트가 지정합니다. Worker는 같은 출처 정적 파일/CSP 설정이 필요하고 사용자 검증·매핑은 메인 스레드입니다. 서버 청크/재개 업로드·자원별 달력·연결 지연·임계 경로는 미지원입니다. npm 게시 없음.
