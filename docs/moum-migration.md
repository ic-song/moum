# Moa JS에서 MOUM으로

MOUM(모음)은 개발에 필요한 도구를 모은다는 뜻의 새 브랜드입니다. 기존 그리드 0.7.0과 차트·간트·업로더·캘린더 0.1.0을 통합하고, 새 Git 저장소 https://github.com/ic-song/moum 에서 관리합니다. 기준 소스는 기존 저장소의 통합 커밋 `18580f8`입니다. 기존 ic-song/moa-js 저장소와 로컬 작업은 변경하거나 삭제하지 않았습니다.

| 구분 | 기존 | 새 이름 |
| --- | --- | --- |
| 패키지 | @moa-js/grid 등 | @moum/grid, @moum/charts, @moum/gantt, @moum/uploader, @moum/calendar |
| 브라우저 JS/CSS | moa-grid.js / moa-grid.css 등 | moum-grid.js / moum-grid.css 등 |
| 브라우저 생성자 | MoaGrid, MoaCharts, MoaGantt, MoaUploader, MoaCalendar | MoumGrid, MoumCharts, MoumGantt, MoumUploader, MoumCalendar |
| RealGrid 일부 API 이행 | MoaRealGrid / moa-realgrid.* | MoumRealGrid / moum-realgrid.* |
| CSS 클래스/변수 | moa-* / --moa-* | moum-* / --moum-* |
| 예제 서버 환경 변수 | MOA_DEMO_PORT / MOA_DEMO_URL | MOUM_DEMO_PORT / MOUM_DEMO_URL |

ESM/CommonJS의 Grid·Charts·Gantt·Uploader·Calendar 및 데이터 모델 API는 유지합니다. 기존 프로젝트에서 전환할 때 import/파일 경로/전역 생성자/CSS 사용자 정의를 함께 바꾸세요. 이 새 저장소에는 옛 이름 별칭을 제공하지 않으므로 기존 파일과 새 파일을 섞지 마세요. 기존 파일이 필요한 소비자는 기존 저장소 배포물을 계속 사용합니다.

새 이름은 IndexedDB 복구 저장소·키와 예약 필드에도 적용됩니다. 옛 복구본을 자동으로 읽거나 삭제하지 않습니다. 전환 전 기존 앱에서 미저장 작업을 저장하거나 복구본/데이터를 내려받고, 새 앱에서는 새 recovery.key를 계정·업무 단위로 지정하세요. 기존 서비스의 미저장 상태를 그대로 둔 채 라이브러리 파일만 교체하지 마세요.

서버에서 신규 행 예약 필드를 직접 처리하고 있었다면 `__moaClientId` → `__moumClientId` 변경도 확인하세요. 이 필드는 서버 영속키가 아니며 서버 저장 계약은 각 API 문서가 기준입니다.

자체 코드는 MIT이며 이전 기여자의 저작권 고지를 유지합니다. 동봉 SheetJS 소스·라이선스는 수정하지 않았습니다. npm 레지스트리 게시나 버전 태그/Release 생성은 하지 않습니다. `npm pack ./packages/<이름>`으로 설치용 파일을 만들어 사용하세요. 과거 검증 기록은 당시 이름·경로를 보존했습니다.
