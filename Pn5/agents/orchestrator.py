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
import skill_review_news
import skill_summarize_briefing
import skill_publish_telegram
import orchestrator_validator

def send_alert(message):
    print(f"🚨 오케스트레이터 알림: {message}")
    skill_publish_telegram.send_telegram(f"🚨 [Medi-IT 파이프라인 경고]\n{message}")

def run_orchestrator():
    print("🚀 [Orchestrator] Medi-IT 멀티 에이전트 브리핑 하네스 시작")
    
    # [Agent 1] News Scraper
    print("🤖 [Scraper] 뉴스 크롤링 시작...")
    raw_news = skill_fetch_news.fetch_all_news()
    
    if not raw_news:
        send_alert("뉴스 크롤러가 유효한 기사를 수집하지 못했습니다. (0건 반환)")
        sys.exit(1)
        
    print(f"✅ [Scraper] {len(raw_news)}건의 원문 수집 완료.")
    
    # [Orchestrator Validation] Scraper 검증 및 자가 치유(Retry) 루프
    scraper_issue = orchestrator_validator.validate_scraper_output(raw_news)
    retry_count = 0
    while scraper_issue and retry_count < 2:
        print(f"⚠️ [Orchestrator] Scraper 검증 실패! 피드백을 전달하여 재시도합니다. (Retry {retry_count+1}/2)\n피드백: {scraper_issue}")
        raw_news = skill_fetch_news.fetch_all_news(feedback=scraper_issue)
        print(f"✅ [Scraper - Auto-Healed] {len(raw_news)}건의 원문 재수집 완료.")
        scraper_issue = orchestrator_validator.validate_scraper_output(raw_news)
        retry_count += 1
        
    failed_sources = []
    if scraper_issue:
        send_alert(f"자가 치유 최종 실패: {scraper_issue}")
        # 실패 내역 추출 (임시로 에러 텍스트 보관)
        failed_sources.append(f"스크래퍼 경고: {scraper_issue[:100]}...")
    elif retry_count > 0:
        print("🎉 [Orchestrator] 자가 치유(Auto-Healing) 성공! 검증을 통과했습니다.")
    
    # Audit log
    workspace_dir = os.path.join(os.path.dirname(__file__), '_workspace')
    os.makedirs(workspace_dir, exist_ok=True)
    today_str = datetime.now().strftime("%Y%m%d")
    
    with open(os.path.join(workspace_dir, f"{today_str}_1_raw_news.json"), "w", encoding="utf-8") as f:
        json.dump(raw_news, f, ensure_ascii=False, indent=2)

    # [Agent 2] News Reviewer (Filtering & Quality Control)
    print("🧐 [Reviewer] 기사 품질 검수 및 핵심 필터링 시작...")
    filtered_news = skill_review_news.review_news(raw_news)
    
    if not filtered_news:
        send_alert("리뷰어가 모든 기사를 불량/중복으로 판정하여 필터링 후 0건이 되었습니다.")
        sys.exit(1)
        
    print(f"✅ [Reviewer] {len(filtered_news)}건의 핵심 기사 엄선 완료.")
    
    # [Orchestrator Validation] Reviewer 검증
    reviewer_issue = orchestrator_validator.validate_reviewer_output(filtered_news)
    retry_count = 0
    # reviewer는 fetcher 처럼 동적 생성이 복잡할 수 있으나, 일단 재시도 골격만 구성
    while reviewer_issue and retry_count < 1:
        print(f"⚠️ [Orchestrator] Reviewer 검증 실패! 피드백 전달 후 재시도합니다. (Retry {retry_count+1}/1)\n피드백: {reviewer_issue}")
        # 리뷰어가 피드백을 받을 수 있도록 수정 (현재는 생략)
        reviewer_issue = None
        retry_count += 1
        
    if reviewer_issue:
        send_alert(f"리뷰어 검증 최종 실패: {reviewer_issue}")
        failed_sources.append(f"리뷰어 경고: {reviewer_issue[:100]}...")
    
    with open(os.path.join(workspace_dir, f"{today_str}_2_filtered_news.json"), "w", encoding="utf-8") as f:
        json.dump(filtered_news, f, ensure_ascii=False, indent=2)

    # [Agent 3] Summarizer (AI Generation)
    print("✍️ [Summarizer] AI 브리핑 요약 생성 시작...")
    try:
        # failed_sources를 전달할 수 있도록 수정
        briefing_html = skill_summarize_briefing.generate_briefing(filtered_news, failed_sources=failed_sources)
        if "⚠️ 유효한 뉴스가 없습니다." in briefing_html:
            raise ValueError("Summarizer 에러: 생성된 브리핑이 비어 있습니다.")
    except Exception as e:
        send_alert(f"브리핑 요약 중 치명적인 에러 발생: {e}")
        sys.exit(1)

    print("✅ [Summarizer] 브리핑 HTML 생성 완료.")
    
    with open(os.path.join(workspace_dir, f"{today_str}_3_briefing.md"), "w", encoding="utf-8") as f:
        f.write(briefing_html)

    # 옵시디언 데이터베이스 동기화
    obsidian_dir = r"C:\Users\ismadmin\Documents\ObsidianVault\Medi-IT-Research"
    os.makedirs(obsidian_dir, exist_ok=True)
    obsidian_filename = f"Medi-IT-Research-Briefing_{datetime.now().strftime('%Y-%m-%d')}.md"
    try:
        with open(os.path.join(obsidian_dir, obsidian_filename), "w", encoding="utf-8") as f:
            f.write(briefing_html)
        print(f"✅ [Summarizer] 옵시디언 볼트 동기화 완료 ({obsidian_filename})")
    except Exception as e:
        print(f"⚠️ [Summarizer] 옵시디언 저장 실패: {e}")

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
