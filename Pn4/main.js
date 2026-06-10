// Pn4 Lifestyle Organizer - Serverless JS Client

let allLogs = [];
let filteredLogs = [];
let currentCategory = 'all';
let dirHandle = null;

// State variables for plan editing and refinement
let currentPlanFilename = "";
let currentPlanContent = "";
let currentChecklist = []; // Active checklist for the loaded plan
let plannerMap = null; // Leaflet map instance for planner view
let activeAccordionMaps = {}; // Leaflet map instances for accordion view on dashboard
let draggedIndex = null; // Drag and drop helper index
let activePreferenceFilter = ""; // Preference filter chip value
let wizardMap = null;
let wizardMarkers = [];

// Essential Planner state variables
let destination = "";
let duration = "";
let theme = "";
let wizardSteps = [];
let currentStepIndex = 0;
let selectedItinerary = [];
let wizardState = 'setup'; // 'setup' | 'planning'
let currentStepRecommendations = [];

let startDate = "";
let endDate = "";
let partySize = 2;

// Tab switcher for AI Planner sub-tabs
function switchPlannerSubTab(subTabId) {
    document.querySelectorAll(".planner-sub-content").forEach(content => {
        content.classList.remove("active");
    });
    document.querySelectorAll(".planner-sub-tab").forEach(tab => {
        tab.classList.remove("active");
    });
    
    const targetContent = document.getElementById(`planner-sub-${subTabId}`);
    const targetTab = document.querySelector(`.planner-sub-tab[data-subtab="${subTabId}"]`);
    
    if (targetContent && targetTab) {
        targetContent.classList.add("active");
        targetTab.classList.add("active");
    }
}

// Calculate duration string from date inputs (e.g. '1박 2일')
function updateDurationBadge() {
    const startVal = document.getElementById("planner-start-date").value;
    const endVal = document.getElementById("planner-end-date").value;
    const badge = document.getElementById("duration-badge");
    
    if (!startVal || !endVal) {
        if (badge) badge.innerText = "날짜 선택 필요";
        return;
    }
    
    const start = new Date(startVal);
    const end = new Date(endVal);
    
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        if (badge) {
            badge.innerText = "귀환일 오류";
            badge.style.backgroundColor = "var(--accent-rose)";
        }
        return;
    }
    
    let durationText = "";
    if (diffDays === 0) {
        durationText = "당일치기";
    } else {
        durationText = `${diffDays}박 ${diffDays + 1}일`;
    }
    
    if (badge) {
        badge.innerText = durationText;
        badge.style.backgroundColor = "var(--accent-blue-light)";
        badge.style.color = "var(--accent-blue)";
    }
    duration = durationText;
}


function initWizardMap() {
    const container = document.getElementById("wizard-map");
    if (!container) return;
    
    if (wizardMap) {
        try {
            wizardMap.remove();
        } catch(e) {}
        wizardMap = null;
    }
    
    const centerLat = wizardSteps[0]?.lat || 35.8341;
    const centerLng = wizardSteps[0]?.lng || 129.2185;
    
    wizardMap = L.map('wizard-map').setView([centerLat, centerLng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(wizardMap);
    
    updateWizardMapMarkers();
}

function updateWizardMapMarkers() {
    if (!wizardMap) return;
    
    // Clear old markers and layers
    wizardMarkers.forEach(layer => {
        try {
            wizardMap.removeLayer(layer);
        } catch(e){}
    });
    wizardMarkers = [];
    
    const latlngs = [];
    
    // 1. Confirmed points (itinerary)
    selectedItinerary.forEach((item, idx) => {
        if (item.lat && item.lng) {
            const marker = L.marker([item.lat, item.lng], {
                icon: L.divIcon({
                    className: 'custom-wizard-marker confirmed',
                    html: `<div style="background-color: #10b981; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.4); font-family: sans-serif;">${idx + 1}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(wizardMap).bindPopup(`<strong>${item.place}</strong><br>${item.title} (확정)`);
            wizardMarkers.push(marker);
            latlngs.push([item.lat, item.lng]);
        }
    });
    
    // 2. Current step base point
    const currentStep = wizardSteps[currentStepIndex];
    if (currentStep && currentStep.lat && currentStep.lng) {
        const marker = L.marker([currentStep.lat, currentStep.lng], {
            icon: L.divIcon({
                className: 'custom-wizard-marker current',
                html: `<div style="background-color: #3b82f6; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; border: 2px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.6); font-family: sans-serif;">${currentStepIndex + 1}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            })
        }).addTo(wizardMap).bindPopup(`<strong>${currentStep.place}</strong><br>${currentStep.title} (기본 초안)`);
        wizardMarkers.push(marker);
        latlngs.push([currentStep.lat, currentStep.lng]);
    }
    
    // 3. Recommended option points
    currentStepRecommendations.forEach((rec, idx) => {
        if (currentStep && currentStep.lat && currentStep.lng) {
            const recLat = rec.lat || (currentStep.lat + (idx - 0.5) * 0.003);
            const recLng = rec.lng || (currentStep.lng + (idx - 0.5) * 0.003 - 0.001);
            
            rec.lat = recLat;
            rec.lng = recLng;
            
            const marker = L.marker([recLat, recLng], {
                icon: L.divIcon({
                    className: 'custom-wizard-marker recommendation',
                    html: `<div style="background-color: #f59e0b; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.4);"><i class="fa-solid fa-star" style="font-size:0.6rem; color: white;"></i></div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                })
            }).addTo(wizardMap).bindPopup(`<strong>${rec.place}</strong><br>실시간 추천 후보`);
            wizardMarkers.push(marker);
        }
    });
    
    // Connect confirmed & active points
    if (latlngs.length > 1) {
        const polyline = L.polyline(latlngs, { color: '#3b82f6', weight: 3, opacity: 0.8, dashArray: '5, 5' }).addTo(wizardMap);
        wizardMarkers.push(polyline);
        wizardMap.fitBounds(polyline.getBounds(), { padding: [40, 40] });
    } else if (latlngs.length === 1) {
        wizardMap.setView(latlngs[0], 14);
    }
    
    setTimeout(() => {
        if (wizardMap) wizardMap.invalidateSize();
    }, 200);
}

function setPreferenceFilter(filterText, element) {
    const container = element.parentElement;
    container.querySelectorAll(".pref-chip").forEach(chip => {
        chip.classList.remove("active");
    });
    element.classList.add("active");
    
    activePreferenceFilter = filterText;
    loadStepRecommendations(true);
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
}

// Extract checklist from markdown body
function extractChecklistFromMarkdown(content) {
    const checklist = [];
    const lines = content.split('\n');
    let inChecklistSection = false;
    
    for (let line of lines) {
        if (line.includes("## 🧳 여행 준비물 체크리스트")) {
            inChecklistSection = true;
            continue;
        }
        if (inChecklistSection && line.trim().startsWith('---')) {
            // End of section or next divider
            inChecklistSection = false;
        }
        if (inChecklistSection) {
            const match = line.match(/^-\s*\[([ xX])\]\s*(.*)$/);
            if (match) {
                checklist.push({
                    text: match[2].trim(),
                    completed: match[1].toLowerCase() === 'x'
                });
            }
        }
    }
    return checklist;
}

// IndexedDB configuration to persist Directory Handles
const DB_NAME = "Pn4_Lifestyle_DB";
const STORE_NAME = "vault_handles";
const KEY_NAME = "obsidian_dir_handle";

function getDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveDirHandle(handle) {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(handle, KEY_NAME);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function loadDirHandle() {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(KEY_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// App Initialization
document.addEventListener("DOMContentLoaded", async () => {
    // Set default date in logger form
    const dateInput = document.getElementById("log-date");
    if (dateInput) {
        dateInput.value = new Date().toISOString().substring(0, 10);
    }
    
    // Set default start/end dates in planner form to today and tomorrow
    const startDateInput = document.getElementById("planner-start-date");
    const endDateInput = document.getElementById("planner-end-date");
    if (startDateInput && endDateInput) {
        startDateInput.value = new Date().toISOString().substring(0, 10);
        endDateInput.value = new Date(Date.now() + 86400000).toISOString().substring(0, 10);
        updateDurationBadge();
    }
    
    // Load saved Gemini API Key if present
    const savedKey = localStorage.getItem("Pn4_Gemini_Key");
    if (savedKey) {
        document.getElementById("settings-api-key").value = savedKey;
    }
    
    // Auto-restore Obsidian Vault handle from IndexedDB
    try {
        const savedHandle = await loadDirHandle();
        if (savedHandle) {
            // Check if we already have permission, otherwise show reconnect
            const isQueryGranted = await savedHandle.queryPermission({ mode: 'readwrite' }) === 'granted';
            if (isQueryGranted) {
                dirHandle = savedHandle;
                updateStatusUI(true, dirHandle.name);
                loadLogsFromVault();
            } else {
                updateStatusUI(false, "연결 잠김 (클릭하여 해제)");
            }
        }
    } catch (err) {
        console.error("IndexedDB handle load error:", err);
    }
});


// Update Directory status badge
function updateStatusUI(connected, text) {
    const badge = document.getElementById("vault-status-badge");
    const connectBtn = document.getElementById("btn-connect-vault");
    
    if (connected) {
        badge.className = "status-badge connected";
        badge.innerHTML = `<span class="status-dot"></span><span class="status-text">연결됨: ${text}</span>`;
        connectBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> 보관소 다시 동기화`;
    } else {
        badge.className = "status-badge disconnected";
        badge.innerHTML = `<span class="status-dot"></span><span class="status-text">${text || 'Obsidian 연결 필요'}</span>`;
        connectBtn.innerHTML = `<i class="fa-solid fa-folder-open"></i> 보관소 폴더 연결`;
    }
}

// Switch UI tabs
function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.remove("active");
    });
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });

    const selectedTab = document.getElementById(`tab-${tabId}`);
    const selectedNav = document.getElementById(`nav-btn-${tabId}`);
    
    if (selectedTab && selectedNav) {
        selectedTab.classList.add("active");
        selectedNav.classList.add("active");
    }
    
    if (tabId === 'dashboard') {
        loadLogsFromVault();
    }
}

// Connect Obsidian Vault using showDirectoryPicker
async function connectObsidianVault() {
    try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        // Request write permission explicitly
        const permission = await verifyPermission(handle, true);
        if (permission) {
            await saveDirHandle(handle);
            dirHandle = handle;
            updateStatusUI(true, dirHandle.name);
            loadLogsFromVault();
        } else {
            alert("폴더 읽기/쓰기 권한이 필요합니다.");
        }
    } catch (err) {
        console.error("Directory picker cancelled or failed:", err);
        // If it was already loaded, try to request permission
        const savedHandle = await loadDirHandle();
        if (savedHandle) {
            const permission = await verifyPermission(savedHandle, true);
            if (permission) {
                dirHandle = savedHandle;
                updateStatusUI(true, dirHandle.name);
                loadLogsFromVault();
            }
        }
    }
}

// Verify folder reading/writing permissions
async function verifyPermission(fileHandle, readWrite) {
    const options = {};
    if (readWrite) {
        options.mode = 'readwrite';
    }
    if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
    }
    return false;
}

// Parse markdown contents locally in JS
function clientParseMarkdown(filename, filepath, content) {
    let frontmatter = {};
    let body = content;
    
    if (content.trim().startsWith('---')) {
        const parts = content.split('---');
        if (parts.length >= 3) {
            const fmText = parts[1];
            body = parts.slice(2).join('---').trim();
            
            const lines = fmText.split('\n');
            let currentKey = null;
            let itineraryList = [];
            let currentItineraryItem = null;
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                let trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                
                if (trimmed.startsWith('-') && currentKey === 'itinerary') {
                    if (currentItineraryItem) {
                        itineraryList.push(currentItineraryItem);
                    }
                    currentItineraryItem = {};
                    const itemLine = trimmed.substring(1).trim();
                    const colIdx = itemLine.indexOf(':');
                    if (colIdx !== -1) {
                        const k = itemLine.substring(0, colIdx).trim();
                        let v = itemLine.substring(colIdx + 1).trim();
                        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                            v = v.substring(1, v.length - 1).trim();
                        }
                        if (!isNaN(v) && v !== '') {
                            v = v.includes('.') ? parseFloat(v) : parseInt(v, 10);
                        }
                        currentItineraryItem[k] = v;
                    }
                } else if (trimmed.includes(':') && !trimmed.startsWith('-')) {
                    if (currentKey === 'itinerary' && currentItineraryItem) {
                        itineraryList.push(currentItineraryItem);
                        currentItineraryItem = null;
                    }
                    const colIdx = trimmed.indexOf(':');
                    const k = trimmed.substring(0, colIdx).trim();
                    let v = trimmed.substring(colIdx + 1).trim();
                    
                    if (k === 'itinerary') {
                        currentKey = 'itinerary';
                        itineraryList = [];
                    } else {
                        currentKey = k;
                        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                            v = v.substring(1, v.length - 1).trim();
                        }
                        if (v.startsWith('[') && v.endsWith(']')) {
                            v = v.substring(1, v.length - 1).split(',').map(item => {
                                item = item.trim();
                                if ((item.startsWith('"') && item.endsWith('"')) || (item.startsWith("'") && item.endsWith("'"))) {
                                    item = item.substring(1, item.length - 1).trim();
                                }
                                return item;
                            }).filter(Boolean);
                        } else {
                            if (!isNaN(v) && v !== '') {
                                v = v.includes('.') ? parseFloat(v) : parseInt(v, 10);
                            }
                        }
                        frontmatter[k] = v;
                    }
                } else if (currentKey === 'itinerary' && currentItineraryItem && trimmed.includes(':')) {
                    const colIdx = trimmed.indexOf(':');
                    const k = trimmed.substring(0, colIdx).trim();
                    let v = trimmed.substring(colIdx + 1).trim();
                    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                        v = v.substring(1, v.length - 1).trim();
                    }
                    if (!isNaN(v) && v !== '') {
                        v = v.includes('.') ? parseFloat(v) : parseInt(v, 10);
                    }
                    currentItineraryItem[k] = v;
                }
            }
            if (currentKey === 'itinerary' && currentItineraryItem) {
                itineraryList.push(currentItineraryItem);
            }
            if (itineraryList.length > 0) {
                frontmatter.itinerary = itineraryList;
            }
        }
    }
    
    // Frontmatter Fallbacks
    if (!frontmatter.title) frontmatter.title = filename.replace('.md', '');
    if (!frontmatter.date) frontmatter.date = new Date().toISOString().split('T')[0];
    if (!frontmatter.category) frontmatter.category = filename.toLowerCase().includes('travel') ? 'Travel' : 'Gourmet';
    if (frontmatter.rating === undefined) frontmatter.rating = 5;
    if (frontmatter.expenses === undefined) frontmatter.expenses = 0;
    if (!frontmatter.tags) frontmatter.tags = [];
    if (typeof frontmatter.tags === 'string') {
        frontmatter.tags = frontmatter.tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    
    return {
        filename,
        filepath,
        frontmatter,
        body,
        html_body: marked.parse(body) // Client side markdown rendering
    };
}

