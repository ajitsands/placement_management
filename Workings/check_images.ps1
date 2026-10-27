try {
    $res = Invoke-WebRequest -Uri 'https://www.sandslab.com' -UseBasicParsing -Headers @{'User-Agent'='Mozilla/5.0'}
    Write-Output "Status: $($res.StatusCode)"
    Write-Output "Base Response URL: $($res.BaseResponse.ResponseUri)"
    # Find all img src matches
    [regex]::Matches($res.Content, '<img[^>]+src=["'']([^"'']+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) | ForEach-Object {
        Write-Output "Image src: $($_.Groups[1].Value)"
    }
} catch {
    Write-Output "Error: $_"
}
