let workbench, mirror, provider, primaryView, secondaryView;
const host = document.getElementById('workbench');
function showScenario() {
  workbench?.destroy(); mirror?.destroy(); primaryView?.destroy(); secondaryView?.destroy(); provider?.destroy();
  workbench = mirror = provider = primaryView = secondaryView = null;
  const scenario = document.getElementById('scenario').value;
  document.getElementById('second-title').hidden = scenario !== 'compat';
  const help = document.getElementById('scenario-help');
  if (scenario === 'compat') {
    help.textContent = 'LocalDataProvider·GridView의 지원 API 일부를 이용한 예제입니다. 수량을 편집해 두 화면의 동시 갱신과 실행 취소를 확인하세요.';
    provider = new MoumRealGrid.LocalDataProvider(true);
    provider.setFields([{ fieldName: 'name', dataType: 'text' }, { fieldName: 'quantity', dataType: 'number' }]);
    provider.setRows([['키보드', 5], ['마우스', 12], ['모니터', 3]]);
    const columns = [{ name: 'name', fieldName: 'name', header: { text: '품목' } }, { name: 'quantity', fieldName: 'quantity', header: { text: '수량' } }];
    primaryView = new MoumRealGrid.GridView('workbench'); primaryView.setDataSource(provider); primaryView.setColumns(columns);
    secondaryView = new MoumRealGrid.GridView('mirror'); secondaryView.setColumns(columns); secondaryView.setDataSource(provider);
    workbench = primaryView.grid; mirror = secondaryView.grid;
    return;
  }
  if (scenario === 'formulas') {
    help.textContent = '수량·단가를 바꾸면 금액이 다시 계산됩니다. 첫 데이터 행이 수식의 1행입니다. 수식 복사는 상대 주소와 $ 고정 주소를 구분합니다.';
    workbench = new MoumGrid(host, { formulas: true, columns: [{ field: 'name', header: '품목', width: 200 }, { field: 'quantity', header: '수량', type: 'number' }, { field: 'price', header: '단가', type: 'number' }, { field: 'amount', header: '금액', type: 'number', width: 180 }], data: [{ name: '키보드', quantity: 5, price: 30000, amount: '=B1*C1' }, { name: '마우스', quantity: 12, price: 15000, amount: '=B2*C2' }, { name: '합계', quantity: '=SUM(B1:B2)', price: null, amount: '=SUM(D1:D2)' }] });
  } else {
    const count = scenario === 'rows' ? 100000 : 1000, fields = scenario === 'rows' ? 12 : 200;
    help.textContent = `${count.toLocaleString()}행 · ${fields}열. 화면 밖 데이터에도 선택·복사·붙여넣기와 Ctrl+Z/Y가 적용됩니다. 가상 모드의 긴 값은 한 줄로 표시하며 F2로 전체 값을 편집합니다.`;
    const columns = Array.from({ length: fields }, (_, index) => ({ field: `c${index}`, header: `열 ${index + 1}`, type: index ? 'number' : 'text', width: 120 }));
    const data = Array.from({ length: count }, (_, row) => Object.fromEntries(columns.map((column, col) => [column.field, col ? row * 10 + col : `데이터 ${row + 1}`])));
    workbench = new MoumGrid(host, { columns, data });
  }
}
document.getElementById('scenario').addEventListener('change', showScenario);
showScenario();
