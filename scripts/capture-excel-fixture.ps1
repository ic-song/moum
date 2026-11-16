param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../output/excel-fixture'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$outputPath = [IO.Path]::GetFullPath($OutputDirectory)
[IO.Directory]::CreateDirectory($outputPath) | Out-Null
$original = [Windows.Forms.Clipboard]::GetDataObject()
$saved = New-Object Windows.Forms.DataObject
if ($null -ne $original) {
  foreach ($format in $original.GetFormats($false)) {
    $content = $original.GetData($format, $false)
    if ($null -ne $content) { $saved.SetData($format, $false, $content) }
  }
}
$excel = $null; $book = $null; $sheet = $null; $copied = $false
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false; $excel.DisplayAlerts = $false; $excel.EnableEvents = $false; $excel.ScreenUpdating = $false
  $book = $excel.Workbooks.Add(); $sheet = $book.Worksheets.Item(1); $sheet.Name = 'ClipboardFixture'
  $headers = @('품목코드', '품목명', '분류', '수량', '단가', '담당부서', '비고', '상위코드')
  $records = @(
    @('00123', '엑셀 물품', '사무용품', [double]1234, [double]12500.5, '총무팀', "첫줄`n둘째줄", ''),
    @('00007', '두 번째 물품', '전산용품', [double]20, [double]49900, '개발팀', "탭`t문자", ''),
    @('00009', '빈 셀 확인', '', [double]0, [double]0, '', '', '')
  )
  $allRows = ,$headers + $records
  for ($r = 0; $r -lt $allRows.Count; $r++) {
    for ($c = 0; $c -lt 8; $c++) {
      $cell = $sheet.Cells.Item($r + 1, $c + 1)
      if ($c -eq 0 -or $c -eq 7) { $cell.NumberFormat = '@' }
      $value = $allRows[$r][$c]
      if ($value -is [double]) {
        # Constant formulas give Excel numeric cached values without COM string coercion.
        $cell.Formula = '=' + $value.ToString([Globalization.CultureInfo]::InvariantCulture)
      } else { $cell.Value2 = [string]$value }
      [Runtime.InteropServices.Marshal]::ReleaseComObject($cell) | Out-Null
    }
  }
  $sheet.Range('D2:D4').NumberFormat = '#,##0'
  $sheet.Range('E2:E4').NumberFormat = '#,##0.00'
  $sheet.Range('G2:G4').WrapText = $true
  $excel.Calculate()
  $workbookPath = Join-Path $outputPath 'excel-source.xlsx'
  $book.SaveAs($workbookPath, 51)
  $sheet.Range('B2:G3').Copy() | Out-Null
  $copied = $true
  $clipboard = [Windows.Forms.Clipboard]::GetDataObject()
  $plain = $clipboard.GetData([Windows.Forms.DataFormats]::UnicodeText)
  $html = $clipboard.GetData([Windows.Forms.DataFormats]::Html)
  if ([string]::IsNullOrEmpty($plain) -or [string]::IsNullOrEmpty($html)) { throw 'Excel did not provide both clipboard formats.' }
  if (-not $plain.StartsWith("엑셀 물품`t사무용품")) { throw 'Clipboard changed during the test; no clipboard fixture was saved.' }
  $expected = @(
    @{ name = '엑셀 물품'; category = '사무용품'; quantity = 1234; price = 12500.5; team = '총무팀'; note = "첫줄`n둘째줄" },
    @{ name = '두 번째 물품'; category = '전산용품'; quantity = 20; price = 49900; team = '개발팀'; note = "탭`t문자" }
  )
  $fixture = @{ excelVersion = $excel.Version; source = 'Microsoft Excel COM: saved XLSX workbook, copied range B2:G3'; workbook = 'excel-source.xlsx'; plainText = $plain; html = $html; expected = $expected }
  [IO.File]::WriteAllText((Join-Path $outputPath 'clipboard.json'), ($fixture | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
  Write-Output 'Created an XLSX and Excel clipboard fixture from test data.'
} finally {
  if ($null -ne $book) { try { $book.Close($false) } catch { Write-Warning 'Could not close owned test workbook.' } }
  if ($null -ne $excel) { try { $excel.Quit() } catch { Write-Warning 'Could not quit owned Excel instance.' } }
  foreach ($ownedObject in @($sheet, $book, $excel)) {
    if ($null -ne $ownedObject) { try { [Runtime.InteropServices.Marshal]::ReleaseComObject($ownedObject) | Out-Null } catch {} }
  }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
  if ($copied) {
    $currentText = [Windows.Forms.Clipboard]::GetText([Windows.Forms.TextDataFormat]::UnicodeText)
    if ([string]::IsNullOrEmpty($currentText) -or $currentText -eq $plain) {
      if ($null -eq $original) { [Windows.Forms.Clipboard]::Clear() }
      else { [Windows.Forms.Clipboard]::SetDataObject($saved, $true, 10, 100) }
    } else { Write-Warning 'User changed the clipboard during the test; kept the newer clipboard content.' }
  }
}
