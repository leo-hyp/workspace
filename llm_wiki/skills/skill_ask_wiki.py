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

from skills import skill_vector_db

def get_relevant_context(question):
    """
    Vector DB에서 질문과 관련된 청크를 검색하고 원본 문서를 통째로 반환합니다.
    """
    docs, metadatas = skill_vector_db.query_documents(question, n_results=5)
    
    if not docs:
        return "관련 문서를 찾을 수 없습니다."
        
    unique_files = set()
    for meta in metadatas:
        if meta and 'target_md' in meta:
            unique_files.add(meta['target_md'])
            
    context = ""
    for filename in unique_files:
        filepath = os.path.join(WIKI_DIR, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            context += f"\n=== [문서 원문: {filename}] ===\n{content}\n"
            
    if not context:
        for idx, text in enumerate(docs, 1):
            context += f"\n--- [검색된 문서 조각 {idx}] ---\n{text}\n"
            
    return context

def ask_wiki(question):
    context = get_relevant_context(question)
    
    prompt = f"""
    You are the 'LLM Wiki QA Agent'. Your job is to answer the user's question based ONLY on the provided [RELEVANT CONTEXT] retrieved from the Vector DB.
    
    [RULES]
    1. Base your answer strictly on the facts present in the [RELEVANT CONTEXT]. Do NOT hallucinate or bring in outside information.
    2. If the context does not contain sufficient information to fully answer the question, answer what you can, and MUST add the exact tag [NEED_WEB_SEARCH] at the very end of your response.
    3. Always reply in fluent Korean (한국어).
    4. Provide specific references (e.g., '검색된 문서에 따르면...') when applicable.
    
    [QUESTION]
    {question}
    
    [RELEVANT CONTEXT]
    {context}
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    import time
    for attempt in range(3):
        try:
            response = requests.post(url, json=payload, timeout=60, verify=False)
            response.raise_for_status()
            result = response.json()
            return result['candidates'][0]['content']['parts'][0]['text']
        except Exception as e:
            if attempt < 2:
                time.sleep(2)
                continue
            return f"지식망 검색 중 오류가 발생했습니다: {e}"

if __name__ == "__main__":
    print(ask_wiki("LLM Wiki와 기존 RAG의 차이점이 뭐야?"))
