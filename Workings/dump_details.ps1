Add-Type -AssemblyName System.IO.Compression.FileSystem

function Dump-FullSheet($sheetName, $xmlName, $zip, $sharedStrings) {
    Write-Output "=== SHEET: $sheetName ==="
    $sheetEntry = $zip.GetEntry($xmlName)
    if (-not $sheetEntry) { return }
    $stream = $sheetEntry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $sheetXml = [xml]$reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    
    $nsS = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
    $nsS.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    
    $rows = $sheetXml.SelectNodes('//s:row', $nsS)
    $maxRows = [Math]::Min($rows.Count, 15)
    for ($i = 0; $i -lt $maxRows; $i++) {
        $r = $rows[$i]
        $rowNum = $r.GetAttribute('r')
        $cells = $r.SelectNodes('./s:c', $nsS)
        $cellVals = @()
        foreach ($c in $cells) {
            $ref = $c.GetAttribute('r')
            $t = $c.GetAttribute('t')
            $vNode = $c.SelectSingleNode('./s:v', $nsS)
            $fNode = $c.SelectSingleNode('./s:f', $nsS)
            $val = if ($vNode) { $vNode.InnerText } else { "" }
            if ($t -eq 's' -and $val -ne "") {
                $idx = [int]$val
                if ($idx -lt $sharedStrings.Count) {
                    $val = $sharedStrings[$idx]
                }
            }
            if ($fNode) {
                $val = "[$($fNode.InnerText)] -> $val"
            }
            $cellVals += "$($ref): $val"
        }
        Write-Output "R$rowNum : $($cellVals -join ' | ')"
    }
}

$zip = [System.IO.Compression.ZipFile]::OpenRead('Placement and Claims Sheet 2026 (2).xlsx')
$ssEntry = $zip.GetEntry('xl/sharedStrings.xml')
$sharedStrings = @()
if ($ssEntry) {
    $stream = $ssEntry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $ssXml = [xml]$reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    $ns = New-Object System.Xml.XmlNamespaceManager($ssXml.NameTable)
    $ns.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    $siNodes = $ssXml.SelectNodes('//s:si', $ns)
    foreach ($si in $siNodes) {
        $tNodes = $si.SelectNodes('.//s:t', $ns)
        $sharedStrings += ($tNodes | ForEach-Object { $_.InnerText }) -join ''
    }
}

Dump-FullSheet "Dropdown" "xl/worksheets/sheet5.xml" $zip $sharedStrings | Out-File -FilePath 'dump_dropdown.txt' -Encoding utf8
Dump-FullSheet "Claims 26" "xl/worksheets/sheet4.xml" $zip $sharedStrings | Out-File -FilePath 'dump_claims26.txt' -Encoding utf8

$zip.Dispose()
