$sites = @('https://home.sandslab.com/favicon.ico', 'https://soft.sandslab.com/', 'https://soft.sandslab.com/software')
foreach ($s in $sites) {
    try {
        $res = Invoke-WebRequest -Uri $s -UseBasicParsing -Headers @{'User-Agent'='Mozilla/5.0'}
        Write-Output "Site $s returned $($res.StatusCode)"
        [regex]::Matches($res.Content, '<img[^>]+src=["'']([^"'']+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) | ForEach-Object {
            Write-Output "  Img: $($_.Groups[1].Value)"
        }
    } catch {
        Write-Output "Site $s failed: $_"
    }
}
