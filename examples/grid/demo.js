const sampleRows = [
  ['IT-001', '무선 키보드', '전산용품', 12, 49000, '총무팀', '한글 입력 확인'],
  ['IT-002', '유선 마우스', '전산용품', 25, 18000, '개발팀', ''],
  ['IT-003', '27인치 모니터', '전산용품', 8, 289000, '운영팀', '듀얼 구성'],
  ['OF-001', 'A4 복사용지', '사무용품', 40, 6200, '총무팀', '80g'],
  ['OF-002', '문서 보관함', '사무용품', 15, 12500, '회계팀', ''],
  ['OF-003', '라벨 스티커', '사무용품', 30, 4300, '물류팀', '방수형'],
  ['IT-004', 'USB-C 허브', '전산용품', 10, 39000, '개발팀', 'HDMI 지원'],
  ['IT-005', '외장 저장장치', '전산용품', 6, 119000, '운영팀', '1TB'],
  ['OF-004', '화이트보드 마커', '사무용품', 50, 1800, '교육팀', '검정'],
  ['OF-005', '회의용 노트', '사무용품', 35, 3500, '기획팀', 'A5'],
  ['IT-006', '랜 케이블', '전산용품', 60, 4500, '운영팀', '3m'],
  ['OF-006', '데스크 매트', '사무용품', 18, 15900, '총무팀', '대형'],
  ['IT-007', '노트북 거치대', '전산용품', 9, 32800, '개발팀', ''],
  ['OF-007', '파일 바인더', '사무용품', 45, 2700, '회계팀', ''],
  ['IT-008', '웹캠', '전산용품', 7, 69000, '교육팀', '1080p'],
  ['OF-008', '접착 메모지', '사무용품', 100, 1500, '기획팀', '혼합색']
].map(([code, name, category, quantity, price, team, note]) => ({ code, name, category, quantity, price, team, note }));

const grid = new MoumGrid('#grid', {
  label: '물품 등록·편집',
  selectionSummary: true,
  columns: [
    { field: 'code', header: '품목코드', editable: false, width: 180 },
    { field: 'name', header: '품목명', width: 180 },
    { field: 'category', header: '분류', width: 120 },
    { field: 'quantity', header: '수량', type: 'number', width: 110, validate: value => value < 0 ? '수량은 0 이상이어야 합니다.' : null },
    { field: 'price', header: '단가', type: 'number', width: 130, validate: value => value < 0 ? '단가는 0 이상이어야 합니다.' : null },
    { field: 'team', header: '담당부서', width: 120 },
    { field: 'note', header: '비고', width: 220 },
    { field: 'parentCode', header: '상위코드', width: 140, editable: false }
  ],
  data: sampleRows
});
const treeRows = [
  { code: 'HQ', name: '운영본부', category: '조직', quantity: 0, price: 0, team: '운영팀', note: '상위 노드', parentCode: '' },
  { code: 'IT', name: '전산 자산', category: '전산용품', quantity: 0, price: 0, team: '개발팀', note: '', parentCode: 'HQ' },
  { code: 'IT-001', name: '무선 키보드', category: '전산용품', quantity: 12, price: 49000, team: '개발팀', note: '', parentCode: 'IT' },
  { code: 'IT-002', name: '27인치 모니터', category: '전산용품', quantity: 8, price: 289000, team: '개발팀', note: '', parentCode: 'IT' },
  { code: 'OF', name: '사무 자산', category: '사무용품', quantity: 0, price: 0, team: '총무팀', note: '', parentCode: 'HQ' },
  { code: 'OF-001', name: 'A4 복사용지', category: '사무용품', quantity: 40, price: 6200, team: '총무팀', note: '', parentCode: 'OF' }
];
const mode = document.getElementById('example-mode');
function loadExample() {
  grid.setGroupBy([]); grid.setTree(null); grid.setFilters([], { logic: 'and' }); grid.setSorts([]); grid.setSearch('');
  grid.setData(mode.value === 'tree' ? treeRows : sampleRows);
  if (mode.value === 'tree') grid.setTree({ idField: 'code', parentField: 'parentCode', labelField: 'name' });
  else if (mode.value === 'group') grid.setGroupBy(['category', 'team']);
}
mode.addEventListener('change', loadExample);
document.getElementById('reset').addEventListener('click', loadExample);
