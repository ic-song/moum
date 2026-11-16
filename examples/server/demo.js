let failNext = false;
const faultStatus = document.getElementById('fault-status');
document.getElementById('fail-next').addEventListener('click', () => { failNext = true; faultStatus.textContent = '다음 조회 요청이 한 번 실패합니다. 서버 새로고침이나 페이지 이동으로 확인하세요.'; });
async function requestData(payload, signal) {
  const response = await fetch('/api/grid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal });
  const result = await response.json(); if (!response.ok) throw Error(result.error || `HTTP ${response.status}`); return result;
}
const serverGrid = new MoumGrid('#server-grid', {
  label: '서버 품목 목록', dataMode: 'pagination', pageSize: 50,
  columns: [{ field: 'id', header: '코드', width: 140 }, { field: 'name', header: '품목', width: 240 }, { field: 'category', header: '분류' }, { field: 'qty', header: '수량', type: 'number' }, { field: 'price', header: '단가', type: 'number' }],
  dataSource: {
    rowKey: 'id', timeoutMs: 10000,
    load: async ({ signal, ...request }) => {
      const fail = failNext; failNext = false; if (fail) faultStatus.textContent = '오류 응답을 한 번 요청했습니다. 실패 후 다시 시도할 수 있습니다.';
      return requestData({ ...request, simulate: { delay: Number(document.getElementById('delay').value), fail } }, signal);
    },
    exportRows: async ({ signal, ...request }) => (await requestData({ ...request, export: true, offset: 0, limit: 10000 }, signal)).rows
  }
});
