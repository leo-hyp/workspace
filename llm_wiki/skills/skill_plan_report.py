import os
import json
import requests

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

def get_index_content():
    index_path = os.path.join(WIKI_DIR, "index.md")
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            return f.read()
    return ""

def plan_report(topic, report_type="Deep Dive"):
    index_content = get_index_content()
    
    prompt = f"""
    You are the Report Planner Agent. Your task is to generate a Table of Contents (ToC) for a report.
    
    Topic: {topic}
    Report Type: {report_type}
    
    Based on the following `index.md` of our knowledge base, identify the key areas that need to be covered to write a comprehensive report on the topic.
    If the report_type is "Daily Briefing", focus on recent changes. If "Deep Dive", make it comprehensive. If "Slide Deck", make it bullet-point oriented.
    
    [WIKI INDEX STATE]
    {index_content}
    
    OUTPUT FORMAT:
    Return a valid JSON array of objects, where each object represents a section. Do not include markdown code blocks.
    Example:
    [
      {{"section": "1. Introduction", "description": "Introduce the topic based on Wiki overview."}},
      {{"section": "2. Core Concepts", "description": "Explain key components A and B."}}
    ]
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }
    
    try:
        response = requests.post(url, json=payload, timeout=60, verify=False)
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
            
        return json.loads(clean_text)
    except Exception as e:
        print(f"Error calling LLM for Planning: {e}")
        return []

if __name__ == "__main__":
    # Test
    toc = plan_report("LLM Wiki 활용 방안", "Deep Dive")
    print(json.dumps(toc, indent=2, ensure_ascii=False))
