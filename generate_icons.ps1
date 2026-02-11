
Add-Type -AssemblyName System.Drawing

$iconPath = "src-tauri/icons"
If (!(Test-Path $iconPath)) { New-Item -ItemType Directory -Path $iconPath }

function New-Icon {
    param (
        [int]$width,
        [int]$height,
        [string]$text,
        [string]$filename,
        [bool]$isIco = $false
    )

    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Settings
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    # Background Color (Dark Slate/Black for contrast)
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml("#0f172a") 
    $brushBg = New-Object System.Drawing.SolidBrush $bgColor
    $graphics.FillRectangle($brushBg, 0, 0, $width, $height)

    # Text Settings
    $fontSize = [float]($width * 0.5)
    $fontStyle = [System.Drawing.FontStyle]::Bold
    $font = New-Object System.Drawing.Font("Arial", $fontSize, $fontStyle)
    $brushText = [System.Drawing.Brushes]::White
    
    # Measure string to center it
    $stringSize = $graphics.MeasureString($text, $font)
    $x = ($width - $stringSize.Width) / 2
    $y = ($height - $stringSize.Height) / 2

    $graphics.DrawString($text, $font, $brushText, $x, $y)
    $graphics.Flush()

    $fullPath = Join-Path $iconPath $filename
    
    if ($isIco) {
        # Create ICO
        $iconHandle = $bitmap.GetHicon()
        $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
        $fileStream = New-Object System.IO.FileStream($fullPath, "Create")
        $icon.Save($fileStream)
        $fileStream.Close()
        # [System.Runtime.InteropServices.Marshal]::DestroyIcon($iconHandle) 
    } else {
        # Save as PNG
        $bitmap.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }

    $graphics.Dispose()
    $bitmap.Dispose()
    
    Write-Host "Generated $filename"
}

# Generate Icons
New-Icon -width 32 -height 32 -text "PR" -filename "32x32.png"
New-Icon -width 128 -height 128 -text "PR" -filename "128x128.png"
New-Icon -width 256 -height 256 -text "PR" -filename "128x128@2x.png"
New-Icon -width 512 -height 512 -text "PR" -filename "icon.png"
New-Icon -width 256 -height 256 -text "PR" -filename "icon.ico" -isIco $true

