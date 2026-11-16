# @moum/uploader 0.2.0

파일 선택/드롭 → 로컬 파싱 → 시트/헤더 선택 → 열 매핑 → 행 검증 → 미리보기 → 명시적 서버 전송. MOUM Grid 없이 독립 실행하며 결과를 선택적으로 그리드에 넘깁니다.

```html
<link rel="stylesheet" href="./moum-uploader.css">
<div id="uploader"></div>
<!-- Excel이 필요할 때만 동봉 파서를 먼저 로드 -->
<script src="./vendor/sheetjs/xlsx.full.min.js"></script>
<script src="./moum-uploader.js"></script>
<script>
const uploader = new MoumUploader('#uploader', {
  accept:'.xlsx,.xls,.csv,.tsv,.json,.pdf,image/*',
  schema:[{field:'code',label:'품목코드',required:true},{field:'qty',label:'수량',type:'integer',required:true,min:0}]
});
</script>
```

위 설정은 로컬 검토 모드이며 자동 전송하지 않습니다. JS/CSS/LICENSE를 복사하고 Excel에는 vendor와 제3자 고지도 포함하세요. 자체 코드 MIT, 동봉 SheetJS 0.20.3 Apache-2.0입니다.

ESM: `import Uploader,{createXHRTransport} from '@moum/uploader'`, CSS: `@moum/uploader/style.css`, CommonJS: `const {Uploader}=require('@moum/uploader')`. 파서는 `excelLibrary:XLSX`로 주입할 수도 있습니다. npm 등록 전이므로 `npm pack ./packages/uploader`로 tgz를 만들어 설치하세요.

## 파싱·검증

- 일반 파일은 원본으로 관리/전송하고 PNG/JPEG/GIF/WebP는 로컬 미리보기를 제공합니다. Excel/CSV/TSV/JSON만 표로 파싱합니다.
- xlsx/xls는 여러 시트와 저장된 숫자/문자/날짜/boolean을 읽습니다. 수식을 실행하지 않으며 오류 셀/계산 결과 없는 수식은 검증 오류입니다. 암호화·ZIP64·매크로 실행·원본 서식/병합/이미지 보존은 지원하지 않습니다.
- CSV/TSV는 BOM, 따옴표, 셀 내 줄바꿈, 이중 따옴표와 원본 행 번호를 지원합니다. CSV 첫 레코드에서 쉼표/세미콜론/탭을 판별하며 delimiter로 지정할 수 있습니다. encoding은 utf-8(기본)/euc-kr/utf-16le이며 자동 판별하지 않습니다.
- JSON은 객체 배열이며 중첩 값은 JSON 문자열로 표시합니다.
- 헤더는 실제 원본 행 번호이며 0은 없음입니다. 빈 행을 생략하되 번호를 유지합니다. 중복 헤더는 column1/column2로 구분하고 모호한 자동 매핑을 하지 않습니다.
- schema: `{field,label?,type?,required?,min?,max?,trim?,validate?}`. type은 string/number/integer/boolean/date. 숫자는 엄격한 십진수/올바른 천 단위 구분, 날짜는 YYYY-MM-DD입니다. `validate(value,sourceRow)`는 false/오류 문자열을 반환하거나 예외를 던질 수 있습니다.
- schema 없이는 column1… 키와 원본 스칼라 타입을 유지합니다. 같은 원본 열의 중복 매핑은 거절합니다. getData(id)는 변환된 전체 데이터, `{validOnly:true}`는 정상 행입니다. **전체 검증을 통과해야 업로드할 수 있습니다.**

기본 한도: 파일 20MB·10개, 데이터 10,000행·200열, 셀 100,000자, XLSX 선언 압축 해제 크기 100MB·100시트. `maxFileSize/maxFiles/maxRows/maxColumns/maxCellLength/maxExpandedBytes/pageSize`로 조절합니다. 원본 마지막 행이 maxRows+1을 넘으면 거절합니다. 파싱은 메인 스레드이므로 큰 파일은 UI 응답을 지연시킬 수 있습니다.

Excel 전체 시트의 사용 범위 합계는 2,000,000셀까지 읽습니다. 여러 큰 시트나 매우 넓은 희소 시트는 나누어 올리세요.

