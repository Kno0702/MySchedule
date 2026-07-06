// HTMLがすべて読み込まれた後に、安全に各種DOM操作やカレンダー初期描画を行う
document.addEventListener('DOMContentLoaded', () => {

    // --- 状態管理オブジェクト ---
    const state = {
        currentView: 'calendar', // 'calendar' | 'day-detail' | 'input'
        currentDate: new Date(),  // カレンダー表示切り替え用の月基準
        selectedDate: null,       // 'YYYY-MM-DD' 形式の選択された日付キー
        selectedColor: '#ff5e57', // 選択されているフォームカラー
        db: {}                    // スケジュールデータ
    };

    // ローカルストレージデータの安全な復元
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

    // --- 画面表示制御（一元管理の最重要関数） ---
    function showPage(viewName) {
        if (!appMain) return;
        
        state.currentView = viewName;
        
        // メインコンテナの data-view 属性を直接書き換えることで、CSS側で表示画面を一発で切り替えます
        appMain.setAttribute('data-view', viewName);

        // 各画面に応じたヘッダー周りの細かなUI調整
        if (viewName === 'calendar') {
            if (backBtn) backBtn.style.display = 'none';
            if (headerTitle) headerTitle.textContent = '24hサークルカレンダー';
        } else if (viewName === 'day-detail') {
            if (backBtn) backBtn.style.display = 'flex';
            if (headerTitle) headerTitle.textContent = '1日のスケジュール';
            renderDayDetail(); // スケジュール画面のデータ描画を走らせる
        } else if (viewName === 'input') {
            if (backBtn) backBtn.style.display = 'flex';
            if (headerTitle) headerTitle.textContent = '予定の追加';
            resetForm(); // フォームを綺麗な状態にする
        }
    }

    // ヘッダー「戻る」ボタンのタップイベント
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (state.currentView === 'input') {
                showPage('day-detail');
            } else if (state.currentView === 'day-detail') {
                showPage('calendar');
                renderCalendar(); // ドット状態を反映するためにカレンダーを再描画
            }
        });
    }

    // データの保存
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
        
        // 1日の曜日までの空白セルの生成
        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('calendar-day', 'empty');
            grid.appendChild(emptyCell);
        }
        
        // 日付セルの生成
        const todayStr = formatLocalDate(new Date());
        for (let day = 1; day <= totalDays; day++) {
            const dayButton = document.createElement('button');
            dayButton.classList.add('calendar-day');
            dayButton.type = "button";
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (dateStr === todayStr) dayButton.classList.add('today');
            
            // 日付の数字
            const numDiv = document.createElement('div');
            numDiv.textContent = day;
            dayButton.appendChild(numDiv);
            
            // スケジュールドットの配置
            const dotsDiv = document.createElement('div');
            dotsDiv.classList.add('day-dots');
            
            if (state.db[dateStr] && state.db[dateStr].events && state.db[dateStr].events.length > 0) {
                state.db[dateStr].events.slice(0, 3).forEach(ev => {
                    const dot = document.createElement('span');
                    dot.classList.add('dot');
                    dot.style.backgroundColor = ev.color || '#fff';
                    dotsDiv.appendChild(dot);
                });
            }
            dayButton.appendChild(dotsDiv);
            
            // 【最重要】日付タップイベント：詳細表示へ
            dayButton.addEventListener('click', () => {
                state.selectedDate = dateStr;
                showPage('day-detail');
            });
            
            grid.appendChild(dayButton);
        }
    }

    // カレンダーの月切り替えイベント
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
        return (totalMinutes * 0.25) - 90;
    }

    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
        return {
            x: centerX + radius * Math.cos(angleInRadians),
            y: centerY + radius * Math.sin(angleInRadians)
        };
    }

    function describeArc(x, y, radius, startAngle, endAngle) {
        if (endAngle - startAngle >= 360) {
            endAngle = startAngle + 359.99;
        }
        const start = polarToCartesian(x, y, radius, endAngle);
        const end = polarToCartesian(x, y, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        
        return [
            "M", start.x, start.y, 
            "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(" ");
    }

    function drawCircleSchedule(events = []) {
        const gridGroup = document.getElementById('circle-grid-group');
        const arcsGroup = document.getElementById('circle-arcs-group');
        if (!gridGroup || !arcsGroup) return;

        gridGroup.innerHTML = '';
        arcsGroup.innerHTML = '';
        
        const cx = 100, cy = 100, r = 80;

        // 24時間目盛り線の動的描画
        for (let h = 0; h < 24; h++) {
            const angle = (h * 15) - 90;
            const outerP = polarToCartesian(cx, cy, r, angle);
            const innerP = polarToCartesian(cx, cy, r - 4, angle);
            
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", innerP.x);
            line.setAttribute("y1", innerP.y);
            line.setAttribute("x2", outerP.x);
            line.setAttribute("y2", outerP.y);
            line.setAttribute("class", "circle-grid-line");
            gridGroup.appendChild(line);
            
            if (h % 3 === 0) {
                const textP = polarToCartesian(cx, cy, r - 10, angle);
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", textP.x);
                text.setAttribute("y", textP.y);
                text.setAttribute("class", "circle-grid-text");
                text.textContent = `${h}h`;
                gridGroup.appendChild(text);
            }
        }

        // スケジュールに合わせた円弧(Arc)の配置
        events.forEach(ev => {
            let startAngle = timeToAngle(ev.start);
            let endAngle = timeToAngle(ev.end);
            
            if (endAngle <= startAngle) endAngle += 360; 

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const arcPathData = describeArc(cx, cy, r - 20, startAngle, endAngle);
            
            path.setAttribute("d", arcPathData);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", ev.color || '#54a0ff');
            path.setAttribute("stroke-width", "16");
            path.setAttribute("opacity", "0.75");
            path.setAttribute("stroke-linecap", "butt");
            
            arcsGroup.appendChild(path);
        });
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

        // 円形スケジュール描画
        drawCircleSchedule(dayData.events);

        // テキストリストの生成
        const taskList = document.getElementById('task-list');
        if (!taskList) return;
        taskList.innerHTML = '';

        const sortedEvents = [...dayData.events].sort((a, b) => (a.start || '').localeCompare(b.start || ''));

        if (sortedEvents.length === 0) {
            taskList.innerHTML = '<li style="text-align:center; color:#8892b0; padding:16px;">予定がありません</li>';
        } else {
            sortedEvents.forEach((ev, idx) => {
                const li = document.createElement('li');
                li.classList.add('task-item');
                li.style.borderLeftColor = ev.color || '#fff';
                
                li.innerHTML = `
                    <div>
                        <div style="font-weight:bold;">${escapeHtml(ev.title || '無題')}</div>
                        <div class="task-item-time">${ev.start} 〜 ${ev.end}</div>
                    </div>
                    <button class="task-delete-btn" type="button">削除</button>
                `;
                
                // 削除処理
                li.querySelector('.task-delete-btn').addEventListener('click', () => {
                    const originalIndex = dayData.events.indexOf(sortedEvents[idx]);
                    if (originalIndex > -1) {
                        dayData.events.splice(originalIndex, 1);
                        state.db[state.selectedDate] = dayData;
                        saveToStorage();
                        renderDayDetail(); 
                    }
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

    // 入力フォーム移行ボタンのアクション紐付け
    const fabAddBtn = document.getElementById('fab-add-btn');
    const circleCenterBtn = document.getElementById('circle-center-btn');
    if (fabAddBtn) fabAddBtn.addEventListener('click', () => showPage('input'));
    if (circleCenterBtn) circleCenterBtn.addEventListener('click', () => showPage('input'));


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

    function resetForm() {
        const titleInput = document.getElementById('event-title');
        if (titleInput) titleInput.value = '';
        if (startInput) startInput.value = '09:00';
        if (endInput) endInput.value = '10:00';
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

            state.db[state.selectedDate].events.push({
                title: title,
                start: start,
                end: end,
                color: state.selectedColor
            });

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

    // --- 初期動作の実行 ---
    renderCalendar();  // カレンダーマスの生成
    showPage('calendar'); // 確実にカレンダーを最初期表示に設定
});