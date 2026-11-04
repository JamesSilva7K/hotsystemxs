Add-Type -AssemblyName System.Drawing
function Make-Icon([int]$sz, [string]$dest) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#0b0d11'))
    $g.FillRectangle($bgBrush, 0, 0, $sz, $sz)
    
    $neonBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#d4f933'))
    [float]$s = [float]$sz / 64.0
    
    [System.Drawing.PointF[]]$pts = @(
        (New-Object System.Drawing.PointF((36.0 * $s), (6.0 * $s))),
        (New-Object System.Drawing.PointF((16.0 * $s), (36.0 * $s))),
        (New-Object System.Drawing.PointF((29.0 * $s), (36.0 * $s))),
        (New-Object System.Drawing.PointF((26.0 * $s), (58.0 * $s))),
        (New-Object System.Drawing.PointF((48.0 * $s), (26.0 * $s))),
        (New-Object System.Drawing.PointF((34.0 * $s), (26.0 * $s))),
        (New-Object System.Drawing.PointF((36.0 * $s), (6.0 * $s)))
    )
    $g.FillPolygon($neonBrush, $pts)
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created $dest ($sz x $sz)"
}

Make-Icon 192 "public/icon-192.png"
Make-Icon 512 "public/icon-512.png"
Make-Icon 180 "public/apple-touch-icon.png"
