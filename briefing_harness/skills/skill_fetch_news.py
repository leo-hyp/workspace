import requests
import re
import json
import time

NEWS_SOURCES = [
    {"name": "전자신문 (IT)", "url": "https://rss.etnews.com/Section901.xml"},
    {"name": "ZDNet (기술)", "url": "https://feeds.feedburner.com/zdkorea"},
    {"name": "보안뉴스 (전문)", "url": "https://www.boannews.com/media/news_rss.xml"},
    {"name": "데일리메드 (병원)", "url": "https://news.google.com/rss/search?q=site:dailymedi.com&hl=ko&gl=KR&ceid=KR:ko"},
    {"name": "의협신문 (의료)", "url": "https://news.google.com/rss/search?q=site:doctorsnews.co.kr&hl=ko&gl=KR&ceid=KR:ko"},
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
    import xml.etree.ElementTree as ET
    import html
    
    all_items = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    for source in NEWS_SOURCES:
        try:
            print(f"📡 [Briefing Harness] {source['name']} 직접 XML 수집 요청 중...")
            response = requests.get(source['url'], headers=headers, timeout=10)
            if response.status_code != 200:
                print(f"⚠️ HTTP 오류 {response.status_code}: {source['name']}")
                continue
                
            # EUC-KR 및 UTF-8 등 인코딩 관련 선언 정규화
            xml_text = response.text
            xml_text = re.sub(r'encoding\s*=\s*["\'](euc-kr|ks_c_5601-1987|utf-8)["\']', 'encoding="utf-8"', xml_text, flags=re.IGNORECASE)
            
            root = ET.fromstring(xml_text.encode('utf-8'))
            items = root.findall('.//item')
            
            for item in items[:5]: # 여유있게 5개를 가져와서 필터링
                title_elem = item.find('title')
                link_elem = item.find('link')
                desc_elem = item.find('description')
                pub_elem = item.find('pubDate')
                
                title = title_elem.text if title_elem is not None else ""
                link = link_elem.text if link_elem is not None else ""
                raw_desc = desc_elem.text if desc_elem is not None else ""
                pubDate = pub_elem.text if pub_elem is not None else ""
                
                clean_title = title.rsplit(' - ', 1)[0] if ' - ' in title else title
                if not has_korean(clean_title):
                    continue
                
                # HTML 태그 제거
                clean_desc = re.sub(r'<[^>]+>', '', raw_desc)
                clean_desc = html.unescape(clean_desc).strip()
                
                # 딥 스크래핑(Deep Scraping) 폴백 로직
                if len(clean_desc) < 30:
                    print(f"[{source['name']}] RSS 본문 부실. 딥 스크래핑 시도: {title}")
                    deep_desc = extract_article_text(link)
                    # 딥 스크래핑 요청 후 항상 15초 대기하여 서버 부하 분산
                    time.sleep(15)
                    if len(deep_desc) < 30:
                        print(f" -> 딥 스크래핑 실패 및 스킵")
                        continue
                    clean_desc = deep_desc
                    print(f" -> 딥 스크래핑 성공! ({len(clean_desc)}자 추출)")

                category = "사회"
                if "보안" in source['name'] or "보안" in title: 
                    category = "보안/사고"
                elif "전자" in source['name'] or "ZD" in source['name'] or "IT" in title or "기술" in title: 
                    category = "IT/기술"
                elif "메드" in source['name'] or "의료" in source['name'] or "병원" in title: 
                    category = "병원/의료"
                
                all_items.append({
                    "category": category,
                    "title": title,
                    "source": source['name'].split(' ')[0],
                    "link": link,
                    "description": clean_desc[:150], # 내용을 최대 150자까지 제공
                    "pubDate": pubDate
                })
        except Exception as e:
            print(f"Error fetching {source['name']}: {e}")
            
        # 각 뉴스 소스 수집 간 30초 대기하여 시간 분산 및 서버 부하 감소
        print(f"💤 {source['name']} 수집 및 처리 완료. 30초 대기 중...")
        time.sleep(30)
            
    return all_items

if __name__ == "__main__":
    news = fetch_all_news()
    if not news:
        print(json.dumps({"error": "No news collected or failed."}))
    else:
        print(json.dumps(news, ensure_ascii=False, indent=2))
