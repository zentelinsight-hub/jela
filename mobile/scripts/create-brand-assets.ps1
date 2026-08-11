$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot '..\assets\brand\jela-ai-logo.png'
$outputPath = Join-Path $PSScriptRoot '..\assets\brand\jela-ai-app-icon.png'
$source = [System.Drawing.Image]::FromFile($sourcePath)

try {
  $size = [Math]::Max($source.Width, $source.Height)
  $canvas = New-Object System.Drawing.Bitmap $size, $size
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    try {
      $graphics.Clear([System.Drawing.Color]::Black)
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      $graphics.DrawImageUnscaled(
        $source,
        [int](($size - $source.Width) / 2),
        [int](($size - $source.Height) / 2)
      )
    }
    finally {
      $graphics.Dispose()
    }
    $canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $canvas.Dispose()
  }
}
finally {
  $source.Dispose()
}

Write-Output $outputPath
