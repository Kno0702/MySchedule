const CalendarComponent = {
    // カレンダーを描画する。引数として日付が押された時のアクション（関数）を受け取る
    render(year, month, onDayClick) {
        const grid = document.getElementById('calendarGrid');
        const title = document.getElementById('calendarTitle');
        
        title.innerText = `${year}年 ${month + 1}月`;
        this.resetGrid(grid);

        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();

        // 1日前の空白スペース
        for (let i = 0; i < firstDayIndex; i++) {
            grid.appendChild(document.createElement('div'));
        }

        // 日付ボタン生成
        for (let day = 1; day <= totalDays; day++) {
            const btn = document.createElement('button');
            btn.classList.add('day-btn');
            btn.innerText = day;

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            // スケジュールのドット表示判定
            if (localStorage.getItem(dateStr)) {
                btn.classList.add('has-event');
            }

            // クリックされたら、外部（app.js）から渡された「モーダルを開く処理」を呼び出す
            btn.addEventListener('click', () => {
                if (onDayClick) onDayClick(dateStr, year, month + 1, day);
            });

            grid.appendChild(btn);
        }
    },

    resetGrid(grid) {
        const dayNames = grid.querySelectorAll('.day-name');
        grid.innerHTML = '';
        dayNames.forEach(name => grid.appendChild(name));
    }
};