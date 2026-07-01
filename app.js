// 表示する対象（現時点の年月）
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth();

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. モーダルの初期化＆保存・削除のデータロジックを登録
    ModalComponent.init((dateStr, text) => {
        if (text) {
            localStorage.setItem(dateStr, text);
        } else {
            localStorage.removeItem(dateStr);
        }
        
        // データが更新されたので、カレンダーのドットをリフレッシュするために再描画
        CalendarComponent.render(currentYear, currentMonth, handleDayClick);
    });

    // 2. 最初のカレンダーを描画
    CalendarComponent.render(currentYear, currentMonth, handleDayClick);
});

// カレンダーの日付がクリックされたら、モーダルコンポーネントを開く（仲介処理）
function handleDayClick(dateStr, year, month, day) {
    ModalComponent.open(dateStr, year, month, day);
}