import json
import sys

def review_news(news_list):
    """
    Scraper가 수집한 뉴스 리스트를 리뷰하여:
    1. 중복 기사 제거 (제목 기준)
    2. 내용이 없는 불량 기사 필터링
    3. 중요도 순으로 Top N개 엄선
    """
    if not news_list:
        return []

    unique_news = {}
    for n in news_list:
        # 내용이 30자 미만인 빈 껍데기 기사는 필터링
        if len(n.get('description', '')) < 30:
            continue
            
        title = n['title']
        if title not in unique_news:
            unique_news[title] = n
            
    filtered_list = list(unique_news.values())
    
    # 카테고리 우선순위 정렬 (보안/사고 > 병원/의료 > IT/기술 > 기타)
    def sort_key(n):
        cat = n.get('category', '')
        if cat == '보안/사고': return 0
        elif cat == '병원/의료': return 1
        elif cat == 'IT/기술': return 2
        return 3
    
    # 소스별로 기사 그룹화
    source_groups = {}
    for n in filtered_list:
        src = n['source']
        if src not in source_groups:
            source_groups[src] = []
        source_groups[src].append(n)
        
    final_top = []
    
    # 1. 각 소스별로 가장 우선순위가 높은 기사 1개씩 먼저 선발
    for src, items in source_groups.items():
        items.sort(key=sort_key)
        final_top.append(items.pop(0))
        
    # 2. 남은 기사들을 모아서 우선순위 정렬 후 10개를 채움
    remaining_items = []
    for items in source_groups.values():
        remaining_items.extend(items)
        
    remaining_items.sort(key=sort_key)
    
    # 10개가 안 될 수도 있고 넘을 수도 있으므로 10개까지 슬라이싱
    final_top.extend(remaining_items)
    final_top = final_top[:10]
    
    # 최종 결과 다시 카테고리별로 정렬해서 리턴
    final_top.sort(key=sort_key)
    return final_top

if __name__ == "__main__":
    input_data = sys.stdin.read()
    if input_data:
        news = json.loads(input_data)
        filtered = review_news(news)
        print(json.dumps(filtered, ensure_ascii=False, indent=2))
