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

    const startInput = document.getElementById('event-start');
    const endInput = document.getElementById('event-end');
    const durationText = document.getElementById('duration-text');
    const startMinPicker = document.getElementById('start-min-picker');
    const endMinPicker = document.getElementById('end-min-picker');

    // モーダル関連要素
    const routineModal = document.getElementById('routine-modal');
    const openFolderBtn = document.getElementById('open-folder-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const routineList = document.getElementById('routine-list');

    // --- クイック分選択タブ (5分刻み) の動的生成 ---
    function initMinutePickers() {
        if (!startMinPicker || !endMinPicker) return;
        
        startMinPicker.innerHTML = '';
        endMinPicker.innerHTML = '';

        for (let m = 0; m < 60; m += 5) {
            const minStr = String(m).padStart(2, '0');
            
            // 開始時刻用タブ
            const startTab = document.createElement('div');
            startTab.className = 'minute-tab';
            startTab.textContent = minStr;
            startTab.setAttribute('data-min', minStr);
            startTab.addEventListener('click', () => selectMinute('start', minStr));
            startMinPicker.appendChild(startTab);

            // 終了時刻用タブ
            const endTab = document.createElement('div');
            endTab.className = 'minute-tab';
            endTab.textContent = minStr;
            endTab.setAttribute('data-min', minStr);
            endTab.addEventListener('click', () => selectMinute('end', minStr));
            endMinPicker.appendChild(endTab);
        }
    }

    // タブクリック時の処理
    function selectMinute(type, minStr) {
        const input = type === 'start' ? startInput : endInput;
        if (!input) return;

        let currentVal = input.value.replace(':', '').trim();
        let hourStr = '09'; // デフォルト

        if (currentVal.length >= 1) {
            const parsed = parseTimeInput(input.value);
            if (parsed) {
                hourStr = parsed.split(':')[0];
            }
        }
        
        input.value = `${hourStr}:${minStr}`;
        updateDuration();
        syncMinuteTabs();
    }

    // 入力欄の値と、5分刻みタブのアクティブ状態を同期する
    function syncMinuteTabs() {
        if (startInput) {
            const parsed = parseTimeInput(startInput.value);
            const currentMin = parsed ? parsed.split(':')[1] : '';
            const tabs = startMinPicker.querySelectorAll('.minute-tab');
            tabs.forEach(t => {
                if (t.getAttribute('data-min') === currentMin) t.classList.add('active');
                else t.classList.remove('active');
            });
        }
        if (endInput) {
            const parsed = parseTimeInput(endInput.value);
            const currentMin = parsed ? parsed.split(':')[1] : '';
            const tabs = endMinPicker.querySelectorAll('.minute-tab');
            tabs.forEach(t => {
                if (t.getAttribute('data-min') === currentMin) t.classList.add('active');
                else t.classList.remove('active');
            });
        }
    }

    // キーボード直接入力（半角数字）を「HH:MM」に解析・補完するヘルパー
    function parseTimeInput(val) {
        let clean = val.replace(/[^0-9]/g, '');
        if (!clean) return null;

        let hour = 0;
        let minute = 0;

        if (clean.length <= 2) {
            hour = parseInt(clean, 10);
            minute = 0;
        } else if (clean.length === 3) {
            hour = parseInt(clean.substring(0, 1), 10);
            minute = parseInt(clean.substring(1, 3), 10);
        } else if (clean.length >= 4) {
            hour = parseInt(clean.substring(0, 2), 10);
            minute = parseInt(clean.substring(2, 4), 10);
        }

        if (hour > 23) hour = 23;
        if (minute > 59) minute = 59;

        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    // 入力欄のリアルタイム／フォーカスアウト時フォーマット適用
    function setupTimeInputFormatting(input) {
        if (!input) return;

        input.addEventListener('input', () => {
            let val = input.value.replace(/[^0-9:]/g, '');
            input.value = val;
            updateDuration();
        });

        input.addEventListener('blur', () => {
            if (!input.value.trim()) return;
            const formatted = parseTimeInput(input.value);
            if (formatted) {
                input.value = formatted;
            }
            updateDuration();
            syncMinuteTabs();
        });
    }

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
            syncMinuteTabs();
        }
    }

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

    // --- 1. 月間カレンダー描画処理 ---
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
                    const parsedStart = parseTimeInput(ev.start);
                    const parsedEnd = parseTimeInput(ev.end);
                    if (!parsedStart || !parsedEnd) return;

                    const [sH, sM] = parsedStart.split(':').map(Number);
                    let [eH, eM] = parsedEnd.split(':').map(Number);
                    
                    let startMin = sH * 60 + sM;
                    let endMin = eH * 60 + eM;
                    if (endMin <= startMin) endMin += 24 * 60; 
                    
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
        const parsed = parseTimeInput(timeStr);
        if (!parsed) return -90;
        const [hours, minutes] = parsed.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        return (totalMinutes * 0.25) - 90; 
    }

    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians)
        };
    }

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

        // 1. 【判定エリア】1時間ごとのパーツ
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
                state.editingEventIndex = null; 
                showPage('input', { start: startStr, end: endStr, title: '', color: '#ff5e57' });
            });
            
            tapZonesGroup.appendChild(path);
        }

        // 2. 【予定の可視化 & テキスト】
        events.forEach((ev, index) => {
            let startAngle = timeToAngle(ev.start);
            let endAngle = timeToAngle(ev.end);
            if (endAngle <= startAngle) endAngle += 360; 

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const arcPathData = describePieSlice(cx, cy, r, startAngle, endAngle);
            path.setAttribute("d", arcPathData);
            path.setAttribute("fill", ev.color || '#54a0ff');
            path.setAttribute("class", "circle-event-arc");
            
            path.addEventListener('click', (e) => {
                e.stopPropagation(); 
                state.editingEventIndex = index;
                showPage('input', { start: ev.start, end: ev.end, title: ev.title, color: ev.color });
            });
            arcsGroup.appendChild(path);

            const midAngle = (startAngle + endAngle) / 2;
            const textRadius = 50; 
            const textPos = polarToCartesian(cx, cy, textRadius, midAngle);

            const textNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textNode.setAttribute("x", textPos.x);
            textNode.setAttribute("y", textPos.y);
            textNode.setAttribute("class", "circle-event-text");
            textNode.textContent = ev.title || '無題';

            textNode.addEventListener('click', (e) => {
                e.stopPropagation();
                state.editingEventIndex = index;
                showPage('input', { start: ev.start, end: ev.end, title: ev.title, color: ev.color });
            });
            arcsGroup.appendChild(textNode);
        });

        // 3. 【時間の目盛り】
        const ticksGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        ticksGroup.setAttribute("class", "circle-ticks-group");
        ticksGroup.style.pointerEvents = "none";

        for (let h = 0; h < 24; h++) {
            const angle = (h * 15) - 90;
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

        // 4. 【外周テキスト】
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
                
                li.querySelector('.task-item-content').addEventListener('click', () => {
                    state.editingEventIndex = ev.originalIndex;
                    showPage('input', { start: ev.start, end: ev.end, title: ev.title, color: ev.color });
                });
                
                li.querySelector('.task-delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    dayData.events.splice(ev.originalIndex, 1);
                    state.db[state.selectedDate] = dayData;
                    saveToStorage();
                    renderDayDetail(); 
                });

                taskList.appendChild(li);
            });
        }
    }

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

    const fabAddBtn = document.getElementById('fab-add-btn');
    if (fabAddBtn) {
        fabAddBtn.addEventListener('click', () => {
            state.editingEventIndex = null; 
            showPage('input');
        });
    }


    // --- スケジュール呼び出し・管理（モーダル）ロジック ---
    if (openFolderBtn) {
        openFolderBtn.addEventListener('click', () => {
            renderRoutineList();
            if (routineModal) routineModal.classList.add('open');
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (routineModal) routineModal.classList.remove('open');
        });
    }

    if (routineModal) {
        routineModal.addEventListener('click', (e) => {
            if (e.target === routineModal) {
                routineModal.classList.remove('open');
            }
        });
    }

    // 保存されたルーティン（nameが入力されている日付）の一覧描画
    function renderRoutineList() {
        if (!routineList) return;
        routineList.innerHTML = '';

        const keys = Object.keys(state.db).filter(key => state.db[key] && state.db[key].name && state.db[key].name.trim() !== '');

        if (keys.length === 0) {
            routineList.innerHTML = '<li class="no-routine-msg">保存された名前付きスケジュールがありません。<br>他のお日にちで名前をつけて保存してください。</li>';
            return;
        }

        keys.forEach(key => {
            const item = state.db[key];
            const eventCount = item.events ? item.events.length : 0;
            
            const li = document.createElement('li');
            li.className = 'routine-item';
            li.innerHTML = `
                <div class="routine-item-info">
                    <div class="routine-item-name">${escapeHtml(item.name)}</div>
                    <div class="routine-item-meta">記録日: ${key} (${eventCount}個の予定)</div>
                </div>
                <div class="routine-action-btns">
                    <button type="button" class="routine-apply-btn">適用</button>
                    <button type="button" class="routine-delete-btn">削除</button>
                </div>
            `;

            // 適用ボタンのイベント処理
            li.querySelector('.routine-apply-btn').addEventListener('click', () => {
                if (confirm(`「${item.name}」のスケジュールを本日のタイムラインに上書きコピーしますか？`)) {
                    applyRoutine(key);
                }
            });

            // 削除ボタンのイベント処理（現編集日に影響を与えず、対象データのみをクリア）
            li.querySelector('.routine-delete-btn').addEventListener('click', () => {
                if (confirm(`保存されたデータ「${item.name} (${key})」を一覧から完全に削除しますか？\n※現在の予定が消えることはありません。`)) {
                    deleteRoutine(key);
                }
            });

            routineList.appendChild(li);
        });
    }

    // ルーティンデータを現在の日付へ上書きコピーする
    function applyRoutine(sourceDateKey) {
        if (!state.selectedDate || !state.db[sourceDateKey]) return;

        const sourceData = state.db[sourceDateKey];
        
        if (!state.db[state.selectedDate]) {
            state.db[state.selectedDate] = { name: '', events: [] };
        }

        // 予定の配列をディープコピー
        state.db[state.selectedDate].events = JSON.parse(JSON.stringify(sourceData.events || []));

        saveToStorage();
        if (routineModal) routineModal.classList.remove('open');
        
        renderDayDetail();
    }

    // ルーティンデータの完全削除（nameとeventsのクリア）
    function deleteRoutine(targetDateKey) {
        if (!state.db[targetDateKey]) return;

        // 該当キーのデータを初期化（またはオブジェクトから消去）
        delete state.db[targetDateKey];

        saveToStorage();
        
        // モーダル内のリスト表示を即座に再描画
        renderRoutineList();
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

    function updateDuration() {
        if (!startInput || !endInput || !durationText) return;

        const parsedStart = parseTimeInput(startInput.value);
        const parsedEnd = parseTimeInput(endInput.value);
        if (!parsedStart || !parsedEnd) return;

        const [sH, sM] = parsedStart.split(':').map(Number);
        let [eH, eM] = parsedEnd.split(':').map(Number);
        
        let startMin = sH * 60 + sM;
        let endMin = eH * 60 + eM;
        
        if (endMin <= startMin) endMin += 24 * 60; 
        
        const diff = endMin - startMin;
        const diffH = Math.floor(diff / 60);
        const diffM = diff % 60;
        
        durationText.textContent = `${diffH}時間 ${diffM}分`;
    }

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
            
            const start = parseTimeInput(startInput ? startInput.value : '09:00') || '09:00';
            const end = parseTimeInput(endInput ? endInput.value : '10:00') || '10:00';
            
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
                state.db[state.selectedDate].events[state.editingEventIndex] = eventData;
            } else {
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

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // 初期化関数
    initMinutePickers();
    setupTimeInputFormatting(startInput);
    setupTimeInputFormatting(endInput);
    
    renderCalendar();  
    showPage('calendar'); 
});