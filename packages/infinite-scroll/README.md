# @moum/infinite-scroll 0.2.0

**MoumInfiniteScroll** — 내부 스크롤 영역·목록·더 보기·로딩/오류/완료 상태를 제공하는 독립 UI 컴포넌트. 외부 런타임 의존성 없음, MIT.

```js
import InfiniteScroll from '@moum/infinite-scroll';
import '@moum/infinite-scroll/style.css';
const feed = new InfiniteScroll('#feed', {
  pageSize: 20, maxItems: 1000, getKey: item => item.id,
  renderItem: item => item.title, // 문자열은 HTML로 해석하지 않음
  load: async ({cursor, pageSize, signal}) => {
    const response = await fetch(`/api/feed?cursor=${encodeURIComponent(cursor ?? '')}&limit=${pageSize}`, {signal});
    if (!response.ok) throw new Error('조회 실패');
    return response.json(); // {items, nextCursor, hasMore}
  }
});
```

비어 있는 요소에 생성합니다. `auto:true` 기본값: 내부 영역 하단 접근 시 IntersectionObserver로 조회합니다. 미지원 환경과 `auto:false`에서는 더 보기 버튼을 사용합니다. `renderItem(item,index)`은 문자열 또는 **새로 만든 연결되지 않은 Element**를 반환합니다. HTML 문자열은 textContent로 표시합니다. 조회 중에는 불러오기 취소 버튼을 제공합니다. Element를 구성할 때 외부 값은 textContent로 넣으세요.

`loadMore()/retry()`는 성공 true/오류·중복 호출·취소 false Promise. `getItems()`는 배열 복사(항목 객체는 호스트 소유), `getState()`는 count/cursor/hasMore/loading/error/limitReached. `reset(cursor=initialCursor)`은 이전 요청을 취소하고 목록·커서·오류를 초기화합니다. `setAuto(boolean)`, `cancel()`(현재 요청 취소), `destroy()`.

load는 요청 pageSize 이하의 items와 boolean hasMore를 반환해야 합니다. hasMore=true이면 null이 아니며 이전과 다른 nextCursor가 필요합니다. 커서는 문자열/숫자 등 원시 값을 권장합니다. getKey 사용 시 중복 키는 제외합니다. 다음 결과에 새 항목이 하나도 없으면 자동 루프를 멈추고 재시도를 표시합니다. 오류 시 기존 항목·커서를 보존합니다. 취소·초기화·제거 이후 늦은 응답은 무시합니다. 한 번에 하나만 조회합니다.

pageSize 기본20(1~1,000), maxItems 기본1,000(1~100,000). 한도에 도달하면 DOM 추가와 자동 조회를 멈추고 조건 좁히기를 안내합니다. **가상 스크롤이 아니며** 수십만 항목을 무제한 유지하지 않습니다. 내부 높이는 `.moum-infinite-scroll-viewport {max-height:...}`로 조정합니다. 자동 조회 일시정지는 setAuto(false), 진행 중 요청까지 중단하려면 cancel()도 호출하세요. 인증·서버 커서 안정성·필터 상태·라우터 복원은 호스트 담당입니다.

현재 npm 미게시. `npm pack ./packages/infinite-scroll` 후 tgz 설치 또는 dist JS/CSS+LICENSE 복사. 브라우저 `MoumInfiniteScroll`, CommonJS `{InfiniteScroll}`, ESM default, TypeScript 제네릭 지원. [예제](../../examples/infinite-scroll/index.html) · [공통 테마](../../docs/components.md).

`requestTimeout`은 기본30,000ms(0 초과 600,000 이하)입니다. 시간 초과 시 로더 신호를 취소하고 오류·재시도를 표시합니다. 로더가 AbortSignal을 무시하고 끝나지 않더라도 cancel/reset/destroy 후 호출 Promise는 false로 종료되며 늦은 응답을 반영하지 않습니다.

## 0.2.0 가상 목록

