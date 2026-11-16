param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../output/playwright/advanced'))
$ErrorActionPreference = 'Stop'
$outputPath = [IO.Path]::GetFullPath($OutputDirectory)
$excel = $null; $book = $null; $reports = @()
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false; $excel.DisplayAlerts = $false; $excel.EnableEvents = $false
  foreach ($name in @('exported.xlsx', 'merged.xlsx')) {
    $book = $excel.Workbooks.Open((Join-Path $outputPath $name), 0, $true)
    $sheet = $book.Worksheets.Item(1)
    $reports += @{ file = $name; excelVersion = $excel.Version; rowCount = $sheet.UsedRange.Rows.Count; code = $sheet.Range('A2').Value2; name = $sheet.Range('B2').Value2; category = $sheet.Range('C2').Value2; nextName = $sheet.Range('B3').Value2; quantity = $sheet.Range('D2').Value2; mergeArea = $sheet.Range('B2').MergeArea.Count }
    [Runtime.InteropServices.Marshal]::ReleaseComObject($sheet) | Out-Null
    $book.Close($false); [Runtime.InteropServices.Marshal]::ReleaseComObject($book) | Out-Null; $book = $null
  }
  [IO.File]::WriteAllText((Join-Path $outputPath 'excel-open-report.json'), ($reports | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
  Write-Output 'Opened both generated XLSX files read-only in Microsoft Excel.'
} finally {
  if ($null -ne $book) { try { $book.Close($false) } catch {} }
  if ($null -ne $excel) { try { $excel.Quit() } catch {}; [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
