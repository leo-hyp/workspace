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

                    category = "사회"
                    if "보안" in source['name'] or "보안" in title: category = "보안/사고"
                    elif "전자" in source['name'] or "ZD" in source['name'] or "IT" in title or "기술" in title: category = "IT/기술"
                    elif "메드" in source['name'] or "의료" in source['name'] or "병원" in title: category = "병원/의료"
                    
                    all_items.append({
                        "category": category,
                        "title": title,
                        "source": source['name'].split(' ')[0],
                        "link": item.get('link', ''),
                        "description": item.get('description', '').split('<')[0][:100],
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
