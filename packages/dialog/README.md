# @moum/dialog 0.3.0

삭제, 초기화, 이동 등 실행 전에 사용자의 선택을 확인합니다. 네이티브 `dialog.showModal()`을 지원하는 브라우저에서 사용합니다. 일반 script 전역은 `MoumDialog`, ESM 기본 export와 CommonJS 이름 export는 `Dialog`입니다. CSS는 `@moum/dialog/style.css` 또는 `dist/moum-dialog.css`를 사용하세요.

```js
const dialog = new Dialog('#confirm');
const confirmed = await dialog.open({
  title: '선택을 초기화할까요?',
  message: '현재 화면의 필터를 기본값으로 되돌립니다.',
  confirmLabel: '초기화'
});
if (confirmed) resetFilters();
```

확인은 `true`, 취소나 Esc는 `false`로 완료됩니다. 처음에는 취소 버튼에 포커스가 이동하고 닫으면 브라우저가 이전 포커스를 되돌립니다. `close()`로 취소하고, 필요하면 `close(true)`로 확인할 수 있습니다. 같은 인스턴스의 요청이 열려 있는 동안 다시 `open()`하면 오류로 완료됩니다. `destroy()`는 열려 있는 요청을 취소하고 요소를 제거합니다.

저장 요청을 확인과 함께 실행하려면 `onConfirm({ signal })`을 넘기세요. 실행 중에는 중복 확인을 막고, 실패하면 오류 메시지를 표시하고 재시도할 수 있게 합니다. 성공하면 닫히고 `open()`의 결과가 `true`가 됩니다.

```js
const saved = await dialog.open({
  title: '설정을 저장할까요?',
  onConfirm: ({ signal }) => saveSettings({ signal })
});
```

취소·Esc·제거 시 `AbortSignal`이 중단됩니다. 이미 서버에서 처리된 요청의 취소 여부는 앱에서 확인하세요.

알림처럼 버튼 하나만 표시하려면 `showCancel: false`를 지정하세요. 이때 확인 버튼이 기본 포커스를 받습니다. 알림·확인·인라인 팝업을 함께 쓰려면 [@moum/popup](../popup/README.md)을 사용할 수 있습니다.
