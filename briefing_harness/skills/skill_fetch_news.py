import requests
import re
import json

NEWS_SOURCES = [
    {"name": "전자신문 (IT)", "url": "https://news.google.com/rss/search?q=site:etnews.com&hl=ko&gl=KR&ceid=KR:ko"},
    {"name": "ZDNet (기술)", "url": "https://news.google.com/rss/search?q=site:zdnet.co.kr&hl=ko&gl=KR&ceid=KR:ko"},
    {"name": "보안뉴스 (전문)", "url": "https://www.boannews.com/media/news_rss.xml"},
    {"name": "데일리메드 (병원)", "url": "https://news.google.com/rss/search?q=site:dailymedi.com&hl=ko&gl=KR&ceid=KR:ko"},
    {"name": "의협신문 (의료)", "url": "https://news.google.com/rss/search?q=site:doctorsnews.co.kr&hl=ko&gl=KR&ceid=KR:ko"},
    {"name": "연합뉴스 (종합)", "url": "https://news.google.com/rss/search?q=site:yna.co.kr&hl=ko&gl=KR&ceid=KR:ko"}
]

def has_korean(text):
    return bool(re.search(r'[가-힣]', text))

def fetch_all_news():
    all_items = []
    for source in NEWS_SOURCES:
        try:
            api_url = f"https://api.rss2json.com/v1/api.json?rss_url={source['url']}"
            response = requests.get(api_url, timeout=10)
            data = response.json()
            
            if data.get('status') == 'ok':
                for item in data.get('items', [])[:5]: # 여유있게 5개를 가져와서 필터링
                    raw_title = item.get('title', '')
                    # 구글 뉴스 RSS는 제목 끝에 ' - 매체명'을 붙이므로, 이를 제거한 순수 제목만 추출
                    clean_title = raw_title.rsplit(' - ', 1)[0] if ' - ' in raw_title else raw_title
                    
                    # 한글 필터링: 매체명을 제외한 '순수 제목'에 한글이 없으면 가비지(영문 기사)로 간주하고 차단
                    if not has_korean(clean_title):
                        continue
                        
                    title = raw_title

                    raw_desc = item.get('description', '')
                    # HTML 태그 제거
                    clean_desc = re.sub(r'<[^>]+>', '', raw_desc)
                    # HTML 엔티티(&nbsp; 등) 디코딩 및 공백 정리
                    import html
                    clean_desc = html.unescape(clean_desc).strip()
                    
                    # 기사 내용(description)이 너무 짧거나(예: '데일리메디 데일리메디' 등 30자 미만) 텅 비어있다면 가비지로 간주하고 스킵
                    if len(clean_desc) < 30:
                        continue

                    category = "사회"
                    if "보안" in source['name'] or "보안" in title: category = "보안/사고"
                    elif "전자" in source['name'] or "ZD" in source['name'] or "IT" in title or "기술" in title: category = "IT/기술"
                    elif "메드" in source['name'] or "의료" in source['name'] or "병원" in title: category = "병원/의료"
                    
                    all_items.append({
                        "category": category,
                        "title": title,
                        "source": source['name'].split(' ')[0],
                        "link": item.get('link', ''),
                        "description": clean_desc[:150], # 내용을 최대 150자까지 제공
                        "pubDate": item.get('pubDate', '')
                    })
        except Exception as e:
            print(f"Error fetching {source['name']}: {e}")
    
    return all_items

if __name__ == "__main__":
    news = fetch_all_news()
    if not news:
        print(json.dumps({"error": "No news collected or failed."}))
    else:
        print(json.dumps(news, ensure_ascii=False, indent=2))
