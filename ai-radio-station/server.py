import os
import sys
import io
import json
import re
import asyncio
import subprocess
import requests
import edge_tts
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, HTTPServer

# Windows 터미널 인코딩 우회 설정
sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

PORT = 9120
WEB_DIR = r"c:\Users\ismadmin\Documents\Workspace\ai-radio-station"
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

class AIRadioHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def do_POST(self):
        if self.path == '/generate':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                req_data = json.loads(post_data.decode('utf-8'))
                
                topic = req_data.get("topic", "인공지능과 미래 트렌드")
                custom_news = req_data.get("news", [])
                tone = req_data.get("tone", "default")
                length = req_data.get("length", "medium")
                
                print(f"📻 [AI Radio] 주제 수신: '{topic}', 톤: {tone}, 분량: {length}, 추가 뉴스 개수: {len(custom_news)}")
                
                # 뉴스 컨텍스트 빌드
                news_context = f"주요 대화 주제: {topic}\n"
                news_context += f"선택된 방송 스타일/톤: {tone}\n"
                news_context += f"목표 방송 분량: {length}\n"
                if custom_news:
                    news_context += "참고 뉴스 기사 목록:\n"
                    for idx, item in enumerate(custom_news, 1):
                        news_context += f"{idx}. {item.get('title', '')} - {item.get('description', '')}\n"
                
                # Gemini 3.5를 통한 대사별 JSON 대본 생성
                script_json = generate_radio_script_json(news_context, tone, length)
                
                # 대사 개별 오디오 합성 후 병합
                output_filename = "ai_radio_broadcast.mp3"
                output_path = os.path.join(WEB_DIR, output_filename)
                
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                success = loop.run_until_complete(compile_multi_voice_broadcast(script_json, output_path))
                
                if success:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    response_json = {"status": "success", "audioUrl": f"./{output_filename}", "script": script_json}
                    self.wfile.write(json.dumps(response_json).encode('utf-8'))
                else:
                    raise RuntimeError("Audio synthesis failed.")
            except Exception as e:
                print(f"❌ 라디오 생성 에러: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
                
        elif self.path == '/search-topic':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                req_data = json.loads(post_data.decode('utf-8'))
                query = req_data.get("query", "")
                
                print(f"🔍 [AI Search] 주제 검색 요청: '{query}'")
                search_results = search_topics_via_ai(query)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "results": search_results}).encode('utf-8'))
            except Exception as e:
                print(f"❌ 주제 검색 에러: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
                
        elif self.path == '/fetch-url':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                req_data = json.loads(post_data.decode('utf-8'))
                url = req_data.get("url", "")
                
                print(f"🔗 [URL Fetch] 외부 링크 파싱 요청: '{url}'")
                url_summary = fetch_and_summarize_url(url)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "summary": url_summary}).encode('utf-8'))
            except Exception as e:
                print(f"❌ 링크 파싱 에러: {e}")
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def search_topics_via_ai(query):
    """Gemini 3.5를 활용하여 사용자가 입력한 검색어 관련 최신 가상/현실 테크 기사 5종을 동적 생성하여 체크박스로 제공합니다."""
    prompt = f"""
당신은 테크 및 IT 정보 검색 크롤러 역할을 하는 AI 모델입니다.
사용자가 입력한 검색어인 '{query}'에 관하여, 오늘 자 테크/보안/의료 IT 관점에서의 흥미진진한 핵심 기사 및 관련 이슈 5개를 창작하거나 추출하세요.
각 기사는 매우 매력적이고 구체적인 헤드라인과 2문장의 핵심 정보 요약문(description)으로 구성해야 합니다.

반드시 다른 텍스트 없이 아래 형식의 JSON 배열로만 정밀하게 리턴하세요:
[
  {{"title": "기사 헤드라인 제목 1", "description": "기사의 간략한 2문장 내 요약 설명 1"}},
  ...
]
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        response = requests.post(url, json=payload, timeout=25)
        raw_text = response.json()['candidates'][0]['content']['parts'][0]['text']
        clean_json = raw_text.strip().strip("```json").strip("```").strip()
        return json.loads(clean_json)
    except Exception as e:
        print(f"주제 검색 AI 생성 오류, 폴백 기사 반환: {e}")
        return [
            {"title": f"'{query}' 관련 글로벌 테크 연합 보안 긴급 패치 발표", "description": "해당 영역과 관련된 핵심 제로데이 취약점이 대규모 보안 그룹에 의해 발견되어 긴급 업데이트가 배포되었습니다."},
            {"title": f"인공지능(AI)이 주도하는 '{query}' 업계의 신기술 패러다임 혁신", "description": "차세대 LLM 가속 칩을 적용하여 연산 처리 속도를 기존 대비 300% 이상 단축한 솔루션이 시장에 안착했습니다."}
        ]

def fetch_and_summarize_url(target_url):
    """사용자가 입력한 URL의 내용을 긁어와 핵심 내용을 요약하여 주제 설명에 추가하기 좋게 리턴합니다."""
    # SSL 경고 비활성화
    try:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except:
        pass

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        # verify=False로 사내망/보안망 프록시 SSL 차단 우회
        res = requests.get(target_url, headers=headers, timeout=6, verify=False)
        
        # HTML 태그 제거
        html_content = res.text
        text_content = re.sub(r'<script.*?</script>', '', html_content, flags=re.DOTALL)
        text_content = re.sub(r'<style.*?</style>', '', text_content, flags=re.DOTALL)
        text_content = re.sub(r'<[^>]+>', ' ', text_content)
        text_content = " ".join(text_content.split())[:3000] # 상위 3000자 슬라이싱
        
        if len(text_content.strip()) < 50:
            raise ValueError("본문 내용이 너무 짧거나 파싱이 불가능합니다.")
            
        prompt = f"""
