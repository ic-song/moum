let saveFault = {};
for (const [id, value, title] of [['fail-save', 'fail', '다음 저장은 변경 없이 실패합니다.'], ['drop-save', 'drop', '다음 저장은 완료 후 응답을 끊습니다. 결과를 다시 확인하세요.'], ['conflict-save', 'conflict', '다음 수정 저장 전에 다른 사용자가 같은 행을 변경합니다.']]) document.getElementById(id).addEventListener('click', () => { saveFault = { [value]: true }; document.getElementById('fault-status').textContent = title; });
async function editRequest(url, payload, signal) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal });
  const result = await response.json();
  if (!response.ok) throw Object.assign(Error(result.error || `HTTP ${response.status}`), { code: result.code, committed: result.committed });
  return result;
}
const editGrid = new MoumGrid('#edit-grid', {
  label: '서버 품목 편집', dataMode: 'pagination', pageSize: 25,
  columns: [{ field: 'id', header: '코드', width: 140 }, { field: 'name', header: '품목', width: 240, required: true, defaultValue: '신규 품목' }, { field: 'category', header: '분류', required: true, defaultValue: '사무' }, { field: 'qty', header: '수량', type: 'number', defaultValue: 1, required: true, validate: value => Number.isInteger(value) && value >= 0 ? null : '0 이상의 정수' }, { field: 'price', header: '단가', type: 'number', defaultValue: 0, required: true, validate: value => value >= 0 ? null : '0 이상' }],
  dataSource: {
    rowKey: 'id', versionField: '_version', timeoutMs: 10000,
    load: ({ signal, ...query }) => editRequest('/api/grid-edit', query, signal),
    exportRows: async ({ signal, ...query }) => (await editRequest('/api/grid-edit', { ...query, export: true }, signal)).rows,
    save: ({ signal, ...batch }) => { const simulate = saveFault; saveFault = {}; return editRequest('/api/grid-edit/save', { ...batch, simulate }, signal); }
  }
});
