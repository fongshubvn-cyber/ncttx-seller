# open-chrome.ps1
$port = 8000
$url = "http://localhost:$port/tinh-dau-10ml-trung-thong.html"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

# Lấy thư mục hiện tại của script
$ScriptDir = $PSScriptRoot
if (!$ScriptDir) {
    $ScriptDir = "e:\Jobs\ncttx-seller-main"
}

# 1. Kiểm tra xem port 8000 đã có server chạy chưa bằng .NET TcpClient
$portOpen = $false
$tcp = New-Object System.Net.Sockets.TcpClient
try {
    $connect = $tcp.BeginConnect("127.0.0.1", $port, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne(200, $false) # Chờ 200ms
    if ($wait) {
        $tcp.EndConnect($connect)
        $portOpen = $true
    }
} catch {}
finally {
    $tcp.Close()
}

if ($portOpen) {
    Write-Output "Server local dang chay san tai port $port."
} else {
    Write-Output "Dang khoi dong server local tai port $port..."
    $ServerScript = Join-Path $ScriptDir "server.ps1"
    
    # Khởi chạy server.ps1 ở chế độ Thu nhỏ (Minimized) thay vì Ẩn (Hidden)
    # Tránh bị Windows Defender hoặc phần mềm diệt virus hiểu lầm và ngăn chặn.
    $command = "`& `"$ServerScript`" > server-out.log 2>&1"
    Start-Process powershell -ArgumentList "-WindowStyle Minimized -ExecutionPolicy Bypass -Command `"$command`"" -WorkingDirectory $ScriptDir -WindowStyle Minimized
    Start-Sleep -Seconds 3
}

# 2. Mở URL bằng Google Chrome
if (Test-Path $chromePath) {
    Write-Output "Dang mo trang web tren Google Chrome..."
    Start-Process $chromePath -ArgumentList $url
} else {
    Write-Output "Khong tim thay Google Chrome, dang mo bang trinh duyet mac dinh..."
    Start-Process $url
}
