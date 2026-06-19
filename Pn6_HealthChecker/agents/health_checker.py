import json
import subprocess
import urllib.request
import urllib.error

class HealthCheckerAgent:
    def __init__(self):
        self.services = ["hermes-gateway", "hermes-dashboard", "hermes-frontend"]
        
    def check_endpoint(self, url):
        try:
            req = urllib.request.Request(url, method="HEAD")
            with urllib.request.urlopen(req, timeout=5) as response:
                return response.status == 200
        except urllib.error.URLError:
            return False
        except Exception:
            return False

    def check_pm2_status(self):
        try:
            result = subprocess.run(
                ["cmd.exe", "/c", "set PATH=C:\\Users\\ismadmin\\AppData\\Local\\hermes\\node;%PATH% && pm2 jlist"],
                capture_output=True,
                text=True,
                check=True
            )
            data = json.loads(result.stdout)
            status_map = {}
            for app in data:
                status_map[app['name']] = app['pm2_env']['status'] == 'online'
            return status_map
        except Exception as e:
            print(f"PM2 Check Failed: {e}")
            return {}

    def run_checks(self):
        print("[HealthCheckerAgent] Starting checks...")
        pm2_status = self.check_pm2_status()
        
        frontend_ok = self.check_endpoint("http://localhost:5173/")
        dashboard_ok = self.check_endpoint("http://127.0.0.1:8501/healthz") or pm2_status.get("hermes-dashboard", False)
        
        # gateway_state.json을 통해 텔레그램 플랫폼의 실제 연결 상태 확인 (단순 프로세스 구동여부 이상 검증)
        import os
        state_path = r"C:\Users\ismadmin\AppData\Local\hermes\gateway_state.json"
        telegram_ok = False
        if os.path.exists(state_path):
            try:
                with open(state_path, 'r', encoding='utf-8') as f:
                    state_data = json.load(f)
                telegram_state = state_data.get("platforms", {}).get("telegram", {}).get("state")
                telegram_ok = (telegram_state == "connected")
                if not telegram_ok:
                    print(f"[HealthCheckerAgent] ⚠️ 텔레그램 게이트웨이가 정지됨 (상태: {telegram_state})")
            except Exception as e:
                print(f"[HealthCheckerAgent] ⚠️ gateway_state.json 조회 실패: {e}")
        
        results = {}
        
        # Gateway (PM2 프로세스가 온라인이고 텔레그램 연결 상태가 connected인 경우만 정상 판정)
        results["gateway"] = pm2_status.get("hermes-gateway", False) and telegram_ok
        
        # Dashboard
        results["dashboard"] = pm2_status.get("hermes-dashboard", False) and dashboard_ok
        
        # Frontend
        results["frontend"] = pm2_status.get("hermes-frontend", False) and frontend_ok
        
        print("[HealthCheckerAgent] Checks completed.")
        return results
