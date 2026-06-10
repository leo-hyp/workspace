import json
import os
import requests
from datetime import datetime
import sys
import io

# Set encoding to utf-8 to handle emojis and Korean characters on Windows terminals
sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

ENV_PATH = r"C:\Users\ismadmin\AppData\Local\hermes\.env"
OBSIDIAN_VAULT_DIR = r"C:\Users\ismadmin\Documents\ObsidianVault\Medi-IT-Research"

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

def get_gemini_analysis(articles):
    if not GEMINI_API_KEY:
        print("❌ Gemini API Key missing.")
        return None
        
    context = ""
    for idx, art in enumerate(articles[:15], 1): # 최대 15개 최신 기사 전달
        context += f"{idx}. [{art['source']}] {art['title']}\n"
        if art['description']:
            context += f"   요약: {art['description']}\n"
        context += f"   링크: {art['link']}\n\n"
        
    prompt = f"""
당신은 '병원 IT 보안 전문가 및 의료 정보 보호 책임자'입니다. 
아래 수집된 최신 IT, AI 에이전트, 자율 로봇, 보안 사고 관련 뉴스 자료를 바탕으로 레오(LEOHYP)님을 위한 프리미엄 지식 분석 보고서를 작성하십시오.

[작성 지침 및 형식]
1. 결과물은 반드시 완벽하고 격조 높은 한국어(Korean)로 작성하십시오.
2. Obsidian 노트 형식에 호환되도록 가장 최상단에 YAML Frontmatter를 추가하십시오.
   예시:
   ---
   title: "Medi-IT 지능형 기술 & 보안 리서치 보고서"
   date: YYYY-MM-DD
   category: IT-Security
   tags: [AI-Agent, Hospital-IT, Cyber-Security, Autonomous-Robotics]
   ---
3. 본문 구조:
   - 🏷️ **[한줄 핵심 요약]**: 전체 트렌드를 관통하는 한줄 요약 (30자 내외).
   - 📖 **[심층 기술 분석]**: 수집된 주요 기사 3~4개를 종합 분석하여 병원 IT 망 관점에서 주목해야 할 핵심 변화상을 4~5문장으로 분석.
   - 💡 **[병원망 적용 가이드 및 Action Items]**: 의료 IT 인프라 보안 및 효율화에 활용할 수 있는 구체적인 권장 액션 가이드라인 3가지를 도출하여 번호를 매겨 상세 서술.
4. 분석 정보 출처를 표기하기 위해 본문 내에 관련 원본 기사 링크([출처](URL))를 자연스럽게 활용하십시오.

[뉴스 리스트]
{context}
"""

    import time
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    for attempt in range(1, 4):
        try:
            print(f"Calling Gemini API (Attempt {attempt}/3)...")
            res = requests.post(url, json=payload, timeout=45)
            result = res.json()
            if 'candidates' in result:
                raw_text = result['candidates'][0]['content']['parts'][0]['text']
                return raw_text
            elif 'error' in result and result['error'].get('code') in (503, 429):
                print(f"⚠️ Gemini API temporary error (code {result['error'].get('code')}). Retrying in 5s...")
                time.sleep(5)
            else:
                print("❌ Gemini API returns no candidates:", result)
                return None
        except Exception as e:
            print(f"❌ Error calling Gemini API on attempt {attempt}: {e}")
            if attempt < 3:
                time.sleep(3)
    return None

def publish_report(output_dir=None):
    print("💾 [Medi-IT Obsidian Publisher] Starting report generation...")
    if output_dir is None:
        output_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(output_dir, "research_output.json")
    
    if not os.path.exists(input_path):
        print(f"❌ Scraped research data not found at {input_path}")
        return False
        
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    articles = data.get("articles", [])
    if not articles:
        print("⚠️ No articles to analyze.")
        return False
        
    print(f"Analyzing {len(articles)} articles with Gemini Flash...")
    analysis_text = get_gemini_analysis(articles)
    
    if not analysis_text:
        print("❌ Failed to obtain Gemini analysis.")
        return False
        
    # Write to Obsidian Vault
    if not os.path.exists(OBSIDIAN_VAULT_DIR):
        os.makedirs(OBSIDIAN_VAULT_DIR, exist_ok=True)
    now_date = datetime.now().strftime("%Y-%m-%d")
    file_name = f"Medi-IT-Research-Briefing_{now_date}.md"
    output_file_path = os.path.join(OBSIDIAN_VAULT_DIR, file_name)
    
    with open(output_file_path, 'w', encoding='utf-8') as f:
        f.write(analysis_text)
        
    print(f"✅ Obsidian report published successfully to {output_file_path}!")
    
    # Save the text in a temp file in output_dir so that the TTS engine can read it in the next step
    temp_text_path = os.path.join(output_dir, "temp_analysis_text.txt")
    with open(temp_text_path, 'w', encoding='utf-8') as f:
        f.write(analysis_text)
        
    return output_file_path

if __name__ == "__main__":
    publish_report()
