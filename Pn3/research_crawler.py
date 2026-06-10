import requests
import json
import xml.etree.ElementTree as ET
from datetime import datetime
import os
import sys
import io

# Set encoding to utf-8 to handle emojis and Korean characters on Windows terminals
sys.stdout = io.TextIOWrapper(sys.stdout.detach(), encoding='utf-8')

RESEARCH_FEEDS = [
    {"name": "보안뉴스 (사고/보안)", "url": "https://www.boannews.com/media/news_rss.xml"},
    {"name": "전자신문 (IT/인프라)", "url": "https://news.google.com/rss/search?q=site:etnews.com+AND+(%22AI%22+OR+%22%EB%B3%B4%EC%95%88%22+OR+%22%EB%A1%9C%EB%B4%87%22)&hl=ko&gl=KR&ceid=KR:ko"},
    {"name": "ZDNet (글로벌기술)", "url": "https://news.google.com/rss/search?q=site:zdnet.co.kr+AND+(%22AI%22+OR+%22%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8%22)&hl=ko&gl=KR&ceid=KR:ko"},
    {"name": "Google News (AI 에이전트)", "url": "https://news.google.com/rss/search?q=%22AI+%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8%22+OR+%22AI+Agent%22&hl=ko&gl=KR&ceid=KR:ko"},
    {"name": "Google News (자율주행/로봇)", "url": "https://news.google.com/rss/search?q=%22%EC%9E%90%EC%9C%A8+%EB%A1%9C%EB%B4%87%22+OR+%22Autonomous+Robot%22&hl=ko&gl=KR&ceid=KR:ko"}
]

def fetch_rss_feed(feed):
    items = []
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        res = requests.get(feed["url"], headers=headers, timeout=15)
        if res.status_code != 200:
            return items
            
        # Handle multi-byte XML encoding for libraries like ElementTree in Python
        content_bytes = res.content
        try:
            encoding = res.apparent_encoding or 'utf-8'
            xml_str = content_bytes.decode(encoding, errors='ignore')
        except Exception:
            xml_str = content_bytes.decode('euc-kr', errors='ignore')
            
        # Replace multi-byte encoding in XML declaration with utf-8 to prevent parser crash
        if 'encoding=' in xml_str:
            import re
            xml_str = re.sub(r'encoding=["\'][a-zA-Z0-9_-]+["\']', 'encoding="utf-8"', xml_str, count=1)
            
        root = ET.fromstring(xml_str.encode('utf-8'))
        channel = root.find("channel")
        if channel is None:
            return items
            
        for item in channel.findall("item")[:5]: # 피드당 최신 5개 기사 수집
            title = item.find("title").text if item.find("title") is not None else ""
            link = item.find("link").text if item.find("link") is not None else ""
            pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
            description = item.find("description").text if item.find("description") is not None else ""
            
            # Clean HTML description
            if description:
                description = description.split("<")[0].strip() # Simple HTML strip
                
            items.append({
                "title": title,
                "source": feed["name"],
                "link": link,
                "pubDate": pub_date,
                "description": description
            })
    except Exception as e:
        print(f"⚠️ Error fetching {feed['name']}: {e}")
    return items

def run_crawler(output_dir=None):
    print("🚀 [Medi-IT Research Crawler] Starting collection...")
    all_news = []
    for feed in RESEARCH_FEEDS:
        print(f"Scraping {feed['name']}...")
        feed_items = fetch_rss_feed(feed)
        print(f"Collected {len(feed_items)} articles from {feed['name']}.")
        all_news.extend(feed_items)
        
    if output_dir is None:
        output_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(output_dir, "research_output.json")
    
    data = {
        "lastUpdated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "articles": all_news
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Total {len(all_news)} articles saved successfully to {output_path}!")
    return all_news

if __name__ == "__main__":
    run_crawler()
