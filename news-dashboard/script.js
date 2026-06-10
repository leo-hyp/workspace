/**
 * [병원 보안 & IT 프리미엄 뉴스 대시보드 2.0]
 * - 브라우저 자율 분산 스크랩 엔진 100% 복원
 * - 수집 완료 피드 백엔드(/sync) 실시간 백업 동기화 연동
 */

document.addEventListener('DOMContentLoaded', () => {
    let newsData = []; 
    let favorites = [];
    const marketBackup = {
        "삼성전자": "299,250 (▲2.3%)",
        "SK하이닉스": "2,066,000 (▲6.4%)",
        "USD/KRW": "1,385.5 (▲14:00)"
    };

    let newsSources = [
        { name: "전자신문 (IT)", url: "https://news.google.com/rss/search?q=site:etnews.com&hl=ko&gl=KR&ceid=KR:ko" },
        { name: "ZDNet (기술)", url: "https://news.google.com/rss/search?q=site:zdnet.co.kr&hl=ko&gl=KR&ceid=KR:ko" },
        { name: "보안뉴스 (전문)", url: "https://www.boannews.com/media/news_rss.xml" },
        { name: "데일리메드 (병원)", url: "https://news.google.com/rss/search?q=site:dailymedi.com&hl=ko&gl=KR&ceid=KR:ko" },
        { name: "의협신문 (의료)", url: "https://news.google.com/rss/search?q=site:doctorsnews.co.kr&hl=ko&gl=KR&ceid=KR:ko" },
        { name: "연합뉴스 (종합)", url: "https://news.google.com/rss/search?q=site:yna.co.kr&hl=ko&gl=KR&ceid=KR:ko" }
    ];

    let currentSlideIdx = 0;
    let slideInterval;
    const getEl = (id) => document.getElementById(id);

    const init = () => {
        try {
            const savedFavs = localStorage.getItem('hospital_favorites_v1');
            if (savedFavs) favorites = JSON.parse(savedFavs);
            const savedSources = localStorage.getItem('hospital_master_v1');
            if (savedSources) {
                const parsed = JSON.parse(savedSources);
                if (Array.isArray(parsed) && parsed.length > 0) newsSources = parsed;
            }
        } catch(e) {}

        renderSourceList();
        setTodayDate();
        renderFinance(marketBackup);
        
        fetchAllNews();
        fetchFinanceData();

        getEl('slide-speed')?.addEventListener('change', startAutoSlide);
        getEl('refresh-btn')?.addEventListener('click', () => { 
            getEl('refresh-btn').classList.add('spinning');
            fetchAllNews(); 
            fetchFinanceData(); 
            setTimeout(() => getEl('refresh-btn').classList.remove('spinning'), 1000);
        });
        getEl('theme-toggle')?.addEventListener('click', toggleTheme);
        getEl('add-source-btn')?.addEventListener('click', addNewSource);
        getEl('search-input')?.addEventListener('input', () => renderNews(getActiveCategory()));

        document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderNews(btn.getAttribute('data-category'));
        }));

        if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
        
        // 30분 주기로 실시간 수집 및 동기화 자동 동작
        setInterval(() => { fetchAllNews(); fetchFinanceData(); }, 1800000);
    };

    // --- [금융 데이터 수집 엔진] ---
    const fetchFinanceData = async () => {
        let liveData = { ...marketBackup };
        const now = new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit' });

        try {
            // 1. 환율 (Open ER API)
            const exRes = await fetch(`https://open.er-api.com/v6/latest/USD`);
            const exData = await exRes.json();
            if (exData?.rates?.KRW) {
                liveData["USD/KRW"] = `${exData.rates.KRW.toFixed(1)} (▲${now})`;
            }

            // 2. 주가 (네이버 모바일 basic API - 브라우저 직접 로드 우회)
            const symbols = [
                { name: "삼성전자", id: "005930" },
                { name: "SK하이닉스", id: "000660" }
            ];

            const stockResults = await Promise.allSettled(symbols.map(async (s) => {
                const res = await fetch(`https://m.stock.naver.com/api/stock/${s.id}/basic`);
                const data = await res.json();
                if (data && data.closePrice) {
                    const compareType = data.compareToPreviousPrice?.name === "RISING" ? "▲" : "▼";
                    return { name: s.name, val: `${data.closePrice} (${compareType}${data.fluctuationsRatio}%)` };
                }
                throw new Error();
            }));

            stockResults.forEach((res) => {
                if (res.status === 'fulfilled' && res.value) {
                    liveData[res.value.name] = res.value.val;
                }
            });

            renderFinance(liveData);
            
            // 금융 정보 변경에 따른 실시간 백엔드 전송 트리거
            syncDataToBackend(newsData, liveData);
        } catch (e) {
            renderFinance(marketBackup);
        }
    };

    const renderFinance = (data) => {
        const sl = getEl('stock-list'); 
        const el = getEl('exchange-list');
        if (!sl || !el) return;
        sl.innerHTML = ""; el.innerHTML = "";
        
        Object.entries(data).forEach(([name, val]) => {
            const li = document.createElement('li');
            li.className = "finance-item-box";
            const color = val.includes('▲') ? 'var(--accent-red, #ef4444)' : 'var(--accent-blue, #3b82f6)';
            li.innerHTML = `<span>${name}</span><span class="pulse-value" style="color:${color}; font-weight:700;">${val}</span>`;
            if (name.includes("/")) el.appendChild(li); else sl.appendChild(li);
        });
    };

    // --- [근본 브라우저 뉴스 자율 수집 엔진] ---
    const fetchAllNews = async () => {
        const titleEl = getEl('briefing-title');
        if (titleEl) titleEl.textContent = "최신 정보를 동기화하고 있습니다...";
        let allItems = [];
        
        const fetchPromises = newsSources.map(async (source) => {
            try {
                // 브라우저 RSS fetch
                const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}&t=${Date.now()}`, { signal: AbortSignal.timeout(7000) });
                const data = await res.json();
                if (data.status === 'ok' && data.items) {
                    const mapped = data.items.map(item => {
                        const desc = item.description ? item.description.replace(/<[^>]*>?/gm, '').trim() : "";
                        const title = item.title || "";
                        
                        let cat = "사회";
                        if (source.name.includes("보안") || title.includes("보안") || title.includes("해킹") || title.includes("사고")) cat = "보안/사고";
                        else if (source.name.includes("전자") || source.name.includes("ZD") || title.includes("IT") || title.includes("기술") || title.includes("신기술")) cat = "IT/기술";
                        else if (source.name.includes("메드") || source.name.includes("의료") || title.includes("병원") || source.name.includes("의협")) cat = "병원/의료";
                        
                        return { 
                            title, 
                            category: cat, 
                            summary: desc.substring(0, 160), 
                            source: source.name.split(' ')[0], 
                            date: item.pubDate, 
                            link: item.link, 
                            priority: cat !== "사회" 
                        };
                    });
                    
                    // 영문 기사 필터링 (제목 및 요약에 한글이 없는 완전 영문 피드 배제)
                    const filtered = mapped.filter(item => {
                        const hasKoreanInTitle = /[가-힣]/.test(item.title);
                        const hasKoreanInDesc = /[가-힣]/.test(item.summary);
                        return hasKoreanInTitle && hasKoreanInDesc;
                    });
                    
                    allItems = [...allItems, ...filtered];
                    updateDisplay(allItems);
                }
            } catch (e) {
                console.error(`채널 수집 오류 (${source.name}):`, e);
            }
        });
        
        await Promise.allSettled(fetchPromises);
    };

    const updateDisplay = (items) => {
        const seen = new Set();
        newsData = items.filter(item => {
            if (!item.title || seen.has(item.title)) return false;
            seen.add(item.title);
            return true;
        });
        
        renderNews(getActiveCategory());
        startAutoSlide();
        
        // 뉴스 갱신 성공 시 서버사이드 동기화 전송 트리거 구동
        const currentFinance = {};
        document.querySelectorAll('#stock-list li, #exchange-list li').forEach(li => {
            const spans = li.querySelectorAll('span');
            if (spans.length >= 2) currentFinance[spans[0].textContent] = spans[1].textContent;
        });
        syncDataToBackend(newsData, currentFinance);
    };

    // --- [서버사이드 백엔드 동기화 전송 모듈] ---
    const syncDataToBackend = async (news, finance) => {
        if (!news || news.length === 0) return;
        
        // 동기화 시도 중 비주얼 처리
        const syncStatus = getEl('sync-status');
        if (syncStatus) {
            syncStatus.innerHTML = "🟡 동기화 중...";
            syncStatus.style.color = "#f59e0b";
            syncStatus.style.background = "rgba(245, 158, 11, 0.08)";
            syncStatus.style.borderColor = "rgba(245, 158, 11, 0.15)";
        }
        
        // 서버사이드 데이터 스펙 포맷 조립
        const payload = {
            finance: finance,
            news: news.map(n => ({
                category: n.category,
                title: n.title,
                source: n.source,
                link: n.link,
                description: n.summary,
                pubDate: n.date
            })),
            sources: newsSources
        };

        try {
            const res = await fetch('/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const result = await res.json();
                console.log("✅ [Medi-IT 2.0] 서버 동기화 성공:", result);
                if (syncStatus) {
                    syncStatus.innerHTML = "🟢 동기화 완료";
                    syncStatus.style.color = "#10b981";
                    syncStatus.style.background = "rgba(16, 185, 129, 0.08)";
                    syncStatus.style.borderColor = "rgba(16, 185, 129, 0.15)";
                }
                if (getEl('briefing-time')) {
                    getEl('briefing-time').textContent = `🔄 백엔드 동기화 완료: ${new Date().toLocaleTimeString('ko-KR', {hour12:false})}`;
                }
            }
        } catch (e) {
            console.warn("⚠️ 백엔드 로컬 동기화 지연 (독립 실행 중):", e);
            if (syncStatus) {
                syncStatus.innerHTML = "🔴 로컬 연동 중";
                syncStatus.style.color = "#ef4444";
                syncStatus.style.background = "rgba(239, 68, 68, 0.08)";
                syncStatus.style.borderColor = "rgba(239, 68, 68, 0.15)";
            }
        }
    };

    const renderNews = (filter = "전체") => {
        const grid = getEl('news-grid');
        if (!grid) return;
        
        const search = getEl('search-input')?.value.toLowerCase() || "";
        let displayList = (filter === "관심기사") ? [...favorites] : [...newsData];
        
        if (filter !== "전체" && filter !== "관심기사") {
            displayList = displayList.filter(i => i.category === filter);
        }
        if (search) {
            displayList = displayList.filter(i => i.title.toLowerCase().includes(search));
        }
        
        // 보안/사고 기사 및 병원 의료 기사 최상단 정렬
        displayList.sort((a, b) => {
            const aPriority = a.category === "보안/사고" ? 2 : (a.priority ? 1 : 0);
            const bPriority = b.category === "보안/사고" ? 2 : (b.priority ? 1 : 0);
            return bPriority - aPriority || new Date(b.date) - new Date(a.date);
        });

        grid.innerHTML = displayList.map(n => {
            const bc = n.category === '보안/사고' ? 'security' : (n.category === 'IT/기술' ? 'tech' : (n.category === '병원/의료' ? 'hospital' : 'default'));
            const isFav = favorites.some(f => f.link === n.link);
            return `
                <article class="news-card" onclick="window.open('${n.link}', '_blank')">
                    <button class="heart-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${JSON.stringify(n).replace(/"/g, '&quot;')})">
                        ${isFav ? '❤️' : '🤍'}
                    </button>
                    <div class="news-card-body">
                        <span class="category-badge ${bc}">${n.category}</span>
                        <h3>${n.title}</h3>
                        <p class="news-summary">${n.summary.substring(0, 85)}...</p>
                    </div>
                    <div class="news-footer">
                        <span class="source">📡 ${n.source}</span>
                        <button class="view-btn" onclick="event.stopPropagation(); showBriefing('${n.title.replace(/'/g, "\\'")}', '${n.summary.replace(/'/g, "\\'").replace(/\n/g, " ")}', '${n.link}')">브리핑 요약</button>
                    </div>
                </article>
            `;
        }).join('');
    };

    window.toggleFavorite = (news) => {
        const idx = favorites.findIndex(f => f.link === news.link);
        if (idx > -1) favorites.splice(idx, 1); else favorites.push(news);
        localStorage.setItem('hospital_favorites_v1', JSON.stringify(favorites));
        renderNews(getActiveCategory());
    };

    const updateBriefingZone = () => {
        const featured = newsData.filter(n => n.category === "보안/사고" || n.category === "병원/의료");
        if (featured.length === 0 || !getEl('briefing-content')) return;
        const currentIdx = currentSlideIdx % featured.length;
        const news = featured[currentIdx];
        const content = getEl('briefing-content');
        
        content.style.opacity = 0;
        content.style.transform = 'translateY(10px)';
        
        // 도트 슬라이드 동적 렌더링 및 연동
        const dotsContainer = getEl('slide-dots');
        if (dotsContainer) {
            dotsContainer.innerHTML = featured.map((_, idx) => 
                `<span class="dot ${idx === currentIdx ? 'active' : ''}" onclick="event.stopPropagation(); window.goToSlide(${idx})"></span>`
            ).join('');
        }
        
        setTimeout(() => {
            if (getEl('briefing-title')) getEl('briefing-title').textContent = news.title;
            if (getEl('briefing-summary')) getEl('briefing-summary').textContent = news.summary;
            if (getEl('briefing-source')) getEl('briefing-source').textContent = `📡 주요 브리핑 소스: ${news.source}`;
            
            content.style.opacity = 1;
            content.style.transform = 'translateY(0)';
            content.onclick = () => { if (news.link && news.link !== '#') window.open(news.link, '_blank'); };
        }, 200);
    };

    window.goToSlide = (idx) => {
        currentSlideIdx = idx;
        updateBriefingZone();
        startAutoSlide();
    };

    const startAutoSlide = () => {
        if (slideInterval) clearInterval(slideInterval);
        const featured = newsData.filter(n => n.category === "보안/사고" || n.category === "병원/의료");
        if (featured.length === 0) return;
        
        slideInterval = setInterval(() => {
            currentSlideIdx = (currentSlideIdx + 1) % featured.length; 
            updateBriefingZone(); 
        }, (parseInt(getEl('slide-speed')?.value) || 5) * 1000);
    };

    const renderSourceList = () => {
        const list = getEl('source-list');
        if (list) list.innerHTML = newsSources.map((s, idx) => `
            <li class="source-item">
                <span>📡 ${s.name}</span>
                <button class="delete-btn" onclick="removeSourceItem(${idx})">삭제</button>
            </li>
        `).join('');
    };

    window.removeSourceItem = (idx) => { 
        if (confirm("채널 삭제?")) { 
            newsSources.splice(idx, 1); 
            localStorage.setItem('hospital_master_v1', JSON.stringify(newsSources)); 
            renderSourceList(); 
            fetchAllNews(); 
        } 
    };
    
    const addNewSource = () => { 
        const n = prompt("채널 이름:"); 
        const u = prompt("RSS 주소:"); 
        if (n && u) { 
            newsSources.push({ name: n, url: u }); 
            localStorage.setItem('hospital_master_v1', JSON.stringify(newsSources)); 
            renderSourceList(); 
            fetchAllNews(); 
        } 
    };
    
    window.showBriefing = (title, summary, link) => {
        const body = getEl('modal-body');
        if (body) {
            body.innerHTML = `
                <h2>🛡️ AI 브리핑 상세 요약</h2>
                <hr style="margin:1rem 0; opacity:0.1; border:none; border-top:1px solid var(--border);">
                <h3 style="font-size:1.25rem; margin-bottom:1rem; line-height:1.4;">${title}</h3>
                <p style="font-size:1.05rem; line-height:1.7; color: var(--text-secondary); background:var(--bg-page); padding:1.5rem; border-radius:15px; border:1px solid var(--border);">${summary}</p>
                <button onclick="window.open('${link}', '_blank')" style="width:100%; padding:15px; margin-top:2rem; background:var(--accent-blue); color:white; border:none; border-radius:12px; cursor:pointer; font-weight:700; transition:0.2s;">기사 원문으로 즉시 이동</button>
            `;
            getEl('news-modal').style.display = "block";
        }
    };
    
    const toggleTheme = () => { 
        document.body.classList.toggle('dark-mode'); 
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); 
    };
    
    const setTodayDate = () => { 
        if (getEl('today-date')) {
            getEl('today-date').textContent = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }); 
        }
    };
    
    const getActiveCategory = () => document.querySelector('.tab-btn.active')?.getAttribute('data-category') || "전체";
    
    if (getEl('news-modal')) { 
        document.querySelector('.close-btn').onclick = () => getEl('news-modal').style.display = 'none'; 
        window.onclick = (e) => { if (e.target === getEl('news-modal')) getEl('news-modal').style.display = 'none'; }; 
    }

    init();
});