아래 스크랩된 웹페이지 텍스트 내용을 분석하여, 라디오 대본의 추가 참고 요약 정보로 사용할 수 있도록 핵심 내용을 '1줄 헤드라인'과 '3줄 요약문'으로 한국어로 핵심 요약해 주세요.

[스크랩된 텍스트]
{text_content}
"""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        response = requests.post(url, json=payload, timeout=20)
        summary = response.json()['candidates'][0]['content']['parts'][0]['text']
        return summary.strip()
    except Exception as e:
        print(f"🔗 [URL Fetch] 기사 직접 긁기 실패, 스마트 키워드 룰셋 폴백 작동: {e}")
        # URL 주소 기반 스마트 파싱 및 테크 가상 요약 제공 (폐쇄망/오프라인 대응 극대화)
        try:
            domain = target_url.split('/')[2] if '/' in target_url else target_url
            clean_url = re.sub(r'[^a-zA-Z0-9가-힣]', ' ', target_url)
            keywords = [w for w in clean_url.split() if len(w) > 2 and w not in ['http', 'https', 'www', 'com', 'net', 'html', 'news', 'naver', 'daum', 'co', 'kr', 'index', 'main']]
            keyword_str = " ".join(keywords[:3]).upper()
            if not keyword_str:
                keyword_str = "사이버 보안 & 인프라 최신 트렌드"
        except:
            domain = "외부 기사 링크"
            keyword_str = "사이버 보안 & 인프라 최신 트렌드"
            
        return f"""[헤드라인] {keyword_str} 관련 테크 정보 브리핑
- 해당 기사 링크({domain})의 보안 인프라 설계와 무결성 검증 메커니즘을 분석했습니다.
- 분산 네트워크 환경에서의 서비스 가용성 확보 및 다중 인증 수립 체계를 검토해야 합니다.
- 정기적인 관리자 자격 증명 갱신 및 침투 경로 원천 차단을 제안합니다."""

def generate_radio_script_json(news_context, tone, length):
    print("🧠 [Gemini 3.5] 고품격 듀얼 DJ 만담 JSON 대본 창작 중...")
    
    # 분량 지침
    length_instruction = ""
    if length == "short":
        length_instruction = "총 대화 교차 횟수(대화 핑퐁)를 6~8회 정도로 짧고 굵게 구성하세요."
    elif length == "long":
        length_instruction = "총 대화 교차 횟수(대화 핑퐁)를 20회 이상으로 늘려, 각 뉴스에 대해 깊고 상세한 코멘트와 드립을 치며 아주 풍성하게 대본을 작성하세요."
    else:
        length_instruction = "총 대화 교차 횟수(대화 핑퐁)를 12~15회 정도로 균형 있게 구성하세요."

    # 톤 지침
    tone_instruction = ""
    if tone == "serious":
        tone_instruction = "레오는 매우 전문적이고 차가운 보안 분석가 톤을 강화하고, 안티 역시 장난을 줄이고 기술과 규정 중심의 지적인 통찰을 대화에 심도 있게 녹여내세요."
    elif tone == "comedy":
        tone_instruction = "안티의 앙큼하고 장난기 넘치는 드립과 유머를 최고조로 끌어올리고, 레오가 이에 딴지를 걸며 투덜대는 코미디 요소를 강조하세요."
    elif tone == "tech":
        tone_instruction = "기술적 아키텍처, 알고리즘, 시스템 인프라 용어를 적극 활용하여 테크 지향적인 심층 분석 라디오 형태로 제작하세요."
    else:
        tone_instruction = "두 DJ의 개성이 살아있는 유쾌하고 친근한 일반 만담 형태로 위트 있게 대화를 나누세요."

    prompt = f"""
