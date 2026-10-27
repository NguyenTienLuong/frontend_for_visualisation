param(
    [string]$DocumentPath = (Join-Path (Get-Location) 'Cell2Cell_Customer_Churn_Report.docx'),
    [string]$PdfPath = (Join-Path (Get-Location) 'Cell2Cell_Customer_Churn_Report.pdf')
)
$ErrorActionPreference = 'Stop'
$resolvedDoc = (Resolve-Path -LiteralPath $DocumentPath).Path
$resolvedPdf = [System.IO.Path]::GetFullPath($PdfPath)
$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($resolvedDoc, $false, $false)
    $document.Fields.Update() | Out-Null
    $document.Repaginate()
    foreach ($toc in $document.TablesOfContents) { $toc.Update() }
    $document.Fields.Update() | Out-Null
    $document.Repaginate()
    foreach ($toc in $document.TablesOfContents) { $toc.UpdatePageNumbers() }
    $document.Save()
    $pages = $document.ComputeStatistics(2)
    $document.ExportAsFixedFormat($resolvedPdf, 17)
    Write-Output ('Word export completed. Pages: ' + $pages)
    Write-Output $resolvedPdf
} finally {
    if ($null -ne $document) { $document.Close(0) }
    if ($null -ne $word) {
        if ($word.Documents.Count -eq 0) { $word.Quit() }
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
}
