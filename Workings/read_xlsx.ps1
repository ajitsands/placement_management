Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-XlsxInfo($path) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
    
    # Read workbook.xml to get sheet names
    $wbEntry = $zip.GetEntry('xl/workbook.xml')
    $stream = $wbEntry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $wbXml = [xml]$reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    
    # Read shared strings
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
    
    Write-Output "Shared Strings Count: $($sharedStrings.Count)"
    
    $nsWb = New-Object System.Xml.XmlNamespaceManager($wbXml.NameTable)
    $nsWb.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    $sheets = $wbXml.SelectNodes('//s:sheet', $nsWb)
    
    $sheetIndex = 1
    foreach ($sh in $sheets) {
        $name = $sh.GetAttribute('name')
        $sheetId = $sh.GetAttribute('sheetId')
        Write-Output "Sheet: $name (id: $sheetId)"
        
        $sheetEntry = $zip.GetEntry("xl/worksheets/sheet${sheetIndex}.xml")
        if ($sheetEntry) {
            $stream = $sheetEntry.Open()
            $reader = New-Object System.IO.StreamReader($stream)
            $sheetXml = [xml]$reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            $nsS = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
            $nsS.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
            
            $rows = $sheetXml.SelectNodes('//s:row', $nsS)
            Write-Output "  Total rows: $($rows.Count)"
            
            # Print first 5 rows
            $rowCount = 0
            foreach ($r in $rows) {
                if ($rowCount -ge 5) { break }
                $rowNum = $r.GetAttribute('r')
                $cells = $r.SelectNodes('./s:c', $nsS)
                $cellVals = @()
                foreach ($c in $cells) {
                    $ref = $c.GetAttribute('r')
                    $t = $c.GetAttribute('t')
                    $vNode = $c.SelectSingleNode('./s:v', $nsS)
                    $val = if ($vNode) { $vNode.InnerText } else { "" }
                    if ($t -eq 's' -and $val -ne "") {
                        $idx = [int]$val
                        if ($idx -lt $sharedStrings.Count) {
                            $val = $sharedStrings[$idx]
                        }
                    }
                    $cellVals += "$ref : $val"
                }
                Write-Output "  Row $rowNum : $($cellVals -join ' | ')"
                $rowCount++
            }
        }
        $sheetIndex++
    }
    
    $zip.Dispose()
}

Read-XlsxInfo 'Placement and Claims Sheet 2026 (2).xlsx' | Out-File -FilePath 'extracted_xlsx.txt' -Encoding utf8
