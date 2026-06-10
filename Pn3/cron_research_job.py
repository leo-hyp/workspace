import subprocess
import os
import sys
import io
import asyncio
import edge_tts
import requests
from datetime import datetime

# Windows encoding support
sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

ENV_PATH = r"C:\Users\ismadmin\AppData\Local\hermes\.env"

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
TELEGRAM_BOT_TOKEN = env.get("TELEGRAM_BOT_TOKEN") or "8938603325:AAEzwqz8hzqd-ybyEn8YAFuQYtmfufzrEFg"
TELEGRAM_CHAT_ID = env.get("TELEGRAM_HOME_CHANNEL") or "8754969551"

PYTHON_EXE = r"C:\Users\ismadmin\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe"

# Workspace Pn3 scripts and file paths
WORKSPACE_DIR = r"c:\Users\ismadmin\Documents\Workspace\Pn3"
CRAWLER_SCRIPT = os.path.join(WORKSPACE_DIR, "research_crawler.py")
PUBLISHER_SCRIPT = os.path.join(WORKSPACE_DIR, "publish_to_obsidian.py")
TEMP_TEXT_PATH = os.path.join(WORKSPACE_DIR, "temp_analysis_text.txt")

def get_audio_output_path():
    now_date = datetime.now().strftime("%Y-%m-%d")
    base_dir = r"C:\Users\ismadmin"
    counter = 1
    while True:
        # 파일명에 날짜와 실행 차수(01, 02...) 넘버링을 부여하여 나중에도 고유 보관/식별 가능
        filename = f"Medi-IT-Research-Briefing_{now_date}_{counter:02d}.mp3"
        path = os.path.join(base_dir, filename)
        if not os.path.exists(path):
            return path
        counter += 1

def run_script(script_path):
    try:
        print(f"Running script: {script_path}...")
        res = subprocess.run([PYTHON_EXE, script_path], capture_output=True, text=True, encoding='utf-8', timeout=60)
        print(res.stdout)
        if res.returncode != 0:
            print(f"❌ Script failed with error:\n{res.stderr}")
            return False
        return True
    except Exception as e:
        print(f"❌ Exception running script: {e}")
        return False

def extract_tts_text(file_path):
    """지정된 마크다운 결과물에서 한줄요약과 심층분석 섹션을 파싱하여 TTS에 최적화된 텍스트를 추출합니다."""
    if not os.path.exists(file_path):
        return None
        
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    lines = content.split('\n')
    extracted_text = []
    capture = False
    
    # We want to extract text inside [한줄 핵심 요약] and [심층 기술 분석]
    for line in lines:
        stripped = line.strip()
        if "한줄 핵심 요약" in stripped or "심층 기술 분석" in stripped:
            capture = True
            extracted_text.append(stripped.replace("**", "").replace("#", "").replace("[", "").replace("]", ""))
            continue
        elif "병원망 적용 가이드" in stripped or "💡" in stripped and "병원" in stripped:
            capture = False
            
        if capture and stripped:
            # Skip YAML frontmatter and header lines
            if stripped.startswith("---") or stripped.startswith("#"):
                continue
            # Remove markdown syntax
            clean = stripped.replace("**", "").replace("*", "").replace("- ", "").replace("### ", "")
            
            # Clean URLs and HTML/Markdown link tags for clean TTS reading
            import re
            # 1. Convert markdown hyperlinks like [출처](http://...) to just "출처"
            clean = re.sub(r'\[([^\]]+)\]\(https?://[^\)]+\)', r'\1', clean)
            # 2. Remove any remaining raw URLs
            clean = re.sub(r'https?://\S+', '', clean)
            # 3. Remove HTML tags like <a> or </a>
            clean = re.sub(r'<[^>]+>', '', clean)
            
            extracted_text.append(clean)
            
    if not extracted_text:
        # Fallback to the first 400 characters if custom parsing fails
        print("⚠️ Custom parsing returned empty, falling back to simple slicing.")
        import re
        clean_content = content.replace("---", "").replace("**", "").replace("#", "").strip()
        clean_content = re.sub(r'\[([^\]]+)\]\(https?://[^\)]+\)', r'\1', clean_content)
        clean_content = re.sub(r'https?://\S+', '', clean_content)
        clean_content = re.sub(r'<[^>]+>', '', clean_content)
        extracted_text = [clean_content[:500]]
        
    final_text = "레오님, 오늘 아침 수집된 최신 IT 보안 기술 리서치 소식을 전달해 드립니다. " + ". ".join(extracted_text)
    return final_text

async def generate_speech(text, output_path):
    print("Generating speech audio file with edge-tts...")
    # 날짜별로 목소리를 교대로 자동 스위칭하여 실증이 나지 않도록 로직 구성!
    # 짝수일: 차분하고 신뢰감 높은 남성 아나운서 인준 (ko-KR-InJoonNeural)
    # 홀수일: 친근하고 맑은 여성 비서 선희 (ko-KR-SunHiNeural)
    day = datetime.now().day
    if day % 2 == 0:
        voice = "ko-KR-InJoonNeural"
        voice_desc = "인준 (차분하고 전문적인 남성 아나운서)"
    else:
        voice = "ko-KR-SunHiNeural"
        voice_desc = "선희 (밝고 스마트한 여성 비서)"
        
    print(f"🎙️ [Voice Rotation] 오늘 선택된 목소리: {voice_desc}")
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
        print(f"✅ TTS Speech file successfully created at {output_path}!")
        return True
    except Exception as e:
        print(f"❌ Error generating TTS speech: {e}")
        return False

