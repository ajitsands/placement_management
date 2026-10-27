Add-Type -AssemblyName System.IO.Compression.FileSystem

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

$sheetEntry = $zip.GetEntry('xl/worksheets/sheet3.xml') # Placements 26
$stream = $sheetEntry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$sheetXml = [xml]$reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()

$nsS = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
$nsS.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')

$rows = $sheetXml.SelectNodes('//s:row', $nsS)
$records = @()
for ($i = 1; $i -lt [Math]::Min($rows.Count, 30); $i++) {
    $r = $rows[$i]
    $cells = $r.SelectNodes('./s:c', $nsS)
    $obj = @{}
    foreach ($c in $cells) {
        $ref = $c.GetAttribute('r')
        $col = [regex]::Match($ref, '^[A-Z]+').Value
        $t = $c.GetAttribute('t')
        $vNode = $c.SelectSingleNode('./s:v', $nsS)
        $val = if ($vNode) { $vNode.InnerText } else { "" }
        if ($t -eq 's' -and $val -ne "") {
            $idx = [int]$val
            if ($idx -lt $sharedStrings.Count) { $val = $sharedStrings[$idx] }
        }
        $obj[$col] = $val
    }
    # Map columns
    # B: Manager, C: RefNo, D: Name, E: CPR, F: Joining Date, G: MoL, I: Gender, J: Edu, K: Salary, L: Position, M: Company
    $records += [PSCustomObject]@{
        refNo = $obj['C']
        name = $obj['D']
        cpr = $obj['E']
        caseManager = $obj['B']
        joiningDays = $obj['F']
        mol = $obj['G']
        gender = $obj['I']
        education = $obj['J']
        salary = $obj['K']
        position = $obj['L']
        company = $obj['M']
    }
}

$records | ConvertTo-Json | Out-File -FilePath 'sample_placements.json' -Encoding utf8
Write-Output "Extracted $($records.Count) placements to sample_placements.json"
