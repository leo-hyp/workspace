import requests
import time
import sys
import json
import os

ENV_PATH = r"c:\Users\ismadmin\AppData\Local\hermes\.env"

def load_env(path):
    env_vars = {}
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    env_vars[key] = value
    return env_vars

env = load_env(ENV_PATH)
TELEGRAM_BOT_TOKEN = env.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = env.get("TELEGRAM_HOME_CHANNEL")

def send_telegram(text, retries=3):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return False, "❌ Telegram 설정 누락"
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    
    backoff = 2
    for attempt in range(retries):
        try:
            response = requests.post(url, json=payload, timeout=15)
            if response.status_code == 200:
                return True, "✅ 텔레그램 전송 성공!"
            elif response.status_code == 429:
                time.sleep(backoff)
                backoff *= 2
            else:
                return False, f"❌ 전송 실패: {response.text}"
        except Exception as e:
            if attempt == retries - 1:
                return False, f"❌ 예외 발생: {e}"
            time.sleep(backoff)
            backoff *= 2

if __name__ == "__main__":
    input_text = sys.stdin.read()
    if input_text:
        success, msg = send_telegram(input_text)
        print(msg)
        if not success:
            sys.exit(1)
