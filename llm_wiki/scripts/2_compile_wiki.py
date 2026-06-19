import os
import json
import requests
import shutil
from datetime import datetime
import sys
import io

# 콘솔 출력 인코딩 강제
sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

WORKSPACE = r"c:\Users\ismadmin\Documents\Workspace\llm_wiki"
RAW_DIR = os.path.join(WORKSPACE, "raw")
WIKI_DIR = os.path.join(WORKSPACE, "wiki")
ARCHIVE_DIR = os.path.join(WORKSPACE, "raw", "archive")
RULES_PATH = os.path.join(WORKSPACE, "RULES.md")
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
GEMINI_API_KEY = env.get("GEMINI_API_KEY")

def get_wiki_state():
    state = ""
    for filename in os.listdir(WIKI_DIR):
        if filename.endswith(".md"):
            filepath = os.path.join(WIKI_DIR, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                state += f"\n--- [FILE: {filename}] ---\n{content}\n"
    return state

def compile_document(raw_content):
    with open(RULES_PATH, 'r', encoding='utf-8') as f:
        rules = f.read()
    
    wiki_state = get_wiki_state()
    
    prompt = f"""
    {rules}
    
    [WIKI DIRECTORY STATE]
    {wiki_state}
    
    [NEW RAW DOCUMENT]
    {raw_content}
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }
    
    try:
        response = requests.post(url, json=payload, timeout=120, verify=False)
        response.raise_for_status()
        result = response.json()
        raw_text = result['candidates'][0]['content']['parts'][0]['text']
        
        # In case the model returns markdown JSON block, strip it
        clean_text = raw_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.startswith("```"):
            clean_text = clean_text[3:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
            
        try:
            return json.loads(clean_text)
        except json.JSONDecodeError as je:
            print(f"JSON Parsing Error: {je}")
            print(f"--- RAW TEXT ---\n{raw_text}\n----------------")
            return []
            
    except Exception as e:
        print(f"Error calling LLM: {e}")
        return []

def main():
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    if not os.path.exists(RAW_DIR):
        print("Raw directory does not exist.")
        return
        
    compiled_any = False
    for filename in os.listdir(RAW_DIR):
        if filename.endswith(".txt"):
            compiled_any = True
            filepath = os.path.join(RAW_DIR, filename)
            print(f"🔄 Compiling {filename}...")
            
            with open(filepath, 'r', encoding='utf-8') as f:
                raw_content = f.read()
                
            operations = compile_document(raw_content)
            for op in operations:
                action = op.get("action")
                target_file = op.get("filename")
                content = op.get("content")
                
                safe_name = os.path.basename(target_file)
                if not safe_name.endswith(".md"):
                    safe_name += ".md"
                    
                target_path = os.path.join(WIKI_DIR, safe_name)
                
                with open(target_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"  [{action.upper()}] {safe_name}")
            
            shutil.move(filepath, os.path.join(ARCHIVE_DIR, filename))
            print(f"✅ Finished compiling {filename}\n")
            
    if not compiled_any:
        print("ℹ️ No new files to compile in raw/ folder.")

if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    main()
