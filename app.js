document.addEventListener('DOMContentLoaded', () => {

    // --- 状態管理オブジェクト ---
    const state = {
        currentView: 'calendar', 
        currentDate: new Date(),  
        selectedDate: null,       
        selectedColor: '#ff5e57', 
        editingEventIndex: null,   // 現在編集中のイベントのインデックス (null の場合は新規登録)
        db: {}                    
    };

    // ローカルストレージからのデータ復元
    try {
        const localData = localStorage.getItem('circle_calendar_db');
        if (localData) state.db = JSON.parse(localData);
    } catch (e) {
        console.error("データの読み込みに失敗しました:", e);
        state.db = {};
    }

    // 主要コンテナ要素
    const appMain = document.getElementById('app-main');
    const backBtn = document.getElementById('back-btn');
    const headerTitle = document.getElementById('header-title');

    // --- 画面表示制御 ---
    function showPage(viewName, presetTimes = null) {
        if (!appMain) return;
        
        state.currentView = viewName;
        appMain.setAttribute('data-view', viewName);

        if (viewName === 'calendar') {
            if (backBtn) backBtn.style.display = 'none';
            if (headerTitle) headerTitle.textContent = '24hサークルカレンダー';
        } else if (viewName === 'day-detail') {
            if (backBtn) backBtn.style.display = 'flex';
            if (headerTitle) headerTitle.textContent = '1日のスケジュール';
            renderDayDetail(); 
        } else if (viewName === 'input') {
            if (backBtn) backBtn.style.display = 'flex';
            if (headerTitle) headerTitle.textContent = state.editingEventIndex !== null ? '予定の編集' : '予定の追加';
            
            // 入力画面のタイトルとボタン文字を動的に切り替え
            const inputViewTitle = document.getElementById('input-view-title');
            const submitEventBtn = document.getElementById('submit-event-btn');
            if (inputViewTitle) {
                inputViewTitle.textContent = state.editingEventIndex !== null ? '予定の編集' : '予定の登録';
            }
            if (submitEventBtn) {
                submitEventBtn.textContent = state.editingEventIndex !== null ? '更新する' : '登録する';
            }

            if (presetTimes) {
                resetForm(presetTimes.start, presetTimes.end, presetTimes.title, presetTimes.color);
            } else {
                resetForm('09:00', '10:00', '', '#ff5e57');
            }
        }
    }

    // ヘッダー「戻る」ボタンの挙動
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (state.currentView === 'input') {
                showPage('day-detail');
            } else if (state.currentView === 'day-detail') {
                showPage('calendar');
                renderCalendar(); 
            }
        });
    }

    function saveToStorage() {
        try {
            localStorage.setItem('circle_calendar_db', JSON.stringify(state.db));
        } catch (e) {
            console.error("データの保存に失敗しました:", e);
        }
    }

    // --- 1. 月間カレンダー描画処理（一番長い予定のドットを1つ表示） ---
    function renderCalendar() {
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        
        const titleEl = document.getElementById('current-month-year');
        if (titleEl) titleEl.textContent = `${year}年 ${month + 1}月`;
        
        const grid = document.getElementById('calendar-grid');
        if (!grid) return;
        grid.innerHTML = '';
        
        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        
        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('calendar-day', 'empty');
            grid.appendChild(emptyCell);
        }
        
        const todayStr = formatLocalDate(new Date());
        for (let day = 1; day <= totalDays; day++) {
            const dayButton = document.createElement('button');
            dayButton.classList.add('calendar-day');
            dayButton.type = "button";
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (dateStr === todayStr) dayButton.classList.add('today');
            
            const numDiv = document.createElement('div');
            numDiv.textContent = day;
            dayButton.appendChild(numDiv);
            
            if (state.db[dateStr] && state.db[dateStr].events && state.db[dateStr].events.length > 0) {
                let maxDuration = -1;
                let longestEventColor = '#fff';

                state.db[dateStr].events.forEach(ev => {
                    const [sH, sM] = ev.start.split(':').map(Number);
                    let [eH, eM] = ev.end.split(':').map(Number);
                    
                    let startMin = sH * 60 + sM;
                    let endMin = eH * 60 + eM;
                    if (endMin <= startMin) endMin += 24 * 60; // 日跨ぎ対応
                    
                    const duration = endMin - startMin;
                    if (duration > maxDuration) {
                        maxDuration = duration;
                        longestEventColor = ev.color || '#fff';
                    }
                });

                const dotsDiv = document.createElement('div');
                dotsDiv.classList.add('day-dots');
                
                const dot = document.createElement('span');
                dot.classList.add('dot');
                dot.style.backgroundColor = longestEventColor;
                dotsDiv.appendChild(dot);
                
                dayButton.appendChild(dotsDiv);
            }
            
            dayButton.addEventListener('click', () => {
                state.selectedDate = dateStr;
                showPage('day-detail');
            });
            
            grid.appendChild(dayButton);
        }
    }

    const prevBtn = document.getElementById('prev-month');
    const nextBtn = document.getElementById('next-month');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            state.currentDate.setMonth(state.currentDate.getMonth() - 1);
            renderCalendar();
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            state.currentDate.setMonth(state.currentDate.getMonth() + 1);
            renderCalendar();
        });
    }


    // --- 2. 1日の詳細 & 円形SVG描画処理 ---

    function timeToAngle(timeStr) {
        if (!timeStr) return -90;
        const [hours, minutes] = timeStr.split(':').map(Number);
        const totalMinutes = (hours || 0) * 60 + (minutes || 0);
        return (totalMinutes * 0.25) - 90; // 1分 = 0.25度, 0時が真上(-90度)
    }

    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians)
        };
    }

    // 中心点 (x, y) から外周半径 (radius) までを隙間なく埋める扇形（パイ型ピース）パスの生成
    function describePieSlice(x, y, radius, startAngle, endAngle) {
        if (endAngle - startAngle >= 360) {
            endAngle = startAngle + 359.99;
        }
        const startOuter = polarToCartesian(x, y, radius, endAngle);
        const endOuter = polarToCartesian(x, y, radius, startAngle);
        
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        
        return [
            "M", x, y,
            "L", endOuter.x, endOuter.y,
            "A", radius, radius, 0, largeArcFlag, 1, startOuter.x, startOuter.y,
            "Z"
        ].join(" ");
    }

    function drawCircleSchedule(events = []) {
        const gridGroup = document.getElementById('circle-grid-group');
        const arcsGroup = document.getElementById('circle-arcs-group');
        const tapZonesGroup = document.getElementById('circle-tap-zones-group');
        
        if (!gridGroup || !arcsGroup || !tapZonesGroup) return;

        gridGroup.innerHTML = '';
        arcsGroup.innerHTML = '';
        tapZonesGroup.innerHTML = '';
        
        const cx = 120, cy = 120, r = 80;

        // 1. 【透明な判定エリア】1時間ごとのパーツを24枚敷き詰める
        for (let h = 0; h < 24; h++) {
            const startAngle = (h * 15) - 90;
            const endAngle = ((h + 1) * 15) - 90;
            
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const pathData = describePieSlice(cx, cy, r, startAngle, endAngle);
            
            path.setAttribute("d", pathData);
            path.setAttribute("class", "tap-zone");
            
            path.addEventListener('click', () => {
                const startStr = `${String(h).padStart(2, '0')}:00`;
                const endStr = `${String((h + 1) % 24).padStart(2, '0')}:00`;
                state.editingEventIndex = null; // 新規追加として設定
                showPage('input', { start: startStr, end: endStr, title: '', color: '#ff5e57' });
            });
            
            tapZonesGroup.appendChild(path);
        }

        // 2. 【予定の可視化 & 予定名のテキスト表示】
        events.forEach((ev, index) => {
            let startAngle = timeToAngle(ev.start);
            let endAngle = timeToAngle(ev.end);
            if (endAngle <= startAngle) endAngle += 360; 

            // 扇形の描画
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const arcPathData = describePieSlice(cx, cy, r, startAngle, endAngle);
            path.setAttribute("d", arcPathData);
            path.setAttribute("fill", ev.color || '#54a0ff');
            path.setAttribute("opacity", "1.0");
            path.setAttribute("class", "circle-event-arc");
            
            // 予定セグメントタップで編集画面へ遷移
            path.addEventListener('click', (e) => {
                e.stopPropagation(); // 下層のtap-zoneのイベント発火を防ぐ
                state.editingEventIndex = index;
                showPage('input', { start: ev.start, end: ev.end, title: ev.title, color: ev.color });
            });
            arcsGroup.appendChild(path);

            // 予定名を常に水平（0度）で中央に配置
            const midAngle = (startAngle + endAngle) / 2;
            const textRadius = 50; 
            const textPos = polarToCartesian(cx, cy, textRadius, midAngle);

            const textNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textNode.setAttribute("x", textPos.x);
            textNode.setAttribute("y", textPos.y);
            textNode.setAttribute("class", "circle-event-text");
            textNode.textContent = ev.title || '無題';

            // テキストタップでも編集画面へ遷移
            textNode.addEventListener('click', (e) => {
                e.stopPropagation();
                state.editingEventIndex = index;
                showPage('input', { start: ev.start, end: ev.end, title: ev.title, color: ev.color });
            });

            arcsGroup.appendChild(textNode);
        });

        // 3. 【時間の目盛り】外周から内側へ向かう24本の短い放射線を追加
        const ticksGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        ticksGroup.setAttribute("class", "circle-ticks-group");
        ticksGroup.style.pointerEvents = "none"; // タップ判定への干渉を防止

        for (let h = 0; h < 24; h++) {
            const angle = (h * 15) - 90;
            // 外周(r=80)と、そこから5px内側(r=75)の座標を算出
            const pOuter = polarToCartesian(cx, cy, r, angle);
            const pInner = polarToCartesian(cx, cy, r - 5, angle);

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", pOuter.x);
            line.setAttribute("y1", pOuter.y);
            line.setAttribute("x2", pInner.x);
            line.setAttribute("y2", pInner.y);
            line.setAttribute("class", "circle-tick-line");

            ticksGroup.appendChild(line);
        }
        gridGroup.appendChild(ticksGroup);

        // 4. 【外周テキスト】数字を円の外側に配置
        for (let h = 0; h < 24; h++) {
            const angle = (h * 15) - 90;
            const textP = polarToCartesian(cx, cy, r + 16, angle);
            
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", textP.x);
            text.setAttribute("y", textP.y);
            text.setAttribute("class", "circle-grid-text");
            text.textContent = h;
            gridGroup.appendChild(text);
        }
    }

    function renderDayDetail() {
        if (!state.selectedDate) return;

        const [y, m, d] = state.selectedDate.split('-');
        const dateObj = new Date(y, m - 1, d);
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        
        const labelEl = document.getElementById('selected-date-label');
        if (labelEl) labelEl.textContent = `${Number(m)}月${Number(d)}日 (${weekdays[dateObj.getDay()]})`;

        const dayData = state.db[state.selectedDate] || { name: '', events: [] };
        if (!dayData.events) dayData.events = [];
        
        const nameInput = document.getElementById('schedule-name-input');
        if (nameInput) nameInput.value = dayData.name || '';

        drawCircleSchedule(dayData.events);

        const taskList = document.getElementById('task-list');
        if (!taskList) return;
        taskList.innerHTML = '';

        // 描画用にインデックスを紐付け保持した上でソート
        const indexedEvents = dayData.events.map((ev, idx) => ({ ...ev, originalIndex: idx }));
        indexedEvents.sort((a, b) => (a.start || '').localeCompare(b.start || ''));

        if (indexedEvents.length === 0) {
            taskList.innerHTML = '<li style="text-align:center; color:#8892b0; padding:16px;">予定がありません</li>';
        } else {
            indexedEvents.forEach((ev) => {
                const li = document.createElement('li');
                li.classList.add('task-item');
                li.style.borderLeftColor = ev.color || '#fff';
                
                li.innerHTML = `
                    <div class="task-item-content">
                        <div style="font-weight:bold;">${escapeHtml(ev.title || '無題')}</div>
                        <div class="task-item-time">${ev.start} 〜 ${ev.end}</div>
                    </div>
                    <button class="task-delete-btn" type="button">削除</button>
                `;
                
                // リストアイテムのコンテンツ部分をタップした時に編集画面を開く
                li.querySelector('.task-item-content').addEventListener('click', () => {
                    state.editingEventIndex = ev.originalIndex;
                    showPage('input', { start: ev.start, end: ev.end, title: ev.title, color: ev.color });
                });
                
                // 削除ボタン
                li.querySelector('.task-delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // 親要素のタップイベント(編集)が発火するのを防ぐ
                    dayData.events.splice(ev.originalIndex, 1);
                    state.db[state.selectedDate] = dayData;
                    saveToStorage();
                    renderDayDetail(); 
                });

                taskList.appendChild(li);
            });
        }
    }

    // スケジュール名保存
    const saveNameBtn = document.getElementById('save-schedule-name-btn');
    if (saveNameBtn) {
        saveNameBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('schedule-name-input');
            const nameValue = nameInput ? nameInput.value.trim() : '';
            if (!state.db[state.selectedDate]) {
                state.db[state.selectedDate] = { name: '', events: [] };
            }
            state.db[state.selectedDate].name = nameValue;
            saveToStorage();
            alert('スケジュール名を保存しました');
        });
    }

    // フローティングボタンイベント
    const fabAddBtn = document.getElementById('fab-add-btn');
    if (fabAddBtn) {
        fabAddBtn.addEventListener('click', () => {
            state.editingEventIndex = null; // 新規追加
            showPage('input');
        });
    }


    // --- 3. スケジュール入力画面ロジック ---

    const colorChips = document.querySelectorAll('.color-chip');
    colorChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            colorChips.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            state.selectedColor = e.target.getAttribute('data-color') || '#ff5e57';
        });
    });

    const startInput = document.getElementById('event-start');
    const endInput = document.getElementById('event-end');
    const durationText = document.getElementById('duration-text');

    function updateDuration() {
        if (!startInput || !endInput || !durationText) return;
        const [sH, sM] = startInput.value.split(':').map(Number);
        let [eH, eM] = endInput.value.split(':').map(Number);
        
        let startMin = sH * 60 + sM;
        let endMin = eH * 60 + eM;
        
        if (endMin <= startMin) endMin += 24 * 60; 
        
        const diff = endMin - startMin;
        const diffH = Math.floor(diff / 60);
        const diffM = diff % 60;
        
        durationText.textContent = `${diffH}時間 ${diffM}分`;
    }

    if (startInput) startInput.addEventListener('input', updateDuration);
    if (endInput) endInput.addEventListener('input', updateDuration);

    function resetForm(startTime = '09:00', endTime = '10:00', title = '', color = '#ff5e57') {
        const titleInput = document.getElementById('event-title');
        if (titleInput) titleInput.value = title;
        if (startInput) startInput.value = startTime;
        if (endInput) endInput.value = endTime;
        
        state.selectedColor = color;
        colorChips.forEach(chip => {
            if (chip.getAttribute('data-color') === color) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });

        updateDuration();
    }

    const scheduleForm = document.getElementById('schedule-form');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            
            const titleInput = document.getElementById('event-title');
            const title = titleInput ? titleInput.value.trim() : '';
            const start = startInput ? startInput.value : '09:00';
            const end = endInput ? endInput.value : '10:00';
            
            if (!title) return;

            if (!state.db[state.selectedDate]) {
                state.db[state.selectedDate] = { name: '', events: [] };
            }
            if (!state.db[state.selectedDate].events) {
                state.db[state.selectedDate].events = [];
            }

            const eventData = {
                title: title,
                start: start,
                end: end,
                color: state.selectedColor
            };

            if (state.editingEventIndex !== null) {
                // 編集モード：既存のデータを上書き
                state.db[state.selectedDate].events[state.editingEventIndex] = eventData;
            } else {
                // 新規登録モード：データを末尾に追加
                state.db[state.selectedDate].events.push(eventData);
            }

            saveToStorage();
            showPage('day-detail'); 
        });
    }

    // --- 共通ヘルパー ---
    function formatLocalDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // HTMLエスケープ処理
    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // 初回初期化
    renderCalendar();  
    showPage('calendar'); 
});