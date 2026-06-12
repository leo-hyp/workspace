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
        
        frontend_ok = self.check_endpoint("http://127.0.0.1:5173/")
        dashboard_ok = self.check_endpoint("http://127.0.0.1:8501/healthz") or pm2_status.get("hermes-dashboard", False)
        
        results = {}
        
        # Gateway
        results["gateway"] = pm2_status.get("hermes-gateway", False)
        
        # Dashboard
        results["dashboard"] = pm2_status.get("hermes-dashboard", False) and dashboard_ok
        
        # Frontend
        results["frontend"] = pm2_status.get("hermes-frontend", False) and frontend_ok
        
        print("[HealthCheckerAgent] Checks completed.")
        return results