def send_telegram_audio(audio_path):
    if not os.path.exists(audio_path):
        print(f"❌ Audio file not found at {audio_path}")
        return False
        
    print("Sending audio file to Telegram...")
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendAudio"
    try:
        now_date = datetime.now().strftime("%Y-%m-%d")
        with open(audio_path, 'rb') as f:
            files = {'audio': f}
            payload = {
                'chat_id': TELEGRAM_CHAT_ID,
                'caption': f"🎙️ 레오님! {now_date} 최신 지능형 IT/보안 리서치 요약 음성 브리핑입니다. 출근길에 가볍게 들어보세요!"
            }
            res = requests.post(url, data=payload, files=files, timeout=30)
            if res.status_code == 200 and res.json().get("ok"):
                print("✅ Telegram audio dispatch successful!")
                return True
            else:
                print("❌ Telegram dispatch failed:", res.json())
                return False
    except Exception as e:
        print(f"❌ Exception sending to telegram: {e}")
        return False

def send_telegram_text(text_path):
    if not os.path.exists(text_path):
        print(f"❌ Text file not found at {text_path}")
        return False
        
    with open(text_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    print("Sending text report to Telegram...")
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    
    # Clean YAML frontmatter if present for better readability on Telegram
    clean_content = content
    if clean_content.startswith("---"):
        parts = clean_content.split("---", 2)
        if len(parts) >= 3:
            clean_content = parts[2].strip()
            
    # Shorten if too long (Telegram limit is 4096)
    if len(clean_content) > 4000:
        clean_content = clean_content[:3900] + "\n\n...(이하 생략 - 상세 보고서는 옵시디언에서 확인해 주세요!)"
        
    payload = {
        'chat_id': TELEGRAM_CHAT_ID,
        'text': f"📋 *[Medi-IT 최신 IT/보안 리서치 요약 텍스트 보고서]*\n\n{clean_content}",
        'parse_mode': 'Markdown'
    }
    
    try:
        res = requests.post(url, json=payload, timeout=20)
        if res.status_code == 200 and res.json().get("ok"):
            print("✅ Telegram text report dispatch successful!")
            return True
        else:
            # Fallback without markdown format if markdown parsing fails
            payload['parse_mode'] = ''
            res = requests.post(url, json=payload, timeout=20)
            if res.status_code == 200 and res.json().get("ok"):
                print("✅ Telegram text report dispatch successful (fallback without formatting)!")
                return True
            print("❌ Telegram text dispatch failed:", res.json())
            return False
    except Exception as e:
        print(f"❌ Exception sending text to telegram: {e}")
        return False

def send_telegram_document(text_path):
    if not os.path.exists(text_path):
        print(f"❌ Text file not found at {text_path}")
        return False
        
    print("Sending document file to Telegram...")
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendDocument"
    try:
        now_date = datetime.now().strftime("%Y-%m-%d")
        # Copy temp file to a beautiful filename before sending
        beautiful_filename = f"Medi-IT-Research-Briefing_{now_date}.md"
        doc_path = os.path.join(os.path.dirname(text_path), beautiful_filename)
        
        import shutil
        shutil.copy2(text_path, doc_path)
        
        with open(doc_path, 'rb') as f:
            files = {'document': f}
            payload = {
                'chat_id': TELEGRAM_CHAT_ID,
                'caption': f"📂 {now_date} 기술 & 보안 리서치 마크다운(.md) 원본 보고서 파일입니다."
            }
            res = requests.post(url, data=payload, files=files, timeout=30)
            
        # Clean up copied file
        if os.path.exists(doc_path):
            os.remove(doc_path)
            
        if res.status_code == 200 and res.json().get("ok"):
            print("✅ Telegram document dispatch successful!")
            return True
        else:
            print("❌ Telegram document dispatch failed:", res.json())
            return False
    except Exception as e:
        print(f"❌ Exception sending document to telegram: {e}")
        return False

async def main():
    print("==================================================")
    print("⚕️ Starting Medi-IT Dynamic Research Automation Job (Pn3 Workspace)")
    print("==================================================")
    
    # 1. 수집 스크립트 가동
    if not run_script(CRAWLER_SCRIPT):
        print("❌ Crawler script failed. Exiting.")
        sys.exit(1)
        
    # 2. 요약 및 옵시디언 발행 스크립트 가동
    if not run_script(PUBLISHER_SCRIPT):
        print("❌ Publisher script failed. Exiting.")
        sys.exit(1)
        
    # 3. 마크다운 보고서로부터 음성 낭독에 적합한 텍스트 추출
    print("Parsing generated report text...")
    tts_text = extract_tts_text(TEMP_TEXT_PATH)
    if not tts_text:
        print("❌ Failed to parse analysis text. Exiting.")
        sys.exit(1)
        
    print(f"Extracted TTS length: {len(tts_text)} characters.")
    
    # 4. 고품질 한국어 신경망 TTS 음성 파일(.mp3) 파일명 동적 생성 및 빌드
    audio_path = get_audio_output_path()
    if not await generate_speech(tts_text, audio_path):
        print("❌ TTS generation failed. Exiting.")
        sys.exit(1)
        
    # 5. 생성된 고음질 mp3 파일을 텔레그램으로 자동 발송
    if not send_telegram_audio(audio_path):
        print("❌ Telegram audio delivery failed.")
        sys.exit(1)
        
    # 6. 요약 텍스트 보고서 및 마크다운 원본 파일을 텔레그램으로 함께 발송
    send_telegram_text(TEMP_TEXT_PATH)
    send_telegram_document(TEMP_TEXT_PATH)
    
    print("🎉 [Success] Medi-IT Research automation job fully completed with audio & text delivery!")

if __name__ == "__main__":
    asyncio.run(main())
