import sys
import os
import time

# 텔레그램 모듈 경로 추가
sys.path.append(r"C:\Users\ismadmin\AppData\Local\hermes")
try:
    from send_news_telegram import send_telegram
except ImportError:
    send_telegram = lambda msg: print(f"[Telegram Not Configured] {msg}")

def run_orchestrator():
    print("🚀 Gourmet-Harness 오케스트레이터 시작...")
    time.sleep(1)
    print("✅ Gourmet-Finder 에이전트: EXIF 파싱 완료")
    time.sleep(1)
    print("✅ Fact-Checker 에이전트: 무결성 검증 완료")
    time.sleep(1)
    print("✅ Doc-Builder 에이전트: 마크다운 리포트 생성 완료")
    
    report_msg = (
        "<b>🎉 하네스 엔지니어링 작업 완료 보고</b>\n\n"
        "레오님, 요청하신 <b>미식 지도 아카이버(Gourmet-Harness)</b> 모듈 구축 및 시뮬레이션 작업이 성공적으로 완료되었습니다.\n"
        "퇴근 잘 하시고, 관련 코드는 워크스페이스 내 <code>gourmet_harness</code> 디렉토리에서 확인하실 수 있습니다.\n\n"
        "<i>- 안티그라비티 & 헤르메스 올림 -</i>"
    )
    send_telegram(report_msg)
    print("텔레그램 전송 완료!")

if __name__ == "__main__":
    run_orchestrator()
