# @moum/pagination 0.2.0

**MoumPagination** — 첫/이전/번호/다음/마지막·페이지 크기·현재 위치를 제공하는 독립 UI 컴포넌트. 외부 런타임 의존성 없음, MIT.

```js
import Pagination from '@moum/pagination';
import '@moum/pagination/style.css';
const pager = new Pagination('#pages', {
  total: 0, pageSize: 20,
  load: async ({offset, pageSize, signal}) => {
    const response = await fetch(`/api/orders?offset=${offset}&limit=${pageSize}`, {signal});
    if (!response.ok) throw new Error('조회 실패');
    const result = await response.json();
    return {total: result.total, data: result.rows};
  },
  onChange: ({data}) => renderRows(data)
});
await pager.reload(); // 생성만으로 자동 조회하지 않음
```

비어 있는 요소에 생성합니다. total=0/pageSize=20/page=1 기본값, pageSizes=[10,20,50,100]. 페이지 번호는 1부터, offset은 0부터 시작합니다. 빈 결과도 1페이지이며 from/to=0입니다. load 없이 로컬 데이터 페이지 이동 UI로도 사용할 수 있습니다.

`goTo(page)`, `setPageSize(size)`(1페이지부터), `reload()`, `retry()`는 성공 true/취소·조회 실패 false Promise. `setTotal(total)`은 현재 페이지를 범위에 맞추고 진행 중 요청을 취소합니다. `getState()`는 total/page/pageSize/pageCount/offset/from/to/loading/error, `getData()`는 마지막 성공 결과(data는 호스트 객체 참조), `cancel()`, `destroy()`.

조회 조건이 바뀌면 AbortSignal을 취소하고 늦은 응답을 무시합니다. 오류 시 마지막 성공 페이지·데이터를 유지하고 재시도 UI/onError를 제공합니다. 서버의 total 감소로 요청 페이지가 없어지면 마지막 페이지를 한 번 재조회합니다. 그동안 다시 범위가 바뀌면 오류를 표시하고 재시도를 기다립니다. onChange는 성공 시에만 호출합니다. pageSize는 1~10,000, total/page는 안전한 정수입니다. disabled는 UI 잠금입니다. 서버 인증·정렬·필터·결과 목록 렌더링은 호스트 담당입니다. 외부 검색 변경 시 reload()를 호출하세요.

현재 npm 미게시. `npm pack ./packages/pagination` 후 tgz 설치 또는 dist JS/CSS+LICENSE 복사. 브라우저 `MoumPagination`, ESM default, CommonJS `{Pagination}`, TypeScript 제네릭 지원. [예제](../../examples/pagination/index.html) · [공통 테마](../../docs/components.md).

`requestTimeout`은 기본30,000ms(0 초과 600,000 이하)입니다. 시간 초과 시 로더 신호를 취소하고 오류·재시도를 표시합니다. 로더가 AbortSignal을 무시하고 끝나지 않더라도 cancel/reset/destroy 후 호출 Promise는 false로 종료되며 늦은 응답을 반영하지 않습니다.

## 0.2.0 직접 이동과 URL 복원

페이지 번호 입력 후 Enter/이동으로 직접 이동합니다. jump:false로 숨길 수 있습니다. setDisabled(boolean)은 UI를 잠그고 진행 중 조회를 중단합니다. 호스트 API 호출은 계속 사용할 수 있습니다. 조회 취소 버튼과 disabled 재시도 상태도 제공합니다.

```js
const pager=new Pagination('#pager',{
 history:{pageKey:'ordersPage',sizeKey:'ordersSize',mode:'push'},
 pageSize:20,load:async ({page,pageSize,offset,signal})=>loadOrders({page,pageSize,offset,signal}),
 onChange:({data})=>showOrders(data)
});
await pager.reload();
```

history는 기본 꺼짐입니다. 설정하면 초기 URL과 브라우저 뒤로/앞으로 이동의 page/size 키를 읽습니다. 키 기본값은 page/pageSize이며 서로 다른 비어 있지 않은 문자열이어야 합니다. 성공한 UI 이동은 push(기본), 최초 조회·reload·뒤로/앞으로 복원·setTotal 보정은 replace로 기록합니다. mode:replace이면 모든 변경을 replace합니다. 같은 URL은 기록하지 않고 기존 history.state·다른 query·hash를 유지합니다. 한 URL에서 여러 컨트롤을 쓰면 키를 다르게 지정하세요. 다른 라우터가 URL을 소유하면 history를 끄고 호스트에서 goTo/setPageSize를 연결하세요.

초기 total을 몰라도 URL 요청 페이지/offset을 서버에 넘기고 반환 total로 범위를 보정합니다. 로더의 total/pageCount는 마지막으로 알려진 값이므로 서버 요청에는 page/pageSize/offset을 사용하세요. 잘못된 URL 숫자는 기본값으로 복구합니다. 생성만으로 조회하지 않으므로 최초 reload가 필요합니다. URL 조회 실패·취소 시 성공 데이터/페이지를 유지하고 현재 URL의 해당 키를 성공 페이지로 되돌립니다. retry는 실패했던 요청을 재시도합니다. URL 쓰기 실패는 historyError/onError로 알리되 성공 데이터를 유지합니다. destroy는 popstate 리스너를 제거합니다.
