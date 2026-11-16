param([string]$InputFile = 'output/playwright/followup/formulas.xlsx', [string]$OutputFile = 'output/playwright/followup/excel-formulas.json')
$ErrorActionPreference = 'Stop'
$excel = $null; $book = $null; $sheet = $null
try {
  $source = (Resolve-Path -LiteralPath $InputFile).Path
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false; $excel.DisplayAlerts = $false; $excel.AutomationSecurity = 3
  $book = $excel.Workbooks.Open($source, 0, $true)
  $sheet = $book.Worksheets.Item(1)
  $excel.CalculateFull()
  $results = foreach ($address in @('D2', 'D3', 'D4')) {
    $cell = $sheet.Range($address)
    try { [PSCustomObject]@{Cell=$address; Formula=$cell.Formula; Value=$cell.Value2} }
    finally { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($cell) }
  }
  if ($results[0].Formula -ne '=B2*C2' -or $results[0].Value -ne 150000 -or $results[1].Value -ne 180000 -or $results[2].Formula -ne '=SUM(D2:D3)' -or $results[2].Value -ne 330000) { throw 'Excel formula roundtrip mismatch' }
  $report = [PSCustomObject]@{Version=$excel.Version; ReadOnly=$book.ReadOnly; Cells=$results; Passed=$true}
  $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputFile -Encoding utf8
  $report | ConvertTo-Json -Depth 5 -Compress
}
finally {
  if ($book) { $book.Close($false) }
  if ($excel) { $excel.Quit() }
  foreach ($item in @($sheet,$book,$excel)) { if ($item) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($item) } }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
