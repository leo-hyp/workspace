import os
import requests
from datetime import datetime

WORKSPACE = r"c:\Users\ismadmin\Documents\Workspace\llm_wiki"
RAW_DIR = os.path.join(WORKSPACE, "raw")
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

def ingest_text(content, source="telegram"):
    os.makedirs(RAW_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{source}.txt"
    filepath = os.path.join(RAW_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return filepath

def send_telegram_reply(chat_id, text):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    requests.post(url, json=payload, timeout=10)

def send_telegram_document(chat_id, filepath, caption=""):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendDocument"
    try:
        with open(filepath, 'rb') as f:
            files = {'document': (os.path.basename(filepath), f, 'text/markdown')}
            data = {'chat_id': chat_id, 'caption': caption}
            requests.post(url, files=files, data=data, timeout=30)
    except Exception as e:
        print(f"[IngestAgent] Error sending document: {e}")

def poll_telegram_updates(offset=None):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    params = {"timeout": 10}
    if offset:
        params["offset"] = offset
        
    try:
        response = requests.get(url, params=params, timeout=15)
        data = response.json()
        
        highest_update_id = None
        pending_commands = []
        if data.get("ok"):
            for update in data.get("result", []):
                update_id = update["update_id"]
                highest_update_id = max(highest_update_id or 0, update_id)
                
                message = update.get("message", {})
                text = message.get("text")
                chat_id = message.get("chat", {}).get("id")
                
                if text and chat_id:
                    if "#report" in text.lower() or "#리포트" in text:
                        print(f"[IngestAgent] Received report command: {text}")
                        topic = text.replace("#report", "").replace("#REPORT", "").replace("#리포트", "").strip()
                        pending_commands.append({"chat_id": chat_id, "topic": topic})
                    # Require a specific hashtag to differentiate from general inquiries/newsletters
                    elif "#위키" in text or "#wiki" in text.lower():
                        print(f"[IngestAgent] Received wiki msg: {text[:30]}...")
                        try:
                            # Remove the hashtag from the text before saving
                            clean_text = text.replace("#위키", "").replace("#wiki", "").replace("#WIKI", "").strip()
                            ingest_text(clean_text, "telegram")
                            send_telegram_reply(chat_id, "📥 [IngestAgent] 지식이 위키에 접수되었습니다! (태그가 제외된 원본이 저장됨)")
                        except Exception as inner_e:
                            print(f"[IngestAgent] Error processing message: {inner_e}")
                        
        return highest_update_id, pending_commands
    except Exception as e:
        print(f"[IngestAgent] Polling error: {e}")
        return None, []
