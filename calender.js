// 現在表示している年月（初期値は今日）
let currentDate = new Date();

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0 = 1月, 5 = 6月...

    // ヘッダーの文字を更新 (例: 2026年 6月)
    document.getElementById('current-month-year').innerText = `${year}年 ${month + 1}月`;

    const daysContainer = document.getElementById('calendar-days');
    daysContainer.innerHTML = ''; // 前の表示をクリア

    // 今月の最初の日と最後の日を取得
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // 今月の初日の曜日 (0:日〜6:土) ➔ 先月分の空白（埋め枠）の数になる
    const startBlankDays = firstDayOfMonth.getDay();
    
    // 先月の最後の日を取得（埋め枠用）
    const lastDayOfPrevMonth = new Date(year, month, 0).getDate();

    // 1. 先月分の日付を薄く表示して埋める
    for (let i = startBlankDays - 1; i >= 0; i--) {
        const prevDay = lastDayOfPrevMonth - i;
        daysContainer.innerHTML += `<div class="day-cell other-month"><span class="date-number">${prevDay}</span></div>`;
    }

    // 今日の日付を判定するための「本物の今日」のデータ
    const today = new Date();

    // 2. 今月分の日付を生成
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        // パディング処理 (4➔"04"など) をして、URL用の YYYY-MM-DD 形式を作る
        const formattedMonth = String(month + 1).padStart(2, '0');
        const formattedDay = String(day).padStart(2, '0');
        const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

        // 「今日」かどうかを厳密にチェック
        const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        const todayClass = isToday ? 'today' : '';

        // タップしたら day.html にパラメータ付きで遷移するAタグを生成
        daysContainer.innerHTML += `
            <a href="day.html?date=${dateStr}" class="day-cell ${todayClass}">
                <span class="date-number">${day}</span>
            </a>
        `;
    }

    // 3. 来月分の日付でグリッドの残りを埋める（綺麗に四角く見せるため）
    const totalCells = startBlankDays + lastDayOfMonth.getDate();
    const endBlankDays = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= endBlankDays; day++) {
        daysContainer.innerHTML += `<div class="day-cell other-month"><span class="date-number">${day}</span></div>`;
    }
}

// 月切り替えボタンを押した時の処理
function changeMonth(offset) {
    currentDate.setMonth(currentDate.getMonth() + offset);
    renderCalendar();
}

// 画面読み込み時にカレンダーを描画
window.onload = renderCalendar;