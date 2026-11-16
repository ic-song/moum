# @moum/infinite-scroll 0.1.0

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

비어 있는 요소에 생성합니다. `auto:true` 기본값: 내부 영역 하단 접근 시 IntersectionObserver로 조회합니다. 미지원 환경과 `auto:false`에서는 더 보기 버튼을 사용합니다. `renderItem(item,index)`은 문자열 또는 **새로 만든 연결되지 않은 Element**를 반환합니다. HTML 문자열은 textContent로 표시합니다. Element를 구성할 때 외부 값은 textContent로 넣으세요.

`loadMore()/retry()`는 성공 true/오류·중복 호출·취소 false Promise. `getItems()`는 배열 복사(항목 객체는 호스트 소유), `getState()`는 count/cursor/hasMore/loading/error/limitReached. `reset(cursor=initialCursor)`은 이전 요청을 취소하고 목록·커서·오류를 초기화합니다. `setAuto(boolean)`, `cancel()`(현재 요청 취소), `destroy()`.

load는 요청 pageSize 이하의 items와 boolean hasMore를 반환해야 합니다. hasMore=true이면 null이 아니며 이전과 다른 nextCursor가 필요합니다. 커서는 문자열/숫자 등 원시 값을 권장합니다. getKey 사용 시 중복 키는 제외합니다. 다음 결과에 새 항목이 하나도 없으면 자동 루프를 멈추고 재시도를 표시합니다. 오류 시 기존 항목·커서를 보존합니다. 취소·초기화·제거 이후 늦은 응답은 무시합니다. 한 번에 하나만 조회합니다.

pageSize 기본20(1~1,000), maxItems 기본1,000(1~100,000). 한도에 도달하면 DOM 추가와 자동 조회를 멈추고 조건 좁히기를 안내합니다. **가상 스크롤이 아니며** 수십만 항목을 무제한 유지하지 않습니다. 내부 높이는 `.moum-infinite-scroll-viewport {max-height:...}`로 조정합니다. 자동 조회 일시정지는 setAuto(false), 진행 중 요청까지 중단하려면 cancel()도 호출하세요. 인증·서버 커서 안정성·필터 상태·라우터 복원은 호스트 담당입니다.

현재 npm 미게시. `npm pack ./packages/infinite-scroll` 후 tgz 설치 또는 dist JS/CSS+LICENSE 복사. 브라우저 `MoumInfiniteScroll`, CommonJS `{InfiniteScroll}`, ESM default, TypeScript 제네릭 지원. [예제](../../examples/infinite-scroll/index.html) · [공통 테마](../../docs/components.md).

`requestTimeout`은 기본30,000ms(0 초과 600,000 이하)입니다. 시간 초과 시 로더 신호를 취소하고 오류·재시도를 표시합니다. 로더가 AbortSignal을 무시하고 끝나지 않더라도 cancel/reset/destroy 후 호출 Promise는 false로 종료되며 늦은 응답을 반영하지 않습니다.
