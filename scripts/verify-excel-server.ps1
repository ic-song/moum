param([string]$Directory = 'output/playwright/server')
$ErrorActionPreference = 'Stop'
$excel = $null; $book = $null; $sheet = $null; $reports = @()
try {
  $folder = (Resolve-Path -LiteralPath $Directory).Path
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false; $excel.DisplayAlerts = $false; $excel.EnableEvents = $false; $excel.AutomationSecurity = 3
  foreach ($spec in @(@('view',51,5,'R00001'), @('all',1024,5,'R00001'), @('filtered',2,5,'R01023'), @('selection',2,2,'서버 품목 1023'))) {
    $book = $excel.Workbooks.Open((Join-Path $folder ('chromium-' + $spec[0] + '.xlsx')), 0, $true)
    $sheet = $book.Worksheets.Item(1); $range = $sheet.UsedRange; $cell = $sheet.Range('A2')
    try {
      $report = [PSCustomObject]@{Scope=$spec[0]; Version=$excel.Version; ReadOnly=$book.ReadOnly; Rows=$range.Rows.Count; Columns=$range.Columns.Count; First=$cell.Value2}
      if ($report.Rows -ne $spec[1] -or $report.Columns -ne $spec[2] -or $report.First -ne $spec[3]) { throw "Server XLSX mismatch: $($spec[0])" }
      $reports += $report
    } finally { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($cell); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($range) }
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sheet); $sheet = $null
    $book.Close($false); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($book); $book = $null
  }
  $reports | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $folder 'excel-open.json') -Encoding utf8
  Write-Output 'Verified four server-scope XLSX downloads read-only in Microsoft Excel.'
} finally {
  if ($book) { $book.Close($false) }
  if ($excel) { $excel.Quit() }
  foreach ($item in @($sheet,$book,$excel)) { if ($item) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($item) } }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