미리보기 셀은 더블클릭 또는 F2/Enter로 수정하고 Enter로 적용, Esc/포커스 이동으로 취소합니다. 수정 즉시 재검증합니다. `editCell(id,sourceRow,columnKey,value)` API도 제공합니다. `editable:false`로 끌 수 있습니다. 수정값은 전송 data와 JSON에 반영되며 원본 file은 바뀌지 않습니다. metadata.edited로 이 상태를 전달하므로 서버는 원본을 재파싱해 수정 data를 덮어쓰지 않도록 계약을 정하세요.

## 서버 연결

```js
const uploader = new Uploader(element, {
  schema,
  url:'/api/uploads',
  transportOptions:{timeout:120000,headers:{'X-CSRF-Token':csrfToken}},
  onUploaded: ({id,result}) => console.log(id,result)
});
```

기본 XHR은 multipart/form-data로 원본 `file`, 검증 레코드 JSON `data`(표 파일), `{sheetName,headerRow,mapping}` JSON `metadata`를 전송합니다. 2xx 성공 응답의 JSON/텍스트를 반환합니다. transportOptions는 method/fieldName/timeout/withCredentials/headers를 받습니다. Content-Type boundary는 브라우저가 지정하므로 직접 설정하지 마세요.

다른 계약은 `onUpload:async ({file,data,metadata,signal,onProgress}) => result`로 연결합니다. AbortSignal을 처리하고 서버 성공 후 resolve하세요. 취소/제거 후 늦은 응답은 UI를 덮어쓰지 않습니다. **취소/타임아웃은 서버 저장 취소를 보장하지 않으므로** 재시도 중복은 서버의 요청 ID/멱등성 정책으로 처리해야 합니다. uploadAll은 순차 파일 전송이며 배치 트랜잭션이 아닙니다.

uploadTimeout(기본 120000ms)은 사용자 전송 함수가 종료하지 않아도 상태를 오류로 돌려줍니다. 시간 초과 시 AbortSignal도 중단합니다.

서버는 별도 구현 대상입니다. 권한·CSRF·파일 검사·크기 제한·저장 경로·레코드 검증은 서버에서 다시 확인하세요. 클라이언트 accept/검증은 서버 검증을 대체하지 않습니다. 청크/이어올리기·백신·S3 자격 증명은 제공하지 않습니다.

## API

`addFiles(File[]|FileList)` → id 배열, `getFiles()`, `selectFile(id)`, `getSelectedFileId()`, `selectSheet(id,index)`, `setHeaderRow(id,row)`, `getMapping(id)`, `setMapping(id,mapping)`, `getData(id,{validOnly?})`, `getErrors(id)`, `upload(id)`, `uploadAll()`, `retry(id)`, `cancel(id)`, `removeFile(id)`, `clear()`, `destroy()`.

콜백: onChange(files), onUploaded({id,file,result}), onError({id,error}). parseUploadFile/parseDelimited/tableFromSheet/validateUploadTable는 UI 없이도 사용합니다. index.d.ts에 전체 타입이 있습니다. 비어 있는 요소에 생성하고 destroy에서 전송 중단/Blob URL 해제를 수행합니다.

[오프라인 예제](../../examples/uploader/index.html): 정상/오류 Excel·CSV·시트 선택·열 매핑·JSON/오류 CSV 다운로드·그리드 연결. 서버 전송은 연결하지 않았습니다. CSS는 `.moum-uploader`와 `--moum-upload-*` 변수로 제한됩니다.

## 0.2.0 동시 전송과 전체 취소

`uploadConcurrency:1`이 기본이며 1~6을 지정할 수 있습니다. uploadAll은 호출 당시 검증된 큐를 worker로 나눠 전송하고 중복 uploadAll 호출은 같은 배치 완료를 기다립니다. `cancelAll()`과 전체 전송 취소 버튼은 진행 중 전송을 취소하고 배치의 아직 시작하지 않은 파일은 남겨둡니다. clear/destroy 후 미시작 전송은 실행하지 않습니다. 개별 upload()를 호스트가 별도로 실행하면 배치 제한과 별개이므로 동시성 통제 시 uploadAll을 사용하세요. 취소가 서버의 수신·처리 취소를 보장하지는 않습니다.
