# open_server.py
import http.server
import socketserver
import webbrowser
import os
import socket

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
URL = f"http://localhost:{PORT}/tinh-dau-10ml-trung-thong.html"

# Di chuyển sang thư mục chứa file script
os.chdir(DIRECTORY)

# Kiểm tra xem cổng 8000 đã có ứng dụng nào chạy chưa
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.bind(("127.0.0.1", PORT))
    s.close()
    port_in_use = False
except socket.error:
    port_in_use = True

# Hàm mở trình duyệt Google Chrome
def open_in_chrome():
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if os.path.exists(chrome_path):
        print("Dang mo trang web tren Google Chrome...")
        webbrowser.register('chrome', None, webbrowser.BackgroundBrowser(chrome_path))
        webbrowser.get('chrome').open(URL)
    else:
        print("Khong tim thay Chrome, dang mo bang trinh duyet mac dinh...")
        webbrowser.open(URL)

if not port_in_use:
    print(f"Khoi dong server local tai port {PORT}...")
    open_in_chrome()
    
    # Khởi động HTTP Server của Python
    Handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print("Server dang chay. Dong cua so nay de tat server.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDang tat server...")
            httpd.server_close()
else:
    print("Server local dang chay san. Dang mo link...")
    open_in_chrome()
