// --- 状態管理オブジェクト ---
const state = {
    currentView: 'calendar', // 'calendar' | 'day-detail' | 'input'
    currentDate: new Date(),  // カレンダー表示用の基準日
    selectedDate: null,       // 詳細表示中の 'YYYY-MM-DD' 文字列
    selectedColor: '#ff5e57', // フォームで選択中のカラー
    // ローカルストレージデータのキャッシュ構造: 
    // { "2026-07-06": { name: "出張", events: [{title: "会議", start: "09:00", end: "12:00", color: "#..."}] } }
    db: JSON.parse(localStorage.getItem('circle_calendar_db')) || {}
};

// --- DOM要素取得 ---
const views = {
    calendar: document.getElementById('view-calendar'),
    dayDetail: document.getElementById('view-day-detail'),
    input: document.getElementById('view-input')
};
const backBtn = document.getElementById('back-btn');
const headerTitle = document.getElementById('header-title');

// --- 画面遷移制御 (SPA) ---
function navigateTo(viewName) {
    state.currentView = viewName;
    
    // 全ビューを一度非表示にする
    Object.keys(views).forEach(key => views[key].classList.add('hidden'));
    // 対象ビューを表示
    views[viewName].classList.remove('hidden');

    // ヘッダー制御
    if (viewName === 'calendar') {
        backBtn.classList.add('hidden');
        headerTitle.textContent = '24hサークルカレンダー';
    } else if (viewName === 'day-detail') {
        backBtn.classList.remove('hidden');
        headerTitle.textContent = '1日のスケジュール';
        renderDayDetail();
    } else if (viewName === 'input') {
        backBtn.classList.remove('hidden');
        headerTitle.textContent = '予定の追加';
        resetForm();
    }
}

// 戻るボタンの挙動
backBtn.addEventListener('click', () => {
    if (state.currentView === 'input') {
        navigateTo('day-detail');
    } else if (state.currentView === 'day-detail') {
        navigateTo('calendar');
        renderCalendar(); // カレンダーのドット更新のため再描画
    }
});

// --- データ保存処理 ---
function saveToStorage() {
    localStorage.setItem('circle_calendar_db', JSON.stringify(state.db));
}

// --- 1. カレンダー生成ロジック ---
function renderCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    
    // ヘッダーの年月更新
    document.getElementById('current-month-year').textContent = `${year}年 ${month + 1}月`;
    
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    // 月の初日の曜日と総日数を計算
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // 空白マスの埋め込み
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('calendar-day', 'empty');
        grid.appendChild(emptyCell);
    }
    
    // 日付マスの生成
    const todayStr = formatLocalDate(new Date());
    for (let day = 1; day <= totalDays; day++) {
        const dayButton = document.createElement('button');
        dayButton.classList.add('calendar-day');
        
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (dateStr === todayStr) dayButton.classList.add('today');
        
        // 日付数字
        const numDiv = document.createElement('div');
        numDiv.textContent = day;
        dayButton.appendChild(numDiv);
        
        // 予定の有無を示すドットコンテナ
        const dotsDiv = document.createElement('div');
        dotsDiv.classList.add('day-dots');
        
        if (state.db[dateStr] && state.db[dateStr].events.length > 0) {
            // 最大3つまでドットを表示
            state.db[dateStr].events.slice(0, 3).forEach(ev => {
                const dot = document.createElement('span');
                dot.classList.add('dot');
                dot.style.backgroundColor = ev.color;
                dotsDiv.appendChild(dot);
            });
        }
        dayButton.appendChild(dotsDiv);
        
        // タップイベント
        dayButton.addEventListener('click', () => {
            state.selectedDate = dateStr;
            navigateTo('day-detail');
        });
        
        grid.appendChild(dayButton);
    }
}

// 翌月・前月ボタン
document.getElementById('prev-month').addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    renderCalendar();
});
document.getElementById('next-month').addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    renderCalendar();
});


// --- 2. 1日の詳細 & 円形SVG描画ロジック ---

// 時間文字列("HH:MM")を24時間円グラフの角度(度数)に変換する関数
// 00:00 = 真上(-90度 または 270度)を起点とする
function timeToAngle(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    // 1440分 = 360度 -> 1分 = 0.25度
    // 時計回りに配置するため、初期角は真上(-90度)
    return (totalMinutes * 0.25) - 90;
}

// 極座標をSVGのXY座標に変換するヘルパー関数
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians)
    };
}

// SVGの円弧パス(d属性)を生成する関数
function describeArc(x, y, radius, startAngle, endAngle) {
    // 360度ちょうどの場合は、終点をわずかに引いて描画エラーを回避
    if (endAngle - startAngle >= 360) {
        endAngle = startAngle + 359.99;
    }
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    
    // 180度を超えるかどうかのフラグ
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
        "M", start.x, start.y, 
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
}

