import os
import requests
import json
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

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
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    state += f"\n--- [FILE: {filename}] ---\n{content}\n"
            except Exception:
                pass
    return state

def ask_wiki(question):
    wiki_state = get_wiki_state()
    
    prompt = f"""
    You are the 'LLM Wiki QA Agent'. Your job is to answer the user's question based ONLY on the provided [WIKI DIRECTORY STATE].
    
    [RULES]
    1. Base your answer strictly on the facts present in the wiki. Do NOT hallucinate or bring in outside information.
    2. If the wiki does not contain the answer, politely state that the information is not currently present in the LLM Wiki.
    3. Always reply in fluent Korean (한국어).
    4. Provide specific references to the file names (e.g., '`Andrej Karpathy.md` 문서에 따르면...') when applicable.
    
    [QUESTION]
    {question}
    
    [WIKI DIRECTORY STATE]
    {wiki_state}
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    try:
        response = requests.post(url, json=payload, timeout=60, verify=False)
        response.raise_for_status()
        result = response.json()
        return result['candidates'][0]['content']['parts'][0]['text']
    except Exception as e:
        return f"지식망 검색 중 오류가 발생했습니다: {e}"

if __name__ == "__main__":
    print(ask_wiki("LLM Wiki와 기존 RAG의 차이점이 뭐야?"))
