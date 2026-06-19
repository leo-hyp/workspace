import os
import json
import requests
import shutil
from datetime import datetime

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
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    prompt = f"""
    {rules}
    
    [CURRENT TIME]
    {current_time}
    
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
            return []
    except Exception as e:
        print(f"Error calling LLM: {e}")
        return []

def compile_all():
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    if not os.path.exists(RAW_DIR):
        return 0
        
    compiled_count = 0
    
    for filename in os.listdir(RAW_DIR):
        if filename.endswith(".txt"):
            filepath = os.path.join(RAW_DIR, filename)
            print(f"[CompileAgent] 🔄 Compiling {filename}...")
            
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
            compiled_count += 1
            print(f"[CompileAgent] ✅ Finished compiling {filename}\n")
            
    return compiled_count