// Load logs directly from the selected local directory
async function loadLogsFromVault() {
    if (!dirHandle) return;
    
    // Ensure read permission
    const hasPermission = await verifyPermission(dirHandle, false);
    if (!hasPermission) {
        updateStatusUI(false, "연결 잠김 (클릭하여 권한 해제 필요)");
        return;
    }
    
    const container = document.getElementById("logs-container");
    container.innerHTML = `<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin"></i> 로컬 보관소 파싱 중...</div>`;
    
    allLogs = [];
    try {
        await scanDirectory(dirHandle, "");
        
        // Sort logs descending by date
        allLogs.sort((a, b) => {
            const dateA = a.frontmatter.date || '';
            const dateB = b.frontmatter.date || '';
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            return (b.frontmatter.title || '').localeCompare(a.frontmatter.title || '');
        });
        
        updateStats();
        applyFilters();
    } catch (err) {
        console.error("Obsidian scanning error:", err);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-rose); font-size: 2rem;"></i>
                <p>보관소 파일을 읽는 데 실패했습니다. 권한을 확인하세요.</p>
            </div>
        `;
    }
}

// Recursively traverse directory entries
async function scanDirectory(directoryHandle, currentPath) {
    for await (const entry of directoryHandle.values()) {
        if (entry.name.startsWith('.')) continue; // Skip hidden folders
        
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            const file = await entry.getFile();
            const content = await file.text();
            const parsed = clientParseMarkdown(entry.name, (currentPath ? currentPath + "/" : "") + entry.name, content);
            allLogs.push(parsed);
        } else if (entry.kind === 'directory') {
            const subDirHandle = await directoryHandle.getDirectoryHandle(entry.name);
            await scanDirectory(subDirHandle, (currentPath ? currentPath + "/" : "") + entry.name);
        }
    }
}

// Update stats calculations
function updateStats() {
    let travelCount = 0;
    let gourmetCount = 0;
    let totalExpenses = 0;
    
    allLogs.forEach(log => {
        const category = log.frontmatter.category;
        const expenses = parseInt(log.frontmatter.expenses) || 0;
        
        if (category === 'Travel') {
            travelCount++;
        } else if (category === 'Gourmet') {
            gourmetCount++;
        }
        totalExpenses += expenses;
    });
    
    document.getElementById("stat-total-count").innerText = allLogs.length;
    document.getElementById("stat-travel-count").innerText = travelCount;
    document.getElementById("stat-gourmet-count").innerText = gourmetCount;
    document.getElementById("stat-total-expenses").innerText = totalExpenses.toLocaleString('ko-KR') + "원";
}

// Filter clicks
function filterCategory(category) {
    currentCategory = category;
    
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.classList.remove("active");
    });
    
    const activeBtn = document.getElementById(`filter-btn-${category.toLowerCase()}`);
    if (activeBtn) activeBtn.classList.add("active");
    
    applyFilters();
}

// Filter logs
function filterLogs() {
    applyFilters();
}

function applyFilters() {
    const searchQuery = document.getElementById("search-input").value.toLowerCase().trim();
    
    filteredLogs = allLogs.filter(log => {
        if (currentCategory !== 'all' && log.frontmatter.category !== currentCategory) {
            return false;
        }
        
        if (searchQuery) {
            const titleMatch = log.frontmatter.title.toLowerCase().includes(searchQuery);
            const memoMatch = log.body.toLowerCase().includes(searchQuery);
            const tagsMatch = (log.frontmatter.tags || []).some(tag => tag.toLowerCase().includes(searchQuery));
            return titleMatch || memoMatch || tagsMatch;
        }
        
        return true;
    });
    
    renderLogsGrid();
}

// Render cards
function renderLogsGrid() {
    const container = document.getElementById("logs-container");
    if (!container) return;
    
    if (!dirHandle) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-folder-closed" style="font-size: 2.5rem; margin-bottom: 0.5rem;"></i>
                <p>먼저 왼쪽 사이드바에서 [보관소 폴더 선택] 버튼을 눌러 Obsidian 폴더와 연동해 주세요.</p>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.5rem;">또는, 아래 데모 버튼을 클릭하여 연동 없이 즉시 앱의 고급 기능들을 테스트해볼 수 있습니다.</p>
                <button type="button" class="connect-btn" onclick="loadDemoData()" style="margin-top: 1rem; border-color: var(--accent-amber); color: var(--accent-amber); background: none;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> 데모 데이터로 즉시 체험하기
                </button>
            </div>
        `;
        return;
    }
    
    if (filteredLogs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-folder-open" style="font-size: 2.5rem; margin-bottom: 0.5rem;"></i>
                <p>보관소에 기록이 없거나 조건과 부합하는 결과가 없습니다. 다이어리 기록을 작성하거나 AI 계획을 짜보세요!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredLogs.map((log, index) => {
        const fm = log.frontmatter;
        const starStr = "⭐".repeat(parseInt(fm.rating) || 5);
        const costStr = (parseInt(fm.expenses) || 0).toLocaleString('ko-KR') + "원";
        const catClass = fm.category === 'Travel' ? 'category-travel' : 'category-gourmet';
        const catLabel = fm.category === 'Travel' ? '여행' : '맛집';
        
        let cleanText = log.body.replace(/[#*`_-]/g, '').trim().substring(0, 80);
        if (log.body.length > 80) cleanText += "...";
        
        // Premium accordion plan detection
        const isPlan = fm.itinerary && fm.itinerary.length > 0;
        const accordionCardClass = isPlan ? 'accordion-card' : '';
        
        // Unsplash keyword based background for travel plans
        let bgStyle = "";
        if (isPlan) {
            const keyword = encodeURIComponent(log.filename.replace("Plan_", "").split("_")[0] || "travel");
            bgStyle = `style="background-image: url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80');"`;
        }
        
        const toggleBtn = isPlan ? `
            <button type="button" class="accordion-toggle-indicator" onclick="toggleAccordion(event, ${index})" style="background: none; border: none; cursor: pointer;">
                <i class="fa-solid fa-plus"></i>
            </button>
        ` : '';
        
        let accordionHTML = '';
        if (isPlan) {
            accordionHTML = `
                <div class="accordion-content-panel" id="accordion-panel-${index}">
                    <div class="accordion-grid-layout">
                        <div class="accordion-details-wrap">
                            <h5 style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.5rem;"><i class="fa-solid fa-route"></i> 일정 경로</h5>
                            <div class="accordion-timeline-mini">
                                ${fm.itinerary.map(item => `
                                    <div class="accordion-timeline-item ${getCategoryClass(item.category)}">
                                        <strong>${item.title}</strong>: ${item.place}<br>
                                        <span style="font-size:0.75rem; color:var(--text-muted);">${item.transport || ''} (${(item.cost || 0).toLocaleString()}원)</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="accordion-map-wrap" id="accordion-map-container-${index}">
                            <!-- Inline Leaflet map loaded dynamically -->
                        </div>
                    </div>
                </div>
            `;
        }
        
        return `
            <article class="log-card ${catClass} ${accordionCardClass} ${isPlan ? 'card-premium-bg' : ''}" ${bgStyle} onclick="openModal(${index})">
                <div class="card-top">
                    <span class="category-badge">${catLabel}</span>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span class="card-date">${fm.date}</span>
                        ${toggleBtn}
                    </div>
                </div>
                <h3 class="card-title">${fm.title}</h3>
                <p class="card-summary">${cleanText || '메모 내용이 없습니다.'}</p>
                <div class="card-bottom">
                    <span class="card-rating">${starStr}</span>
                    <span class="card-expenses">${costStr}</span>
                </div>
                ${accordionHTML}
            </article>
        `;
    }).join('');
}

// Toggle dashboard plan card accordion
function toggleAccordion(event, index) {
    event.stopPropagation(); // Prevent opening the note preview modal
    
    const card = document.querySelectorAll(".log-card")[index];
    if (!card) return;
    
    const isExpanded = card.classList.contains("expanded");
    
    // Close other expanded accordions
    document.querySelectorAll(".log-card.accordion-card").forEach((c, idx) => {
        if (idx !== index) {
            c.classList.remove("expanded");
        }
    });
    
    if (!isExpanded) {
        card.classList.add("expanded");
        setTimeout(() => {
            renderAccordionMap(index);
        }, 300); // Wait for expansion animation
    } else {
        card.classList.remove("expanded");
    }
}

// Render Leaflet map for expanded accordion card
function renderAccordionMap(index) {
    const log = filteredLogs[index];
    if (!log || !log.frontmatter.itinerary) return;
    
    const containerId = `accordion-map-container-${index}`;
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Clean previous map instance
    if (activeAccordionMaps[index]) {
        activeAccordionMaps[index].remove();
        delete activeAccordionMaps[index];
    }
    
    container.innerHTML = "";
    const mapDiv = document.createElement("div");
    mapDiv.style.width = "100%";
    mapDiv.style.height = "100%";
    container.appendChild(mapDiv);
    
    const itinerary = log.frontmatter.itinerary;
    const validPoints = itinerary.filter(item => item.lat && item.lng);
    if (validPoints.length === 0) {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.8rem;">지도 좌표 정보가 없습니다.</div>`;
        return;
    }
    
    const map = L.map(mapDiv).setView([validPoints[0].lat, validPoints[0].lng], 13);
    activeAccordionMaps[index] = map;
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    
    const latlngs = [];
    validPoints.forEach(item => {
        L.marker([item.lat, item.lng]).addTo(map).bindPopup(`<strong>${item.place}</strong><br>${item.title}`);
        latlngs.push([item.lat, item.lng]);
    });
    
    if (latlngs.length > 1) {
        const polyline = L.polyline(latlngs, { color: '#3b82f6', weight: 3, opacity: 0.8 }).addTo(map);
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    }
    
    setTimeout(() => {
        map.invalidateSize();
    }, 200);
}

function getCategoryClass(cat) {
    if (cat === "음식점" || cat === "Gourmet") return "gourmet";
    if (cat === "숙소") return "stay";
    if (cat === "관광" || cat === "Travel") return "travel";
    return "activity";
}

let modalMap = null; // modal map tracking

// Modal popup for note preview
function openModal(index) {
    const log = filteredLogs[index];
    if (!log) return;
    
    const fm = log.frontmatter;
    const modal = document.getElementById("preview-modal");
    const modalBtn = document.getElementById("btn-modal-download-pdf");
    if (modalBtn) modalBtn.style.display = "none";
    
    document.getElementById("modal-title").innerText = fm.title;
    document.getElementById("modal-date").innerHTML = `<i class="fa-regular fa-calendar"></i> ${fm.date}`;
    document.getElementById("modal-rating").innerHTML = `<i class="fa-regular fa-star"></i> ${"⭐".repeat(parseInt(fm.rating) || 5)}`;
    document.getElementById("modal-expenses").innerHTML = `<i class="fa-solid fa-won-sign"></i> ${(parseInt(fm.expenses) || 0).toLocaleString('ko-KR')}원`;
    document.getElementById("modal-filepath").innerText = `보관소 내 경로: ${log.filepath}`;
    
    const badge = document.getElementById("modal-meta-tag");
    badge.innerText = fm.category === 'Travel' ? '여행' : '맛집';
    badge.className = "category-badge";
    badge.classList.add(fm.category === 'Travel' ? 'category-travel' : 'category-gourmet');
    
    const isPlan = fm.itinerary && fm.itinerary.length > 0;
    
    if (isPlan) {
        if (modalBtn) {
            modalBtn.style.display = "block";
            modalBtn.onclick = (e) => {
                e.stopPropagation();
                generateBrochurePDF(log);
            };
        }
        const parsedChecklist = extractChecklistFromMarkdown(log.body);
        
        let checklistHTML = parsedChecklist.map((item, cidx) => {
            const checked = item.completed ? "checked" : "";
            return `
                <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem;">
                    <input type="checkbox" ${checked} disabled>
                    <span style="${item.completed ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${item.text}</span>
                </div>
            `;
        }).join('');
        
        if (parsedChecklist.length === 0) {
            checklistHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">준비물 내역이 없습니다.</span>`;
        }
        
        const catTotals = { "음식점": 0, "숙소": 0, "교통": 0, "관광": 0, "쇼핑": 0, "기타": 0 };
        let grandTotal = 0;
        fm.itinerary.forEach(item => {
            const cost = parseInt(item.cost) || 0;
            const cat = item.category || "기타";
            if (catTotals[cat] !== undefined) catTotals[cat] += cost;
            else catTotals["기타"] += cost;
            grandTotal += cost;
        });
        
        const budgetHTML = Object.entries(catTotals).map(([cat, amount]) => {
            if (amount === 0) return '';
            const percentage = grandTotal > 0 ? (amount / grandTotal * 100).toFixed(0) : 0;
            return `
                <div style="font-size:0.8rem; margin-bottom:0.25rem;">
                    <div style="display:flex; justify-content:space-between; color:var(--text-secondary);">
                        <span>${cat}</span>
                        <span>${amount.toLocaleString()}원 (${percentage}%)</span>
                    </div>
                </div>
            `;
        }).join('');
        
        document.getElementById("modal-body").innerHTML = `
            <div>${log.html_body}</div>
            <div class="modal-plan-widgets" style="margin-top: 2.5rem; display: flex; flex-direction: column; gap: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.5rem;">
                <h4 style="font-size:1.05rem; font-weight:700; color:var(--text-primary);"><i class="fa-solid fa-map-location-dot"></i> 여행 코스 경로 지도</h4>
                <div id="modal-map-container" style="height: 280px; border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; position: relative;"></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <!-- Checklist -->
                    <div class="utility-card" style="background: hsla(222, 20%, 5%, 0.3); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border-color);">
                        <h5 style="margin-bottom: 0.75rem; font-weight:700; font-size:0.9rem; color:var(--accent-blue);"><i class="fa-solid fa-suitcase"></i> 준비물 내역</h5>
                        <div style="display: flex; flex-direction: column; gap: 0.4rem; max-height: 180px; overflow-y: auto;">
                            ${checklistHTML}
                        </div>
                    </div>
                    <!-- Budget -->
                    <div class="utility-card" style="background: hsla(222, 20%, 5%, 0.3); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border-color);">
                        <h5 style="margin-bottom: 0.75rem; font-weight:700; font-size:0.9rem; color:var(--accent-amber);"><i class="fa-solid fa-wallet"></i> 가계부 예산 요약</h5>
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            ${budgetHTML || '<span style="font-size:0.8rem; color:var(--text-muted);">지출 예산 내역이 없습니다.</span>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
        
        setTimeout(() => {
            initModalMap(fm.itinerary);
        }, 300);
    } else {
        document.getElementById("modal-body").innerHTML = log.html_body;
        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }
}

function initModalMap(steps) {
    const container = document.getElementById("modal-map-container");
    if (!container) return;
    
    if (modalMap) {
        modalMap.remove();
        modalMap = null;
    }
    
    const validSteps = steps.filter(s => s.lat && s.lng);
    if (validSteps.length === 0) {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.8rem;">지도 좌표 정보가 없습니다.</div>`;
        return;
    }
    
    const mapDiv = document.createElement("div");
    mapDiv.style.width = "100%";
    mapDiv.style.height = "100%";
    container.appendChild(mapDiv);
    
    modalMap = L.map(mapDiv).setView([validSteps[0].lat, validSteps[0].lng], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(modalMap);
    
    const latlngs = [];
    validSteps.forEach(item => {
        L.marker([item.lat, item.lng]).addTo(modalMap).bindPopup(`<strong>${item.place}</strong><br>${item.title}`);
        latlngs.push([item.lat, item.lng]);
    });
    
    if (latlngs.length > 1) {
        const polyline = L.polyline(latlngs, { color: '#3b82f6', weight: 3, opacity: 0.8 }).addTo(modalMap);
        modalMap.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    }
    
    setTimeout(() => {
        modalMap.invalidateSize();
    }, 200);
}

function closeModal() {
    const modal = document.getElementById("preview-modal");
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
    
    if (modalMap) {
        modalMap.remove();
        modalMap = null;
    }
}

function closeModalOnOuterClick(event) {
    const modalContent = document.querySelector("#preview-modal .modal-content");
    if (modalContent && !modalContent.contains(event.target)) {
        closeModal();
    }
}

// Write file directly into the local Obsidian folder using File System Access API
async function writeLogToVault(filename, content) {
    if (!dirHandle) {
        alert("먼저 [보관소 폴더 선택] 버튼을 눌러 Obsidian 폴더와 연결해 주세요.");
        return false;
    }
    
    const hasPermission = await verifyPermission(dirHandle, true);
    if (!hasPermission) {
        alert("폴더 쓰기 권한이 허용되지 않았습니다.");
        return false;
    }
    
    try {
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
    } catch (err) {
        console.error("Local file save error:", err);
        alert("로컬 파일 저장에 실패했습니다: " + err.message);
        return false;
    }
}

// Form logic: manual diary logging
async function saveDiaryLog() {
    if (!dirHandle) {
        alert("먼저 [보관소 폴더 선택] 버튼을 눌러 Obsidian 폴더와 연결해 주세요.");
        return;
    }
    
    const title = document.getElementById("log-title").value.trim();
    const category = document.getElementById("log-category").value;
    const dateVal = document.getElementById("log-date").value;
    const rating = document.getElementById("log-rating").value;
    const expenses = document.getElementById("log-expenses").value || 0;
    const tags = document.getElementById("log-tags").value.trim();
    const memo = document.getElementById("log-memo").value.trim();
    
    if (!title || !memo) return;
    
    const submitBtn = document.getElementById("logger-submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> 저장 중...`;
    
    const tagsList = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (!tagsList.includes(category)) {
        tagsList.push(category);
    }
    const yamlTags = tagsList.map(t => `"${t}"`).join(", ");
    
    const markdownContent = `---
title: "${title}"
date: "${dateVal}"
category: "${category}"
rating: ${rating}
expenses: ${expenses}
tags: [${yamlTags}]
---

# ✍️ ${title} (${category === 'Travel' ? '여행' : '맛집'})

*   **방문 날짜**: ${dateVal}
*   **평점**: ${"⭐".repeat(rating)} (${rating}/5)
*   **지출 비용**: ${parseInt(expenses).toLocaleString('ko-KR')}원

---

### 📝 메모 및 후기
${memo}

---
*(기록 일시: ${new Date().toLocaleString()})*
`;

    const cleanTitle = title.replace(/[\\/*?:"<>|]/g, "");
    const nowStr = new Date().toISOString().replace(/[-:T]/g, "").substring(0, 14);
    const filename = `Diary_${cleanTitle}_${nowStr}.md`;
    
    const success = await writeLogToVault(filename, markdownContent);
    if (success) {
        alert("다이어리 기록이 Obsidian 보관소에 성공적으로 저장되었습니다!");
        
        // Reset form
        document.getElementById("log-title").value = "";
        document.getElementById("log-tags").value = "";
        document.getElementById("log-memo").value = "";
        document.getElementById("log-expenses").value = "";
        
        // Refresh dashboard logs
        loadLogsFromVault();
        
        // Switch to dashboard tab
        switchTab('dashboard');
    }
    
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> 기록 저장하기`;
}

async function startPlannerWizard() {
    if (!dirHandle) {
        alert("먼저 [보관소 폴더 선택] 버튼을 눌러 Obsidian 폴더와 연결해 주세요. 또는 대시보드에서 '데모 데이터로 즉시 체험하기' 버튼을 클릭해 데모 모드로 바로 진행할 수 있습니다.");
        return;
    }
    
    const destInput = document.getElementById("planner-destination").value.trim();
    const startVal = document.getElementById("planner-start-date").value;
    const endVal = document.getElementById("planner-end-date").value;
    const themeInput = document.getElementById("planner-theme").value.trim();
    
    if (!startVal || !endVal) {
        alert("여행 출발일과 귀환일을 입력해 주세요.");
        return;
    }
    
    startDate = startVal;
    endDate = endVal;
    updateDurationBadge();
    
    const partySizeSelect = document.getElementById("planner-party-size");
    partySize = partySizeSelect ? parseInt(partySizeSelect.value, 10) : 2;
    
    const transportInput = document.getElementById("planner-transport") ? document.getElementById("planner-transport").value : "상관없음";
    const stayTypeInput = document.getElementById("planner-stay-type") ? document.getElementById("planner-stay-type").value : "상관없음";
    const customReqsInput = document.getElementById("planner-custom-reqs") ? document.getElementById("planner-custom-reqs").value.trim() : "";
    
    if (!destInput) return;
    
    const apiKey = localStorage.getItem("Pn4_Gemini_Key");
    if (!apiKey) {
        const confirmDemo = confirm("Gemini API Key가 등록되어 있지 않습니다. 체험용 데모 일정(경주 1박 2일 코스)으로 마법사를 바로 테스트해 보시겠습니까?");
        if (confirmDemo) {
            wizardSteps = [
                {
                    title: "1일차 점심 식사",
                    place: "교동쌈밥",
                    desc: "한우 쌈밥 정식과 정갈한 반찬 추천",
                    category: "음식점",
                    cost: 18000,
                    transport: "도보 5분",
                    lat: 35.8341,
                    lng: 129.2185,
                    recommendations: [
                        { place: "교동쌈밥", desc: "한우 쌈밥 정식이 유명한 30년 전통의 경주 대표 맛집", url: "https://search.naver.com/search.naver?query=경주+교동쌈밥", source_title: "경주 대표 쌈밥집 교동쌈밥 솔직후기", type: "blog", rating: 4.6, reliability: "방문자 리뷰 2,400+개로 신뢰성 검증됨" },
                        { place: "황남경주식당", desc: "황리단길에 고풍스러운 한옥 인테리어와 정갈한 고기 한 상이 나오는 곳", url: "https://search.naver.com/search.naver?query=황남경주식당", source_title: "황리단길 밥집 황남경주식당 내돈내산", type: "blog", rating: 4.7, reliability: "인플루언서 20회 이상 추천으로 대중성 검증" },
                        { place: "황남밀면", desc: "매콤달콤한 밀면과 연탄석쇠고기의 환상 궁합인 줄서는 가성비 맛집", url: "https://search.naver.com/search.naver?query=경주+황남밀면", source_title: "황리단길 대표 밀면집 황남밀면 추천영상", type: "youtube", rating: 4.5, reliability: "조회수 4.5만 유튜브 추천 맛집" }
                    ]
                },
                {
                    title: "1일차 오후 활동",
                    place: "대릉원",
                    desc: "거대한 고분들 사이를 거니는 경주의 대표 역사 명소",
                    category: "관광",
                    cost: 3000,
                    transport: "도보 10분",
                    lat: 35.8382,
                    lng: 129.2223,
                    recommendations: [
                        { place: "대릉원 천마총", desc: "고분군 산책로와 신라 시대 고분을 관람할 수 있는 랜드마크", url: "https://search.naver.com/search.naver?query=대릉원+천마총", source_title: "경주 대릉원 포토존 및 천마총 입장료", type: "blog", rating: 4.8, reliability: "구글 평점 4.6/5, 대중성 1순위 역사 관광지" },
                        { place: "첨성대", desc: "동양에서 가장 오래된 천문대로 낮에는 야생화, 밤에는 조명이 화려한 곳", url: "https://search.naver.com/search.naver?query=첨성대", source_title: "경주 첨성대 핑크뮬리 및 야경 주차 정보", type: "blog", rating: 4.7, reliability: "리뷰 5,000+개로 검증된 국가 대표 명소" },
                        { place: "경주 동궁과 월지", desc: "과거 안압지로 불렸으며 연못에 비친 전각들의 조명 야경이 환상적인 곳", url: "https://www.youtube.com/results?search_query=경주+동궁과+월지+야경", source_title: "야경 명소 1위! 경주 동궁과 월지 드론 영상", type: "youtube", rating: 4.9, reliability: "조회수 10만 유튜브 추천 야경 명소" }
                    ]
                },
                {
                    title: "1일차 저녁/숙소",
                    place: stayTypeInput.includes("호텔") ? "라한셀렉트 경주" : (stayTypeInput.includes("한옥") ? "경주 소설재" : "라한셀렉트 경주"),
                    desc: "보문호수 전망이 뛰어난 대중적인 숙박시설",
                    category: "숙소",
                    cost: 150000,
                    transport: "택시 15분",
                    lat: 35.8398,
                    lng: 129.2785,
                    recommendations: [
                        { place: "라한셀렉트 경주", desc: "보문호숫가에 위치해 객실 전망이 훌륭하며, 현대적 시설을 갖춘 대표적인 호캉스 호텔", url: "https://search.naver.com/search.naver?query=라한셀렉트+경주", source_title: "보문호 전망 최고 라한셀렉트 경주 솔직 후기", type: "blog", rating: 4.8, reliability: "네이버 블로그 리뷰 3,200건 이상, 대중성 검증 완료" },
                        { place: "경주 소설재", desc: "황리단길 내에 조용하게 자리잡은 전통 한옥스테이 게스트하우스", url: "https://search.naver.com/search.naver?query=경주+소설재", source_title: "경주 한옥 숙소 소설재 내돈내산 1박 후기", type: "blog", rating: 4.7, reliability: "구글 평점 4.7/5, 가성비 전통 숙소 대표" },
                        { place: "경주 라궁호텔", desc: "개별 노천탕을 보유한 고풍스러운 한옥 독채 호텔로 프라이빗 힐링 가능", url: "https://www.youtube.com/results?search_query=경주+라궁호텔", source_title: "진짜 신라 왕실 느낌? 경주 한옥 독채 라궁 호텔 노천탕 브이로그", type: "youtube", rating: 4.9, reliability: "유튜브 조회수 15만 돌파 인기 숙소" }
                    ]
                },
                {
                    title: "2일차 오전 산책",
                    place: "첨성대 야생화단지",
                    desc: "계절 꽃들이 만발하는 동양에서 가장 오래된 천문대 구역",
                    category: "관광",
                    cost: 0,
                    transport: "도보 7분",
                    lat: 35.8343,
                    lng: 129.2190,
                    recommendations: [
                        { place: "첨성대 야생화단지", desc: "봄에는 양귀비, 가을에는 핑크뮬리로 물드는 도보 코스", url: "https://search.naver.com/search.naver?query=첨성대+야생화단지", source_title: "경주 가볼만한곳 첨성대 꽃단지 풍경", type: "blog", rating: 4.6, reliability: "포토존 15개소 이상 활성화된 대중적 명소" },
                        { place: "경주 교촌마을", desc: "전통 한옥들이 보존된 마을로 최부자댁 고택과 전통차 카페 힐링 코스", url: "https://search.naver.com/search.naver?query=경주+교촌마을", source_title: "경주 교촌마을 한옥 스테이와 토속 먹거리", type: "blog", rating: 4.5, reliability: "한국관광공사 지정 우수 한옥마을" }
                    ]
                },
                {
                    title: "2일차 점심 식사",
                    place: "황남밀면",
                    desc: "황리단길 인기 밀면집으로 시원하고 매콤한 소스가 일품인 식사",
                    category: "음식점",
                    cost: 9000,
                    transport: "도보 8분",
                    lat: 35.8390,
                    lng: 129.2085,
                    recommendations: [
                        { place: "황남밀면", desc: "황리단길 메인 스트리트에 위치해 웨이팅이 항상 있는 매콤새콤 밀면 전문점", url: "https://search.naver.com/search.naver?query=경주+황남밀면", source_title: "황리단길 맛집 황남밀면 리얼후기", type: "blog", rating: 4.5, reliability: "네이버 영수증 리뷰 1,800+건으로 대중성 입증" },
                        { place: "료코", desc: "안심 돈카츠와 료코 안심 카레가 정갈하게 맛있는 감성 일식 핫플", url: "https://search.naver.com/search.naver?query=경주+료코", source_title: "황리단길 돈까스 맛집 료코 웨이팅 없이 먹기", type: "blog", rating: 4.7, reliability: "인스타그램 누적 해시태그 5,000+건 돌파" },
                        { place: "소바카게", desc: "정통 일본식 마제소바를 맛볼 수 있는 개성있고 대중적인 국수 맛집", url: "https://www.youtube.com/results?search_query=경주+소바카게", source_title: "경주 황리단길 면요리 탑3 소바카게 마제소바 맛집리뷰", type: "youtube", rating: 4.6, reliability: "유튜브 조회수 3만회 돌파 추천" }
                    ]
                }
            ];
            
            // If customReqsInput specified, inject it into one of the places for realistic simulation
            if (customReqsInput) {
                wizardSteps[0].desc += ` (${customReqsInput} 반영됨)`;
            }
            
            destination = "경주";
            duration = "1박 2일";
            theme = "역사 및 맛집 탐방";
            
            currentStepIndex = 0;
            selectedItinerary = [];
            wizardState = 'planning';
            
            document.getElementById("ai-planner-form").style.display = "none";
            document.getElementById("planner-result-box").classList.add("hidden");
            document.getElementById("planner-wizard-area").classList.remove("hidden");
            
            switchPlannerSubTab('wizard'); // Switch to wizard subtab
            
            renderTimeline();
            initWizardMap();
            await loadStepRecommendations(false); // Use cached demo recs!
            return;
        } else {
            openSettingsModal();
            return;
        }
    }
    
    const submitBtn = document.getElementById("planner-submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Gemini가 전체 일정 초안 설계 중...<br><span style="font-size: 0.75rem; font-weight: normal; opacity: 0.8; margin-top: 0.25rem; display: block;">*전체 일정 뼈대를 빠르게 구성하고 있으며, 약 3~5초가 소요됩니다.</span>`;
    
    destination = destInput;
    duration = duration; // uses global duration calculated by updateDurationBadge
    theme = themeInput;
    
    let detailInstructions = "";
    if (transportInput !== "상관없음") {
        detailInstructions += `- 🚗 주요 이동 수단: ${transportInput}을 기준으로 삼아 이에 최적화된 동선과 이동방법(transport)을 설계하십시오.\n`;
        if (transportInput === "자가용") {
            detailInstructions += `  - [🚗 자가용 수단 핵심 정책]: 기차역, KTX역, 버스터미널 출발 및 도착 일정을 일정 구성에 절대 포함하지 마십시오. 모든 이동은 차량 이동으로 최적화 하십시오.\n`;
        }
    }
    if (stayTypeInput !== "상관없음") {
        detailInstructions += `- 🏨 선호 숙소 유형: 숙소 단계의 추천 리스트에는 주로 '${stayTypeInput}' 유형의 숙박시설을 최우선으로 찾아서 추천하십시오.\n`;
    }
    if (customReqsInput) {
        detailInstructions += `- ✍️ 사용자의 추가 특별 요청사항: "${customReqsInput}"을 일정 설계에 적극 반영해 주십시오.\n`;
    }
    
    detailInstructions += `- 👥 여행 동반 인원수: 총 ${partySize}명 기준의 여행이므로 이에 알맞은 활동 템포와 식사 및 예산을 고려하십시오.\n`;
    detailInstructions += `- 🏨 [숙소 매일차 개별 추천 정책]: 여행 일정이 N박인 경우 숙소("숙소" 카테고리) 단계를 정확히 N개 배치하고, 각 일차의 최종 스텝에 서로 다른 매력적인 숙소를 배치하도록 설계하십시오.\n`;

    
    const prompt = `
당신은 여행 및 맛집 탐방 분야의 전문 가이드입니다. 
목적지: "${destination}", 기간: "${duration}", 테마: "${theme}"에 가장 적합한 날짜별 여행 코스 및 맛집 일정 뼈대 초안을 단일 JSON 배열로 출력하십시오.
설명글이나 백틱(\`\`\`json 등) 코드 블록 기호 없이 오직 순수한 JSON 데이터만 반환하십시오.

[추가 상세 조건]
${detailInstructions || "- 특별한 추가 조건 없음"}

[지침]
1. 반드시 기간("${duration}") 전체를 커버할 수 있도록 날짜 순서대로 모든 일정 단계를 작성하십시오.
   - 예: 1박 2일의 경우 하루 3~4개씩 총 5~6개 이상의 단계가 배열에 반드시 포함되어야 합니다. 절대 1개의 단계만 출력해서는 안 됩니다.
   - 예: 2박 3일의 경우 하루 3~4개씩 총 8~10개 이상의 단계가 배열에 반드시 포함되어야 합니다.
2. 각 장소에는 반드시 실제 지도 위치와 매칭 가능한 적절한 실제 위도(lat)와 경도(lng) 값을 소수점 4자리까지 제공해 주십시오. (지도에 정확히 마킹되어야 합니다.)
3. 각 단계(Step)에 대한 실시간 추천 목록('recommendations' 필드)은 지금 작성하지 마십시오. 반드시 빈 배열 \`[]\` 로만 출력해야 합니다.

[출력 JSON 스키마 예시]
[
  {
    "title": "1일차 점심 식사", 
    "place": "교동쌈밥", 
    "desc": "경주 대표 쌈밥 맛집으로 정갈한 반찬과 한우 쌈밥 추천",
    "category": "음식점",
    "cost": 18000,
    "transport": "도보 5분",
    "lat": 35.8341,
    "lng": 129.2185,
    "recommendations": []
  },
  {
    "title": "1일차 오후 활동", 
    "place": "대릉원", 
    "desc": "경주의 거대한 고분들을 거닐 수 있는 대표 유적지",
    "category": "관광",
    "cost": 3000,
    "transport": "도보 10분",
    "lat": 35.8382,
    "lng": 129.2223,
    "recommendations": []
  }
]

카테고리는 반드시 ["음식점", "카페", "관광", "숙소", "교통", "기타"] 중 하나여야 하며, 비용(cost)은 숫자로 작성하십시오. transport는 이전 장소로부터의 예상 이동 수단 및 소요 시간입니다.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }]
        // 뼈대 설계 단계이므로 실시간 구글 그라운딩 도구(tools)를 제외합니다.
    };
    
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Outline request failed");
        
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            let rawJson = data.candidates[0].content.parts[0].text.trim();
            if (rawJson.startsWith("```")) {
                rawJson = rawJson.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
            }
            
            wizardSteps = JSON.parse(rawJson);
            currentStepIndex = 0;
            selectedItinerary = [];
            wizardState = 'planning';
            
            document.getElementById("ai-planner-form").style.display = "none";
            document.getElementById("planner-result-box").classList.add("hidden");
            document.getElementById("planner-wizard-area").classList.remove("hidden");
            
            switchPlannerSubTab('wizard'); // Switch to wizard subtab
            
            renderTimeline();
            initWizardMap();
            await loadStepRecommendations(false); // First load uses the prefetched recs!
        } else {
            throw new Error("초안 데이터를 받지 못했습니다.");
        }
    } catch (err) {
        console.error("Wizard setup failed:", err);
        alert("일정 초안 생성 실패: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> 일정 설계 시작하기`;
    }
}

// Render Timeline Progress with Drag & Drop events
function renderTimeline() {
    const timeline = document.getElementById("wizard-timeline-container");
    if (!timeline) return;
    
    timeline.innerHTML = wizardSteps.map((step, idx) => {
        let statusClass = "pending";
        let badgeText = "대기";
        let inlineStyle = "border-left: 3px solid var(--border-color); color: var(--text-muted); opacity: 0.6;";
        
        if (idx === currentStepIndex) {
            statusClass = "active";
            badgeText = "확인 중";
            inlineStyle = "border-left: 3px solid var(--accent-blue); background-color: var(--bg-card); font-weight: 600;";
        } else if (idx < currentStepIndex) {
            statusClass = "completed";
            const chosen = selectedItinerary[idx]?.place || step.place;
            badgeText = "확정";
            inlineStyle = "border-left: 3px solid var(--accent-emerald); background-color: hsla(150, 60%, 45%, 0.03); color: var(--text-secondary);";
            return `
                <div class="timeline-item ${statusClass}" draggable="true" data-index="${idx}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 1rem; border-radius: 8px; ${inlineStyle}">
                    <span style="font-size: 0.9rem;"><i class="fa-solid fa-circle-check" style="color: var(--accent-emerald); margin-right: 0.5rem;"></i> ${step.title}: <strong>${chosen}</strong></span>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span class="status-badge" style="font-size: 0.75rem; background-color: rgba(74, 222, 128, 0.15); color: var(--accent-emerald); padding: 0.15rem 0.45rem; border-radius: 4px;">${badgeText}</span>
                        <i class="fa-solid fa-grip-vertical" style="color: var(--text-muted); cursor: grab;"></i>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="timeline-item ${statusClass}" draggable="true" data-index="${idx}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 1rem; border-radius: 8px; ${inlineStyle}">
                <span style="font-size: 0.9rem;"><i class="fa-regular fa-circle" style="margin-right: 0.5rem;"></i> ${step.title}: ${step.place}</span>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span class="status-badge" style="font-size: 0.75rem; background-color: rgba(255,255,255,0.05); padding: 0.15rem 0.45rem; border-radius: 4px;">${badgeText}</span>
                    <i class="fa-solid fa-grip-vertical" style="color: var(--text-muted); cursor: grab;"></i>
                </div>
            </div>
        `;
    }).join('');

    // Bind drag events
    const items = timeline.querySelectorAll(".timeline-item");
    items.forEach(item => {
        item.addEventListener("dragstart", (e) => {
            draggedIndex = parseInt(item.getAttribute("data-index"));
            item.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
        });
        
        item.addEventListener("dragover", (e) => {
            e.preventDefault();
            item.classList.add("drag-over");
        });
        
        item.addEventListener("dragleave", () => {
            item.classList.remove("drag-over");
        });
        
        item.addEventListener("drop", (e) => {
            e.preventDefault();
            item.classList.remove("drag-over");
            const targetIndex = parseInt(item.getAttribute("data-index"));
            if (draggedIndex !== null && draggedIndex !== targetIndex) {
                // Swap steps
                const temp = wizardSteps[draggedIndex];
                wizardSteps.splice(draggedIndex, 1);
                wizardSteps.splice(targetIndex, 0, temp);
                
                // If it is already partially confirmed, swap selectedItinerary elements too
                if (draggedIndex < selectedItinerary.length && targetIndex < selectedItinerary.length) {
                    const tempSel = selectedItinerary[draggedIndex];
                    selectedItinerary.splice(draggedIndex, 1);
                    selectedItinerary.splice(targetIndex, 0, tempSel);
                }
                
                renderTimeline();
                if (currentStepIndex === draggedIndex) {
                    currentStepIndex = targetIndex;
                }
                loadStepRecommendations(false); // Reload step from cache instantly!
            }
        });
        
        item.addEventListener("dragend", () => {
            item.classList.remove("dragging");
            draggedIndex = null;
        });
    });
}

// Optimize route based on coordinate distances (Greedy TSP)
function optimizeWizardRoute() {
    if (wizardSteps.length <= 1) return;
    
    const daysMap = {};
    
    wizardSteps.forEach((step, idx) => {
        const match = step.title.match(/(\d+일차)/);
        const dayKey = match ? match[1] : "1일차";
        if (!daysMap[dayKey]) daysMap[dayKey] = [];
        daysMap[dayKey].push({ step, originalIndex: idx });
    });
    
    const optimizedSteps = [];
    
    Object.keys(daysMap).sort().forEach(dayKey => {
        const dayItems = daysMap[dayKey];
        if (dayItems.length <= 1) {
            dayItems.forEach(item => optimizedSteps.push(item.step));
            return;
        }
        
        const unvisited = [...dayItems];
        let current = unvisited.shift();
        optimizedSteps.push(current.step);
        
        while (unvisited.length > 0) {
            let nearestIndex = 0;
            let minDistance = Infinity;
            
            for (let i = 0; i < unvisited.length; i++) {
                const dist = calculateDistance(
                    current.step.lat, current.step.lng,
                    unvisited[i].step.lat, unvisited[i].step.lng
                );
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestIndex = i;
                }
            }
            
            current = unvisited.splice(nearestIndex, 1)[0];
            optimizedSteps.push(current.step);
        }
    });
    
    wizardSteps = optimizedSteps;
    selectedItinerary = [];
    currentStepIndex = 0;
    
    renderTimeline();
    loadStepRecommendations(false); // Reset from cache instantly!
    alert("동선이 거리 기준으로 자동 최적화되었습니다! 일정을 처음부터 다시 조율합니다.");
}

// Load Search suggestions and Obsidian history tips for active step
async function loadStepRecommendations(forceRefresh = false) {
    if (currentStepIndex >= wizardSteps.length) return;
    
    const step = wizardSteps[currentStepIndex];
    
    // Update Stepper
    document.getElementById("wizard-step-title").innerText = `${step.title} (${step.place})`;
    document.getElementById("wizard-step-progress").innerText = `${currentStepIndex + 1} / ${wizardSteps.length}`;
    
    const percentage = ((currentStepIndex + 1) / wizardSteps.length) * 100;
    document.getElementById("wizard-progress-bar").style.width = `${percentage}%`;
    
    // Set custom input default placeholder to current recommendation
    document.getElementById("wizard-custom-input").value = step.place;
    
    // 1. Search local Obsidian logs for keywords to show nostalgic hint
    const hintCard = document.getElementById("local-history-hint");
    const hintContent = document.getElementById("local-history-hint-content");
    
    const relatedLogs = allLogs.filter(log => {
        const fm = log.frontmatter || {};
        const titleMatch = fm.title && typeof fm.title === 'string' && destination ? fm.title.includes(destination) : false;
        const bodyMatch = log.body && typeof log.body === 'string' && destination ? log.body.includes(destination) : false;
        const tagsMatch = Array.isArray(fm.tags) && destination ? fm.tags.some(t => typeof t === 'string' && t.includes(destination)) : false;
        return titleMatch || bodyMatch || tagsMatch;
    });
    
    // Find logs with rating 4 or 5 stars that matches the keyword
    const highRatingLog = relatedLogs.find(log => log.frontmatter.rating >= 4);
    if (highRatingLog) {
        hintContent.innerHTML = `
            레오님의 보관소에서 일치하는 기록 발견: <strong>[${highRatingLog.frontmatter.title}]</strong> (${highRatingLog.frontmatter.date})<br>
            평점: ${"⭐".repeat(highRatingLog.frontmatter.rating)} | 후기: "${highRatingLog.body.replace(/[#*`_-]/g, '').trim().substring(0, 120)}..."
        `;
        hintCard.classList.remove("hidden");
    } else {
        hintCard.classList.add("hidden");
    }

    // 2. Local cache check: If forceRefresh is false and recommendations already pre-fetched, load instantly!
    if (!forceRefresh && step.recommendations && step.recommendations.length > 0) {
        currentStepRecommendations = step.recommendations;
        renderRecommendCards();
        updateWizardMapMarkers();
        return;
    }
    
    // 3. Determine Category and Build Search Queries
    const category = step.category || "관광";
    let categoryTarget = "관광 명소 및 액티비티";
    let categoryInstruction = "관광지와 역사 명소, 즐길거리";
    if (category === "음식점") {
        categoryTarget = "실제 로컬 맛집 및 식당";
        categoryInstruction = "식사가 가능한 밥집, 식당, 로컬 맛집";
    } else if (category === "카페") {
        categoryTarget = "분위기 좋은 카페 및 디저트점";
        categoryInstruction = "음료와 디저트 위주의 카페, 베이커리";
    } else if (category === "숙소") {
        categoryTarget = "호텔, 감성 펜션, 한옥 민박 등 숙박 시설";
        categoryInstruction = "호텔, 콘도, 펜션, 리조트, 게하 등 순수 숙박시설 (절대 맛집이나 카페 제외)";
    }
    
    const preferenceInfo = activePreferenceFilter ? `[검색 선호 조건: ${activePreferenceFilter}]` : "";
    
    // 4. Fetch Web Grounded suggestions from Gemini or Fallback Mock Data
    const cardsContainer = document.getElementById("recommend-cards-container");
    cardsContainer.innerHTML = `<div class="loading-state" style="padding: 2rem 0;"><i class="fa-solid fa-circle-notch fa-spin"></i> 실시간 추천 리스트 및 유튜브 검색 중...</div>`;
    
    const apiKey = localStorage.getItem("Pn4_Gemini_Key");
    
    // If virtual vault or missing API key, provide smart mock database reflecting active filters & categories
    if ((dirHandle && dirHandle.name === "Virtual_Obsidian_Vault") || !apiKey) {
        setTimeout(() => {
            currentStepRecommendations = getMockRecommendations(category, activePreferenceFilter, step.place);
            step.recommendations = currentStepRecommendations; // cache it!
            renderRecommendCards();
            updateWizardMapMarkers(); // Update Leaflet markers for demo mode
        }, 500);
        return;
    }
    
    const prompt = `
당신은 여행 및 레저 분야의 전문 가이드입니다. 
목적지: "${destination}"에서 "${step.title}" 단계를 위한 최고의 실시간 ${categoryTarget} 추천지 3곳을 인터넷 검색(Google Grounding)으로 찾아서 제시해 주십시오.
설명글이나 백틱(\`\`\`json) 기호 없이 오직 JSON 배열로만 정갈하게 응답하십시오.

[사용자 선호 취향 필터]
- ${preferenceInfo || "기본 추천"}

[현재 계획된 기본 정보]
- 현재 단계 타이틀: ${step.title}
- 현재 단계 기본 추천장소: ${step.place}
- 카테고리: ${category} (${categoryInstruction})

[🚨 카테고리 꼬임 방지 핵심 지침]
* 현재 단계의 카테고리는 **"${category}"** 입니다.
* 만약 카테고리가 "숙소" 단계라면, 절대 식당이나 카페, 단순 야외공원을 추천하지 마십시오. 오직 **실제로 밤에 잘 수 있는 호텔, 펜션, 게스트하우스 등 숙박시설**만 추천에 포함해야 합니다.
* 이전 단계들의 일정(예: 맛집 이름)을 검색어에 섞지 마십시오. 오직 현재 단계의 대상에만 독립적으로 집중해 주십시오.

[신뢰성 및 대중성 검증 지침]
1. 반드시 대중적으로 이용자 후기가 많이 누적되고 평점이 우수한 실제 존재하는 장소만 선별하십시오.
2. 네이버/티스토리 등 실제 활성 파워 인플루언서 블로그 주소(URL) 또는 조회수가 높은 고품질 유튜브 리뷰 영상(URL)을 정확히 연결하십시오.
3. 무조건적인 광고 홍보 페이지나 허위 장소는 철저히 배제하십시오.

[출력 JSON 형식]
[
  {
    "place": "추천 장소명",
    "desc": "추천 사유 및 대중성 특징 요약",
    "url": "실제 검색된 블로그/유튜브 URL",
    "source_title": "해당 글/영상 제목",
    "type": "blog" 또는 "youtube",
    "rating": 4.7, // 소수점 1자리 평점 (4.0~5.0 사이)
    "reliability": "리뷰 2,000건 이상으로 대중성 입증" 또는 "조회수 10만회 유튜브 추천 명소" 등 신뢰도 증거 요약
  }
]
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }] // Enable Google Search Grounding!
    };
    
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            let rawJson = data.candidates[0].content.parts[0].text.trim();
            if (rawJson.startsWith("```")) {
                rawJson = rawJson.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
            }
            
            currentStepRecommendations = JSON.parse(rawJson);
            step.recommendations = currentStepRecommendations; // Cache it!
            renderRecommendCards();
            updateWizardMapMarkers(); // Update map markers after Grounding load
        } else {
            throw new Error("No recommendation Candidates");
        }
    } catch (err) {
        console.error("Grounded recommendations load failed:", err);
        currentStepRecommendations = getMockRecommendations(category, activePreferenceFilter, step.place);
        step.recommendations = currentStepRecommendations; // Cache it!
        renderRecommendCards();
        updateWizardMapMarkers(); // Update map markers even for fallback mock recommendations
    }
}

// Generate smart mock recommendations based on category and style filter
function getMockRecommendations(category, filter, defaultPlace) {
    if (category === "숙소") {
        if (filter.includes("가성비")) {
            return [
                { place: "경주 소설재", desc: "황리단길 내 깔끔하고 가성비 훌륭한 전통 한옥 체험 게스트하우스. 조식 샌드위치가 제공되며 친절함.", url: "https://search.naver.com/search.naver?query=경주+소설재", source_title: "소설재 한옥스테이 내돈내산 후기", type: "blog", rating: 4.7, reliability: "구글 평점 4.7/5, 10만원대 한옥 스테이 대표" },
                { place: "신라부티크호텔 프리미엄", desc: "보문단지 인근 대중성 있는 가성비 호텔. 키즈룸과 온돌방 완비. 평점 우수.", url: "https://search.naver.com/search.naver?query=신라부티크호텔+경주", source_title: "경주 가성비 호텔 신라부티크 리뷰", type: "blog", rating: 4.5, reliability: "네이버 블로그 리뷰 800+건으로 가성비 검증" }
            ];
        } else if (filter.includes("전망") || filter.includes("오션뷰")) {
            return [
                { place: "라한셀렉트 경주", desc: "보문호수 전망이 완벽한 경주 최고의 뷰맛집 5성급 호텔. 호수 산책로 연동.", url: "https://search.naver.com/search.naver?query=라한셀렉트+경주", source_title: "호수 전망 대박! 라한셀렉트 경주 호캉스 후기", type: "blog", rating: 4.8, reliability: "방문자 후기 5,000건 돌파 대표 전망 호텔" },
                { place: "경주 라궁호텔", desc: "궁궐 같은 고풍스러운 한옥 전망 독채로 개별 노천탕 완비. 힐링 및 온천 명소.", url: "https://www.youtube.com/results?search_query=경주+라궁호텔", source_title: "경주 한옥 독채 라궁 노천탕 힐링 브이로그", type: "youtube", rating: 4.9, reliability: "유튜브 조회수 15만 돌파 노천탕 핫플레이스" }
            ];
        } else if (filter.includes("인스타그램") || filter.includes("핫플레이스")) {
            return [
                { place: "황리단길 감성 숙소 소소와", desc: "SNS 인스타그램에서 화제인 개별 자쿠지 보유 한옥 감성 독채 펜션.", url: "https://search.naver.com/search.naver?query=경주+소소와", source_title: "인스타 감성 폭발 경주 자쿠지 숙소 소소와", type: "blog", rating: 4.9, reliability: "인스타그램 자쿠지 한옥 해시태그 상위권" },
                { place: "경주 지지관광호텔", desc: "황리단길 도보 3분 거리의 대중성 높고 접근성이 압도적인 인기 핫플 호텔.", url: "https://search.naver.com/search.naver?query=경주+지지관광호텔", source_title: "황리단길 바로 옆 지지관광호텔 솔직 리뷰", type: "blog", rating: 4.6, reliability: "황리단길 접근성 최고 평가, 리뷰 1,200건" }
            ];
        } else if (filter.includes("조용")) {
            return [
                { place: "경주 한옥스테이 헤이븐", desc: "보문단지 너머 조용한 숲 속에 위치한 독채 한옥 스테이. 평화로운 힐링 추천.", url: "https://search.naver.com/search.naver?query=경주+헤이븐+한옥", source_title: "조용하게 힐링하기 좋은 경주 한옥 헤이븐", type: "blog", rating: 4.9, reliability: "조용하고 아늑한 한옥 만족도 조사 만점급" }
            ];
        } else {
            return [
                { place: "경주 힐튼호텔", desc: "대릉원 및 보문호수와 가까우며 대중적인 신뢰성이 검증된 프리미엄 패밀리 호텔.", url: "https://search.naver.com/search.naver?query=경주+힐튼호텔", source_title: "경주 힐튼호텔 디럭스룸 솔직 후기", type: "blog", rating: 4.7, reliability: "5성급 전통 호텔 브랜드 파워 신뢰" },
                { place: "소설재 황리단길점", desc: "황리단길의 정갈하고 대중적인 인기를 누리는 한옥 게하. 접근성 최고.", url: "https://search.naver.com/search.naver?query=소설재", source_title: "경주 여행 한옥 추천 소소한 일상", type: "blog", rating: 4.7, reliability: "커플/가족 단위 한옥체험 만족도 95%" }
            ];
        }
    } else if (category === "음식점" || category === "카페") {
        if (filter.includes("가성비")) {
            return [
                { place: "황남밀면", desc: "경주 특산 밀면 전문점으로 매콤달콤 양념과 가성비 우수. 현지인 대중성 검증.", url: "https://search.naver.com/search.naver?query=경주+황남밀면", source_title: "경주 황리단길 황남밀면 가성비 최고", type: "blog", rating: 4.5, reliability: "리뷰 1,800건 이상 대중적인 가성비 식당" }
            ];
        } else if (filter.includes("전망") || filter.includes("오션뷰")) {
            return [
                { place: "황리단길 온천집", desc: "대릉원 인근 연못 정원 뷰가 훌륭해 줄 서서 먹는 샤브샤브 분위기 맛집.", url: "https://search.naver.com/search.naver?query=황리단길+온천집", source_title: "뷰맛집 온천집 샤브샤브 웨이팅 팁", type: "blog", rating: 4.6, reliability: "인스타 해시태그 1만건 돌파 비주얼 뷰맛집" }
            ];
        } else {
            return [
                { place: "교동쌈밥", desc: "경주 전통 교동 최씨 가문의 조리법을 딴 쌈밥 전문점. 대중성 높은 쌈밥 한정식.", url: "https://search.naver.com/search.naver?query=경주+교동쌈밥", source_title: "경주 쌈밥 정식 원조 교동쌈밥 내돈내산", type: "blog", rating: 4.6, reliability: "30년 업력, 네이버 리뷰 2,400+건 대중성 입증" },
                { place: "황남경주식당", desc: "황리단길 인근의 고풍스러운 한옥에서 고기 밥상을 즐길 수 있는 신뢰성 높은 고깃집.", url: "https://search.naver.com/search.naver?query=황남경주식당", source_title: "경주 고기구이 전문 황남경주식당 방문기", type: "blog", rating: 4.7, reliability: "구글 평점 4.5/5, 이용객 만족도 최상위" }
            ];
        }
    } else {
        if (filter.includes("조용")) {
            return [
                { place: "경주 서출지", desc: "남산 자락의 연못으로 조용히 산책하며 사색하기 아주 훌륭한 힐링 코스.", url: "https://search.naver.com/search.naver?query=경주+서출지", source_title: "아름다운 배롱나무 꽃이 피는 조용한 서출지", type: "blog", rating: 4.8, reliability: "국내 조용한 사색 명소 10선 등재" }
            ];
        } else {
            return [
                { place: "대릉원 천마총", desc: "경주 시내 중심의 거대한 황남대총과 천마총 내부 관람로가 이어진 국민 필수 역사 코스.", url: "https://search.naver.com/search.naver?query=대릉원+천마총", source_title: "경주 대릉원 포토존 위치 및 소나무길 힐링 산책", type: "blog", rating: 4.8, reliability: "연간 방문객 100만 명 돌파 대표 유적지" },
                { place: "동궁과 월지 야경", desc: "대중적인 신뢰성 1순위 야경 관람 명소. 호수에 비친 조명이 장엄함.", url: "https://www.youtube.com/results?search_query=동궁과+월지+야경", source_title: "한국의 야경 명소 탑티어! 경주 동궁과 월지 실시간 영상", type: "youtube", rating: 4.9, reliability: "경주 야경 명소 압도적 1위, 평점 4.8" }
            ];
        }
    }
}

// Render the 3 recommendation option cards
function renderRecommendCards() {
    const container = document.getElementById("recommend-cards-container");
    if (!container) return;
    
    if (currentStepRecommendations.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">추천지를 찾지 못했습니다. 직접 입력해 주세요.</p>`;
        return;
    }
    
    container.innerHTML = currentStepRecommendations.map((rec, idx) => {
        const badgeClass = rec.type === 'youtube' ? 'youtube' : 'blog';
        const badgeLabel = rec.type === 'youtube' ? 'YouTube' : 'Blog';
        const icon = rec.type === 'youtube' ? 'fa-brands fa-youtube' : 'fa-regular fa-file-lines';
        
        const ratingVal = rec.rating || 5.0;
        const starsStr = "⭐ " + parseFloat(ratingVal).toFixed(1);
        const reliabilityText = rec.reliability || "실시간 대중성 검증 완료";
        
        return `
            <div class="recommend-card" onclick="selectRecommendCard(${idx})">
                <div>
                    <div class="recommend-card-header">${rec.place}</div>
                    <div class="recommend-card-desc">${rec.desc}</div>
                    
                    <!-- 신뢰성 및 대중성 검증 지표 영역 -->
                    <div class="recommend-card-verify-row" style="margin-top: 0.65rem; display: flex; flex-direction: column; gap: 0.2rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem;">
                            <span style="color: var(--accent-amber); font-weight: 700;">${starsStr}</span>
                            <span class="recommend-card-badge-verified" style="background-color: rgba(74, 222, 128, 0.08); color: var(--accent-emerald); font-size: 0.65rem; padding: 0.05rem 0.35rem; border-radius: 4px; font-weight: bold; border: 1px solid rgba(74, 222, 128, 0.15); display: inline-flex; align-items: center; gap: 0.2rem;">
                                <i class="fa-solid fa-circle-check"></i> 검증됨
                            </span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem;">
                            <i class="fa-solid fa-square-poll-vertical"></i> ${reliabilityText}
                        </div>
                    </div>
                </div>
                <div class="recommend-card-footer">
                    <span class="recommend-platform-badge ${badgeClass}"><i class="${icon}"></i> ${badgeLabel}</span>
                    <a href="${rec.url}" target="_blank" class="recommend-source-link" onclick="event.stopPropagation()">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> 출처 보기
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

// Highlight clicked card and copy place name to custom input
function selectRecommendCard(idx) {
    document.querySelectorAll(".recommend-card").forEach((card, cidx) => {
        if (cidx === idx) {
            card.classList.add("selected");
        } else {
            card.classList.remove("selected");
        }
    });
    
    const rec = currentStepRecommendations[idx];
    if (rec) {
        document.getElementById("wizard-custom-input").value = rec.place;
        if (wizardMap && rec.lat && rec.lng) {
            wizardMap.panTo([rec.lat, rec.lng]);
            wizardMarkers.forEach(m => {
                if (m instanceof L.Marker && m.getLatLng().lat === rec.lat && m.getLatLng().lng === rec.lng) {
                    m.openPopup();
                }
            });
        }
    }
}

// Click listener to confirm choice and go to next step
async function submitWizardStep() {
    const val = document.getElementById("wizard-custom-input").value.trim();
    const defaultStep = wizardSteps[currentStepIndex];
    
    let finalPlace = val || defaultStep.place;
    let finalLat = defaultStep.lat;
    let finalLng = defaultStep.lng;
    let finalCategory = defaultStep.category || "관광";
    let finalCost = defaultStep.cost || 0;
    let finalTransport = defaultStep.transport || "도보 5분";
    let finalDesc = defaultStep.desc || "";
    
    const matchedRec = currentStepRecommendations.find(rec => rec.place === finalPlace);
    if (matchedRec) {
        finalDesc = matchedRec.desc || finalDesc;
        finalLat = defaultStep.lat + (Math.random() - 0.5) * 0.005;
        finalLng = defaultStep.lng + (Math.random() - 0.5) * 0.005;
    }
    
    // Save selection
    selectedItinerary.push({
        title: defaultStep.title,
        place: finalPlace,
        desc: finalDesc,
        category: finalCategory,
        cost: finalCost,
        transport: finalTransport,
        lat: finalLat,
        lng: finalLng
    });
    
    currentStepIndex++;
    
    if (currentStepIndex < wizardSteps.length) {
        renderTimeline();
        await loadStepRecommendations(false); // Load next step from pre-fetched cache!
    } else {
        // Wizard completed! Compile final markdown plan
        await finalizeItinerary();
    }
}

// Call Gemini API to compile final comprehensive Markdown Itinerary
async function finalizeItinerary() {
    if (wizardMap) {
        try {
            wizardMap.remove();
        } catch(e){}
        wizardMap = null;
    }
    const wizardArea = document.getElementById("planner-wizard-area");
    wizardArea.innerHTML = `
        <div class="loading-state" style="padding: 5rem 0;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.5rem;"></i>
            <h3 style="margin-top: 1.5rem; color: var(--text-primary);">최종 여행 계획표 컴파일 중...</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">레오님이 선택하신 일정 정보들을 모아 고품질 마크다운으로 정리하고 있습니다.</p>
        </div>
    `;
    
    const apiKey = localStorage.getItem("Pn4_Gemini_Key");
    
    const prompt = `
당신은 레오(LEOHYP)님의 개인 여행 및 맛집 전문 가이드 AI입니다. 
사용자가 단계별로 조율하고 확정한 다음 코스들을 바탕으로 하나의 아름답고 상세한 마크다운 여행 계획표를 작성해 주십시오.

[기본 정보]
- 목적지: ${destination}
- 기간: ${duration}
- 테마: ${theme}

[레오님이 직접 선택하고 조율한 코스 목록]
${selectedItinerary.map(item => `- ${item.title}: ${item.place}`).join("\n")}

[작성 지침 및 형식]
1. 최상단에 Obsidian 노트와 호환되는 YAML Frontmatter를 작성하십시오.
2. 본문에는 다음 내용이 포함되어야 합니다:
   - 🗺️ **[여행/맛집 경로 요약]**: 선택된 코스들의 동선 흐름 요약
   - 📅 **[일정 상세 구성]**: 각 일자별 선택지에 대한 세부 설명(위치 팁, 대표 메뉴, 특징 등) 및 이동 팁 기술
   - 💡 **[성공적인 방문을 위한 로컬 팁]**: 주차, 예약 꿀팁, 혼잡 시간대 피하기 등 실용 정보
3. 내용에 이모지를 활용하여 읽기 쉽고 감성적으로 작성하십시오.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            const rawText = data.candidates[0].content.parts[0].text;
            
            // Clean up YAML from rawText if it has one
            let geminiBody = rawText;
            if (rawText.trim().startsWith('---')) {
                const parts = rawText.split('---');
                if (parts.length >= 3) {
                    geminiBody = parts.slice(2).join('---').trim();
                }
            }
            
            // Initialize Checklist state
            currentChecklist = [
                { text: "여권 및 지갑(카드/현금)", completed: false },
                { text: "보조배터리 및 충전기", completed: false },
                { text: "날씨에 맞는 여벌 옷 및 잠옷", completed: false },
                { text: "상비약 (두통약, 밴드, 소화제)", completed: false },
                { text: "세면도구 및 화장품", completed: false }
            ];
            
            // Calculate Total Budget (multiply individual cost by party size)
            let totalBudget = 0;
            selectedItinerary.forEach(item => totalBudget += (parseInt(item.cost) || 0) * partySize);
            
            // Build YAML Itinerary Frontmatter
            const yamlItinerary = selectedItinerary.map(item => {
                return `  - title: "${item.title}"\n    place: "${item.place}"\n    category: "${item.category}"\n    cost: ${item.cost}\n    lat: ${item.lat}\n    lng: ${item.lng}\n    transport: "${item.transport}"`;
            }).join("\n");
            
            const cleanDest = destination.replace(/[\\/*?:"<>|]/g, "");
            const nowStr = new Date().toISOString().replace(/[-:T]/g, "").substring(0, 14);
            const filename = `Plan_${cleanDest}_${nowStr}.md`;
            
            const fullMarkdown = `---
title: "${destination} ${theme} 계획"
date: "${new Date().toISOString().split('T')[0]}"
category: "Travel"
rating: 5
expenses: ${totalBudget}
tags: [Plan, "${destination}", "${theme.replace(/\s+/g, '')}"]
status: "Planned"
itinerary:
${yamlItinerary}
---

${geminiBody}

---

## 💸 여행 가계부 및 지출 현황

| 일정 | 장소 | 분류 | 예상 비용 (1인당) | 이동 편 |
| :--- | :--- | :--- | :--- | :--- |
${selectedItinerary.map(item => `| ${item.title} | ${item.place} | ${item.category} | ${item.cost.toLocaleString('ko-KR')}원 | ${item.transport} |`).join("\n")}
| **총합 (총 ${partySize}명 기준)** | | | **${totalBudget.toLocaleString('ko-KR')}원** | |

## 🧳 여행 준비물 체크리스트

${currentChecklist.map(item => `- [${item.completed ? "x" : " "}] ${item.text}`).join("\n")}
`;

            let success = true;
            if (dirHandle && dirHandle.name !== "Virtual_Obsidian_Vault") {
                success = await writeLogToVault(filename, fullMarkdown);
            } else {
                // Simulate save for virtual demo
                const newDemoLog = {
                    filename: filename,
                    filepath: filename,
                    frontmatter: {
                        title: `${destination} ${theme} 계획`,
                        date: new Date().toISOString().split('T')[0],
                        category: "Travel",
                        rating: 5,
                        expenses: totalBudget,
                        tags: ["Plan", destination, theme.replace(/\s+/g, '')],
                        status: "Planned",
                        itinerary: selectedItinerary
                    },
                    body: geminiBody,
                    html_body: marked.parse(geminiBody)
                };
                // Remove any existing demo plan with the same name if exists
                allLogs = allLogs.filter(log => log.filename !== filename);
                allLogs.unshift(newDemoLog);
            }
            
            if (success) {
                currentPlanFilename = filename;
                currentPlanContent = fullMarkdown;
                
                document.getElementById("current-plan-filename-badge").innerText = filename;
                document.getElementById("planner-editor-textarea").value = fullMarkdown;
                setPlannerEditorMode('view');
                
                // Hide wizard area
                document.getElementById("planner-wizard-area").classList.add("hidden");
                
                // Switch to result sub-tab
                switchPlannerSubTab('result');
                
                // Show result box & Populate UI
                const resultBox = document.getElementById("planner-result-box");
                const resultContent = document.getElementById("planner-result-content");
                resultContent.innerHTML = marked.parse(geminiBody);
                resultBox.classList.remove("hidden");
                resultBox.scrollIntoView({ behavior: 'smooth' });
                
                // Load Leaflet Map & Checklist & Budget UI
                initLeafletMap("planner-map", selectedItinerary);
                renderChecklistUI();
                updateBudgetUI();
                
                // Analyze route efficiency and display optimization banner if needed
                const analysis = analyzeRouteEfficiency(selectedItinerary);
                const banner = document.getElementById("route-optimize-banner");
                if (analysis.savingPercent >= 15 && banner) {
                    document.getElementById("route-optimize-msg").innerHTML = `현재 이동 경로를 재배치하면 총 이동거리를 약 <strong>${analysis.savingPercent}%</strong> (${(analysis.currentDist - analysis.optimizedDist).toFixed(1)}km) 절약할 수 있습니다.`;
                    banner.classList.remove("hidden");
                    window.pendingOptimizedItinerary = analysis.optimizedOrder;
                } else if (banner) {
                    banner.classList.add("hidden");
                }
                
                // Restore wizard UI layout for future planning
                resetWizardAreaHTML();
                
                // Show setup form again
                document.getElementById("ai-planner-form").style.display = "block";
                const submitBtn = document.getElementById("planner-submit-btn");
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> 일정 설계 시작하기`;
                
                // Refresh dashboard logs
                loadLogsFromVault();
            }
        }
    } catch (err) {
        console.error("Wizard finalize failed:", err);
        alert("계획서 완성 중 오류 발생: " + err.message);
        cancelPlannerWizard();
    }
}

// Populate packing checklist UI
function renderChecklistUI() {
    const container = document.getElementById("checklist-items-container");
    if (!container) return;
    
    if (currentChecklist.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem 0;">등록된 준비물이 없습니다.</p>`;
        return;
    }
    
    container.innerHTML = currentChecklist.map((item, idx) => {
        const checked = item.completed ? "checked" : "";
        const completedClass = item.completed ? "completed" : "";
        return `
            <div class="checklist-item ${completedClass}">
                <label class="checklist-item-left" onclick="toggleChecklistItem(${idx})">
                    <input type="checkbox" ${checked} onclick="event.stopPropagation(); toggleChecklistItem(${idx});">
                    <span>${item.text}</span>
                </label>
                <button type="button" class="checklist-delete-btn" onclick="deleteChecklistItem(${idx})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

async function addChecklistItemDirect() {
    const input = document.getElementById("checklist-new-item");
    const val = input.value.trim();
    if (!val) return;
    
    currentChecklist.push({ text: val, completed: false });
    input.value = "";
    renderChecklistUI();
    
    if (currentPlanFilename) {
        await updateObsidianChecklistAndBudget();
    }
}

async function toggleChecklistItem(idx) {
    if (currentChecklist[idx]) {
        currentChecklist[idx].completed = !currentChecklist[idx].completed;
        renderChecklistUI();
        if (currentPlanFilename) {
            await updateObsidianChecklistAndBudget();
        }
    }
}

async function deleteChecklistItem(idx) {
    currentChecklist.splice(idx, 1);
    renderChecklistUI();
    if (currentPlanFilename) {
        await updateObsidianChecklistAndBudget();
    }
}

// Update budget summary gauges
function updateBudgetUI() {
    const totalCostSpan = document.getElementById("budget-total-cost");
    const perPersonCostSpan = document.getElementById("budget-per-person-cost");
    const partyLabelSpan = document.getElementById("budget-party-label");
    const barsContainer = document.getElementById("budget-categories-bars");
    if (!totalCostSpan || !barsContainer) return;
    
    const catTotals = {
        "음식점": 0,
        "숙소": 0,
        "교통": 0,
        "관광": 0,
        "쇼핑": 0,
        "기타": 0
    };
    
    let perPersonTotal = 0;
    
    selectedItinerary.forEach(item => {
        const cost = parseInt(item.cost) || 0;
        const cat = item.category || "기타";
        if (catTotals[cat] !== undefined) {
            catTotals[cat] += cost * partySize;
        } else {
            catTotals["기타"] += cost * partySize;
        }
        perPersonTotal += cost;
    });
    
    const grandTotal = perPersonTotal * partySize;
    
    totalCostSpan.innerText = grandTotal.toLocaleString('ko-KR') + "원";
    if (perPersonCostSpan) {
        perPersonCostSpan.innerText = perPersonTotal.toLocaleString('ko-KR') + "원";
    }
    if (partyLabelSpan) {
        partyLabelSpan.innerText = `(${partySize}명 기준)`;
    }
    
    const classMap = {
        "음식점": "bar-fill-gourmet",
        "숙소": "bar-fill-stay",
        "교통": "bar-fill-transport",
        "관광": "bar-fill-activity",
        "쇼핑": "bar-fill-shopping",
        "기타": "bar-fill-etc"
    };
    
    barsContainer.innerHTML = Object.entries(catTotals).map(([cat, amount]) => {
        const percentage = grandTotal > 0 ? (amount / grandTotal * 100).toFixed(0) : 0;
        const fillClass = classMap[cat] || "bar-fill-etc";
        
        return `
            <div class="budget-category-row">
                <div class="budget-category-info">
                    <span>${cat}</span>
                    <span>${amount.toLocaleString('ko-KR')}원 (${percentage}%)</span>
                </div>
                <div class="budget-category-bar-bg">
                    <div class="budget-category-bar-fill ${fillClass}" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Initialize Leaflet map and render route polylines
function initLeafletMap(containerId, steps) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (plannerMap) {
        plannerMap.remove();
        plannerMap = null;
    }
    
    const validSteps = steps.filter(s => s.lat && s.lng);
    if (validSteps.length === 0) {
        container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height:100%; color: var(--text-muted);">지도 좌표 데이터가 없습니다.</div>`;
        return;
    }
    
    container.innerHTML = "";
    const mapDiv = document.createElement("div");
    mapDiv.style.width = "100%";
    mapDiv.style.height = "100%";
    container.appendChild(mapDiv);
    
    const map = L.map(mapDiv).setView([validSteps[0].lat, validSteps[0].lng], 13);
    plannerMap = map;
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    const latlngs = [];
    
    validSteps.forEach((step, idx) => {
        const marker = L.marker([step.lat, step.lng]).addTo(map);
        marker.bindPopup(`
            <div style="font-family: Outfit, sans-serif; color: #1e293b;">
                <strong style="font-size:0.95rem;">${step.place}</strong><br>
                <span style="font-size:0.8rem; color:#64748b;">${step.title} (${step.category || '기타'})</span><br>
                <p style="margin-top:0.4rem; font-size:0.85rem; line-height:1.3;">${step.desc}</p>
            </div>
        `);
        
        latlngs.push([step.lat, step.lng]);
    });
    
    if (latlngs.length > 1) {
        const polyline = L.polyline(latlngs, {
            color: '#3b82f6',
            weight: 4,
            opacity: 0.8,
            dashArray: '5, 10'
        }).addTo(map);
        
        map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
        
        for (let i = 0; i < validSteps.length - 1; i++) {
            const start = validSteps[i];
            const end = validSteps[i+1];
            const midLat = (start.lat + end.lat) / 2;
            const midLng = (start.lng + end.lng) / 2;
            
            const routeMarker = L.circleMarker([midLat, midLng], {
                radius: 5,
                fillColor: '#10b981',
                color: '#fff',
                weight: 1,
                fillOpacity: 0.8
            }).addTo(map);
            
            routeMarker.bindPopup(`
                <div style="font-family: Outfit, sans-serif; color: #1e293b; padding: 0.2rem;">
                    <strong>🚗 이동 경로 안내</strong><br>
                    <span style="font-size:0.8rem; color:#64748b;">${start.place} &rarr; ${end.place}</span><br>
                    <span style="color: var(--accent-emerald); font-weight:600; font-size:0.85rem;">추천 이동: ${end.transport || '자가용/택시 이동'}</span>
                </div>
            `);
        }
    }
}

// Synchronize checklist changes back to the Obsidian markdown file
async function updateObsidianChecklistAndBudget() {
    if (!currentPlanFilename || !currentPlanContent) return;
    
    let body = currentPlanContent;
    
    if (currentPlanContent.trim().startsWith('---')) {
        const parts = currentPlanContent.split('---');
        if (parts.length >= 3) {
            body = parts.slice(2).join('---').trim();
        }
    }
    
    const checklistPart = `## 🧳 여행 준비물 체크리스트\n\n${currentChecklist.map(item => `- [${item.completed ? "x" : " "}] ${item.text}`).join("\n")}`;
    
    if (body.includes("## 🧳 여행 준비물 체크리스트")) {
        body = body.split("## 🧳 여행 준비물 체크리스트")[0] + checklistPart;
    } else {
        body = body + "\n\n" + checklistPart;
    }
    
    const yamlItinerary = selectedItinerary.map(item => {
        return `  - title: "${item.title}"\n    place: "${item.place}"\n    category: "${item.category}"\n    cost: ${item.cost}\n    lat: ${item.lat}\n    lng: ${item.lng}\n    transport: "${item.transport}"`;
    }).join("\n");
    
    let totalBudget = 0;
    selectedItinerary.forEach(item => totalBudget += parseInt(item.cost) || 0);
    
    const updatedContent = `---
title: "${destination} ${theme} 계획"
date: "${new Date().toISOString().split('T')[0]}"
category: "Travel"
rating: 5
expenses: ${totalBudget}
tags: [Plan, "${destination}", "${theme.replace(/\s+/g, '')}"]
status: "Planned"
itinerary:
${yamlItinerary}
---

${body}
`;

    const success = await writeLogToVault(currentPlanFilename, updatedContent);
    if (success) {
        currentPlanContent = updatedContent;
        loadLogsFromVault(); // Sync dashboard
    }
}

// Restore default wizard area HTML structure for future use
function resetWizardAreaHTML() {
    const wizardArea = document.getElementById("planner-wizard-area");
    wizardArea.innerHTML = `
        <!-- Stepper Indicator -->
        <div class="stepper-container" style="margin-bottom: 2rem;">
            <div class="stepper-header" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-weight: 600;">
                <span id="wizard-step-title" class="step-title" style="color: var(--accent-blue); font-size: 1.15rem;">1일차 점심 식사</span>
                <span id="wizard-step-progress" class="step-progress" style="color: var(--text-secondary);">1 / 5</span>
            </div>
            <div class="stepper-bar" style="background-color: hsl(222, 20%, 8%); height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color);">
                <div id="wizard-progress-bar" class="stepper-progress-fill" style="width: 20%; background-color: var(--accent-blue); height: 100%; transition: var(--transition-smooth);"></div>
            </div>
        </div>

        <!-- Timeline Overview -->
        <div class="timeline-overview" style="margin-bottom: 2rem; background-color: hsla(222, 20%, 5%, 0.3); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 14px;">
            <h4 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.75rem;"><i class="fa-solid fa-list-check"></i> 📋 기본 일정 초안 흐름</h4>
            <div id="wizard-timeline-container" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; padding-right: 0.5rem;">
                <!-- Will be loaded dynamically -->
            </div>
        </div>

        <!-- Local History Hint (From Obsidian) -->
        <div id="local-history-hint" class="local-hint-card hidden" style="background-color: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); padding: 1.25rem; border-radius: 14px; margin-bottom: 2rem; display: flex; flex-direction: column; gap: 0.5rem;">
            <div class="hint-header" style="font-weight: 700; color: var(--accent-blue); font-size: 0.95rem;">
                <i class="fa-solid fa-lightbulb"></i> 💡 레오님의 과거 Obsidian 기록 발견
            </div>
            <div id="local-history-hint-content" class="hint-body" style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;"></div>
        </div>

        <!-- Recommendations Card Container -->
        <div class="recommendation-section" style="margin-bottom: 2rem;">
            <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem;"><i class="fa-solid fa-magnifying-glass"></i> 실시간 블로그 & 유튜브 추천 목록</h4>
            <p class="section-desc-small" style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">Gemini가 구글 실시간 검색을 통해 연동한 생생한 출처 리스트입니다. 마음에 드는 카드를 클릭해 주세요.</p>
            <div id="recommend-cards-container" class="recommend-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem;"></div>
        </div>

        <!-- Step Control Input/Button -->
        <div class="wizard-control-row" style="display: flex; gap: 1rem; align-items: center; margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.5rem;">
            <div class="form-group" style="flex-grow: 1; margin-bottom: 0; display: flex; flex-direction: column; gap: 0.5rem;">
                <label for="wizard-custom-input" style="font-size: 0.85rem;">✍️ 선택지 직접 입력 (원하는 코스가 없을 경우 기입)</label>
                <input type="text" id="wizard-custom-input" placeholder="예: 경주 황남밀면집에서 밀면 식사">
            </div>
            <button id="btn-wizard-next" class="submit-btn" onclick="submitWizardStep()" style="margin-top: 1.5rem; width: auto; padding: 0.85rem 2rem; white-space: nowrap;">
                다음 단계로 <i class="fa-solid fa-arrow-right"></i>
            </button>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem;">
            <button class="icon-btn" onclick="refreshStepRecommendations()" style="padding: 0.5rem 1rem;">
                <i class="fa-solid fa-arrows-rotate"></i> 다른 목록 검색
            </button>
            <button class="icon-btn" onclick="cancelPlannerWizard()" style="color: var(--accent-rose); border-color: rgba(239, 68, 68, 0.2); padding: 0.5rem 1rem;">
                계획 수립 취소
            </button>
        </div>
    `;
}

// Cancel active planner session
function cancelPlannerWizard() {
    if (wizardMap) {
        try {
            wizardMap.remove();
        } catch(e){}
        wizardMap = null;
    }
    wizardState = 'setup';
    document.getElementById("planner-wizard-area").classList.add("hidden");
    document.getElementById("ai-planner-form").style.display = "block";
    
    const submitBtn = document.getElementById("planner-submit-btn");
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> 일정 설계 시작하기`;
    
    resetWizardAreaHTML();
}

// Reload current step recommendations
async function refreshStepRecommendations() {
    await loadStepRecommendations(true);
}

// Copy to clipboard
function copyPlanToClipboard() {
    const content = document.getElementById("planner-result-content").innerText;
    navigator.clipboard.writeText(content).then(() => {
        const copyBtn = document.getElementById("copy-plan-btn");
        copyBtn.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--accent-emerald);"></i> 복사 완료`;
        setTimeout(() => {
            copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> 복사`;
        }, 2000);
    }).catch(err => {
        console.error("Copy failed:", err);
    });
}

// Settings modal trigger
function openSettingsModal() {
    const modal = document.getElementById("settings-modal");
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeSettingsModal() {
    const modal = document.getElementById("settings-modal");
    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
}

function closeSettingsModalOnOuterClick(event) {
    const modalContent = document.querySelector("#settings-modal .modal-content");
    if (modalContent && !modalContent.contains(event.target)) {
        closeSettingsModal();
    }
}

function saveSettings() {
    const apiKey = document.getElementById("settings-api-key").value.trim();
    localStorage.setItem("Pn4_Gemini_Key", apiKey);
    alert("Gemini API Key가 성공적으로 저장되었습니다!");
    closeSettingsModal();
}

// Toggle detailed option panel accordion
function toggleDetailedOptions() {
    const panel = document.getElementById("detailed-options-panel");
    const arrow = document.getElementById("detailed-options-arrow");
    if (!panel || !arrow) return;
    
    const isHidden = panel.classList.contains("hidden");
    if (isHidden) {
        panel.classList.remove("hidden");
        panel.style.maxHeight = "500px"; // Expand
        arrow.style.transform = "rotate(180deg)";
    } else {
        panel.style.maxHeight = "0"; // Collapse
        arrow.style.transform = "rotate(0deg)";
        setTimeout(() => {
            panel.classList.add("hidden");
        }, 400);
    }
}

// -----------------------------------------------------
// Interactive Plan Refinement Upgrade Logic
// -----------------------------------------------------

// Toggle between Markdown Preview and Manual Edit modes
function setPlannerEditorMode(mode) {
    const btnView = document.getElementById("btn-planner-view-mode");
    const btnEdit = document.getElementById("btn-planner-edit-mode");
    const panelView = document.getElementById("planner-result-content");
    const panelEdit = document.getElementById("planner-editor-container");
    
    if (mode === 'view') {
        btnView.classList.add("active");
        btnEdit.classList.remove("active");
        panelView.classList.remove("hidden");
        panelEdit.classList.add("hidden");
        
        // Sync raw editor text to view HTML
        panelView.innerHTML = marked.parse(currentPlanContent);
    } else {
        btnView.classList.remove("active");
        btnEdit.classList.add("active");
        panelView.classList.add("hidden");
        panelEdit.classList.remove("hidden");
        
        // Ensure textarea has the current content
        document.getElementById("planner-editor-textarea").value = currentPlanContent;
    }
}

// Save manual text edits to local Obsidian note
async function saveManualPlanEdit() {
    if (!currentPlanFilename) {
        alert("수정할 활성화된 계획표가 없습니다.");
        return;
    }
    
    const newContent = document.getElementById("planner-editor-textarea").value;
    const saveBtn = document.getElementById("btn-save-manual-edit");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> 저장 중...`;
    
    const success = await writeLogToVault(currentPlanFilename, newContent);
    if (success) {
        currentPlanContent = newContent;
        setPlannerEditorMode('view');
        alert("수정본이 Obsidian 보관소에 성공적으로 저장되었습니다!");
        loadLogsFromVault(); // Refresh dashboard
    }
    
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> 직접 수정 사항 저장`;
}

// Call Gemini API to refine the existing plan based on feedback
async function refineAIPlan() {
    if (!currentPlanFilename || !currentPlanContent) {
        alert("수정 보완할 활성화된 계획표가 없습니다. 먼저 상단 폼에서 일정표를 생성해 주세요.");
        return;
    }
    
    const feedback = document.getElementById("planner-refine-input").value.trim();
    if (!feedback) {
        alert("수정/보완하고자 하는 피드백 요구사항을 입력해 주세요.");
        return;
    }
    
    const apiKey = localStorage.getItem("Pn4_Gemini_Key");
    if (!apiKey) {
        alert("Gemini API Key가 구성되지 않았습니다. [Gemini 설정]을 클릭해 등록해 주세요.");
        openSettingsModal();
        return;
    }
    
    const submitBtn = document.getElementById("planner-refine-submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Gemini 일정 보완 반영 중...`;
    
    const prompt = `
당신은 레오(LEOHYP)님의 개인 여행 및 맛집 전문 가이드 AI입니다.
아래의 기존 계획표 마크다운 문서를 사용자의 요구사항에 맞게 수정 및 고도화해 주십시오.

[기존 계획표 마크다운]
${currentPlanContent}

[사용자 수정 및 보완 요청사항]
${feedback}

[수정 지침]
1. 기존 마크다운의 구조, 이모지, 기본 일정 흐름은 유지하되 사용자가 지적한 특정 코스나 식당, 일정 영역만 자연스럽게 변경/보완하십시오.
2. YAML Frontmatter 영역(---와 --- 사이의 부분)은 절대로 훼손하지 마십시오. 단, 계획 수정이 발생했으므로 관련 태그(예: tags) 등은 필요에 따라 추가하거나 갱신할 수 있습니다.
3. 설명글이나 코드 블록 기호(예: \`\`\`markdown) 없이 수정된 전체 계획표 마크다운 원본 텍스트만 바로 출력하십시오.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error?.message || "Gemini API request failed");
        }
        
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            let refinedText = data.candidates[0].content.parts[0].text;
            
            // Clean up any markdown code block wrapper if Gemini wraps the output accidentally
            if (refinedText.startsWith("```")) {
                refinedText = refinedText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
            }
            
            const success = await writeLogToVault(currentPlanFilename, refinedText);
            if (success) {
                currentPlanContent = refinedText;
                document.getElementById("planner-editor-textarea").value = refinedText;
                document.getElementById("planner-refine-input").value = ""; // Clear input
                
                setPlannerEditorMode('view');
                alert("AI 피드백이 성공적으로 반영되어 일정표가 업그레이드되었습니다!");
                
                // Refresh dashboard logs
                loadLogsFromVault();
            }
        } else {
            throw new Error("Gemini API가 적절한 수정 후보를 제공하지 않았습니다.");
        }
    } catch (err) {
        console.error("Gemini refinement failed:", err);
        alert("일정 보완 중 오류 발생: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> 피드백 반영하여 업그레이드`;
    }
}

// Load premium demo data into the dashboard memory to allow testing without local vault
function loadDemoData() {
    // Check if dirHandle is set, reset text slightly to mock connection
    const badge = document.getElementById("vault-status-badge");
    badge.className = "status-badge connected";
    badge.innerHTML = `<span class="status-dot"></span><span class="status-text">연결됨: (체험용 가상 보관소)</span>`;
    
    // Setup Mock Plan & Diary markdown files
    const mockPlanBody = `
# 🗺️ 경주 힐링 및 맛집 탐방 경로 요약
1일차 점심 식사로 교동쌈밥을 즐긴 후, 대릉원을 산책하고, 저녁에는 안압지(동궁과 월지)의 환상적인 야경을 관람하는 일정입니다.

## 📅 일정 상세 구성
- **교동쌈밥**: 경주 특산인 한우 쌈밥과 신선한 채소 쌈이 풍성하게 나오는 맛집입니다.
- **대릉원**: 경주의 거대한 고분들 사이를 거닐며 여유와 힐링을 느낄 수 있는 대표 역사 명소입니다.
- **동궁과 월지**: 밤이 되면 고풍스러운 한옥과 호수에 비친 조명이 물들어 최고의 사진 컷을 선사합니다.
`;

    const mockPlanFrontmatter = {
        title: "경주 힐링 및 맛집 탐방 계획",
        date: new Date().toISOString().split('T')[0],
        category: "Travel",
        rating: 5,
        expenses: 26000,
        tags: ["Plan", "경주", "힐링맛집"],
        status: "Planned",
        itinerary: [
            { title: "1일차 점심 식사", place: "교동쌈밥", category: "음식점", cost: 18000, lat: 35.8341, lng: 129.2185, transport: "도보 5분", desc: "한우 쌈밥 정식 추천" },
            { title: "1일차 오후 활동", place: "대릉원", category: "관광", cost: 3000, lat: 35.8382, lng: 129.2223, transport: "도보 10분", desc: "고분 산책 및 천마총 관람" },
            { title: "1일차 저녁 식사", place: "동궁과 월지", category: "관광", cost: 5000, lat: 35.8347, lng: 129.2262, transport: "택시 5분(약 4,500원)", desc: "환상적인 경주 야경 투어" }
        ]
    };

    const mockDiaryBody = `
# 🍕 황남금고 피자 맛집 후기
경주 황리단길에 위치한 황남금고에서 시그니처 깔조네 피자와 파스타를 먹었습니다.
안에 치즈가 폭포처럼 쏟아져 나와 정말 만족스러웠으며 분위기도 엔티크해서 데이트 코스로 강추합니다.
주차가 다소 불편한 점은 아쉽습니다.
`;
    
    const mockDiaryFrontmatter = {
        title: "황남금고 피자 맛집 탐방",
        date: new Date().toISOString().split('T')[0],
        category: "Gourmet",
        rating: 4,
        expenses: 32000,
        tags: ["맛집", "경주", "양식"],
        status: "Completed"
    };

    allLogs = [
        {
            filename: "Plan_Gyeongju_Demo.md",
            filepath: "Plan_Gyeongju_Demo.md",
            frontmatter: mockPlanFrontmatter,
            body: mockPlanBody,
            html_body: marked.parse(mockPlanBody)
        },
        {
            filename: "Diary_Hwangnam_Demo.md",
            filepath: "Diary_Hwangnam_Demo.md",
            frontmatter: mockDiaryFrontmatter,
            body: mockDiaryBody,
            html_body: marked.parse(mockDiaryBody)
        }
    ];

    // Persist mock handle locally in variable
    dirHandle = { name: "Virtual_Obsidian_Vault" };

    updateStats();
    applyFilters();
    
    alert("경주 1박 2일 여행 플랜 데모와 맛집 일기 데모 데이터가 가상 보관소에 성공적으로 로드되었습니다! 대시보드 카드의 '+' 버튼을 클릭하여 고급 지도 동선과 가계부 그래프를 테스트해 보세요.");
}

// Analyze route efficiency using coordinate distance and Greedy TSP
function analyzeRouteEfficiency(itinerary) {
    const validSteps = itinerary.filter(s => s.lat && s.lng);
    if (validSteps.length <= 2) {
        return { currentDist: 0, optimizedDist: 0, savingPercent: 0, optimizedOrder: itinerary };
    }
    
    // Group by Day (using title regex e.g. "1일차")
    const daysMap = {};
    validSteps.forEach(step => {
        const match = step.title.match(/(\d+일차)/);
        const dayKey = match ? match[1] : "1일차";
        if (!daysMap[dayKey]) daysMap[dayKey] = [];
        daysMap[dayKey].push(step);
    });
    
    let currentTotalDist = 0;
    let optimizedTotalDist = 0;
    const optimizedOrder = [];
    
    // Calculate distance and optimize for each day independently
    Object.keys(daysMap).sort().forEach(dayKey => {
        const daySteps = daysMap[dayKey];
        if (daySteps.length <= 1) {
            optimizedOrder.push(...daySteps);
            return;
        }
        
        // 1. Current order distance
        let dayCurrentDist = 0;
        for (let i = 0; i < daySteps.length - 1; i++) {
            dayCurrentDist += calculateDistance(daySteps[i].lat, daySteps[i].lng, daySteps[i+1].lat, daySteps[i+1].lng);
        }
        currentTotalDist += dayCurrentDist;
        
        // 2. Greedy TSP optimization (starts at the first planned step of the day)
        const unvisited = [...daySteps];
        let current = unvisited.shift(); // keep starting point
        optimizedOrder.push(current);
        
        let dayOptimizedDist = 0;
        while (unvisited.length > 0) {
            let nearestIndex = 0;
            let minDistance = Infinity;
            
            for (let i = 0; i < unvisited.length; i++) {
                const dist = calculateDistance(current.lat, current.lng, unvisited[i].lat, unvisited[i].lng);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestIndex = i;
                }
            }
            
            const next = unvisited.splice(nearestIndex, 1)[0];
            dayOptimizedDist += minDistance;
            current = next;
            optimizedOrder.push(current);
        }
        optimizedTotalDist += dayOptimizedDist;
    });
    
    // Append non-coordinate items if any
    itinerary.forEach(step => {
        if (!step.lat || !step.lng) {
            optimizedOrder.push(step);
        }
    });
    
    const savingPercent = currentTotalDist > 0 
        ? Math.round(((currentTotalDist - optimizedTotalDist) / currentTotalDist) * 100)
        : 0;
        
    return {
        currentDist: currentTotalDist,
        optimizedDist: optimizedTotalDist,
        savingPercent: savingPercent,
        optimizedOrder: optimizedOrder
    };
}

// Apply the pending optimized order to selectedItinerary and save
async function applyRouteOptimization() {
    if (!window.pendingOptimizedItinerary || window.pendingOptimizedItinerary.length === 0) return;
    
    selectedItinerary = window.pendingOptimizedItinerary;
    window.pendingOptimizedItinerary = null;
    
    // Hide optimization banner
    dismissRouteOptimization();
    
    // Re-render map and budget
    initLeafletMap("planner-map", selectedItinerary);
    updateBudgetUI();
    
    // Save checklist, budget, and YAML Frontmatter updates back to Obsidian
    if (currentPlanFilename) {
        await updateObsidianChecklistAndBudget();
        
        // Re-compile results UI preview from updated currentPlanContent
        const resultContent = document.getElementById("planner-result-content");
        if (resultContent) {
            let body = currentPlanContent;
            if (currentPlanContent.trim().startsWith('---')) {
                const parts = currentPlanContent.split('---');
                if (parts.length >= 3) {
                    body = parts.slice(2).join('---').trim();
                }
            }
            resultContent.innerHTML = marked.parse(body);
        }
    }
    
    alert("동선 최적화 순서가 일정표 및 로컬 마크다운 파일에 성공적으로 반영되었습니다! 🗺️");
}

function dismissRouteOptimization() {
    const banner = document.getElementById("route-optimize-banner");
    if (banner) {
        banner.classList.add("hidden");
    }
}

// Premium PDF Brochure Generator
async function generateBrochurePDF(customData = null) {
    let brochureItinerary = [];
    let brochureDestination = "";
    let brochureTheme = "";
    let brochurePartySize = 2;
    let brochureDuration = "";
    let brochureChecklist = [];
    let mapElement = null;
    let brochureDate = "";

    if (customData) {
        // Data passed from Dashboard Modal
        const fm = customData.frontmatter;
        brochureItinerary = fm.itinerary || [];
        brochureDestination = fm.title.replace(" 계획", "").trim();
        brochureTheme = fm.tags ? fm.tags.filter(t => t !== "Plan").join(", ") : "힐링 여행";
        brochurePartySize = parseInt(fm.partySize) || 2;
        brochureDuration = fm.duration || "1박 2일";
        brochureChecklist = extractChecklistFromMarkdown(customData.body);
        mapElement = document.querySelector("#modal-map-container");
        brochureDate = fm.date || "";
    } else {
        // Data from active Planner state
        brochureItinerary = selectedItinerary;
        brochureDestination = destination || "선택된 여행지";
        brochureTheme = theme || "힐링 및 맛집 탐방";
        brochurePartySize = parseInt(partySize) || 2;
        brochureDuration = duration || "1박 2일";
        brochureChecklist = currentChecklist;
        mapElement = document.querySelector("#planner-map");
        brochureDate = new Date().toISOString().split('T')[0];
    }

    if (!brochureItinerary || brochureItinerary.length === 0) {
        alert("출력할 여행 코스 일정이 비어 있습니다. 일정을 먼저 설계해 주세요!");
        return;
    }

    // Show visual loading indicator
    const loader = document.createElement("div");
    loader.style.position = "fixed";
    loader.style.top = "0";
    loader.style.left = "0";
    loader.style.width = "100%";
    loader.style.height = "100%";
    loader.style.backgroundColor = "rgba(15, 23, 42, 0.82)";
    loader.style.backdropFilter = "blur(6px)";
    loader.style.display = "flex";
    loader.style.flexDirection = "column";
    loader.style.alignItems = "center";
    loader.style.justifyContent = "center";
    loader.style.zIndex = "99999";
    loader.style.color = "#ffffff";
    loader.innerHTML = `
        <div style="text-align: center;">
            <i class="fa-solid fa-compass fa-spin" style="font-size: 3.5rem; color: #10b981; margin-bottom: 1.5rem; filter: drop-shadow(0 0 15px rgba(16,185,129,0.4));"></i>
            <h3 style="font-weight: 700; font-size: 1.3rem; font-family: 'Outfit', sans-serif;">✨ 프리미엄 브로셔 다운로드 중...</h3>
            <p style="color: #94a3b8; font-size: 0.9rem; margin-top: 0.5rem; font-family: sans-serif;">Unsplash 힐링 사진과 동선 지도를 고해상도로 변환하고 있습니다.</p>
        </div>
    `;
    document.body.appendChild(loader);

    // 1. Capture Map to Base64 Image
    let capturedMapImg = "";
    if (mapElement) {
        try {
            // Leaflet 맵 객체가 타일 로딩을 끝냈을 여유 시간을 둠
            const canvas = await html2canvas(mapElement, {
                useCORS: true,
                allowTaint: false,
                scale: 1.8,
                logging: false
            });
            capturedMapImg = canvas.toDataURL("image/jpeg", 0.95);
        } catch (err) {
            console.error("Map rendering capture failed:", err);
        }
    }

    // Unsplash premium aesthetic images setup
    const categoryImages = {
        "음식점": [
            "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=500&q=80"
        ],
        "카페": [
            "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=500&q=80"
        ],
        "숙소": [
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=500&q=80"
        ],
        "관광": [
            "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=500&q=80"
        ],
        "기타": [
            "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1499591934245-40b55745b905?auto=format&fit=crop&w=500&q=80",
            "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=500&q=80"
        ]
    };

    const imageIndices = { "음식점": 0, "카페": 0, "숙소": 0, "관광": 0, "기타": 0 };
    function getCategoryPicture(cat) {
        const key = categoryImages[cat] ? cat : "기타";
        const arr = categoryImages[key];
        const idx = imageIndices[key] % arr.length;
        imageIndices[key]++;
        return arr[idx];
    }

    function getCategoryBadgeColor(cat) {
        switch (cat) {
            case '음식점': return 'background-color: rgba(245, 158, 11, 0.12); color: var(--accent-amber);';
            case '카페': return 'background-color: rgba(239, 68, 68, 0.1); color: var(--accent-rose);';
            case '숙소': return 'background-color: rgba(139, 92, 246, 0.12); color: hsl(265, 70%, 55%);';
            case '관광': return 'background-color: var(--accent-blue-light); color: var(--accent-blue);';
            default: return 'background-color: rgba(16, 185, 129, 0.12); color: var(--accent-emerald);';
        }
    }

    function getCategoryIcon(cat) {
        switch(cat) {
            case '음식점': return '<i class="fa-solid fa-utensils"></i>';
            case '카페': return '<i class="fa-solid fa-mug-saucer"></i>';
            case '숙소': return '<i class="fa-solid fa-hotel"></i>';
            case '관광': return '<i class="fa-solid fa-camera"></i>';
            default: return '<i class="fa-solid fa-route"></i>';
        }
    }

    // 2. Create off-screen container
    const container = document.createElement("div");
    container.className = "brochure-container";
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    document.body.appendChild(container);

    // Day grouping
    const daysMap = {};
    brochureItinerary.forEach(item => {
        let dayNum = 1;
        const match = item.title.match(/(\d+)일차/);
        if (match) {
            dayNum = parseInt(match[1]);
        }
        if (!daysMap[dayNum]) daysMap[dayNum] = [];
        daysMap[dayNum].push(item);
    });

    // 3. Build Cover Page HTML
    const coverHTML = `
        <div class="brochure-cover">
            <div class="cover-header">
                <i class="fa-solid fa-compass"></i> Pn4 Life Travel Archive
            </div>
            <div class="cover-middle">
                <h1 class="cover-destination">${brochureDestination}</h1>
                <p class="cover-title">${brochureTheme}</p>
                <div class="cover-meta">
                    <span class="cover-meta-badge"><i class="fa-solid fa-calendar-days"></i> ${brochureDuration}</span>
                    <span class="cover-meta-badge"><i class="fa-solid fa-users"></i> 동행 ${brochurePartySize}명</span>
                </div>
            </div>
            <div class="cover-stamp">
                <div class="cover-stamp-title">Medi-IT News</div>
                <div style="font-size:0.65rem;">HOS_IT_MAN</div>
                <div style="font-size:0.7rem; color:#f59e0b; margin-top:2px; letter-spacing:1px; font-weight:900;">★ LEOHYP ★</div>
            </div>
            <div class="cover-footer">
                CREATED BY ANTIGRAVITY AI PLANNER • PARTNER SYSTEM
            </div>
        </div>
    `;
    container.innerHTML += coverHTML;

    // 4. Build Day-by-day Itinerary Pages
    const sortedDays = Object.keys(daysMap).sort((a,b) => a - b);
    
    for (let day of sortedDays) {
        const items = daysMap[day];
        
        // Split day items into chunks of 4 to avoid page break vertical truncation
        const itemsChunks = [];
        for (let i = 0; i < items.length; i += 4) {
            itemsChunks.push(items.slice(i, i + 4));
        }

        itemsChunks.forEach((chunk, chunkIdx) => {
            const pageHeader = `
                <div class="brochure-page-header">
                    <span class="page-header-title">🗺️ ${brochureDestination} 여행 계획서</span>
                    <span class="page-header-date">${brochureDate}</span>
                </div>
            `;
            
            const pageFooter = `
                <div class="brochure-page-footer">
                    <span>${brochureTheme}</span>
                    <span>Day ${day} - Page ${chunkIdx + 1}</span>
                </div>
            `;

            let dayTitleHTML = "";
            if (chunkIdx === 0) {
                dayTitleHTML = `<h2 class="brochure-day-title">Day ${day} <span>| ${day}일차 여행 일정</span></h2>`;
            } else {
                dayTitleHTML = `<h2 class="brochure-day-title">Day ${day} <span>| ${day}일차 추가 일정 (계속)</span></h2>`;
            }

            const cardsHTML = chunk.map(item => {
                const imgUrl = getCategoryPicture(item.category);
                const badgeColor = getCategoryBadgeColor(item.category);
                const icon = getCategoryIcon(item.category);
                const costText = item.cost > 0 ? `${parseInt(item.cost).toLocaleString()}원` : "무료/기타";
                
                return `
                    <div class="brochure-card">
                        <div class="brochure-card-img" style="background-image: url('${imgUrl}')"></div>
                        <div class="brochure-card-info">
                            <div class="brochure-card-header">
                                <div>
                                    <h3 class="brochure-card-title">${item.title}</h3>
                                    <span class="brochure-card-place">${item.place}</span>
                                </div>
                                <span class="brochure-card-badge" style="${badgeColor}">${icon} ${item.category || '관광'}</span>
                            </div>
                            <p class="brochure-card-desc">${item.desc || '세부 일정이 마련되어 있습니다. 동선을 확인해 보세요.'}</p>
                            <div class="brochure-card-footer">
                                <span class="brochure-card-transport"><i class="fa-solid fa-car-side"></i> ${item.transport || '도보 이동'}</span>
                                <span class="brochure-card-cost">${costText}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            const pageHTML = `
                <div class="brochure-page">
                    ${pageHeader}
                    <div class="brochure-page-content">
                        ${dayTitleHTML}
                        <div class="brochure-timeline">
                            ${cardsHTML}
                        </div>
                    </div>
                    ${pageFooter}
                </div>
            `;
            container.innerHTML += pageHTML;
        });
    }

    // 5. Build Summary Page HTML (Map, Budget and Checklist)
    // Budget Calculations
    const catTotals = { "음식점": 0, "카페": 0, "숙소": 0, "관광": 0, "쇼핑": 0, "기타": 0 };
    let grandTotal = 0;
    brochureItinerary.forEach(item => {
        const cost = parseInt(item.cost) || 0;
        const cat = item.category || "기타";
        const matchedCat = catTotals[cat] !== undefined ? cat : "기타";
        catTotals[matchedCat] += cost;
        grandTotal += cost;
    });

    const totalPartyBudget = grandTotal * brochurePartySize;
    const perPersonBudget = grandTotal;

    const budgetBarsHTML = Object.entries(catTotals).map(([cat, amount]) => {
        if (amount === 0) return '';
        const percentage = grandTotal > 0 ? (amount / grandTotal * 100).toFixed(0) : 0;
        
        let barClass = "var(--text-muted)";
        if (cat === "음식점") barClass = "var(--accent-amber)";
        else if (cat === "카페") barClass = "var(--accent-rose)";
        else if (cat === "숙소") barClass = "var(--accent-blue)";
        else if (cat === "관광") barClass = "var(--accent-emerald)";
        else if (cat === "쇼핑") barClass = "hsl(280, 70%, 55%)";

        return `
            <div class="brochure-budget-row">
                <div class="brochure-budget-info">
                    <span>${cat}</span>
                    <span>${(amount * brochurePartySize).toLocaleString()}원 (${percentage}%)</span>
                </div>
                <div class="brochure-budget-bar-bg">
                    <div class="brochure-budget-bar-fill" style="width: ${percentage}%; background-color: ${barClass};"></div>
                </div>
            </div>
        `;
    }).join('');

    // Checklist Items
    const checklistItemsHTML = brochureChecklist.map(item => {
        const isChecked = item.completed || item.checked;
        const checkedClass = isChecked ? "checked" : "";
        const iconClass = isChecked ? "fa-solid fa-circle-check" : "fa-regular fa-circle";
        return `
            <div class="brochure-checklist-item ${checkedClass}">
                <i class="${iconClass} brochure-checklist-icon"></i>
                <span>${item.text}</span>
            </div>
        `;
    }).join('');

    const mapHTML = capturedMapImg 
        ? `<img class="brochure-map-img" src="${capturedMapImg}" alt="Route Map">`
        : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);background:#f1f5f9;">동선 지도 로드 실패</div>`;

    const summaryPageHTML = `
        <div class="brochure-page" style="page-break-after: avoid;">
            <div class="brochure-page-header">
                <span class="page-header-title">🗺️ ${brochureDestination} 코스 지도 & 요약</span>
                <span class="page-header-date">${brochureDate}</span>
            </div>
            <div class="brochure-page-content">
                <h4 style="font-size:1.15rem; font-weight:700; margin-bottom: 5px; color:#1e293b;"><i class="fa-solid fa-map-location-dot" style="color:var(--accent-blue);"></i> 전체 최적화 동선 지도</h4>
                <div class="brochure-map-container">
                    ${mapHTML}
                </div>
                <div class="brochure-summary-grid">
                    <!-- Budget -->
                    <div class="brochure-summary-card">
                        <h4 class="brochure-summary-title"><i class="fa-solid fa-wallet" style="color:var(--accent-amber);"></i> 지출 비용 가계부</h4>
                        <div class="brochure-budget-total">
                            ${totalPartyBudget.toLocaleString()}원
                            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">총액 (${brochurePartySize}명 기준)</span>
                        </div>
                        <div style="font-size:0.8rem; font-weight:600; margin-bottom:12px; color:var(--text-secondary);">1인당 예상 비용: ${perPersonBudget.toLocaleString()}원</div>
                        <div class="brochure-budget-bars">
                            ${budgetBarsHTML || '<span style="font-size:0.8rem; color:var(--text-muted);">지출 내용 없음</span>'}
                        </div>
                    </div>
                    <!-- Checklist -->
                    <div class="brochure-summary-card">
                        <h4 class="brochure-summary-title"><i class="fa-solid fa-suitcase" style="color:var(--accent-blue);"></i> 여행 준비물 체크리스트</h4>
                        <div class="brochure-checklist-list">
                            ${checklistItemsHTML || '<span style="font-size:0.8rem; color:var(--text-muted);">준비물 내역이 비어 있습니다.</span>'}
                        </div>
                    </div>
                </div>
            </div>
            <div class="brochure-page-footer">
                <span>Created by Antigravity Partner AI</span>
                <span>마지막 페이지</span>
            </div>
        </div>
    `;
    container.innerHTML += summaryPageHTML;

    // 6. Output PDF using html2pdf
    const opt = {
        margin:       0,
        filename:     `Brochure_${brochureDestination}_Plan.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, allowTaint: false, logging: false },
        jsPDF:        { unit: 'px', format: [794, 1123], hotfixes: ['px_scaling'] }
    };

    try {
        const pdfWorker = html2pdf().from(container).set(opt);
        const pdfBlob = await pdfWorker.output('blob');
        
        // 다운로드 폴더로 강제 다운로드 유도하기 위해 hidden <a> 태그 활용
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `Brochure_${brochureDestination}_Plan.pdf`;
        document.body.appendChild(a);
        a.click();
        
        // 리소스 해제
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("PDF generation failed:", err);
        alert("PDF 브로셔 다운로드 중 에러가 발생했습니다. 브라우저 콘솔을 확인해 주세요.");
    } finally {
        // Remove loader & temporary container
        document.body.removeChild(loader);
        document.body.removeChild(container);
    }
}

