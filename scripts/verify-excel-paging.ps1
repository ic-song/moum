param([string]$Directory = 'output/playwright/paging')
$ErrorActionPreference = 'Stop'
$excel = $null; $book = $null; $sheet = $null; $reports = @()
try {
  $folder = (Resolve-Path -LiteralPath $Directory).Path
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false; $excel.DisplayAlerts = $false; $excel.EnableEvents = $false; $excel.AutomationSecurity = 3
  foreach ($spec in @(@('view',26,5,'R77'), @('filtered',55,5,'R102'), @('all',104,5,'R0'), @('selection',3,2,'품목 77'), @('infinite-loaded',254,5,'R0'), @('readonly-all',104,5,'R0'), @('empty',1,5,$null))) {
    $book = $excel.Workbooks.Open((Join-Path $folder ($spec[0] + '.xlsx')), 0, $true)
    $sheet = $book.Worksheets.Item(1); $range = $sheet.UsedRange; $cell = $sheet.Range('A2')
    try {
      $report = [PSCustomObject]@{File=$spec[0]; Version=$excel.Version; ReadOnly=$book.ReadOnly; Rows=$range.Rows.Count; Columns=$range.Columns.Count; First=$cell.Value2}
      if ($report.Rows -ne $spec[1] -or $report.Columns -ne $spec[2] -or ($null -ne $spec[3] -and $report.First -ne $spec[3])) { throw "Excel export mismatch: $($spec[0])" }
      $reports += $report
    } finally { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($cell); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($range) }
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($sheet); $sheet = $null
    $book.Close($false); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($book); $book = $null
  }
  $reports | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $folder 'excel-open.json') -Encoding utf8
  Write-Output 'Verified seven scope-specific XLSX downloads read-only in Microsoft Excel.'
} finally {
  if ($book) { $book.Close($false) }
  if ($excel) { $excel.Quit() }
  foreach ($item in @($sheet,$book,$excel)) { if ($item) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($item) } }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
