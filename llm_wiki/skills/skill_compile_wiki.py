import os
import json
import requests
import shutil
import base64
import mimetypes
import uuid
from datetime import datetime
from skills import skill_vector_db

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

def compile_document(filepath):
    with open(RULES_PATH, 'r', encoding='utf-8') as f:
        rules = f.read()
    
    wiki_state = get_wiki_state()
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    mime_type, _ = mimetypes.guess_type(filepath)
    if not mime_type:
        mime_type = "text/plain"
        
    parts = []
    
    if mime_type.startswith("text/") or mime_type in ["application/json", "application/xml", "application/csv"] or filepath.endswith(".md"):
        # For text files, read content directly
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                raw_content = f.read()
        except UnicodeDecodeError:
            print(f"Failed to read {filepath} as utf-8 text. Skipping.")
            return []
            
        prompt = f"""
        {rules}
        
        [CURRENT TIME]
        {current_time}
        
        [WIKI DIRECTORY STATE]
        {wiki_state}
        
        [NEW RAW DOCUMENT]
        {raw_content}
        """
        parts.append({"text": prompt})
    else:
        # For PDF and Image files, use inlineData (multimodal)
        try:
            with open(filepath, 'rb') as f:
                b64_data = base64.b64encode(f.read()).decode('utf-8')
        except Exception as e:
            print(f"Failed to read {filepath} as binary. Error: {e}")
            return []
            
        prompt = f"""
        {rules}
        
        [CURRENT TIME]
        {current_time}
        
        [WIKI DIRECTORY STATE]
        {wiki_state}
        
        [NEW RAW DOCUMENT]
        The new raw document is provided as an attached multimodal file (e.g., PDF or Image). 
        Please thoroughly analyze and extract the information from the attached file, 
        and compile it into the wiki according to the rules.
        """
        parts.append({"text": prompt})
        parts.append({
            "inlineData": {
                "mimeType": mime_type,
                "data": b64_data
            }
        })
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": parts}],
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
    valid_extensions = [".txt", ".md", ".csv", ".pdf", ".png", ".jpg", ".jpeg", ".webp"]
    
    for filename in os.listdir(RAW_DIR):
        filepath = os.path.join(RAW_DIR, filename)
        if os.path.isfile(filepath):
            ext = os.path.splitext(filename)[1].lower()
            if ext in valid_extensions:
                print(f"[CompileAgent] 🔄 Compiling {filename} (Type: {ext})...")
                
                operations = compile_document(filepath)
                if not operations:
                    print(f"[CompileAgent] ⚠️ No operations returned for {filename}")
                    
                for op in operations:
                    action = op.get("action")
                    target_file = op.get("filename")
                    content = op.get("content")
                    
                    if not target_file: continue
                    
                    safe_name = os.path.basename(target_file)
                    # Force spaces instead of underscores for Obsidian compatibility
                    safe_name = safe_name.replace("_", " ")
                    if not safe_name.endswith(".md"):
                        safe_name += ".md"
                        
                    target_path = os.path.join(WIKI_DIR, safe_name)
                    
                    with open(target_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"  [{action.upper()}] {safe_name}")
                    
                    # Vector DB에 청크 인덱싱 (데이터 프로비넌스)
                    # content 내용을 바로 넣지 않고, 의미있는 문단 단위로 잘라도 좋지만, 
                    # LLM이 요약해준 단위 자체가 하나의 지식이므로 통째로 청크화합니다.
                    chunk_id = f"{filename}_{uuid.uuid4().hex[:8]}"
                    skill_vector_db.add_documents(
                        texts=[content],
                        metadatas=[{"source": filename, "target_md": safe_name}],
                        ids=[chunk_id]
                    )
                
                shutil.move(filepath, os.path.join(ARCHIVE_DIR, filename))
                compiled_count += 1
                print(f"[CompileAgent] ✅ Finished compiling {filename}\n")
            
    return compiled_count

if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    compile_all()
