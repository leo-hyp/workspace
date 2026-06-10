import os
import sys
import json
import time
import subprocess
import hashlib

# Fix cp949 encoding issue on Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

INBOX_FILE = os.path.join(os.path.dirname(__file__), 'inbox.json')
OUTBOX_FILE = os.path.join(os.path.dirname(__file__), 'outbox.json')

def show_toast(title, msg):
    ps_cmd = f"""
    [reflection.assembly]::loadwithpartialname("System.Windows.Forms") | Out-Null
    [reflection.assembly]::loadwithpartialname("System.Drawing") | Out-Null
    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Information
    $notify.Visible = $true
    $notify.ShowBalloonTip(10000, "{title}", "{msg}", [System.Windows.Forms.ToolTipIcon]::Info)
    Start-Sleep -Seconds 10
    $notify.Dispose()
    """
    subprocess.run(["powershell", "-command", ps_cmd], creationflags=subprocess.CREATE_NO_WINDOW)

def read_inbox():
    if not os.path.exists(INBOX_FILE):
        return []
    try:
        with open(INBOX_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception as e:
        return []

def main():
    print(f"📡 [Watcher] Monitoring {INBOX_FILE} for new tasks...")
    last_hash = ""
    
    while True:
        try:
            tasks = read_inbox()
            pending_tasks = [t for t in tasks if t.get('status') == 'pending']
            
            if pending_tasks:
                # 간단한 해시로 상태 변경 감지
                current_state = json.dumps(pending_tasks, sort_keys=True)
                current_hash = hashlib.md5(current_state.encode('utf-8')).hexdigest()
                
                if current_hash != last_hash:
                    # 새로운 pending 작업이 들어왔을 때
                    task_titles = "\n".join([f"- {t.get('task', '새로운 작업')}" for t in pending_tasks])
                    msg = f"헤르메스(Telegram)로부터 {len(pending_tasks)}개의 새로운 업무가 위임되었습니다!\nIDE에서 안티그라비티를 호출해 주세요."
                    print(f"🔔 팝업 알림 전송: {len(pending_tasks)}개의 작업 발견!")
                    show_toast("🚨 Antigravity 작업 지시 도착!", msg)
                    last_hash = current_hash
            else:
                last_hash = ""
                
        except Exception as e:
            print(f"Error checking inbox: {e}")
            
        time.sleep(5) # 5초 주기로 감시

if __name__ == "__main__":
    main()
