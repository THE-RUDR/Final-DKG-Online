# DKG Online - Built-in Windows HTTP Web Server with shared data

$port = 8001
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

function Send-JsonResponse {
    param([System.Net.HttpListenerResponse]$Response, [int]$StatusCode, [object]$Body)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "application/json; charset=utf-8"
    $json = $Body | ConvertTo-Json -Depth 20
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Read-RequestJson {
    param([System.Net.HttpListenerRequest]$Request)
    $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
    $body = $reader.ReadToEnd()
    $reader.Close()
    if ([string]::IsNullOrWhiteSpace($body)) { return $null }
    return $body | ConvertFrom-Json
}

function Get-SharedDbPath {
    return (Join-Path $PSScriptRoot "shared-db.json")
}

function Handle-SharedDbGet {
    param([System.Net.HttpListenerResponse]$Response)
    $dbPath = Get-SharedDbPath
    if (!(Test-Path $dbPath -PathType Leaf)) {
        Send-JsonResponse -Response $Response -StatusCode 404 -Body @{ success = $false; error = "Shared database is not initialized yet." }
        return
    }

    try {
        $json = Get-Content -LiteralPath $dbPath -Raw
        $data = $json | ConvertFrom-Json
        Send-JsonResponse -Response $Response -StatusCode 200 -Body $data
    }
    catch {
        Send-JsonResponse -Response $Response -StatusCode 500 -Body @{ success = $false; error = $_.Exception.Message }
    }
}

function Handle-SharedDbPost {
    param([System.Net.HttpListenerRequest]$Request, [System.Net.HttpListenerResponse]$Response)
    try {
        $payload = Read-RequestJson -Request $Request
        if (!$payload -or !$payload.data) {
            Send-JsonResponse -Response $Response -StatusCode 400 -Body @{ success = $false; error = "Missing shared database payload." }
            return
        }

        if (!$payload.updatedAt) {
            $payload | Add-Member -NotePropertyName updatedAt -NotePropertyValue ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -Force
        }
        $payload | Add-Member -NotePropertyName success -NotePropertyValue $true -Force

        $dbPath = Get-SharedDbPath
        $json = $payload | ConvertTo-Json -Depth 20
        [System.IO.File]::WriteAllText($dbPath, $json, [System.Text.Encoding]::UTF8)
        Send-JsonResponse -Response $Response -StatusCode 200 -Body @{ success = $true; updatedAt = $payload.updatedAt }
    }
    catch {
        Send-JsonResponse -Response $Response -StatusCode 500 -Body @{ success = $false; error = $_.Exception.Message }
    }
}

function Get-ContentType {
    param([string]$FilePath)
    if ($FilePath.EndsWith(".html")) { return "text/html; charset=utf-8" }
    if ($FilePath.EndsWith(".css")) { return "text/css; charset=utf-8" }
    if ($FilePath.EndsWith(".js")) { return "application/javascript; charset=utf-8" }
    if ($FilePath.EndsWith(".png")) { return "image/png" }
    if ($FilePath.EndsWith(".jpg") -or $FilePath.EndsWith(".jpeg")) { return "image/jpeg" }
    if ($FilePath.EndsWith(".svg")) { return "image/svg+xml" }
    if ($FilePath.EndsWith(".json")) { return "application/json; charset=utf-8" }
    if ($FilePath.EndsWith(".webmanifest")) { return "application/manifest+json; charset=utf-8" }
    return "application/octet-stream"
}

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "           DKG ONLINE ATTENDANCE TRACKER          " -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting local web server with shared attendance data..." -ForegroundColor Cyan

try {
    $listener.Start()
    Write-Host "Server successfully started on http://localhost:$port/" -ForegroundColor Green
    Write-Host "Opening DKG Online in your browser..." -ForegroundColor Green
    Write-Host "Press Ctrl+C in this window to stop the server." -ForegroundColor Yellow
    Write-Host ""
    Start-Process "http://localhost:$port/"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        $path = $request.Url.LocalPath

        try {
            if ($path -eq "/api/shared-db") {
                if ($request.HttpMethod -eq "GET") {
                    Handle-SharedDbGet -Response $response
                    Write-Host "[API] shared DB loaded" -ForegroundColor Cyan
                    continue
                }
                if ($request.HttpMethod -eq "POST") {
                    Handle-SharedDbPost -Request $request -Response $response
                    Write-Host "[API] shared DB saved" -ForegroundColor Cyan
                    continue
                }
            }

            if ($path -eq "/" -or [string]::IsNullOrEmpty($path)) { $path = "/index.html" }
            $cleanPath = $path.TrimStart('/')
            $filePath = Join-Path $PSScriptRoot $cleanPath

            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = Get-ContentType -FilePath $filePath
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host "[200] served: $path" -ForegroundColor Gray
            }
            else {
                $response.StatusCode = 404
                $response.StatusDescription = "Not Found"
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - File Not Found")
                $response.ContentLength64 = $msg.Length
                $response.OutputStream.Write($msg, 0, $msg.Length)
                Write-Host "[404] not found: $path" -ForegroundColor Red
            }
        }
        finally {
            $response.Close()
        }
    }
}
catch {
    Write-Host "Error starting server: $_" -ForegroundColor Red
}
finally {
    if ($listener.IsListening) { $listener.Stop() }
    Write-Host "Server stopped." -ForegroundColor Yellow
}

