const tabs = new MoumTabs('#tabs', {
  label: '상품 정보',
  items: [
    { id: 'overview', label: '소개', content: '일정이나 메모를 적을 수 있는 무지 노트입니다.' },
    { id: 'specs', label: '규격', content: 'A5, 120쪽, 재생 종이' },
    { id: 'shipping', label: '배송', content: '배송지에 따라 수령 예정일을 확인할 수 있습니다.' },
    { id: 'reviews', label: '후기', disabled: true, content: '등록된 후기가 없습니다.' }
  ]
});
const accordion = new MoumAccordion('#accordion', {
  single: true,
  items: [
    { id: 'tracking', label: '배송을 어디서 확인하나요?', content: '주문 상세 화면에서 운송장 번호를 확인할 수 있습니다.' },
    { id: 'address', label: '배송지를 바꿀 수 있나요?', content: '출고 전이라면 주문 상세 화면에서 변경할 수 있습니다.' }
  ]
});
const dialog = new MoumDialog('#dialog');
document.querySelector('#open-dialog').addEventListener('click', async () => {
  const confirmed = await dialog.open({
    title: '선택을 초기화할까요?',
    message: '상품 정보는 소개 탭으로 돌아가고, 펼친 질문은 접힙니다.',
    confirmLabel: '초기화'
  });
  if (confirmed) {
    tabs.setActive('overview');
    accordion.setOpen([]);
  }
  document.querySelector('#result').textContent = confirmed ? '선택을 초기화했습니다.' : '현재 선택을 유지했습니다.';
});
