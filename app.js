const cx = 100, cy = 100, r = 80;
let plans = [];

// 1. 初期化: 24時間の目盛りと数字を描画
function initClock() {
    const ticksGroup = document.getElementById('ticks-group');
    if (!ticksGroup) return;

    for (let h = 0; h < 24; h++) {
        // JavaFXと異なり、SVGの標準座標系（真右が0度）に合わせるため (h * 15 - 90) で真上を0時にする
        const angle = (h * 15 - 90) * Math.PI / 180;
        const x1 = cx + (r - 5) * Math.cos(angle);
        const y1 = cy + (r - 5) * Math.sin(angle);
        const x2 = cx + r * Math.cos(angle);
        const y2 = cy + r * Math.sin(angle);
        
        // 目盛り線を追加
        ticksGroup.innerHTML += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#bbb" stroke-width="1"/>`;
        
        // 3時間ごとに数字を表示
        if (h % 3 === 0) {
            const xt = cx + (r - 12) * Math.cos(angle);
            const yt = cy + (r - 12) * Math.sin(angle) + 3;
            ticksGroup.innerHTML += `<text x="${xt}" y="${yt}" font-size="7" font-weight="bold" text-anchor="middle" fill="#666">${h}</text>`;
        }
    }
}

// 2. 円形をタップした時にタップされた「時間」を計算してフォームを開く
function handleClockClick(event) {
    const svg = document.getElementById('schedule-clock');
    const rect = svg.getBoundingClientRect();
    
    // 中心からのタップ座標を計算
    const x = event.clientX - rect.left - (rect.width / 2);
    const y = event.clientY - rect.top - (rect.height / 2);
    
    // 角度を求める（真上を0度、時計回りに0〜360度）
    let angle = Math.atan2(y, x) * 180 / Math.PI + 90;
    if (angle < 0) angle += 360;
    
    // 1時間 = 15度 なので、角度から「時間(0〜23)」を算出
    const hour = Math.floor(angle / 15);
    
    // フォームに自動セットしてモーダルを表示
    document.getElementById('start-hour').value = hour;
    document.getElementById('modal').style.display = 'block';
    document.getElementById('overlay').style.display = 'block';
}

// 3. 予定の長さを選択（ボタンのアクティブ状態の制御も）
function setDuration(minutes) {
    document.getElementById('plan-duration').value = minutes;
    
    // ボタンの見た目切り替え
    const buttons = document.querySelectorAll('.btn-time');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
    document.getElementById('overlay').style.display = 'none';
}

// 4. 入力データを配列に追加して再描画
function addPlan() {
    const title = document.getElementById('plan-title').value;
    const hour = parseInt(document.getElementById('start-hour').value) || 0;
    const min = parseInt(document.getElementById('start-minute').value) || 0;
    const duration = parseInt(document.getElementById('plan-duration').value) || 15;
    const color = document.getElementById('plan-color').value;

    const startTotalMinutes = hour * 60 + min;
    plans.push({ title, startTotalMinutes, duration, color });
    
    renderPlans();
    closeModal();
}

// 5. 予定をSVGの扇形（Arc）として描画するメイン処理
function renderPlans() {
    const group = document.getElementById('plans-group');
    group.innerHTML = '';

    plans.forEach(p => {
        // 1分 = 0.25度 (360度 / 1440分)
        const startAngle = (p.startTotalMinutes * 0.25 - 90);
        const endAngle = startAngle + (p.duration * 0.25);

        const rad1 = startAngle * Math.PI / 180;
        const rad2 = endAngle * Math.PI / 180;
        
        const x1 = cx + r * Math.cos(rad1);
        const y1 = cy + r * Math.sin(rad1);
        const x2 = cx + r * Math.cos(rad2);
        const y2 = cy + r * Math.sin(rad2);

        // 180度を超える予定の場合はフラグを1にする（今回は最大60分なので基本0）
        const largeArcFlag = (p.duration * 0.25) > 180 ? 1 : 0;

        // SVGのPathデータ作成 (M:中心へ移動 -> L:外周へ直線 -> A:円弧を描く -> Z:中心へ閉じる)
        const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
        
        // テキストを表示する位置（扇形の中央・少し内側）
        const textAngle = ((startAngle + endAngle) / 2) * Math.PI / 180;
        const tx = cx + (r * 0.65) * Math.cos(textAngle);
        const ty = cy + (r * 0.65) * Math.sin(textAngle);

        // 要素を画面に追加
        group.innerHTML += `
            <path d="${d}" fill="${p.color}" opacity="0.85" stroke="#ffffff" stroke-width="0.5"/>
            <text x="${tx}" y="${ty}" font-size="5" font-weight="bold" text-anchor="middle" fill="#222">${p.title}</text>
        `;
    });
}

// 6. Javaバックエンドへのテンプレート保存リクエスト
function saveAsTemplate() {
    // 例: Spring BootのAPIにデータを送信する想定
    const payload = {
        templateName: "月曜日",
        plans: plans
    };

    console.log("Javaに送信するデータ:", payload);
    
    /* 実際の通信コード例
    fetch('/api/schedules/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => alert("「月曜日」として保存しました"))
    .catch(err => alert("保存に失敗しました"));
    */
    
    alert("このスケジュールを「月曜日」テンプレートとして保存しました（デモ）。");
}

// 起動時に時計を初期化
window.onload = initClock;