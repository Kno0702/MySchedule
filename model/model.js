const ModalComponent = {
    currentDateStr: "",

    // 初期化：ボタンのイベントと、保存された時の処理（関数）をセットする
    init(onSaveCallback) {
        const closeBtn = document.getElementById('closeBtn');
        const saveBtn = document.getElementById('saveBtn');

        closeBtn.addEventListener('click', () => this.close());

        saveBtn.addEventListener('click', () => {
            const text = document.getElementById('scheduleInput').value.trim();
            // 保存した時の実際のデータ処理はapp.js側で行うためにコールバックを実行
            if (onSaveCallback) {
                onSaveCallback(this.currentDateStr, text);
            }
            this.close();
        });
    },

    // モーダルを開く
    open(dateStr, year, month, day) {
        this.currentDateStr = dateStr;
        document.getElementById('modalDateTitle').innerText = `${year}年${month}月${day}日のスケジュール`;
        
        // 既存データの読み込み
        const savedEvent = localStorage.getItem(dateStr) || "";
        document.getElementById('scheduleInput').value = savedEvent;
        
        document.getElementById('scheduleModal').style.display = 'flex';
    },

    // モーダルを閉じる
    close() {
        document.getElementById('scheduleModal').style.display = 'none';
    }
};