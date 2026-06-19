import os
import sys
import requests
import json
import io

sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

WORKSPACE = r"c:\Users\ismadmin\Documents\Workspace\llm_wiki"
WIKI_DIR = os.path.join(WORKSPACE, "wiki")
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

def generate_report(topic):
    wiki_state = get_wiki_state()
    prompt = f"""
    You are an expert researcher and report writer. Use the following [WIKI DIRECTORY STATE] to write a comprehensive report on the topic: "{topic}".
    Do NOT use external knowledge. Only use the facts present in the wiki. If the wiki does not contain enough information, state that clearly.
    Output the report in professional Markdown format.
    CRITICAL: Write the entire report in Korean language by default, unless the user's topic explicitly asks for another language.
    
    [WIKI DIRECTORY STATE]
    {wiki_state}
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    try:
        response = requests.post(url, json=payload, timeout=60, verify=False)
        response.raise_for_status()
        result = response.json()
        report = result['candidates'][0]['content']['parts'][0]['text']
        return report
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    import urllib3
    from datetime import datetime
    import re
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    if len(sys.argv) > 1:
        topic = " ".join(sys.argv[1:])
        print(f"📊 Generating report on: {topic}...\n")
        report = generate_report(topic)
        
        # Save to reports directory
        REPORTS_DIR = os.path.join(WORKSPACE, "reports")
        os.makedirs(REPORTS_DIR, exist_ok=True)
        
        # Extract the first H1 title from the report to use as filename
        first_line = report.strip().split('\n')[0]
        title_for_filename = topic
        if first_line.startswith('# '):
            title_for_filename = first_line[2:].strip()
            
        # Create a safe filename from the title
        safe_title = re.sub(r'[^a-zA-Z0-9가-힣]', '_', title_for_filename)[:50].strip('_')
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{safe_title}.md"
        filepath = os.path.join(REPORTS_DIR, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report)
            
        print(f"✅ Report saved to: {filepath}")
    else:
        print("❌ Provide a topic: python 3_generate_report.py 'Your Topic'")
