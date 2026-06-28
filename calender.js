let currentDate = new Date();

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // ヘッダーの文字を更新
    document.getElementById('current-month-year').innerText = `${year}年 ${month + 1}月`;

    // 💡 修正：日付を流し込むターゲット要素を取得
    const daysContainer = document.getElementById('calendar-days');
    if (!daysContainer) return; // 要素が見つからない場合はスキップ
    
    daysContainer.innerHTML = ''; // 前の表示をクリア

    // 今月の最初の日と最後の日
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // 空白の数（先月分の埋め枠）
    const startBlankDays = firstDayOfMonth.getDay();
    const lastDayOfPrevMonth = new Date(year, month, 0).getDate();

    // 1. 先月分の日付で埋める
    for (let i = startBlankDays - 1; i >= 0; i--) {
        const prevDay = lastDayOfPrevMonth - i;
        daysContainer.innerHTML += `<div class="day-cell other-month"><span class="date-number">${prevDay}</span></div>`;
    }

    // 本物の今日の日付データ
    const today = new Date();

    // 2. 今月分の日付を生成
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const formattedMonth = String(month + 1).padStart(2, '0');
        const formattedDay = String(day).padStart(2, '0');
        const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

        const isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        const todayClass = isToday ? 'today' : '';

        daysContainer.innerHTML += `
            <a href="day.html?date=${dateStr}" class="day-cell ${todayClass}">
                <span class="date-number">${day}</span>
            </a>
        `;
    }

    // 3. 来月分の日付で埋める
    const totalCells = startBlankDays + lastDayOfMonth.getDate();
    const endBlankDays = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= endBlankDays; day++) {
        daysContainer.innerHTML += `<div class="day-cell other-month"><span class="date-number">${day}</span></div>`;
    }
}

// 月切り替えボタン
function changeMonth(offset) {
    currentDate.setMonth(currentDate.getMonth() + offset);
    renderCalendar();
}

// 💡 画面のHTML要素がすべて準備できてからカレンダーを描画する（安全対策）
document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
});