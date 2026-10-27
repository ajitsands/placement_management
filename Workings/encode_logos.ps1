$bytesDark = [System.IO.File]::ReadAllBytes('sands_logo_2.png')
$b64Dark = [Convert]::ToBase64String($bytesDark)
"data:image/png;base64,$b64Dark" | Out-File -FilePath 'logo_dark_b64.txt' -Encoding ascii

$bytesWhite = [System.IO.File]::ReadAllBytes('logo_white.png')
$b64White = [Convert]::ToBase64String($bytesWhite)
"data:image/png;base64,$b64White" | Out-File -FilePath 'logo_white_b64.txt' -Encoding ascii

Write-Output "Logos encoded to base64 successfully!"
