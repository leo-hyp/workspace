import requests
import re
import json

import os
import json

JSON_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'sources.json'))

def get_news_sources():
    try:
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Failed to read from JSON: {e}")
        return []

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

def dynamic_scrape_with_llm(feedback, all_items, sources):
    print(f"🤖 [Scraper-AutoHeal] 피드백 수신: {feedback}")
    import os, requests
    env_vars = {}
    env_path = r"c:\Users\ismadmin\AppData\Local\hermes\.env"
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    k, v = line.strip().split('=', 1)
                    env_vars[k] = v
    api_key = env_vars.get("GEMINI_API_KEY") or env_vars.get("GOOGLE_API_KEY")
    
    prompt = f"""
당신은 파이썬 웹 스크래핑 전문가입니다.
오케스트레이터의 피드백: {feedback}

위 피드백을 보고 누락된 소스(예: 데일리메드, url: https://www.dailymedi.com/news/articleList.html)를 파악하세요.
해당 소스의 최신 기사 5개를 requests와 BeautifulSoup으로 크롤링하는 파이썬 코드를 작성하세요.
반드시 `dynamic_items` 라는 변수명으로 결과를 저장해야 합니다. (List[Dict] 형태, 키: title, link, description, pubDate)
Markdown(```python)을 쓰지 말고 순수 파이썬 코드만 출력하세요.
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        response = requests.post(url, json=payload, timeout=30, verify=False)
        code = response.json()['candidates'][0]['content']['parts'][0]['text']
        code = code.replace("```python", "").replace("```", "").strip()
        print("🤖 [Scraper-AutoHeal] 생성된 동적 코드 실행 중...")
        
        local_vars = {}
        exec(code, globals(), local_vars)
        
        if 'dynamic_items' in local_vars:
            items = local_vars['dynamic_items']
            for item in items:
                category = "병원/의료"
                all_items.append({
                    "category": category,
                    "title": item.get("title", ""),
                    "source": "데일리메드",
                    "link": item.get("link", ""),
                    "description": item.get("description", "")[:150],
                    "pubDate": item.get("pubDate", "")
                })
            print(f"✅ [Scraper-AutoHeal] 동적 스크래핑 성공! {len(items)}건 추가 완료.")
    except Exception as e:
        print(f"❌ [Scraper-AutoHeal] 동적 스크래핑 실패: {e}")
    return all_items

def fetch_all_news(feedback=None):
    all_items = []
    sources = get_news_sources()
    
    if feedback:
        # 피드백이 오면 기존 스크래핑 로직 대신(또는 추가로) 자가 치유 로직 가동
        # 재수집 시 기존 RSS도 다시 긁되, 피드백 대상은 동적으로 처리 (시간상 여기서는 동적 치유로 대체)
        # 우선 기존 방식대로 다 긁은 뒤, 부족한 부분을 채웁니다.
        pass

    for source in sources:
        try:
            api_url = f"https://api.rss2json.com/v1/api.json?rss_url={source['url']}"
            response = requests.get(api_url, timeout=10)
            data = response.json()
            
            items = []
            if data.get('status') == 'ok':
                items = data.get('items', [])
            else:
                import xml.etree.ElementTree as ET
                try:
                    res = requests.get(source['url'], timeout=10)
                    root = ET.fromstring(res.content)
                    for item in root.findall('.//item'):
                        items.append({
                            'title': item.findtext('title') or '',
                            'link': item.findtext('link') or '',
                            'description': item.findtext('description') or '',
                            'pubDate': item.findtext('pubDate') or ''
                        })
                except Exception as ex:
                    print(f"Fallback parsing failed for {source['name']}: {ex}")
            
            for item in items[:5]: # 여유있게 5개를 가져와서 필터링
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
    
    if feedback:
        all_items = dynamic_scrape_with_llm(feedback, all_items, sources)
        
    return all_items

if __name__ == "__main__":
    import sys
    # For testing: python skill_fetch_news.py "데일리메드 누락됨"
    fb = sys.argv[1] if len(sys.argv) > 1 else None
    news = fetch_all_news(feedback=fb)
    if not news:
        print(json.dumps({"error": "No news collected or failed."}))
    else:
        print(json.dumps(news, ensure_ascii=False, indent=2))
