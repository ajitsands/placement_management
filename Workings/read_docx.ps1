Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-Docx($path) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
    $entry = $zip.GetEntry('word/document.xml')
    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $xmlContent = $reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    $zip.Dispose()
    
    $xml = [xml]$xmlContent
    $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    
    $paragraphs = $xml.SelectNodes('//w:p', $ns)
    $textList = @()
    foreach ($p in $paragraphs) {
        $runs = $p.SelectNodes('.//w:t', $ns)
        $pText = ($runs | ForEach-Object { $_.InnerText }) -join ''
        if ($pText.Trim()) {
            $textList += $pText
        }
    }
    return $textList
}

$lines = Read-Docx 'SOFTWARE DEVELOPMENT PROPOSAL.docx'
$lines | Out-File -FilePath 'extracted_docx.txt' -Encoding utf8
Write-Host "DOCX extracted, line count:" $lines.Count
