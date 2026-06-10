import sys
import io
import json
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer
from datetime import datetime

# Windows 터미널 한글 및 이모지 인코딩 우회 설정
sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

PORT = 9119
WEB_DIR = r"c:\Users\ismadmin\Documents\Workspace\news-dashboard"
DEST_PATHS = [
    r"C:\Users\ismadmin\AppData\Local\hermes\news_output.json",
    r"c:\Users\ismadmin\Documents\Workspace\news-dashboard\news_output.json"
]

class DashboardSyncHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # 웹 디렉토리 경로 고정
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_POST(self):
        """대시보드 브라우저에서 긁은 최신 수집 데이터(/sync)를 수신하거나, 라디오 생성 요청을 수신합니다."""
        if self.path == '/sync':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                
                # 데이터 유효성 검증
                parsed_data = json.loads(post_data.decode('utf-8'))
                
                # 수집 시간 보장 및 데이터 동기화 라이팅
                parsed_data["lastUpdated"] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
                for path in DEST_PATHS:
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    with open(path, 'w', encoding='utf-8') as f:
                        json.dump(parsed_data, f, ensure_ascii=False, indent=2)
                    print(f"✅ 대시보드 주도 동기화 데이터 쓰기 성공: {path}")

                # HTTP Response 전송
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                response_json = {"status": "success", "message": "동기화 완료"}
                self.wfile.write(json.dumps(response_json).encode('utf-8'))
                
            except Exception as e:
                print(f"❌ 동기화 중 에러 발생: {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"Error: {e}".encode('utf-8'))
                
        elif self.path == '/radio/generate':
            try:
                print("📻 대시보드로부터 AI 라디오 방송국 빌드 요청 수신!")
                
                import subprocess
                cmd = f"python {os.path.join(WEB_DIR, 'radio_builder.py')}"
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                
                if result.returncode == 0:
                    print("✅ AI 라디오 방송 컴파일 조립 성공!")
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    response_json = {"status": "success", "message": "라디오 생성 완료"}
                    self.wfile.write(json.dumps(response_json).encode('utf-8'))
                else:
                    print(f"❌ 라디오 빌더 비정상 종료: {result.stderr}")
                    raise RuntimeError(result.stderr)
            except Exception as e:
                print(f"❌ 라디오 생성 중 예외 발생: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        """CORS 요청 처리를 위한 preflight 대응"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run_server():
    print("🚀 [Medi-IT 2.0] 대시보드 주도형 동기화 서버 초기화 중...")
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, DashboardSyncHandler)
    print(f"📢 대시보드 호스팅 및 수집 수신 동작 중: http://localhost:{PORT}")
    
    # PID 저장 (백그라운드 제어용)
    pid_file = os.path.join(WEB_DIR, "server_pid.txt")
    with open(pid_file, 'w') as f:
        f.write(str(os.getpid()))
        
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 서버가 종료되었습니다.")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