`virtual:{itemHeight:56,overscan:4,height:400}`로 고정 행 높이 가상화를 켭니다. 원본 데이터는 메모리에 유지하고 현재 보이는 행과 앞뒤 overscan만 DOM에 둡니다. 키보드 포커스가 있는 행은 화면 밖으로 나가도 추가1개로 유지합니다. aria-posinset/setsize는 현재 불러온 목록 크기 기준입니다. renderItem은 재호출될 수 있으므로 부수 효과 없이 매번 새 Element 또는 문자열을 반환하세요. 표시 오류는 renderError와 ‘표시 다시 시도’로 처리하며 추가 조회 없이 다시 그립니다.

itemHeight는44~1,000px, height는100~2,000px, overscan은0~100입니다. maxItems×itemHeight는 브라우저 스크롤 높이 한계를 고려해8,000,000px 이하입니다. 가변 높이는 지원하지 않으며 긴 콘텐츠는 지정 행 높이 안에서 잘릴 수 있습니다. 긴 본문/펼침 상세는 비가상 모드를 사용하세요. 창 크기 변경 시 보이는 범위를 다시 계산합니다.

## 목록·위치 기억과 세션 캐시

getSnapshot()은 {version:1,items,cursor,hasMore,scrollTop} 복사본입니다. restoreSnapshot(snapshot)은 크기/키/렌더러를 검증한 후 목록·커서·위치를 함께 복원하고 onChange를 호출합니다. 잘못된 스냅샷은 기존 목록과 진행 중 요청을 건드리지 않습니다. 유효한 복원은 기존 요청을 취소하고 늦은 응답을 무시합니다. scrollTop은 현재 브라우저가 허용하는 위치로 제한됩니다. 외부 라우터/캐시 저장소와 연결할 때 이 API를 사용하세요.

```js
const feed=new InfiniteScroll('#feed',{
 auto:false,maxItems:20000,pageSize:200,virtual:{itemHeight:56},
 cache:{key:'user-42:orders:filter-v2:row56:schema1',ttl:300000,maxBytes:2000000},
 getKey:item=>item.id,renderItem:item=>item.title,
 load:({cursor,pageSize,signal})=>loadOrders({cursor,pageSize,signal}),
 onCacheError:error=>console.warn(error)
});
if(!feed.getState().count)await feed.loadMore();
```

cache는 기본 꺼짐입니다. 켜면 생성 시 sessionStorage에서 복원하며 조회 완료·스크롤 후·destroy 직전에 성공 목록 상태를 저장합니다. ttl 기본5분(최대24시간), maxBytes 기본2,000,000(최대10,000,000바이트)이며 key는1~200자입니다. 저장 키에는 moum-infinite-scroll:v1: 접두사가 붙습니다. 옵션 storage로 동일한 Storage 계약의 저장소를 지정할 수 있습니다. 민감한 데이터의 저장 허용 여부와 사용자/검색조건/정렬/스키마/행 높이별 키 분리는 호스트가 결정하세요. 로그아웃/조건 변경 시 기존 키 정리도 호스트 책임입니다. 캐시는 서버 데이터의 최신성을 보장하지 않습니다.

saveCache()/restoreCache()/clearCache()로 직접 제어합니다. restoreCache는 성공 여부 boolean이며 초기 자동 복원은 onChange를 호출하지 않습니다(생성 중 콜백 재진입 방지). getState().restored와 getItems로 초기 상태를 읽으세요. 캐시가 없거나 만료되면 새 조회를 시작하고, 손상/용량 초과/저장소 차단은 cacheError/onCacheError로 알리며 현재 목록은 유지합니다. cacheError는 사용자용 안내, 콜백은 원래 Error입니다. reset은 현재 키 캐시도 지우고 처음부터 시작합니다. clearCache는 현재 목록을 지우지 않으며 이후 변경/destroy에서 다시 저장될 수 있습니다. 영구 비활성화하려면 cache 옵션 없이 생성하세요. JSON 왕복으로 형태가 보존되는 항목/커서를 사용하세요(Date는 ISO 문자열, Map은 배열/객체로 변환). maxItems/파일 크기 상한은 실서비스 데이터로 측정하세요.
