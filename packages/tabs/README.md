# @moum/tabs 0.2.0

상품 정보나 설정처럼 관련된 내용을 탭으로 나누어 표시합니다. 일반 script 전역은 `MoumTabs`, ESM 기본 export와 CommonJS 이름 export는 `Tabs`입니다. CSS는 `@moum/tabs/style.css` 또는 `dist/moum-tabs.css`를 사용하세요.

```js
const tabs = new Tabs('#tabs', {
  label: '설정',
  items: [
    { id: 'profile', label: '프로필', content: '표시 이름과 사진' },
    { id: 'privacy', label: '공개 범위', content: '프로필을 볼 수 있는 사용자' }
  ],
  onChange: ({ id }) => console.log(id)
});
tabs.setActive('privacy');
```

빈 요소에 생성합니다. `activeId`를 생략하면 첫 번째 활성화 가능한 탭을 선택합니다. `getActive()`는 현재 ID를 반환하고 `setActive(id)`는 선택을 변경합니다. 방향키와 Home/End는 비활성 탭을 건너뛰며 선택과 포커스를 함께 이동합니다. 문자열 콘텐츠는 텍스트로 표시합니다. HTMLElement는 그대로 옮겨 붙이므로 이벤트와 폼 상태를 유지합니다. 컨테이너에서 제거할 때 `destroy()`를 호출하세요.

`activation: 'manual'`을 쓰면 방향키와 Home/End는 포커스만 옮기고 Enter·Space 또는 클릭으로 탭을 엽니다. 선택 시 데이터를 불러오는 화면에서 사용하기 좋습니다.