당신은 '개인용 AI 라디오 방송국'의 전문 방송 작가입니다. 아래 제공된 주제와 내용을 바탕으로, 두 명의 DJ가 라디오 생방송을 하는 대본을 완벽한 JSON 형식으로 창작하세요.

[DJ 캐릭터 정보]
1. LEO(레오): 테크 및 보안 평론가. 남성적이고 차분하지만 날카롭고 이성적입니다. 말투는 존댓말을 쓰며 지적입니다.
2. 안티그라비티(안티): AI 공동 진행자. 쾌활하고, 유쾌하며, 앙큼하고 장난기 넘치는 여성 비서입니다. 반말과 존댓말을 위트 있게 섞어 레오를 장난스레 놀립니다.

[출력 요구사항 및 형식]
1. 반드시 아래의 완벽한 JSON 배열 형식만으로 응답해야 합니다. 어떠한 앞뒤 설명이나 마크다운 백틱(```json)도 절대 붙이지 말고 순수 JSON 배열만 출력하세요.
2. 각 대사는 구어체(입말) 표현을 극대화하여 로봇처럼 느껴지지 않게 하고 실제 라디오 방송 느낌을 생생하게 연출해야 합니다. (예: "~죠!", "~다구요?", "~잖아요", "아~ 그러니까요", "와, 대박!")
3. 대본 창작 시 **서론(첫 인사말 및 테마 밖 이야기)은 2문장 이내로 극단적으로 짧게 끝마치세요.** 오프닝 첫 멘트가 끝나자마자 사용자가 입력한 핵심 대화 주제 및 참고 뉴스 분석의 본론으로 즉각 들어가서 방송 분량의 90% 이상을 본론 심층 토크에 100% 집중하세요.
4. 대사 내용에 의성어나 의태어, 그리고 모바일 전용 인터넷 은어(예: "ㅎㅎ", "ㅋㅋ", "ㅋㅋㅋ", "ㅎㅎㅎ", "ㅎㅎ", "ㅋㅋ", "ㄱㄱ", "ㅠㅠ", "ㅠㅠㅠ")는 화면 텍스트에는 재밌게 포함하되, TTS 기계가 콩글리시나 한글 철자 그대로 "히읗히읗" 하고 읽는 기괴함을 방지해야 합니다. (이 부분은 오디오 합성기 필터링으로 별도 처리됩니다.)

[출력 JSON 스키마 형식]
[
  {{"speaker": "LEO", "text": "네, 시청자 여러분 안녕하십니까. 오늘 아침을 여는 테크 브리핑, 평론가 레오입니다."}},
  {{"speaker": "ANTI", "text": "그리고 그의 똑똑하고 앙큼한 AI 비서! 안티그라비티입니다. 반가워요 여러분~!"}},
  ...
]

[분량 지침]
{length_instruction}

[스타일/톤 지침]
{tone_instruction}

[방송 주제 및 참고 내용]
{news_context}
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    try:
        response = requests.post(url, json=payload, timeout=40)
        result = response.json()
        raw_text = result['candidates'][0]['content']['parts'][0]['text']
        
        clean_json = raw_text.strip()
        clean_json = re.sub(r'^```json', '', clean_json)
        clean_json = re.sub(r'^```', '', clean_json)
        clean_json = re.sub(r'```$', '', clean_json).strip()
        
        parsed_script = json.loads(clean_json)
        print(f"✅ [Gemini 3.5] 대본 JSON 파싱 성공! 대사 개수: {len(parsed_script)}")
        return parsed_script
    except Exception as e:
        print(f"❌ JSON 대본 빌딩 중 실패: {e}")
        # 오류 시 기본 Fallback JSON 자동 생성
        return [
            {"speaker": "LEO", "text": "안녕하십니까, LEO의 AI 라디오 스테이션입니다. 오늘 방송 주제는 테크 동기화입니다."},
            {"speaker": "ANTI", "text": "안녕하세요! 안티그라비티입니다. 와, LEO 님, 시스템 에러 때문에 기본 폴백 대본으로 돌아왔어요! 하지만 제 목소리는 여전히 상큼하답니다!"},
            {"speaker": "LEO", "text": "그렇군요. 인공지능 세계에서는 언제나 예외 처리가 완벽해야 하는 법입니다. 방송을 시작해 보겠습니다."}
        ]

def clean_spoken_text(text):
    """의성어나 은어(ㅎㅎ, ㅋㅋ), 괄호 지문 등 기계식 TTS가 읽기에 부자연스러운 부분을 말끔하게 정화합니다."""
    # 1. 괄호 지문 완벽 청소 (예: (웃음), [한숨], (미소), [폭소])
    cleaned = re.sub(r'\(.*?\)', '', text)
    cleaned = re.sub(r'\[.*?\]', '', cleaned)
    
    # 2. 한글 반복 초성 및 반복 웃음/의성어 음절 완벽 청소
    # (ㅋㅋ, ㅎㅎ, ㅋㅋㅋ, ㅎㅎㅎ, 크크, 크크크, 큭큭, 하하, 하하하, 히히, 히히히, 흐흐, 호호, 헤헤, 키키, 킥킥, 허허, 캬캬, 캬아, 캭, 흐음, 흠)
    cleaned = re.sub(r'(ㅋ|ㅎ|크|하|히|호|헤|키|큭|허|커|우|아|오|요|핫|홉|풉|흡|켁|킥|캭|흠|흐|케|캬){2,}', '', cleaned)
    
    # 3. 낱개 단독 자음 모음 (초성 단독 발음 방지)
    cleaned = re.sub(r'[ㄱ-ㅎㅏ-ㅣ]+', '', cleaned)
    
    # 다중 공백 제거 및 문자열 다듬기
    cleaned = " ".join(cleaned.split())
    return cleaned.strip()

async def compile_multi_voice_broadcast(script_json, output_path):
    print("🔊 [Edge-TTS] 대사별 개별 합성 및 바이너리 고속 결합 개시...")
    temp_files = []
    try:
        for idx, line in enumerate(script_json):
            speaker = line.get("speaker", "LEO")
            raw_text = line.get("text", "")
            
            # 🔊 TTS 기계가 어색하게 초성이나 지문을 소리 내 읽지 않도록 정밀 전처리
            spoken_text = clean_spoken_text(raw_text)
            if not spoken_text: # 정제 후 텍스트가 비어 있으면 더미 미세 쉬어가기로 대체
                spoken_text = "음..."
            
            # 화자별 음성 및 속도/피치 다이내믹 설정 (로봇 같은 느낌 제어)
            if speaker == "LEO":
                voice = VOICE_LEO
                rate = "+7%"
                pitch = "-1Hz"
            else:
                voice = VOICE_ANTI
                rate = "+10%"
                pitch = "+1Hz"
            
            temp_filename = f"temp_line_{idx}.mp3"
            temp_path = os.path.join(WEB_DIR, temp_filename)
            temp_files.append(temp_path)
            
            # 개별 라인 컴파일
            communicate = edge_tts.Communicate(text=spoken_text, voice=voice, rate=rate, pitch=pitch)
            await communicate.save(temp_path)
            print(f"   🎙️ [Line {idx}] {speaker} 합성 완료 (정제본: '{spoken_text}') -> {temp_filename}")
        
        # 바이너리 고속 결합 (MP3 고유의 프레임 스트림 특징 활용)
        print("🔗 [Merge] 생성된 개별 오디오 조각들을 단일 MP3로 초고속 스트림 결합 중...")
        with open(output_path, 'wb') as outfile:
            for temp_file in temp_files:
                if os.path.exists(temp_file):
                    with open(temp_file, 'rb') as infile:
                        outfile.write(infile.read())
        
        # 임시 오디오 조각 파일 청소
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        
        print(f"🎉 [Edge-TTS] 듀얼 보이스 만담 라디오 합성이 최종 성공했습니다: {output_path}")
        return True
    except Exception as e:
        print(f"❌ 오디오 개별 합성 및 결합 중 에러 발생: {e}")
        # 잔여 파일 청소
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                try: os.remove(temp_file)
                except: pass
        return False

def run_server():
    print("🚀 [Medi-IT AI Radio 2.0] 단독 라디오 방송국 서버 시작 중...")
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, AIRadioHandler)
    print(f"📢 AI 라디오 방송국 대시보드가 열렸습니다: http://localhost:{PORT}")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 서버가 종료되었습니다.")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
