import requests
import re
import json

NEWS_SOURCES = [
    {"name": "전자신문 (IT)", "url": "https://rss.etnews.com/Section901.xml"},
    {"name": "ZDNet (기술)", "url": "https://feeds.feedburner.com/zdkorea"},
    {"name": "보안뉴스 (전문)", "url": "https://www.boannews.com/media/news_rss.xml"},
    {"name": "데일리메드 (병원)", "url": "https://www.dailymedi.com/news/rss.php"},
    {"name": "의협신문 (의료)", "url": "https://www.doctorsnews.co.kr/rss/allArticle.xml"},
    {"name": "연합뉴스 (종합)", "url": "https://www.yna.co.kr/rss/news.xml"}
]

def has_korean(text):
    return bool(re.search(r'[가-힣]', text))

from bs4 import BeautifulSoup

def extract_article_text(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        res = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        soup = BeautifulSoup(res.content, 'html.parser')
        # 불필요한 태그 제거
        for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
            tag.decompose()
        text = soup.get_text(separator=' ')
        text = re.sub(r'\s+', ' ', text).strip()
        return text[:500] # 분석에 필요한 500자 추출
    except Exception as e:
        return ""

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
                    clean_title = raw_title.rsplit(' - ', 1)[0] if ' - ' in raw_title else raw_title
                    
                    if not has_korean(clean_title):
                        continue
                        
                    title = raw_title

                    raw_desc = item.get('description', '')
                    clean_desc = re.sub(r'<[^>]+>', '', raw_desc)
                    import html
                    clean_desc = html.unescape(clean_desc).strip()
                    
                    # 딥 스크래핑(Deep Scraping) 폴백 로직
                    if len(clean_desc) < 30:
                        link_url = item.get('link', '')
                        print(f"[{source['name']}] RSS 본문 부실. 딥 스크래핑 시도: {title}")
                        deep_desc = extract_article_text(link_url)
                        if len(deep_desc) < 30:
                            print(f" -> 딥 스크래핑 실패 및 스킵")
                            continue
                        clean_desc = deep_desc
                        print(f" -> 딥 스크래핑 성공! ({len(clean_desc)}자 추출)")

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
