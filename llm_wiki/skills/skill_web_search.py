import os
import requests
import json
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

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

def web_search(question):
    """
    외부 구글 검색을 수행하여 팩트 기반의 답변을 생성합니다.
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    prompt = f"""
    당신은 최신 외부 지식을 검색하여 팩트를 수집하는 'Scout Agent'입니다.
    사용자의 질문에 대해 구글 웹 검색을 수행하고, 찾은 정보를 종합하여 상세하게 답변해주세요.
    반드시 한국어(Korean)로 답변해야 합니다.
    
    [질문]
    {question}
    """
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"googleSearch": {}}]
    }
    
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
            return f"외부 웹 검색 중 오류가 발생했습니다: {e}"

if __name__ == "__main__":
    print(web_search("안드레 카파시의 가장 최근 행보는 뭐야?"))
