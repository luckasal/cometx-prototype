param([Parameter(Mandatory = $true)][string]$ZipPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repo = Split-Path $PSScriptRoot -Parent
$colors = @{
  'Deep Space'='deep-space'; 'Connection Lime'='connection-lime';
  'Cloud White'='cloud-white'; 'Night Gray'='night-gray';
  'Electric Cyan'='electric-cyan'; 'Impact Orange'='impact-orange';
  'Network Violet'='network-violet'; 'bílá'='white'; 'černá'='black'
}
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ZipPath))
$records = [Collections.Generic.List[object]]::new()
try {
  foreach ($entry in $archive.Entries) {
    $name = $entry.FullName.Normalize([Text.NormalizationForm]::FormC)
    $destination = $null
    $kind = 'unclassified'
    if ($name.EndsWith('/')) { $kind = 'directory' }
    elseif ($name.EndsWith('.DS_Store')) { $kind = 'ignored-macos-metadata' }
    elseif ($name -match '/Logo a Symbol - export/(SVG|PNG)/(?:B&W/)?([^/]+)/([^/]+)$') {
      $format = $Matches[1].ToLowerInvariant()
      $color = $colors[$Matches[2]]
      $file = $Matches[3]
      if (-not $color) { throw "Unmapped color: $name" }
      if ($format -eq 'svg') {
        if ($file -eq 'Symbol.svg') { $kind = 'symbol' }
        elseif ($file -match 'CometX_LOGA-(\d+)\.svg') {
          # Export order is symbol+claim, logo+claim, logo (verified visually).
          $kind = @('symbol-claim','logo-claim','logo')[([int]$Matches[1] - 20) % 3]
        } else { throw "Unmapped SVG: $name" }
      } else {
        $kind = @{ 'Logo.png'='logo'; 'Logo + claim.png'='logo-claim'; 'Symbol.png'='symbol'; 'Symbol + claim.png'='symbol-claim' }[$file]
        # The official Electric Cyan PNG filenames are swapped; retain bytes.
        if ($color -eq 'electric-cyan') {
          if ($kind -eq 'logo') { $kind = 'symbol-claim' }
          elseif ($kind -eq 'symbol-claim') { $kind = 'logo' }
        }
      }
      if (-not $kind) { throw "Unmapped artwork: $name" }
      $destination = "public/brand/cometx/$kind/$color.$format"
    }
    elseif ($name -match '/Prvek X/(SVG|PNG)/.+-(0[4-7])\.(svg|png)$') {
      $kind = 'x-element'
      $destination = "public/brand/cometx/elements/x-$($Matches[2]).$($Matches[3])"
    }
    elseif ($name.EndsWith('/Brandbook/CometX brandbook 1.0.pdf')) {
      $kind = 'brandbook'
      $destination = 'docs/brand/cometx-brandbook-1.0.pdf'
    }
    elseif ($name.EndsWith('/Prvek X/tvar + aplikace.ai')) { $kind = 'illustrator-source-retained-in-original-archive' }
    else { throw "Unclassified archive entry: $name" }
    $stream = $entry.Open()
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = [Convert]::ToHexString($sha.ComputeHash($stream)).ToLowerInvariant() }
    finally { $stream.Dispose(); $sha.Dispose() }
    if ($destination) {
      $target = Join-Path $repo $destination
      New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
    }
    $records.Add([ordered]@{ source=$name; kind=$kind; destination=$destination; bytes=$entry.Length; sha256=$hash })
  }
} finally { $archive.Dispose() }
$manifest = [ordered]@{
  archive=(Split-Path $ZipPath -Leaf)
  archiveSha256=(Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
  notes=@('Every ZIP entry is classified; Illustrator source remains in the original archive.', 'Original SVG and PNG bytes are preserved; filename corrections are recorded in this importer.')
  files=$records
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $repo 'docs/brand/asset-manifest.json') -Encoding utf8
Write-Output "Inspected $($records.Count) archive entries; imported $(@($records | Where-Object destination).Count) assets/documents."
