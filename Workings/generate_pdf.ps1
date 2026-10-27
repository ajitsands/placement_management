$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$html = 'D:\Projects\Claims\proposal.html'
$pdf = 'D:\Projects\Claims\Candidate_Placement_Claims_Management_Proposal_SaNDSLab.pdf'

Write-Output "Starting PDF generation with Chrome..."
$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = $chrome
$pinfo.Arguments = "--headless=new --disable-gpu --no-pdf-header-footer --run-all-compositor-stages-before-draw --print-to-pdf=""$pdf"" ""$html"""
$pinfo.RedirectStandardOutput = $true
$pinfo.RedirectStandardError = $true
$pinfo.UseShellExecute = $false
$pinfo.CreateNoWindow = $true

$p = [System.Diagnostics.Process]::Start($pinfo)
$p.WaitForExit(30000)
$out = $p.StandardOutput.ReadToEnd()
$err = $p.StandardError.ReadToEnd()

Write-Output "Exit code: $($p.ExitCode)"
Write-Output "Standard error: $err"
if (Test-Path $pdf) {
    $item = Get-Item $pdf
    Write-Output "SUCCESS: PDF created! Size: $($item.Length) bytes ($([Math]::Round($item.Length / 1KB, 2)) KB)"
} else {
    Write-Output "FAILED: PDF was not created."
}
