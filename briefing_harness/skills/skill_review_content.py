import requests
import json
import os
import urllib.parse
from datetime import datetime

ENV_PATH = r"c:\Users\ismadmin\AppData\Local\hermes\.env"
BOT_USERNAME = "Hos_it_man_bot"

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

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def format_ai_response(text):
    lines = text.strip().split('\n')
    formatted_lines = []
    for line in lines:
        if line.strip() and (line.strip()[0].isdigit() and '.' in line[:3]):
            q_text = line.split('.', 1)[1].strip().replace('*', '').replace('_', '')
            encoded_q = urllib.parse.quote(q_text)
            link = f"https://t.me/share/url?url=https://t.me/{BOT_USERNAME}&text={encoded_q}"
            formatted_lines.append(f"{line.split('.', 1)[0]}. <a href='{link}'>{q_text}</a> 👈 (질문하기)")
        else:
            formatted_lines.append(line.replace('<', '&lt;').replace('>', '&gt;'))
    return '\n'.join(formatted_lines)

def get_ai_insight(news_list):
    context = "\n".join([f"- {n['title']} ({n['source']})" for n in news_list[:12]])
    prompt = f"""
당신은 '병원 IT 보안 전문가'입니다. 아래 뉴스 목록을 분석하여 브리핑을 완성하세요.
[요구사항]
1. 🏷️ [한줄 핵심]: (15자 이내 요약)
2. 📖 [심층 분석]: (병원 IT 관리자가 주목해야 할 점을 3~4문장으로 분석)
3. 🙋‍♂️ [궁금하실 수 있는 질문]: (질문 3개를 번호 매겨 리스트 형태로 작성)

[뉴스 목록]
{context}
"""
    local_url = "http://10.60.90.230:6789/v1/chat/completions"
    local_payload = {
        "model": "gemma-4-e4b-it",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3
    }
    
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    gemini_payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    try:
        # [우선순위 1] 온프레미스 환경 (Gemma 4)을 최대한 활용하여 토큰 비용 절감
        # 로컬 서버 부하를 고려해 타임아웃을 60초로 넉넉하게 부여
        response = requests.post(local_url, json=local_payload, timeout=60, verify=False)
        result = response.json()
        if 'choices' in result and len(result['choices']) > 0:
            raw_text = result['choices'][0]['message']['content']
            return format_ai_response(raw_text)
        else:
            raise KeyError("choices")
    except Exception as e:
        print(f"⚠️ [Reviewer] 로컬 Gemma 모델 응답 실패, Gemini 3.5 Flash 엔진으로 폴백합니다. ({e})")
        # [우선순위 2] 상용 클라우드 환경 (Gemini 3.5 Flash)으로 안전하게 대체 (Fallback)
        try:
            response = requests.post(gemini_url, json=gemini_payload, timeout=20, verify=False)
            result = response.json()
            if 'candidates' in result:
                raw_text = result['candidates'][0]['content']['parts'][0]['text']
                return format_ai_response(raw_text)
            else:
                raise KeyError("candidates")
        except Exception:
            fallback_text = (
                "🏷️ [한줄 핵심]: 실시간 뉴스 동기화 및 2.0 업그레이드 완료\n\n"
                "📖 [심층 분석]: AI 분석 엔진 오류로 인해 임시 템플릿으로 대체되었습니다.\n\n"
                "🙋‍♂️ [궁금하실 수 있는 질문]\n"
                "1. 임시 템플릿 사용 중입니다.\n"
                "2. AI 연동 상태를 확인해주세요.\n"
                "3. 로컬 엔진도 응답이 없습니다."
            )
            return format_ai_response(fallback_text)

def generate_briefing(news_list):
    if not news_list:
        return "⚠️ 유효한 뉴스가 없습니다."

    unique_news = {n['title']: n for n in news_list}.values()
    unique_news = list(unique_news)[:10]

    now_date = datetime.now().strftime('%Y-%m-%d')
    header = f"⚕️ <b>Medi-IT Intelligence Briefing ({now_date})</b>\n"
    header += "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n\n"
    
    news_body = ""
    for i, n in enumerate(unique_news[:7], 1):
        color_emoji = "🔵"
        if "보안" in n['source'] or "사고" in n['title']: color_emoji = "🔴"
        elif "메드" in n['source'] or "의협" in n['source'] or "병원" in n['title']: color_emoji = "🟢"
        
        safe_title = n['title'].replace('<', '&lt;').replace('>', '&gt;')
        safe_desc = n['description'].replace('<', '&lt;').replace('>', '&gt;')
        
        news_body += f"{color_emoji} <b>{safe_title}</b>\n"
        news_body += f"   <i>{n['source']}</i> | {safe_desc}\n"
        news_body += f"   🔗 <a href='{n['link']}'>기사 읽기</a>\n\n"
    
    ai_content = get_ai_insight(list(unique_news))
    
    footer = "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n"
    footer += f"💡 <b>전문가 인사이트</b>\n{ai_content}\n\n"
    footer += "<i>위 질문을 클릭하시면 바로 저에게 질문을 보낼 수 있습니다!</i>"
    
    return header + news_body + footer

if __name__ == "__main__":
    import sys
    input_data = sys.stdin.read()
    if input_data:
        news = json.loads(input_data)
        print(generate_briefing(news))
