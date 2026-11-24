# @moum/accordion 0.2.0

FAQ나 보조 설정을 접고 펼칩니다. 네이티브 `details`와 `summary`를 사용합니다. 일반 script 전역은 `MoumAccordion`, ESM 기본 export와 CommonJS 이름 export는 `Accordion`입니다. CSS는 `@moum/accordion/style.css` 또는 `dist/moum-accordion.css`를 사용하세요.

```js
const faq = new Accordion('#faq', {
  single: true,
  items: [
    { id: 'hours', label: '운영 시간', content: '평일 오전 10시부터 오후 6시까지' },
    { id: 'visit', label: '찾아오는 길', content: '정문에서 안내 표지를 따라오세요.' }
  ],
  onChange: openIds => console.log(openIds)
});
faq.setOpen(['hours']);
```

`single: true`는 브라우저의 단일 펼침 그룹을 사용합니다. 기본값은 여러 항목을 함께 열 수 있습니다. `openIds`로 초기 상태를 정하고, `getOpen()`과 `setOpen(ids)`로 현재 상태를 읽거나 바꿉니다. 문자열은 텍스트로 표시하고 HTMLElement는 목록으로 이동합니다. 사용이 끝나면 `destroy()`로 제거하세요.

`toggle(id)`로 한 항목을 열거나 닫을 수 있습니다. 결과가 열림이면 `true`, 닫힘이면 `false`를 반환합니다. 단일 펼침 모드에서 새 항목을 열면 먼저 열린 항목을 닫습니다.
