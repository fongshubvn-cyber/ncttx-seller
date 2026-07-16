# Simple PowerShell HTTP Server for NCTTX Landing Page
$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Output "HTTP Server started successfully at http://localhost:$port/"
    Write-Output "Your editor (VS Code/Cursor) will auto-forward this port to your local machine."
    Write-Output "Press Ctrl+C in terminal to stop the server."
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $localPath = $request.Url.LocalPath
        
        # Default route to elixir landing page
        if ($localPath -eq "/" -or $localPath -eq "/index.html") {
            $filePath = "e:\Jobs\ncttx-seller-main\elixir-da-lat-ben-hien-nha.html"
        } else {
            # Normalize and clean up path for assets
            $cleanedPath = $localPath.Replace('/', '\').TrimStart('\')
            $filePath = Join-Path "e:\Jobs\ncttx-seller-main" $cleanedPath
        }
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Determine mime types
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "application/octet-stream"
            
            if ($ext -eq ".html" -or $ext -eq ".htm") { $contentType = "text/html; charset=utf-8" }
            elseif ($ext -eq ".css") { $contentType = "text/css; charset=utf-8" }
            elseif ($ext -eq ".js") { $contentType = "application/javascript; charset=utf-8" }
            elseif ($ext -eq ".png") { $contentType = "image/png" }
            elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $contentType = "image/jpeg" }
            elseif ($ext -eq ".svg") { $contentType = "image/svg+xml; charset=utf-8" }
            elseif ($ext -eq ".ico") { $contentType = "image/x-icon" }
            
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $response.ContentType = "text/plain; charset=utf-8"
            $errorMsg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found - File does not exist")
            $response.ContentLength64 = $errorMsg.Length
            $response.OutputStream.Write($errorMsg, 0, $errorMsg.Length)
        }
        $response.OutputStream.Close()
    }
}
catch {
    Write-Error $_
}
finally {
    $listener.Stop()
}
