$urls = @(
    'https://soft.sandslab.com/images/logo/sands_logo.png',
    'https://soft.sandslab.com/soft_images/Logo.png',
    'https://soft.sandslab.com/soft_images/logo2.png'
)

$i = 1
foreach ($u in $urls) {
    try {
        $fn = "sands_logo_$i.png"
        Invoke-WebRequest -Uri $u -OutFile $fn -UseBasicParsing -Headers @{'User-Agent'='Mozilla/5.0'}
        $fi = Get-Item $fn
        Write-Output "Downloaded $u -> $fn ($($fi.Length) bytes)"
        $i++
    } catch {
        Write-Output "Failed $($u): $($_.Exception.Message)"
    }
}
