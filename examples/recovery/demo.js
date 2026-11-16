const serverMode = new URLSearchParams(location.search).get('mode') === 'server';
document.querySelector('#grid-title').textContent = serverMode ? '서버 데이터 · 저장 요청 복구' : '로컬 데이터 · 편집 복구';
document.querySelector('#mark-saved').hidden = serverMode;
document.querySelector('#fault-label').hidden = !serverMode;
document.querySelector('#mode-help').textContent = serverMode ? '서버 저장 후 응답을 끊고 페이지를 다시 열어도 같은 요청 ID로 결과를 확인합니다.' : '변경 취소는 초기/마지막 확정 기준점으로 되돌립니다. 로컬 기준점 확정은 서버 통신 없이 복구본을 지웁니다.';
async function recoveryRequest(url, payload, signal) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal });
  const result = await response.json(); if (!response.ok) throw Object.assign(Error(result.error || `HTTP ${response.status}`), { code: result.code, committed: result.committed }); return result;
}
const recoveryGrid = new MoumGrid('#recovery-grid', {
  label: '미저장 품목 편집',
  recovery: { key: `demo:account-001:inventory:${serverMode ? 'server' : 'local'}`, schemaVersion: '1' },
  dataMode: serverMode ? 'pagination' : 'virtual', pageSize: 25,
  columns: [{ field: 'id', header: '코드', editable: false }, { field: 'name', header: '품목', defaultValue: '신규 품목', required: true, width: 240 }, { field: 'category', header: '분류', defaultValue: '사무' }, { field: 'qty', header: '수량', type: 'number', defaultValue: 1 }, { field: 'price', header: '단가', type: 'number', defaultValue: 0 }],
  ...(serverMode ? { dataSource: {
    rowKey: 'id', versionField: '_version', timeoutMs: 10000,
    load: ({ signal, ...query }) => recoveryRequest('/api/grid-edit', query, signal),
    save: ({ signal, ...batch }) => { const control = document.querySelector('#drop-reply'), drop = control.checked; control.checked = false; return recoveryRequest('/api/grid-edit/save', { ...batch, simulate: { drop } }, signal); }
  } } : { data: [{ id: 'L001', name: '미저장 복구 품목', category: '사무', qty: 10, price: 1000 }, { id: 'L002', name: '볼펜', category: '사무', qty: 20, price: 500 }] })
});
document.querySelector('#mark-saved').addEventListener('click', async () => { if (await recoveryGrid.markSaved()) recoveryGrid.message('로컬 기준점을 확정했습니다. 서버 저장은 수행하지 않았습니다.'); });
