import os
import requests
import json

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

def write_report(topic, report_type, toc_json):
    wiki_state = get_wiki_state()
    toc_str = json.dumps(toc_json, indent=2, ensure_ascii=False)
    
    prompt = f"""
    You are the Report Writer Agent. Your task is to write a highly professional report based on the provided Table of Contents (ToC) and the LLM Wiki data.
    
    Topic: {topic}
    Report Type: {report_type}
    
    [TABLE OF CONTENTS TO FOLLOW]
    {toc_str}
    
    [RULES]
    1. DO NOT hallucinate external information. Only use facts present in the [WIKI DIRECTORY STATE].
    2. Write the entire report in Korean language (한국어).
    3. Format according to the Report Type:
       - Deep Dive: Formal, academic, detailed paragraphs.
       - Daily Briefing: Short, concise summaries of new information.
       - Slide Deck: Bullet points, extremely concise, ready for presentation slides.
    4. Provide the final output in beautiful Markdown. Do NOT wrap it in a JSON object. Just return the markdown string.
    
    [WIKI DIRECTORY STATE]
    {wiki_state}
    """
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    try:
        response = requests.post(url, json=payload, timeout=120, verify=False)
        response.raise_for_status()
        result = response.json()
        report = result['candidates'][0]['content']['parts'][0]['text']
        return report
    except Exception as e:
        print(f"Error calling LLM for Writing: {e}")
        return f"Error generating report: {e}"

if __name__ == "__main__":
    # Test placeholder
    pass
