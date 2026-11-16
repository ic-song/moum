# 예제 선택

독립 라이브러리: [차트](charts/index.html) · [간트](gantt/index.html) · [업로더·엑셀 검토](uploader/index.html) · [캘린더](calendar/index.html). 각 HTML은 file://로 바로 열 수 있습니다. 업로더 예제의 서버 전송은 미연결이며 로컬 검토와 그리드 전달을 제공합니다.

| 목적 | 파일 | 실행 |
| --- | --- | --- |
| 처음 사용·최소 코드 | [quick-start/index.html](quick-start/index.html) | 파일을 브라우저로 바로 열기 |
| Excel 방식 편집·그룹·트리·병합 | [grid/index.html](grid/index.html) | 파일을 브라우저로 바로 열기 |
| 수식·가상 스크롤·API 일부 이행 | [advanced/index.html](advanced/index.html) | 파일을 브라우저로 바로 열기 |
| 서버 조회·페이징·무한 스크롤 | [server/index.html](server/index.html) | `node scripts/serve.mjs` 실행 후 HTTP로 열기 |
| 서버 편집·추가·삭제·저장 | [server-edit/index.html](server-edit/index.html) | 같은 HTTP 서버에서 열기 |
| 새로고침·종료 후 미저장 복구 | [recovery/index.html](recovery/index.html) | HTTP 서버에서 로컬/서버 모드 선택 |
| React 프로젝트에 삽입 | [react/ProductGrid.jsx](react/ProductGrid.jsx) | 기존 React 빌드 프로젝트에 복사 |
| Vue 3 프로젝트에 삽입 | [vue/ProductGrid.vue](vue/ProductGrid.vue) | 기존 Vue 빌드 프로젝트에 복사 |

JS/CSS 복사 위치·로컬 npm 패키지 설치·JSP 경로 설정은 [빠른 시작](../docs/getting-started.md), React/Vue에서의 사용 코드는 [프레임워크 연결](../docs/frameworks.md)에 있습니다. `ProductGrid` 예제는 로컬 데이터용 컴포넌트입니다. 서버 연결에는 별도의 `dataSource` 계약을 사용하세요.

HTML 예제의 상대 경로는 저장소 디렉터리 구조를 기준으로 합니다. 다른 프로젝트로 옮길 때는 `packages/grid/dist`의 파일도 복사하고 경로를 바꾸세요. 코어에는 Node나 npm이 필요하지 않습니다. React/Vue의 빌드 환경은 사용하는 프로젝트에서 준비합니다.
