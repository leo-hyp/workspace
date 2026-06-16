import os
import sys
import json
from datetime import datetime
import io

sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.detach(), encoding='utf-8')

# 스킬 임포트를 위해 경로 추가
sys.path.append(os.path.join(os.path.dirname(__file__), 'skills'))
import skill_fetch_news
import skill_review_content
import skill_publish_telegram

def send_alert(message):
    print(f"🚨 오케스트레이터 알림: {message}")
    skill_publish_telegram.send_telegram(f"🚨 [Medi-IT 파이프라인 경고]\n{message}")

def run_orchestrator():
    print("🚀 [Orchestrator] Medi-IT 브리핑 하네스 시작")
    
    # [Agent 1] News Scraper
    print("🤖 [Scraper] 뉴스 크롤링 시작...")
    news_items = skill_fetch_news.fetch_all_news()
    
    if not news_items:
        send_alert("뉴스 크롤러가 유효한 기사를 수집하지 못했습니다. (0건 반환)")
        sys.exit(1)
        
    print(f"✅ [Scraper] {len(news_items)}건의 유효한 한글 뉴스 수집 완료.")
    
    # Audit log
    workspace_dir = os.path.join(os.path.dirname(__file__), '_workspace')
    os.makedirs(workspace_dir, exist_ok=True)
    today_str = datetime.now().strftime("%Y%m%d")
    
    with open(os.path.join(workspace_dir, f"{today_str}_raw_news.json"), "w", encoding="utf-8") as f:
        json.dump(news_items, f, ensure_ascii=False, indent=2)

    # [Agent 2] Content Reviewer
    print("🤖 [Reviewer] AI 브리핑 요약 생성 시작...")
    try:
        briefing_html = skill_review_content.generate_briefing(news_items)
        if "⚠️ 유효한 뉴스가 없습니다." in briefing_html:
            raise ValueError("Reviewer 에러: 생성된 브리핑이 비어 있습니다.")
        if "임시 템플릿 사용 중입니다" in briefing_html or "AI 분석 엔진 오류" in briefing_html:
            raise ValueError("콘텐츠 검증 에러: AI 분석 실패로 임시 템플릿이 포함된 부실한 브리핑이 생성되었습니다. (발송 및 저장 차단)")
    except Exception as e:
        send_alert(f"브리핑 요약/검증 중 치명적인 에러 발생: {e}")
        sys.exit(1)

    print("✅ [Reviewer] 브리핑 HTML 생성 완료.")
    
    with open(os.path.join(workspace_dir, f"{today_str}_briefing.md"), "w", encoding="utf-8") as f:
        f.write(briefing_html)

    # 옵시디언 데이터베이스 동기화
    obsidian_dir = r"C:\Users\ismadmin\Documents\ObsidianVault\Medi-IT-Research"
    os.makedirs(obsidian_dir, exist_ok=True)
    obsidian_filename = f"Medi-IT-Research-Briefing_{datetime.now().strftime('%Y-%m-%d')}.md"
    try:
        with open(os.path.join(obsidian_dir, obsidian_filename), "w", encoding="utf-8") as f:
            f.write(briefing_html)
        print(f"✅ [Reviewer] 옵시디언 볼트 동기화 완료 ({obsidian_filename})")
    except Exception as e:
        print(f"⚠️ [Reviewer] 옵시디언 저장 실패: {e}")

    # [Agent 3] Telegram Publisher
    print("🤖 [Publisher] 텔레그램 메신저 전송 시작...")
    success, msg = skill_publish_telegram.send_telegram(briefing_html)
    
    if not success:
        print(f"❌ [Publisher] 전송 실패: {msg}")
        sys.exit(1)
        
    print(f"✅ [Publisher] 전송 완료! ({msg})")
    print("🎉 [Orchestrator] 모든 파이프라인이 성공적으로 종료되었습니다.")

if __name__ == "__main__":
    run_orchestrator()
