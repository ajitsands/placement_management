$urls = @(
    'https://home.sandslab.com/logo/logo_white.png',
    'https://home.sandslab.com/logo/logo.png',
    'https://home.sandslab.com/logo/logo_black.png',
    'https://home.sandslab.com/logo/karma_ai_logo.png'
)

foreach ($url in $urls) {
    $fn = [System.IO.Path]::GetFileName($url)
    try {
        Invoke-WebRequest -Uri $url -OutFile $fn -UseBasicParsing -Headers @{'User-Agent'='Mozilla/5.0'}
        $fi = Get-Item $fn
        Write-Output "Downloaded $fn : $($fi.Length) bytes"
    } catch {
        Write-Output "Failed $url : $_"
    }
}
