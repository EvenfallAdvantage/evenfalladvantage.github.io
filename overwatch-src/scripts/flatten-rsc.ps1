# flatten-rsc.ps1
# Next.js 16 outputs RSC payloads as directory trees (__next.admin/events/__PAGE__.txt)
# but the client JS requests them as flat dotted files (__next.admin.events.__PAGE__.txt).
# This script creates the flat copies so GitHub Pages can serve them.

param([string]$OutDir = "out")

$count = 0
# Find all directories whose name starts with "__next."
Get-ChildItem -Path $OutDir -Recurse -Directory | Where-Object { $_.Name -like "__next.*" } | ForEach-Object {
    $nextDir = $_
    $parentDir = $nextDir.Parent.FullName
    $prefix = $nextDir.Name  # e.g. "__next.admin"

    # Get all .txt files recursively inside this __next.* directory
    Get-ChildItem -Path $nextDir.FullName -Recurse -File -Filter "*.txt" | ForEach-Object {
        $file = $_
        # Get relative path from the __next.* directory
        $relPath = $file.FullName.Substring($nextDir.FullName.Length + 1)
        # Convert path separators to dots: "events\__PAGE__.txt" -> "events.__PAGE__.txt"
        $flatName = $relPath -replace '[\\/]', '.'
        # Final flat filename: "__next.admin" + "." + "events.__PAGE__.txt"
        $destName = "$prefix.$flatName"
        $destPath = Join-Path $parentDir $destName

        if (-not (Test-Path $destPath)) {
            Copy-Item -Path $file.FullName -Destination $destPath
            $count++
        }
    }
}

Write-Host "Flattened $count RSC payload files."
