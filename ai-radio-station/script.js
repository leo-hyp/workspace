document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const audioPlayer = document.getElementById('audio-player');
    const btnBuild = document.getElementById('btn-build');
    const btnPlay = document.getElementById('btn-play');
    const btnPause = document.getElementById('btn-pause');
    const btnStop = document.getElementById('btn-stop');
    const screenMessage = document.getElementById('screen-message');
    const digitalCounter = document.getElementById('digital-counter');
    const radioTopic = document.getElementById('radio-topic');
    const scriptBox = document.getElementById('script-box');
    const newsFeedList = document.getElementById('news-feed-list');
    const retroDeck = document.querySelector('.retro-deck');
    const vuBars = document.querySelectorAll('.bar');

    let audioCtx = null;
    let analyser = null;
    let sourceNode = null;
    let animationFrameId = null;
    let lines = [];
    let cumulativeRatios = []; // 실시간 자막 밀도 기반 정확한 포커싱 비율 배열
    let isGenerating = false;

    // Button Event Listeners
    btnBuild.addEventListener('click', generateBroadcast);
    btnPlay.addEventListener('click', startPlayback);
    btnPause.addEventListener('click', pausePlayback);
    btnStop.addEventListener('click', stopPlayback);

    // Initial Button States
    btnPause.disabled = true;
    btnStop.disabled = true;
    
    // Audio Player Ended Event
    audioPlayer.addEventListener('ended', () => {
        stopPlayback();
    });

    // Select All News Logic
    const newsSelectAll = document.getElementById('news-select-all');
    if (newsSelectAll) {
        newsSelectAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.news-feed-item').forEach(item => {
                const cb = item.querySelector('input[type="checkbox"]');
                if (cb) {
                    cb.checked = isChecked;
                    if (isChecked) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                }
            });
        });
    }

    // Handle preset theme chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            radioTopic.value = chip.getAttribute('data-topic');
            radioTopic.style.borderColor = 'var(--cyber-cyan)';
            setTimeout(() => {
                radioTopic.style.borderColor = '';
            }, 1000);
        });
    });

    // Horizontal & Vertical Draggable Resizers
    const vDivider = document.getElementById('v-divider');
    const playerSection = document.querySelector('.player-section');
    const mainContent = document.querySelector('.main-content');

    vDivider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        vDivider.classList.add('active');
        const startX = e.clientX;
        const startWidth = playerSection.getBoundingClientRect().width;

        const onMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = startWidth + deltaX;
            if (newWidth >= 380 && newWidth <= 650) {
                playerSection.style.width = `${newWidth}px`;
            }
        };

        const onMouseUp = () => {
            vDivider.classList.remove('active');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    const hDivider = document.getElementById('h-divider');
    const controlPanel = document.querySelector('.control-panel');

    hDivider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        hDivider.classList.add('active');
        const startY = e.clientY;
        const startHeight = controlPanel.getBoundingClientRect().height;

        const onMouseMove = (moveEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const newHeight = startHeight + deltaY;
            if (newHeight >= 250 && newHeight <= 520) {
                controlPanel.style.height = `${newHeight}px`;
            }
        };

        const onMouseUp = () => {
            hDivider.classList.remove('active');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // Set interactive select for news feed items
    newsFeedList.addEventListener('click', (e) => {
        const item = e.target.closest('.news-feed-item');
        if (item) {
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
            }
            if (checkbox.checked) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        }
    });

    // Time counter formatter & Real-time Subtitle Auto-Focus Sync
    audioPlayer.addEventListener('timeupdate', () => {
        const mins = Math.floor(audioPlayer.currentTime / 60).toString().padStart(2, '0');
        const secs = Math.floor(audioPlayer.currentTime % 60).toString().padStart(2, '0');
        digitalCounter.textContent = `${mins}:${secs}`;

        // ⏱️ 글자 수 가속도 모델 기반 정밀한 실시간 자막 싱크 추적
        if (lines.length > 0 && cumulativeRatios.length === lines.length) {
            const currentRatio = audioPlayer.currentTime / audioPlayer.duration;
            let targetIndex = 0;
            
            // 현재 시간비에 매칭되는 대사 색인 검색
            for (let i = 0; i < cumulativeRatios.length; i++) {
                if (currentRatio <= cumulativeRatios[i]) {
                    targetIndex = i;
                    break;
                }
            }
            
            const bubbles = scriptBox.querySelectorAll('.line-bubble');
            bubbles.forEach((bubble, idx) => {
                if (idx === targetIndex) {
                    bubble.style.borderColor = 'var(--accent-yellow)';
                    bubble.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.3)';
                    // 대본 읽는 라인 자동 중앙 스냅 스크롤
                    bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } else {
                    bubble.style.borderColor = '';
                    bubble.style.boxShadow = '';
                }
            });
        }
    });

    // Premium Maximize Panel Toggles (확대 축소 기능)
    document.querySelectorAll('.maximize-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetClass = btn.getAttribute('data-target');
            const targetEl = document.querySelector(`.${targetClass}`);
            
            if (targetEl) {
                targetEl.classList.toggle('maximized');
                if (targetEl.classList.contains('maximized')) {
                    btn.textContent = '🗗';
                    btn.setAttribute('title', '창 이전 크기로 복원');
                } else {
                    btn.textContent = '🗖';
                    btn.setAttribute('title', '창 최대화');
                }
                // 실시간 스펙트럼 캔버스 사이즈 보정
                setTimeout(resizeCanvas, 350);
            }
        });
    });

    // URL 뉴스 링크 파싱 (Link Parser)
    const btnFetchUrl = document.getElementById('btn-fetch-url');
    const urlInput = document.getElementById('url-input');

    btnFetchUrl.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return;

        btnFetchUrl.disabled = true;
        btnFetchUrl.textContent = "분석 중...";
        
        try {
            const res = await fetch('/fetch-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (data.status === 'success') {
                radioTopic.value += `\n\n[참고 기사 외부 링크 요약 정보]\n${data.summary}`;
                urlInput.value = "";
                // 📜 텍스트 박스 맨 아래로 스크롤 이동 및 포커스 (주입 인지율 극대화)
                radioTopic.scrollTop = radioTopic.scrollHeight;
                radioTopic.focus();
                
                // 성공 알림 글로우
                radioTopic.style.borderColor = 'var(--cyber-cyan)';
                setTimeout(() => { radioTopic.style.borderColor = ''; }, 1500);
            } else {
                alert("링크 분석 실패: " + data.message);
            }
        } catch (err) {
            alert("연결 중 에러 발생: " + err.message);
        } finally {
            btnFetchUrl.disabled = false;
            btnFetchUrl.textContent = "링크 주입";
        }
    });

    // AI 주제 기사 검색 및 동적 피드 수집 (Search & Feed Checklist)
    const btnSearchTopic = document.getElementById('btn-search-topic');
    const searchInput = document.getElementById('search-input');

    btnSearchTopic.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        if (!query) return;

        btnSearchTopic.disabled = true;
        btnSearchTopic.textContent = "수집 중...";
        
        try {
            const res = await fetch('/search-topic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const data = await res.json();
            if (data.status === 'success') {
                // 기존 기사 체크리스트 비우고 동적 검색결과 채우기
                newsFeedList.innerHTML = "";
                
                data.results.forEach((item) => {
                    const card = document.createElement('div');
                    card.className = "news-feed-item selected";
                    card.setAttribute('data-title', item.title);
                    card.setAttribute('data-desc', item.description);
                    
                    card.innerHTML = `
                        <input type="checkbox" checked>
                        <div class="feed-text">
                            <strong>${item.title}</strong>
                            <span>${item.description}</span>
                        </div>
                    `;
                    newsFeedList.appendChild(card);
                });
                
                searchInput.value = "";
            } else {
                alert("이슈 수집 실패: " + data.message);
            }
        } catch (err) {
            alert("연결 중 에러 발생: " + err.message);
        } finally {
            btnSearchTopic.disabled = false;
            btnSearchTopic.textContent = "이슈 수집";
        }
    });

    // Holographic Canvas Visualizer Setup
    const canvas = document.getElementById('visualizer-canvas');
    const ctx = canvas.getContext('2d');

    // Resize canvas to match its client dimensions
    function resizeCanvas() {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle class for futuristic particles floating in hologram
    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = canvas.width / 2;
            this.y = canvas.height / 2;
            this.angle = Math.random() * Math.PI * 2;
            this.speed = Math.random() * 2 + 1;
            this.size = Math.random() * 2 + 0.5;
            this.color = Math.random() > 0.5 ? 'rgba(6, 182, 212, ' : 'rgba(236, 72, 153, ';
            this.alpha = 1;
            this.fadeSpeed = Math.random() * 0.02 + 0.005;
        }
        update(intensity) {
            this.x += Math.cos(this.angle) * this.speed * (1 + intensity * 0.05);
            this.y += Math.sin(this.angle) * this.speed * (1 + intensity * 0.05);
            this.alpha -= this.fadeSpeed;
            if (this.alpha <= 0 || this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
                this.reset();
            }
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color + this.alpha + ')';
            ctx.fill();
        }
    }

    const particles = Array.from({ length: 30 }, () => new Particle());
    let visualizerFrameId = null;

    // Permanent Hologram Drawing Loop
    function drawHologram() {
        visualizerFrameId = requestAnimationFrame(drawHologram);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const time = Date.now() * 0.003;
        
        let freqData = new Uint8Array(32);
        let averageIntensity = 0;
        
        if (analyser && !audioPlayer.paused && !audioPlayer.ended) {
            analyser.getByteFrequencyData(freqData);
            let sum = 0;
            for (let i = 0; i < freqData.length; i++) sum += freqData[i];
            averageIntensity = sum / freqData.length;
        }

        // Draw background grid lines (cyberpunk breathing mesh)
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.03)';
        ctx.lineWidth = 1;
        const gridSpacing = 20;
        for (let x = 0; x < canvas.width; x += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        if (audioPlayer.paused || audioPlayer.ended) {
            // Idle breathing sine wave
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
            ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
            ctx.shadowBlur = 10;
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            for (let x = 0; x < canvas.width; x += 5) {
                const breathingAmp = Math.sin(time) * 10 + 15;
                const y = centerY + Math.sin(x * 0.01 + time) * breathingAmp;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // reset
        } else {
            // Active Live Holographic Radar Waveform
            const baseRadius = 50 + averageIntensity * 0.3;
            
            // Draw particles radiating from center
            particles.forEach(p => {
                p.update(averageIntensity);
                p.draw();
            });
            
            // Neon shadow glow
            ctx.shadowBlur = 15;
            
            // Inner glowing circle (Reacting core)
            ctx.beginPath();
            ctx.arc(centerX, centerY, baseRadius * 0.7, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.6)';
            ctx.shadowColor = 'rgba(236, 72, 153, 0.8)';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Outer frequency audio waveform circular nodes
            ctx.beginPath();
            const points = 60;
            for (let i = 0; i < points; i++) {
                const angle = (i / points) * Math.PI * 2;
                const dataIndex = Math.floor((i / points) * freqData.length);
                const magnitude = freqData[dataIndex % freqData.length] * 0.25;
                const r = baseRadius + magnitude;
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
            ctx.shadowColor = 'rgba(6, 182, 212, 1)';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Outer pulsing concentric rings
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(centerX, centerY, baseRadius * 1.3, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    // Start hologram loop immediately
    drawHologram();

    // Audio Visualizer Setup (Web Audio API)
    function initVisualizer() {
        if (audioCtx) return;
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            
            sourceNode = audioCtx.createMediaElementSource(audioPlayer);
            sourceNode.connect(analyser);
            analyser.connect(audioCtx.destination);
        } catch (err) {
            console.warn("Web Audio API blocked or not supported on this browser:", err);
        }
    }

    function renderVisualizer() {
        if (!analyser) return;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            if (audioPlayer.paused || audioPlayer.ended) {
                vuBars.forEach(bar => bar.style.height = '5%');
                return;
            }
            
            animationFrameId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            vuBars.forEach((bar, index) => {
                const value = dataArray[index % bufferLength];
                const percent = Math.max(5, Math.min(100, (value / 255) * 100));
                bar.style.height = `${percent}%`;
            });
        };
        draw();
    }

    // Build trigger
    async function generateBroadcast() {
        if (isGenerating) return;
        isGenerating = true;
        
        btnBuild.disabled = true;
        btnPlay.disabled = true;
        btnPause.disabled = true;
        btnStop.disabled = true;
        btnBuild.style.opacity = 0.6;
        screenMessage.textContent = "🎙️ AI 방송 조립 및 극본 창작 중 (Gemini 3.5)...";
        scriptBox.innerHTML = '<p class="placeholder-text">🤖 Gemini 3.5 엔진이 유쾌하고 깐깐한 두 DJ의 방송 만담 대본을 창작하고 있습니다. 잠시만 기다리세요...</p>';

        // Gather news context
        const selectedNews = [];
        document.querySelectorAll('.news-feed-item.selected').forEach(item => {
            selectedNews.push({
                title: item.getAttribute('data-title'),
                description: item.getAttribute('data-desc')
            });
        });

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: radioTopic.value,
                    tone: document.getElementById('radio-tone').value,
                    length: document.getElementById('radio-length').value,
                    news: selectedNews
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                audioPlayer.src = `${data.audioUrl}?t=${Date.now()}`; // Prevent browser cache
                screenMessage.textContent = "🎙️ 방송 완성! [PLAY] 버튼을 누르세요.";
                renderScriptJson(data.script);
            } else {
                throw new Error(data.message || "라디오 합성 에러");
            }
        } catch (err) {
            console.error(err);
            screenMessage.textContent = "❌ 생성 실패: " + err.message;
            scriptBox.innerHTML = `<p class="placeholder-text" style="color: var(--accent-red)">⚠️ 방송 생성 중 에러가 발생했습니다. 다시 시도하십시오.</p>`;
        } finally {
            isGenerating = false;
            btnBuild.disabled = false;
            btnPlay.disabled = false;
            btnBuild.style.opacity = 1;
        }
    }

    // Playing functions
    function startPlayback() {
        if (isGenerating) return;
        
        initVisualizer();
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        audioPlayer.play().then(() => {
            retroDeck.classList.add('playing');
            screenMessage.textContent = "📻 LIVE 방송 송출 중...";
            btnBuild.disabled = true;
            btnPlay.disabled = true;
            btnPause.disabled = false;
            btnStop.disabled = false;
            renderVisualizer();
        }).catch(err => {
            console.warn("Audio play blocked by browser:", err);
            screenMessage.textContent = "⚠️ 재생 차단됨. 다시 클릭하세요.";
        });
    }

    function pausePlayback() {
        audioPlayer.pause();
        retroDeck.classList.remove('playing');
        screenMessage.textContent = "⏸️ 방송 일시 정지됨.";
        btnBuild.disabled = false;
        btnPlay.disabled = false;
        btnPause.disabled = true;
        btnStop.disabled = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    }

    function stopPlayback() {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        retroDeck.classList.remove('playing');
        screenMessage.textContent = "⏹️ 방송 정지됨. 대기 중.";
        digitalCounter.textContent = "00:00";
        btnBuild.disabled = false;
        btnPlay.disabled = false;
        btnPause.disabled = true;
        btnStop.disabled = true;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        vuBars.forEach(bar => bar.style.height = '5%');
    }

    // Render clean JSON-structured dialogue bubbles beautifully & calculate real-time ratios
    function renderScriptJson(scriptArray) {
        scriptBox.innerHTML = "";
        lines = scriptArray;
        
        // ⏱️ 각 대사 글자 길이 계산하여 누적 시간비(Ratios) 산출 (리얼타임 자막 싱크 패치)
        let totalChars = 0;
        const lineLengths = lines.map(line => {
            const len = line.text.length;
            totalChars += len;
            return len;
        });

        let accum = 0;
        cumulativeRatios = lines.map((line, idx) => {
            accum += lineLengths[idx];
            return accum / totalChars;
        });
        
        lines.forEach((line) => {
            const speaker = line.speaker;
            const content = line.text;
            const speakerClass = speaker === 'LEO' ? 'dj-leo' : 'dj-anti';

            const bubble = document.createElement('div');
            bubble.className = `line-bubble ${speakerClass}`;
            bubble.innerHTML = `<span class="speaker-name">${speaker}</span>${content}`;
            scriptBox.appendChild(bubble);
        });

        if (lines.length === 0) {
            scriptBox.innerHTML = '<p class="placeholder-text">대본이 비어 있습니다.</p>';
        } else {
            scriptBox.scrollTop = 0;
        }
    }

    // 📡 페이지 로드 시 "실시간 뉴스 데이터 피드"에 다이내믹 AI 보안/테크 뉴스 주입 자동화
    async function loadDynamicNewsFeed() {
        try {
            const res = await fetch('/search-topic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: "의료 IT 및 사물인터넷 사이버 보안 사고 동향" })
            });
            const data = await res.json();
            if (data.status === 'success') {
                newsFeedList.innerHTML = "";
                data.results.forEach((item) => {
                    const card = document.createElement('div');
                    card.className = "news-feed-item selected";
                    card.setAttribute('data-title', item.title);
                    card.setAttribute('data-desc', item.description);
                    
                    card.innerHTML = `
                        <input type="checkbox" checked>
                        <div class="feed-text">
                            <strong>${item.title}</strong>
                            <span>${item.description}</span>
                        </div>
                    `;
                    newsFeedList.appendChild(card);
                });
            }
        } catch (err) {
            console.warn("기본 다이내믹 기사 피드 로드 오류 폴백:", err);
        }
    }
    // 최초 구동 즉시 로드
    loadDynamicNewsFeed();
});
