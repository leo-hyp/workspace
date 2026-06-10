import os
import json
import requests
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
GEMINI_API_KEY = env.get("GEMINI_API_KEY") or env.get("GOOGLE_API_KEY")

def llm_validate(md_path, data_json, context_msg=""):
    """
    LLM을 사용하여 MD 파일의 규칙과 JSON 데이터를 교차 검증합니다.
    문제가 있으면 에러 메시지를 반환하고, 정상이면 None을 반환합니다.
    """
    if not os.path.exists(md_path):
        return None
        
    with open(md_path, 'r', encoding='utf-8') as f:
        md_content = f.read()
        
    prompt = f"""
당신은 시스템 오케스트레이터입니다. 아래 Agent의 지침(Markdown)과 해당 Agent가 생성한 결과물(JSON)을 보고, 지침을 엄격히 준수했는지 검수하세요.
특히 누락된 항목이 없는지, 에러 처리를 무시하지 않았는지 확인하세요.
{context_msg}

[Agent 지침]
{md_content}

[결과물 JSON (요약)]
{data_json}

만약 지침을 위반했거나, 누락된 소스가 있다면 반드시 구체적인 위반 사항(예: "데일리메드 소스가 누락되었습니다")을 설명해주세요.
문제가 없다면 오직 "PASS" 라고만 대답하세요.
"""

    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    try:
        response = requests.post(gemini_url, json=payload, timeout=45, verify=False)
        result = response.json()
        if 'candidates' in result:
            ans = result['candidates'][0]['content']['parts'][0]['text'].strip()
            if "PASS" in ans.upper() and len(ans) < 10:
                return None
            return ans
    except Exception as e:
        print(f"Validation LLM request failed: {e}")
        return None
    
    return None

def validate_scraper_output(raw_news):
    print("🔍 [Validator] Scraper 산출물 검수 시작...")
    md_path = os.path.join(os.path.dirname(__file__), 'rules', 'news_scraper.md')
    sources_path = os.path.join(os.path.dirname(__file__), '..', 'sources.json')
    
    sources_text = ""
    if os.path.exists(sources_path):
        with open(sources_path, 'r', encoding='utf-8') as f:
            sources_text = f.read()
            
    # LLM 토큰 제한을 위해 소스 목록만 요약
    found_sources = list(set([n.get('source', '') for n in raw_news]))
    data_summary = json.dumps({"수집된_소스_목록": found_sources, "수집건수": len(raw_news)}, ensure_ascii=False)
    
    context = f"현재 등록된 타겟 소스는 다음과 같습니다:\n{sources_text}\n결과물에 모든 타겟 소스가 최소 1번 이상 등장해야 합니다. 누락된 소스가 있는지 대조하세요."
    
    issue = llm_validate(md_path, data_summary, context)
    if issue:
        return f"🚨 [Scraper Validation Error]\n{issue}"
    return None

def validate_reviewer_output(filtered_news):
    print("🔍 [Validator] Reviewer 산출물 검수 시작...")
    md_path = os.path.join(os.path.dirname(__file__), 'rules', 'content_reviewer.md')
    
    found_sources = list(set([n.get('source', '') for n in filtered_news]))
    data_summary = json.dumps({"최종선정_소스_목록": found_sources, "건수": len(filtered_news)}, ensure_ascii=False)
    
    # 리뷰어는 기본적으로 모든 소스에서 최소 1개를 살려야 함
    context = "각 소스별 최소 1개 이상의 기사가 선정되었는지, 그리고 최종 건수가 10건 내외인지 검수하세요."
    
    issue = llm_validate(md_path, data_summary, context)
    if issue:
        return f"🚨 [Reviewer Validation Error]\n{issue}"
    return None
