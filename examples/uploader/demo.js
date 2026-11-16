const importSchema = [{ field: 'code', label: '품목코드', required: true }, { field: 'name', label: '품목명', required: true }, { field: 'qty', label: '수량', type: 'integer', required: true, min: 0 }, { field: 'date', label: '납기일', type: 'date', required: true }];
window.uploader = new MoumUploader('#uploader', { schema: importSchema, ...(location.protocol!=='file:'?{workerURL:'../../packages/uploader/dist/moum-uploader-worker.js'}:{}), onChange: files => { window.uploadFiles = files; } });
function workbookFile(invalid) {
  const book = XLSX.utils.book_new(), headers = importSchema.map(f => f.label);
  const values = [headers, ['P-001', '업무용 노트', 25, '2026-11-20'], ['P-002', '검정 볼펜', invalid ? -3 : 120, '2026-11-23'], ['P-003', invalid ? '' : '서류철', invalid ? '숫자 아님' : 30, invalid ? '2026-02-30' : '2026-11-25']];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(values), '물품'); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, ['P-004', '복사용지', 10, '2026-11-27']]), '추가물품');
  return new File([XLSX.write(book, { type: 'array', bookType: 'xlsx', compression: true })], invalid ? '물품_오류.xlsx' : '물품_정상.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
async function addSample(file) { const ids = await uploader.addFiles([file]); if (ids[0]) uploader.selectFile(ids[0]); }
document.querySelector('#sample').addEventListener('click', () => addSample(workbookFile(false)));
document.querySelector('#invalid').addEventListener('click', () => addSample(workbookFile(true)));
document.querySelector('#csv').addEventListener('click', () => addSample(new File(['\uFEFF품목코드,품목명,수량,납기일\r\nC-001,"쉼표, 포함 품목",12,2026-11-30'], '물품.csv', { type: 'text/csv' })));
document.querySelector('#data').addEventListener('click', () => { const id = uploader.getSelectedFileId(); document.querySelector('#result').textContent = id ? JSON.stringify({ data: uploader.getData(id, { validOnly: true }), errors: uploader.getErrors(id) }, null, 2) : '파일을 먼저 선택하세요.'; });
let importGrid;
document.querySelector('#grid-data').addEventListener('click', () => { const id = uploader.getSelectedFileId(); if (!id) { document.querySelector('#result').textContent = '파일을 먼저 선택하세요.'; return; } if (uploader.getErrors(id).length) { document.querySelector('#result').textContent = '검증 오류를 먼저 해결하세요.'; return; } const data = uploader.getData(id); importGrid?.destroy(); importGrid = new MoumGrid('#import-grid', { columns: importSchema.map(f => ({ field: f.field, header: f.label, ...(f.type === 'integer' ? { type: 'number' } : {}) })), data }); document.querySelector('#result').textContent = `${data.length}행을 모음 그리드에 표시했습니다.`; });

document.querySelector('#parse-mode').textContent=location.protocol==='file:'?'파일로 연 예제는 기본 파서를 사용합니다. npm run dev로 열면 백그라운드 파싱을 확인할 수 있습니다.':'백그라운드 파싱 모드 · 읽기/분석 단계와 취소를 지원합니다.';
document.querySelector('#large').addEventListener('click',()=>addSample(new File(['품목코드,품목명,수량,납기일\n'+Array.from({length:10000},(_,i)=>`L-${i},품목 ${i},${i},2026-11-30`).join('\n')],'대용량.csv',{type:'text/csv'})));
