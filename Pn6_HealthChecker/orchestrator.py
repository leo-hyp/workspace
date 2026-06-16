import time
import sys
import subprocess

from agents.health_checker import HealthCheckerAgent

def send_toast(title, message):
    ps_script = f"""
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
    [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null
    $template = @"
    <toast>
        <visual>
            <binding template="ToastText02">
                <text id="1">{title}</text>
                <text id="2">{message}</text>
            </binding>
        </visual>
    </toast>
"@
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($template)
    $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Hermes Secretary").Show($toast)
    """
    try:
        subprocess.run(["powershell", "-Command", ps_script], capture_output=True)
    except Exception as e:
        print(f"[Orchestrator] Failed to send toast notification: {e}")

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    print("[Orchestrator] Pn6_HealthChecker started.")
    
    results = {}
    try:
        # 1. Execute Sub-Agent
        print("[Orchestrator] Delegating to HealthCheckerAgent...")
        checker = HealthCheckerAgent()
        results = checker.run_checks()
        
        # 2. Validate outputs
        if not isinstance(results, dict) or len(results) == 0:
            raise ValueError("Health checker returned empty or invalid results.")
            
    except Exception as e:
        print(f"[Orchestrator] 🚨 Sub-agent error caught: {e}")
        # Orchestrator handles the failure gracefully
        results = {"gateway": False, "dashboard": False, "frontend": False, "error": str(e)}

    # 3. Final Validation & Reporting (Orchestrator's direct responsibility)
    print("[Orchestrator] Generating final report...")
    report_lines = []
    
    if "error" in results:
        report_lines.append(f"⚠️ Internal Error: {results['error']}")
        
    report_lines.append("✅ Gateway: Online" if results.get("gateway") else "❌ Gateway: Offline or not responding")
    report_lines.append("✅ Dashboard: Online" if results.get("dashboard") else "❌ Dashboard: Offline or not responding")
    report_lines.append("✅ Frontend: Online" if results.get("frontend") else "❌ Frontend: Offline or not responding")
    
    report_message = "\n".join(report_lines)
    print(report_message)
    
    # Determine overall status
    if all(v is True for k, v in results.items() if k != "error") and "error" not in results:
        title = "🔴🔑 Hermes System: All Systems Operational"
    else:
        title = "🔴🔑 Hermes System: Attention Required!"
        
    # send_toast(title, report_message) # 팝업 알람 제거 (사용자 요청)
    print("[Orchestrator] Pipeline execution completed and reported to log (Toast Notification Disabled).")

if __name__ == "__main__":
    main()
