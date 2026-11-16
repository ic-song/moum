# React·Vue에서 사용하기

[로컬 tgz 설치](getting-started.md)를 마친 기존 빌드 프로젝트에 컴포넌트를 복사합니다. React/Vue를 MOUM Grid가 자동 설치하지 않습니다. 각 예제는 로컬 데이터용이며 별도의 공식 프레임워크 래퍼 패키지는 아닙니다.

## React

[ProductGrid.jsx](../examples/react/ProductGrid.jsx)를 `src/components/ProductGrid.jsx`에 복사하고 앱에서 사용하세요.

```jsx
import { useState } from 'react';
import ProductGrid from './components/ProductGrid.jsx';

export default function App() {
  const [rows, setRows] = useState([
    { code: 'A001', name: '노트', qty: 10 },
    { code: 'A002', name: '볼펜', qty: 20 }
  ]);
  return <main>
    <h1>품목 목록</h1>
    <button onClick={() => setRows([{ code: 'B001', name: '새 조회 결과', qty: 5 }])}>
      조회 결과 교체
    </button>
    <ProductGrid rows={rows} onChange={({ reason, data }) => console.log(reason, data)} />
  </main>;
}
```

컴포넌트는 DOM 마운트 후 Effect에서 그리드를 만들고 cleanup에서 `destroy()`를 호출합니다. React StrictMode의 개발 중 재마운트에도 컨테이너를 비웁니다. 이 패턴은 [React의 외부 시스템 연결/cleanup 지침](https://react.dev/reference/react/useEffect)을 따릅니다. Next.js App Router에서는 예제 컴포넌트의 `'use client'` 지시문을 유지하세요. Grid 생성은 서버 렌더 중에 실행하지 않습니다.

`rows`는 **조회 결과 교체용**입니다. 같은 배열 참조를 유지하면 재렌더 때 그리드를 다시 만들거나 입력 이력을 지우지 않습니다. `onChange`의 data를 매번 `setRows(data)`로 되돌려 보내면 `setData()`가 실행돼 Undo 이력이 초기화됩니다. 편집 데이터는 그리드가 관리하고, 콜백으로 별도 상태 표시·저장용 스냅샷을 갱신하세요. 의도적으로 새 조회 결과를 반영할 때만 rows 참조를 교체합니다.

## Vue 3

[ProductGrid.vue](../examples/vue/ProductGrid.vue)를 `src/components/ProductGrid.vue`에 복사합니다.

```vue
<script setup>
import { ref } from 'vue';
import ProductGrid from './components/ProductGrid.vue';

const rows = ref([
  { code: 'A001', name: '노트', qty: 10 },
  { code: 'A002', name: '볼펜', qty: 20 }
]);
function reload() {
  rows.value = [{ code: 'B001', name: '새 조회 결과', qty: 5 }];
}
function changed({ reason, data }) { console.log(reason, data); }
</script>

<template>
  <main>
    <h1>품목 목록</h1>
    <button @click="reload">조회 결과 교체</button>
    <ProductGrid :rows="rows" @change="changed" />
  </main>
</template>
```

그리드는 `onMounted`에서 만들고 `onBeforeUnmount`에서 해제합니다. 실제 DOM을 참조하는 방식은 [Vue 템플릿 ref](https://vuejs.org/guide/essentials/template-refs)와 [라이프사이클 지침](https://vuejs.org/api/composition-api-lifecycle)을 따릅니다. 인스턴스는 일반 변수로 보관해 DOM/클래스 전체를 Vue 반응형 프록시로 감싸지 않습니다.

watch는 rows 배열 참조 교체만 관찰합니다. 새 조회 결과는 `rows.value = 새배열`로 반영하세요. 배열 내부를 직접 바꾸는 것과 그리드 데이터 변경을 자동 양방향 동기화하지 않습니다. React와 마찬가지로 change마다 rows를 새 배열로 되돌리면 이력이 초기화됩니다.

## 공통

- 그리드가 관리할 `<div>` 내부에는 프레임워크가 다른 자식을 렌더하지 않도록 비워 둡니다. 컴포넌트 소스의 columns를 업무 필드에 맞게 바꾸세요.
- 라이브러리 CSS는 일반 CSS로 가져옵니다. Vue scoped 스타일만으로 대신하지 않습니다.
- 서버 데이터는 두 예제의 로컬 `data`/rows watch 대신 [dataSource.load/save](server-editing.md)를 구성합니다. 서버 모드에서는 setData를 사용하지 않습니다.
- 서버 편집 화면을 라우팅으로 제거하기 전에 `getSaveState()`를 확인해 저장/취소/미확정 요청 재확인을 처리하세요. 컴포넌트 cleanup 자체가 초안을 저장하지 않습니다.
- Excel 파일 기능을 사용할 때는 로컬 XLSX 객체를 생성 옵션으로 전달합니다. 텍스트/HTML 셀 복사·붙여넣기에는 별도 XLSX 모듈이 필요하지 않습니다.

## 예제 개발 검증 (선택)

저장소 개발용 검사이며, 소비자 프로젝트의 설치 절차와 구분합니다. Node 22에서 다음을 실행합니다. 도구는 devDependencies로 관리하며 라이브러리 런타임에 포함하지 않습니다.

```sh
npm ci
npx playwright install chromium firefox webkit
npm run test:usage
```

패키지를 직접 만들고 별도 consumer 디렉터리에 오프라인 설치한 뒤, 가이드 HTML·CommonJS/ESM과 실제 컴파일한 React StrictMode/Vue 컴포넌트의 생성·편집·콜백 갱신·데이터 교체·해제/재생성을 검사합니다. 결과는 output/playwright/usage/results.json입니다. JSP 서버나 Next/Nuxt 애플리케이션 전체 실행은 포함하지 않습니다.

복구 기능을 추가할 때는 [recovery 키/저장 계약](recovery.md)을 적용하고 recoveryReady를 기다리세요. 새 조회 결과 교체 전에 dirty 상태를 확인해야 하며, 복구를 켜면 미저장 상태의 setData는 false로 차단됩니다.
