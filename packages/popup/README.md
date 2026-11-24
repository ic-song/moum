# @moum/popup 0.1.0

알림·예/아니오 확인·인라인 팝오버를 독립 패키지에서 제공합니다. ESM은 `import Popup, { Popover } from '@moum/popup'`, 일반 script는 `MoumPopup`과 `MoumPopup.Popover`를 사용하세요. CSS는 `@moum/popup/style.css` 또는 `dist/moum-popup.css`를 불러옵니다.

## 알림과 예/아니오 확인

```js
const popups = new Popup('#popup-host'); // 비어 있는 컨테이너
await popups.alert({ title: '저장 완료', message: '설정을 저장했습니다.' });

await popups.confirm({
  title: '목록을 비울까요?',
  message: '현재 목록의 항목을 모두 지웁니다.',
  onYes: () => clearList(),
  onNo: () => keepList()
});
```

`confirm()`은 예를 선택하면 `true`, 아니오·Esc·제거로 닫으면 `false`를 반환합니다. 해당 분기의 콜백만 한 번 호출하고 비동기 콜백도 완료까지 기다립니다. 결과만 필요하면 콜백 없이 `await popups.confirm({ title: '진행할까요?' })`를 사용하세요. `onYes`와 `onNo`는 닫힌 뒤 실행되며, 이 콜백에서 발생한 오류는 반환한 Promise의 거부로 처리됩니다.

요청 실패 시 대화상자를 유지하고 싶다면 `onConfirm: ({ signal }) => save({ signal })`로 저장을 연결하세요. 이 콜백은 대화상자가 열린 상태에서 실행되며 실패 시 재시도할 수 있습니다. 취소할 때는 중단 신호를 보냅니다. `alert()`는 확인 버튼 하나만 표시하며 닫힌 뒤 선택적으로 `onClose`를 호출합니다. 같은 인스턴스에서 모달은 한 번에 하나씩 열고 화면 제거 시 `destroy()`를 호출하세요. 고급 제어는 이름 export `Dialog`로도 사용할 수 있습니다.

## 버튼 옆 인라인 팝오버

```html
<button id="show-help" type="button">배송 안내</button>
<div id="shipping-help" role="group" aria-label="배송 안내">
  <p>배송 예정일은 주문 상세 화면에서 확인할 수 있습니다.</p>
</div>
```

```js
const help = new Popover('#shipping-help', { trigger: '#show-help', placement: 'bottom' });
```

패널과 버튼은 같은 문서 트리에 연결합니다. 버튼으로 열고 닫으며 바깥 클릭이나 Esc로 닫을 수 있습니다. `top`과 `bottom` 중 선호 위치를 지정하면 공간이 부족할 때 반대편으로 이동합니다. 스크롤과 크기 변경은 자동 반영합니다. 앱이 레이아웃만 이동시키는 경우 `updatePosition()`을 호출할 수 있습니다.

`open()`, `close()`, `toggle()`, `isOpen()`, `onChange(open)`으로 화면과 상태를 연결할 수 있습니다. `destroy()`는 기존 콘텐츠를 남기고 모듈의 연결과 위치 지정만 해제합니다. 네이티브 Popover API를 지원하는 브라우저에서 사용하세요. 팝오버 안의 입력창·링크·버튼은 앱에서 구성합니다.
