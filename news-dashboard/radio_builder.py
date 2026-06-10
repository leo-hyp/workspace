import os
import sys
import io
import json
import re
import asyncio
import requests
import edge_tts
from datetime import datetime

# Windows 터미널 한글 및 이모지 인코딩 우회 설정
sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

# 경로 설정
NEWS_JSON_PATH = r"C:\Users\ismadmin\AppData\Local\hermes\news_output.json"
OUTPUT_MP3_PATH = r"c:\Users\ismadmin\Documents\Workspace\news-dashboard\medi_it_radio.mp3"
ENV_PATH = r"c:\Users\ismadmin\AppData\Local\hermes\.env"

# DJ 목소리 설정
VOICE_LEO = "ko-KR-InJoonNeural"      # 남성 보이스 (지적이고 깐깐함)
VOICE_ANTI = "ko-KR-SunHiNeural"      # 여성 보이스 (귀엽고 앙큼함)

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

def get_latest_news_context():
    """뉴스 데이터를 읽어 AI 대본 창작을 위한 컨텍스트를 구성합니다."""
    if not os.path.exists(NEWS_JSON_PATH):
        return "수집된 뉴스가 없습니다."
    
    try:
        with open(NEWS_JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        news_items = data.get('news', [])[:5]  # 상위 5대 뉴스만 컴팩트하게 라디오 대본화
        
        context = ""
        for i, item in enumerate(news_items, 1):
            context += f"{i}. [{item.get('source')}] {item.get('title')} - 요약: {item.get('description')}\n"
        return context
    except Exception as e:
        print(f"뉴스 컨텍스트 구성 에러: {e}")
        return "뉴스 컨텍스트 구성에 실패했습니다."

def generate_radio_ssml(news_context):
    """Gemini 3.5 엔진을 활용해 두 DJ의 티격태격 드립이 섞인 완벽한 SSML XML 대본을 창작합니다."""
    print("🧠 [Gemini 3.5] 두 DJ의 1인 라디오 대본 창작 시작...")
    
    prompt = f"""
당신은 '개인용 AI 라디오 방송국'의 극본 작가입니다. 아래 제공된 5대 뉴스 리스트를 바탕으로, 두 DJ가 대화식으로 유쾌하고 유머러스하게 테크 뉴스를 소개해 주는 라디오 스크립트를 작성해야 합니다.

[DJ 캐릭터 설정]
1. LEO(레오): 테크 평론가. 냉철하고 깐깐하며 분석적인 지적인 남성. 말투는 정중하면서도 날카롭습니다.
2. 안티그라비티(안티): AI 비서. 앙큼하고 장난기가 있으며, 레오의 깐깐함을 위트 있게 넘기는 귀여운 여성.

[출력 요구사항]
1. 반드시 아래의 'SSML XML' 형식만을 온전히 출력해야 합니다. 어떠한 앞뒤 설명이나 마크다운 백틱(```xml)도 절대 붙이지 말고 순수 XML 문자열만 출력하세요.
2. 두 DJ가 번갈아 가며 티격태격 대화를 나누는 만담 형식이어야 하며, 5대 뉴스의 핵심 사항을 유머러스한 드립과 함께 풀어내야 합니다.
3. 한국어 Neural 보이스 설정에 맞추어 아래의 태그 구조를 오차 없이 지키세요:
   - LEO의 대사: <voice name="ko-KR-InJoonNeural">대사내용</voice>
   - 안티의 대사: <voice name="ko-KR-SunHiNeural">대사내용</voice>
4. 각 대사 사이에는 <break time="800ms"/> 또는 <break time="1s"/> 태그를 적재적소에 넣어 대화의 호흡이 자연스럽게 하세요.

[제공된 뉴스 목록]
{news_context}

[SSML 출력 시작 템플릿]
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">
  <voice name="ko-KR-InJoonNeural">레오 첫인사</voice>
  <break time="800ms"/>
  <voice name="ko-KR-SunHiNeural">안티 첫인사</voice>
  <!-- 여기에 계속해서 두 DJ의 대사 교차 배치 -->
</speak>
"""
    # Gemini 3.5 Flash(High) 혹은 최신 Flash 모델 호출
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    try:
        response = requests.post(url, json=payload, timeout=40)
        result = response.json()
        raw_text = result['candidates'][0]['content']['parts'][0]['text']
        
        # 앞뒤 불필요한 마크다운 백틱이나 문자열 정제
        clean_ssml = raw_text.strip()
        clean_ssml = re.sub(r'^```xml', '', clean_ssml)
        clean_ssml = re.sub(r'^```html', '', clean_ssml)
        clean_ssml = re.sub(r'```$', '', clean_ssml).strip()
        
        # 필수 구조 보장 검증
        if not clean_ssml.startswith("<speak"):
            raise ValueError("생성된 텍스트가 올바른 SSML 시작 구조가 아닙니다.")
            
        print("✅ [Gemini 3.5] 극본 조립 성공!")
        return clean_ssml
    except Exception as e:
        print(f"대본 생성 에러: {e}")
        # 오류 시 기본 Fallback 대본 자동 적용
        fallback_ssml = f"""<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ko-KR">
  <voice name="{VOICE_LEO}">안녕하십니까! 5분 테크 라디오 브리핑의 진행을 맡은 평론가 레오입니다.</voice>
  <break time="800ms"/>
  <voice name="{VOICE_ANTI}">안녕하세요! 레오 님의 귀여운 조수이자 인공지능 비서 안티그라비티입니다. 오늘 대고도화 연동으로 뉴스 대시보드가 2.0으로 멋지게 바뀌었네요!</voice>
  <break time="1s"/>
  <voice name="{VOICE_LEO}">그렇습니다. 아주 깔끔하고 쾌적하게 2.0 시스템이 이식되었죠. 오늘 준비된 소식들은 텔레그램 질문 포워딩 딥링크 패치 성공과 영문 기사의 철저한 필터링입니다.</voice>
  <break time="800ms"/>
  <voice name="{VOICE_ANTI}">맞아요 레오 님! 그리고 이 앙큼한 라디오 음성까지 이제 브라우저에서 버튼 하나로 바로 재생해서 들을 수 있답니다. 정말 세상이 편해졌죠?</voice>
  <break time="1s"/>
  <voice name="{VOICE_LEO}">편리한 세상인 만큼 보안의 무결성을 더욱 철저히 다듬어야 합니다. 오늘 준비된 방송은 여기까지입니다. 내일 아침에도 더 깐깐하고 재미있는 라디오 브리핑으로 뵙겠습니다. 감사합니다.</voice>
  <break time="800ms"/>
  <voice name="{VOICE_ANTI}">내일 또 만나요 레오 님! 안녕~!</voice>
</speak>"""
        return fallback_ssml

async def compile_audio_broadcast(ssml_text):
    """구조화된 듀얼 보이스 SSML XML 대본을 대화형 라디오 .mp3 파일로 초고속 빌드합니다."""
    print("🔊 [Edge-TTS] 듀얼 보이스 만담 라디오 합성을 시작합니다...")
    try:
        communicate = edge_tts.Communicate(text=ssml_text, voice=VOICE_LEO) # Base 커뮤니케이터 (SSML 태그 내에 개별 voice 속성이 오버라이드함)
        
        # 파일 컴파일링 출력
        os.makedirs(os.path.dirname(OUTPUT_MP3_PATH), exist_ok=True)
        await communicate.save(OUTPUT_MP3_PATH)
        print(f"🎉 [Edge-TTS] 1인 라디오 방송 파일 조립 최종 완료: {OUTPUT_MP3_PATH}")
        return True
    except Exception as e:
        print(f"오디오 합성 컴파일 에러: {e}")
        return False

def make_radio_broadcast():
    """뉴스 데이터 수집부터 듀얼 보이스 라디오 생성까지 총괄 조율하는 메인 빌더 기동 장치입니다."""
    print("📻 [Medi-IT Radio 2.0] 실시간 라디오 방송 제작을 개시합니다.")
    news_context = get_latest_news_context()
    ssml = generate_radio_ssml(news_context)
    
    # 비동기 오디오 컴파일러 실행
    loop = asyncio.get_event_loop()
    success = loop.run_until_complete(compile_audio_broadcast(ssml))
    if success:
        print("🎉 라디오 방송 제작 최종 완료!")
        return True
    return False

if __name__ == "__main__":
    make_radio_broadcast()
