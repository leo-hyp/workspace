import requests

TELEGRAM_BOT_TOKEN = "8938603325:AAEzwqz8hzqd-ybyEn8YAFuQYtmfufzrEFg"
TELEGRAM_CHAT_ID = "8754969551"

def send_telegram(text):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"}
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        print("Telegram message sent successfully!")
    else:
        print(f"Failed to send: {response.text}")

if __name__ == "__main__":
    msg = """✅ <b>[Revis 작업 보고]</b>
헤르메스와의 양방향 소통 파이프라인(Agent_Comm) 구축 및 버그 수정이 모두 완료되었습니다!

1. <b>inbox.json 접근성 강화:</b> 헤르메스가 파일을 직접 수정하려다 발생한 구문 오류 원천 차단
2. <b>전용 툴 스크립트 도입:</b> 복잡한 JSON 조작 대신 터미널에서 간단히 파이썬을 실행하게 하는 <code>add_task.py</code> 스크립트 구축
3. <b>헤르메스 뇌구조(Config) 고정:</b> 파일 검색/수정 권한을 제한하고, 오직 전달자 역할만 하도록 시스템 프롬프트 업데이트 및 재부팅 완료

회의 잘 다녀오십시오! 🫡"""
    send_telegram(msg)