// 円形スケジュール及び24時間目盛りの描画
function drawCircleSchedule(events) {
    const gridGroup = document.getElementById('circle-grid-group');
    const arcsGroup = document.getElementById('circle-arcs-group');
    gridGroup.innerHTML = '';
    arcsGroup.innerHTML = '';
    
    const cx = 100, cy = 100, r = 80;

    // 24時間の目盛り線とテキストを描画
    for (let h = 0; h < 24; h++) {
        const angle = (h * 15) - 90; // 360度 / 24時間 = 15度ずつ
        
        // 目盛り線 (外周部分のみに短く引く)
        const outerP = polarToCartesian(cx, cy, r, angle);
        const innerP = polarToCartesian(cx, cy, r - 4, angle);
        
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", innerP.x);
        line.setAttribute("y1", innerP.y);
        line.setAttribute("x2", outerP.x);
        line.setAttribute("y2", outerP.y);
        line.setAttribute("class", "circle-grid-line");
        gridGroup.appendChild(line);
        
        // 主要な時間(3時間ごと)に数字テキストを配置
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

    // 登録された予定の円弧を重ねて描画
    events.forEach(ev => {
        let startAngle = timeToAngle(ev.start);
        let endAngle = timeToAngle(ev.end);
        
        // 終了時刻が開始時刻より前の場合（日を跨ぐ予定）の補正
        if (endAngle <= startAngle) {
            endAngle += 360;
        }

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const arcPathData = describeArc(cx, cy, r - 20, startAngle, endAngle); // 半径r-20の位置に太めの線を描く
        
        path.setAttribute("d", arcPathData);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", ev.color);
        path.setAttribute("stroke-width", "16"); // 塗りつぶしの厚み
        path.setAttribute("opacity", "0.75");
        path.setAttribute("stroke-linecap", "butt"); // 端の形状を四角に
        
        arcsGroup.appendChild(path);
    });
}

// 1日の詳細画面全体のレンダリング
function renderDayDetail() {
    const [y, m, d] = state.selectedDate.split('-');
    const dateObj = new Date(y, m - 1, d);
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    
    // 日付ラベル更新
    document.getElementById('selected-date-label').textContent = `${Number(m)}月${Number(d)}日 (${weekdays[dateObj.getDay()]})`;

    // 保存された予定群とスケジュール名の取得
    const dayData = state.db[state.selectedDate] || { name: '', events: [] };
    
    // スケジュール名入力欄の設定
    document.getElementById('schedule-name-input').value = dayData.name || '';

    // 円形スケヴル描画
    drawCircleSchedule(dayData.events);

    // リスト表示
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';

    // 時刻順でソートして表示
    const sortedEvents = [...dayData.events].sort((a,b) => a.start.localeCompare(b.start));

    if (sortedEvents.length === 0) {
        taskList.innerHTML = '<li style="text-align:center; color:#8892b0; padding:16px;">予定がありません</li>';
    } else {
        sortedEvents.forEach((ev, idx) => {
            const li = document.createElement('li');
            li.classList.add('task-item');
            li.style.borderLeftColor = ev.color;
            
            li.innerHTML = `
                <div>
                    <div style="font-weight:bold;">${escapeHtml(ev.title)}</div>
                    <div class="task-item-time">${ev.start} 〜 ${ev.end}</div>
                </div>
                <button class="task-delete-btn" data-index="${idx}">削除</button>
            `;
            
            // 削除ボタンアクション
            li.querySelector('.task-delete-btn').addEventListener('click', (e) => {
                const originalIndex = dayData.events.indexOf(sortedEvents[idx]);
                dayData.events.splice(originalIndex, 1);
                state.db[state.selectedDate] = dayData;
                saveToStorage();
                renderDayDetail(); // 再描画
            });

            taskList.appendChild(li);
        });
    }
}

// スケジュール名の保存処理
document.getElementById('save-schedule-name-btn').addEventListener('click', () => {
    const nameValue = document.getElementById('schedule-name-input').value.trim();
    if (!state.db[state.selectedDate]) {
        state.db[state.selectedDate] = { name: '', events: [] };
    }
    state.db[state.selectedDate].name = nameValue;
    saveToStorage();
    alert('スケジュール名を保存しました');
});

// 各種追加ボタンから入力画面への遷移
document.getElementById('fab-add-btn').addEventListener('click', () => navigateTo('input'));
document.getElementById('circle-center-btn').addEventListener('click', () => navigateTo('input'));


// --- 3. スケジュール入力画面ロジック ---

// カラーパレットの選択インタラクション
const colorChips = document.querySelectorAll('.color-chip');
colorChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
        colorChips.forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        state.selectedColor = e.target.getAttribute('data-color');
    });
});

// 時刻変更時に「予定の長さ」を自動計算する処理
const startInput = document.getElementById('event-start');
const endInput = document.getElementById('event-end');
const durationText = document.getElementById('duration-text');

function updateDuration() {
    const [sH, sM] = startInput.value.split(':').map(Number);
    let [eH, eM] = endInput.value.split(':').map(Number);
    
    let startMin = sH * 60 + sM;
    let endMin = eH * 60 + eM;
    
    // 終了時刻が開始時刻より前の場合は、翌日とみなして24時間プラスする
    if (endMin <= startMin) {
        endMin += 24 * 60;
    }
    
    const diff = endMin - startMin;
    const diffH = Math.floor(diff / 60);
    const diffM = diff % 60;
    
    durationText.textContent = `${diffH}時間 ${diffM}分`;
}

startInput.addEventListener('input', updateDuration);
endInput.addEventListener('input', updateDuration);

// フォーム初期化
function resetForm() {
    document.getElementById('event-title').value = '';
    startInput.value = '09:00';
    endInput.value = '10:00';
    updateDuration();
}

// フォーム登録確定
document.getElementById('schedule-form').addEventListener('submit', () => {
    const title = document.getElementById('event-title').value.trim();
    const start = startInput.value;
    const end = endInput.value;
    
    if (!title) return;

    if (!state.db[state.selectedDate]) {
        state.db[state.selectedDate] = { name: '', events: [] };
    }

    // 新規予定を追加
    state.db[state.selectedDate].events.push({
        title: title,
        start: start,
        end: end,
        color: state.selectedColor
    });

    saveToStorage();
    navigateTo('day-detail'); // 登録後、一覧画面に戻る
});


// --- 共通ユーティリティ ---
function formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- アプリ起動時の初期化 ---
renderCalendar();
navigateTo('calendar');