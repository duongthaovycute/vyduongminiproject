/* ================= CONFIG (no changes to data logic / URLs) ================= */
const STATIONS = [
  { id: 'station_01', url: 'https://z2c6um5ew3.execute-api.ap-southeast-1.amazonaws.com/data?station=station_01' },
  { id: 'station_02', url: 'https://z2c6um5ew3.execute-api.ap-southeast-1.amazonaws.com/data?station=station_02' },
  { id: 'station_03', url: 'https://z2c6um5ew3.execute-api.ap-southeast-1.amazonaws.com/data?station=station_03' }
];
//Lưu các đường dẫn API của 3 trạm đo khác nhau.
//currentApi: URL mặc định của trạm 3.
//INTERVAL_MS: chu kỳ cập nhật dữ liệu (mỗi 3 giây).
//MAX_POINTS: số điểm tối đa hiển thị trên biểu đồ.
//USV_THRESHOLD: ngưỡng cảnh báo phóng xạ.

let currentApi = STATIONS[2].url; // default selected
const INTERVAL_MS = 3000; // 3s 1 lân đo
const MAX_POINTS = 30;
const USV_THRESHOLD = 0.30;

/* ================ BUBBLES BG ================ */
const bubbleCanvas = document.getElementById('bubbles');
const bctx = bubbleCanvas.getContext('2d');
let bubbles = [];
function resizeBubbles(){
  bubbleCanvas.width = window.innerWidth;
  bubbleCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeBubbles);
resizeBubbles();
function initBubbles(n=40){
  bubbles = [];
  const baseHue = Number(getComputedStyle(document.documentElement).getPropertyValue('--bubble-hue-start')) || 260;
  for(let i=0;i<n;i++){
    bubbles.push({
      x: Math.random()*bubbleCanvas.width,
      y: Math.random()*bubbleCanvas.height,
      r: Math.random()*28+6,
      color: `hsla(${(baseHue + (Math.random()*40-20))},70%,80%,0.45)`,
      dx: (Math.random()-0.5)*0.4,
      dy: (Math.random()-0.5)*0.4
    });
  }
}
initBubbles(40);

//Tạo hiệu ứng bong bóng chuyển động nền (canvas).
//initBubbles() sinh ngẫu nhiên các bong bóng với màu và vị trí khác nhau.
//drawBubbles() vẽ và di chuyển bong bóng liên tục → tạo cảm giác động.
//Tự động thay đổi kích thước khi trình duyệt thay đổi.

function drawBubbles(){
  bctx.clearRect(0,0,bubbleCanvas.width,bubbleCanvas.height);
  for(const b of bubbles){
    bctx.beginPath();
    bctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    const g = bctx.createRadialGradient(b.x - b.r*0.3, b.y - b.r*0.3, 1, b.x, b.y, b.r);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.08, b.color);
    g.addColorStop(1, 'rgba(255,255,255,0.02)');
    bctx.fillStyle = g;
    bctx.fill();
    b.x += b.dx; b.y += b.dy;
    if(b.x < -50) b.x = bubbleCanvas.width + 50;
    if(b.x > bubbleCanvas.width + 50) b.x = -50;
    if(b.y < -50) b.y = bubbleCanvas.height + 50;
    if(b.y > bubbleCanvas.height + 50) b.y = -50;
  }
  requestAnimationFrame(drawBubbles);
}
drawBubbles();

/* ================ UI REFS-tham khảo giao diện người dùng ================ */
const statusEl = document.getElementById('status');
const stationSelect = document.getElementById('stationSelect');
const pauseBtn = document.getElementById('pauseBtn');
const clearBtn = document.getElementById('clearBtn');

const mini = {
  temp: document.getElementById('v-temp'),
  hum: document.getElementById('v-hum'),
  cps: document.getElementById('v-cps'),
  usv: document.getElementById('v-usv'),
  counts: document.getElementById('v-counts')
};
//Lấy các phần tử HTML (nút, menu, ô hiển thị số liệu) để JS có thể thao tác.
//Dùng mini.temp, mini.hum, ... để cập nhật giá trị đo mới.

/* ================ CHARTS ================ */
Chart.register(ChartDataLabels);

function makeChart(canvasId, color, stepped=true){
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ data: [], borderColor: color, backgroundColor: color, stepped: stepped, borderWidth: 2, pointRadius: 3, fill: false }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 160 },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted') }, grid: { color: 'rgba(0,0,0,0.03)' } },
        y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted') }, grid: { color: 'rgba(0,0,0,0.03)' } }
      },
      interaction: { mode: 'nearest', intersect: false }
    }
  });
}

function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const chartTemp   = makeChart('chart-temp', cssVar('--accent-temp') || '#ff8fab');
const chartHum    = makeChart('chart-hum', cssVar('--accent-hum') || '#91c9ff');
const chartCps    = makeChart('chart-cps', cssVar('--accent-cps') || '#ffd166');
const chartUsv    = makeChart('chart-usv', cssVar('--accent-usv') || '#c79aff');
const chartCounts = makeChart('chart-counts', cssVar('--accent-counts') || '#80e3c3');

const charts = { temp: chartTemp, hum: chartHum, cps: chartCps, usv: chartUsv, counts: chartCounts };

/* helper push & trim */
function pushPoint(chart, label, value){
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);
  while(chart.data.labels.length > MAX_POINTS){
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update('none');
}
function safeNum(x){ const n = Number(x); return Number.isFinite(n) ? n : NaN; }

//Dùng Chart.js để tạo 5 biểu đồ (nhiệt độ, độ ẩm, CPS, µSv/h, counts).
//makeChart() thiết lập kiểu biểu đồ, màu sắc, trục tọa độ.
//pushPoint() thêm điểm mới vào đồ thị, giới hạn tối đa 30 điểm (MAX_POINTS).
//safeNum() đảm bảo dữ liệu đọc từ API là số hợp lệ.

/* ================ Kitty SVG (data URI) ================ */
/* single SVG used for all charts (transparent bg) */
const kittySvg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g transform="translate(0,0)"><ellipse cx="60" cy="60" rx="36" ry="34" fill="#fff5fb" stroke="#ffbfd6" stroke-width="3"/><path d="M32 36 L20 12 L46 28 Z" fill="#fff5fb" stroke="#ffbfd6" stroke-width="2"/><path d="M88 36 L100 12 L74 28 Z" fill="#fff5fb" stroke="#ffbfd6" stroke-width="2"/><circle cx="48" cy="62" r="4" fill="#333"/><circle cx="72" cy="62" r="4" fill="#333"/><path d="M60 72 q6 4 0 8 q-6 -4 0 -8" fill="#ff9fb3"/><path d="M30 70 h18" stroke="#d89" stroke-width="2" stroke-linecap="round"/><path d="M30 76 h18" stroke="#d89" stroke-width="2" stroke-linecap="round"/><path d="M84 70 h-18" stroke="#d89" stroke-width="2" stroke-linecap="round"/><path d="M84 76 h-18" stroke="#d89" stroke-width="2" stroke-linecap="round"/><ellipse cx="44" cy="46" rx="8" ry="6" fill="#ff4d8a" /><path d="M52 46 q8 -6 16 0 q-6 6 -16 0" fill="#ff4d8a"/></g></svg>`;
const kittyDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(kittySvg);

/* assign same kitty image to each chart img */
const kittyEls = {
  temp: document.getElementById('kitty-temp'),
  hum: document.getElementById('kitty-hum'),
  cps: document.getElementById('kitty-cps'),
  usv: document.getElementById('kitty-usv'),
  counts: document.getElementById('kitty-counts')
};
for(const k in kittyEls){ kittyEls[k].src = kittyDataUrl; }

//hình mèo đáng yêu (SVG) hiển thị ở vị trí cuối cùng của mỗi biểu đồ.
//Dùng moveKittyToLastPoint() để cập nhật vị trí mèo theo điểm mới.

/* ================ Polling & Data handling (kept intact) ================ */
let paused = false;
let loopHandle = null;

async function pollOnce(){
  if(paused) return;
  try{
    statusEl.textContent = 'Status: loading...';
    const resp = await fetch(currentApi, { cache: "no-store" });
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    const arr = await resp.json();
    if(!Array.isArray(arr) || arr.length === 0){
      statusEl.textContent = 'Status: no data';
      return;
    }
    const d = arr[arr.length - 1];

    const temp = safeNum(d.temperature ?? d.temp);
    const hum  = safeNum(d.humidity);
    const cps  = safeNum(d.cps);
    const usv  = safeNum(d.uSv ?? d.usv);
    const counts = safeNum(d.counts);

    const tsMs = d.timestamp ? Number(d.timestamp) * 1000 : Date.now();
    const timeLabel = new Date(tsMs).toLocaleTimeString();

    //pollOnce(): gọi API, lấy dữ liệu mới, cập nhật giá trị mini và biểu đồ.
    //Kiểm tra xem giá trị µSv có vượt ngưỡng cảnh báo (USV_THRESHOLD).
    //Cho phép người dùng:
    //Pause / Resume việc đo.
    //Clear để xóa dữ liệu và biểu đồ.
    //Đổi trạm (station_01, 02, 03).
    //setInterval() giúp chương trình tự động gọi API mỗi 3 giây.
    

    /* ===========update mini cards================== */
    mini.temp.textContent = Number.isFinite(temp) ? temp.toFixed(1) + ' °C' : '--';
    mini.hum.textContent  = Number.isFinite(hum)  ? hum.toFixed(0) + ' %' : '--';
    mini.cps.textContent  = Number.isFinite(cps)  ? cps.toString() : '--';
    mini.usv.textContent  = Number.isFinite(usv)  ? usv.toFixed(3) + ' µSv/h' : '--';
    mini.counts.textContent = Number.isFinite(counts) ? counts.toString() : '--';


    /*====================usv alert======================*/
    const usvAlert = Number.isFinite(usv) && usv > USV_THRESHOLD;
    const cardUsv = document.getElementById('mini-usv');
    if(usvAlert) cardUsv.classList.add('alert'); else cardUsv.classList.remove('alert');

    /*===================push to charts================*/
    if(Number.isFinite(temp)) pushPoint(chartTemp, timeLabel, temp);
    if(Number.isFinite(hum)) pushPoint(chartHum, timeLabel, hum);
    if(Number.isFinite(cps)) pushPoint(chartCps, timeLabel, cps);
    if(Number.isFinite(usv)) pushPoint(chartUsv, timeLabel, usv);
    if(Number.isFinite(counts)) pushPoint(chartCounts, timeLabel, counts);

    statusEl.textContent = 'Status: OK · last ' + timeLabel;

    // move kitty for each chart to its last point
    moveKittyToLastPoint(chartTemp, kittyEls.temp);
    moveKittyToLastPoint(chartHum, kittyEls.hum);
    moveKittyToLastPoint(chartCps, kittyEls.cps);
    moveKittyToLastPoint(chartUsv, kittyEls.usv);
    moveKittyToLastPoint(chartCounts, kittyEls.counts);
  }catch(err){
    console.error('Poll error', err);
    statusEl.textContent = 'Status: error — ' + (err.message || err);
  }
}

/* controls - nút điều chỉnh */
pauseBtn.addEventListener('click', ()=>{
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  statusEl.textContent = paused ? 'Status: paused' : 'Status: running';
});
clearBtn.addEventListener('click', ()=>{
  Object.values(charts).forEach(c=>{
    c.data.labels = [];
    c.data.datasets[0].data = [];
    c.update();
  });
  // reset minis
  Object.values(mini).forEach(el=> el.textContent = '--');
  statusEl.textContent = 'Cleared charts';
  // hide all kitties
  for(const k in kittyEls) kittyEls[k].style.display = 'none';
});

/* station change- thay đổi trạm */
stationSelect.addEventListener('change', (e)=>{
  const url = e.target.value;
  currentApi = url;
  // clear charts
  Object.values(charts).forEach(c=>{
    c.data.labels = []; c.data.datasets[0].data = []; c.update();
  });
  statusEl.textContent = 'Switched station, loading...';
  pollOnce();
});

/* start loop */
pollOnce();
loopHandle = setInterval(pollOnce, INTERVAL_MS);

/* cleanup */
window.addEventListener('beforeunload', ()=> clearInterval(loopHandle));

/* ================ Zoom buttons ================ */
document.querySelectorAll('.zoom-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const card = btn.closest('.chart-card');
    if(!card.classList.contains('fullscreen')){
      card.classList.add('fullscreen');
      btn.textContent = '❌';
    } else {
      card.classList.remove('fullscreen');
      btn.textContent = '🔍';
    }
  });
});

//Cho phép người dùng click nút 🔍 để phóng to biểu đồ.
//Khi đang fullscreen thì hiện ❌ để thu nhỏ lại.

/* ================ Kitty placement logic ================ */
/* Places a kitty img element over the last point of the given Chart.js chart */
function moveKittyToLastPoint(chart, kittyEl){
  try{
    const meta = chart.getDatasetMeta(0);
    if(!meta || !meta.data || meta.data.length === 0) { kittyEl.style.display='none'; return; }
    const lastPoint = meta.data[meta.data.length - 1];
    if(!lastPoint) { kittyEl.style.display='none'; return; }

    //Cập nhật vị trí mèo trùng với điểm cuối trên mỗi biểu đồ.
    //Khi resize hoặc cuộn trang, mèo sẽ reposition lại đúng chỗ.

    
    // ==========get canvas position & point coordinates==========//
    const canvasRect = chart.canvas.getBoundingClientRect();
    const px = canvasRect.left + lastPoint.x;
    const py = canvasRect.top + lastPoint.y;
    // position kittyEl (absolute in page coordinates)
    kittyEl.style.left = px + 'px';
    kittyEl.style.top = py + 'px';
    kittyEl.style.display = '';
    // subtle pop animation
    kittyEl.style.transform = 'translate(-50%,-120%) scale(1.06)';
    setTimeout(()=> kittyEl.style.transform = 'translate(-50%,-100%) scale(1.0)', 220);
  }catch(e){
    console.warn('kitty placement failed', e);
  }
}

/* Ensure kitty repositions on resize/scroll */
window.addEventListener('resize', ()=> {
  for(const k in charts){
    if(charts[k].data.datasets[0].data.length>0) moveKittyToLastPoint(charts[k], kittyEls[k]);
  }
});
window.addEventListener('scroll', ()=> {
  for(const k in charts){
    if(charts[k].data.datasets[0].data.length>0) moveKittyToLastPoint(charts[k], kittyEls[k]);
  }
});

/* ================ THEME SWITCHING (adds visuals but keeps data same) ================ */
const bodyEl = document.body;
const pillPastel = document.getElementById('theme-pill-pastel');
const pillBatman = document.getElementById('theme-pill-batman');
const pillPhoenix = document.getElementById('theme-pill-phoenix');
const themePills = [pillPastel, pillBatman, pillPhoenix];

//Cho phép đổi 3 giao diện: Pastel 🌸, Batman 🦇, Phoenix 🔥.
//Thay đổi màu, ảnh góc (cornerImg) và màu biểu đồ tương ứng.
//Gọi refreshChartColors() để đồng bộ lại màu các biểu đồ khi đổi theme.

//=====corner image element (kept)==//
const cornerImg = document.createElement('img');
cornerImg.className = 'corner-img';
cornerImg.alt = 'corner-img';
cornerImg.src = 'https://postimg.cc/BtrTRyNF'; // keep original corner image as requested
document.body.appendChild(cornerImg);

function setActivePill(active){
  themePills.forEach(p => {
    if(p.dataset.theme === active) p.classList.add('active'); else p.classList.remove('active');
  });
}

function refreshChartColors(){
  try{
    const vars = {
      temp: cssVar('--accent-temp'),
      hum: cssVar('--accent-hum'),
      cps: cssVar('--accent-cps'),
      usv: cssVar('--accent-usv'),
      counts: cssVar('--accent-counts')
    };
    if(chartTemp) { chartTemp.data.datasets[0].borderColor = vars.temp; chartTemp.data.datasets[0].backgroundColor = vars.temp; chartTemp.update(); }
    if(chartHum)  { chartHum.data.datasets[0].borderColor = vars.hum; chartHum.data.datasets[0].backgroundColor = vars.hum; chartHum.update(); }
    if(chartCps)  { chartCps.data.datasets[0].borderColor = vars.cps; chartCps.data.datasets[0].backgroundColor = vars.cps; chartCps.update(); }
    if(chartUsv)  { chartUsv.data.datasets[0].borderColor = vars.usv; chartUsv.data.datasets[0].backgroundColor = vars.usv; chartUsv.update(); }
    if(chartCounts){ chartCounts.data.datasets[0].borderColor = vars.counts; chartCounts.data.datasets[0].backgroundColor = vars.counts; chartCounts.update(); }
    document.querySelectorAll('.mini .value').forEach(el => el.style.color = vars.temp);
    // header accent
    document.querySelectorAll('header h1').forEach(h => h.style.color = vars.temp);
  }catch(e){ console.warn('refreshChartColors error', e); }
}

function applyTheme(name){
  // remove theme classes
  bodyEl.classList.remove('theme-batman','theme-phoenix');
  if(name === 'batman') bodyEl.classList.add('theme-batman');
  if(name === 'phoenix') bodyEl.classList.add('theme-phoenix');

  // set active pill
  setActivePill(name === 'pastel' ? 'pastel' : (name === 'batman' ? 'batman' : 'phoenix'));

  // update corner image (we keep original but add subtle overlay icon per theme)
  if(name === 'pastel'){
    cornerImg.src = 'https://i.postimg.cc/Hsx681y6/1761908272006-Screenshot-20251031-175722.jpg'; // user's original image preserved
    cornerImg.style.filter = 'none';
  } else if(name === 'batman'){
    // darken + golden glow
    cornerImg.src = 'https://i.postimg.cc/Hsx681y6/1761908272006-Screenshot-20251031-175722.jpg'; // keep user image, but apply CSS filter overlay to fit theme
    cornerImg.style.filter = 'brightness(0.6) contrast(1.1) drop-shadow(0 8px 18px rgba(255,215,0,0.06))';
  } else if(name === 'phoenix'){
    cornerImg.src = 'https://i.postimg.cc/Hsx681y6/1761908272006-Screenshot-20251031-175722.jpg';
    cornerImg.style.filter = 'saturate(1.2) hue-rotate(6deg) drop-shadow(0 10px 28px rgba(255,120,60,0.08))';
  }

  // rebuild bubbles colors & chart colors
  initBubbles(40);
  refreshChartColors();
}

// pill handlers
pillPastel.addEventListener('click', ()=> applyTheme('pastel'));
pillBatman.addEventListener('click', ()=> applyTheme('batman'));
pillPhoenix.addEventListener('click', ()=> applyTheme('phoenix'));

// set initial
applyTheme('pastel');

/* Observe class attribute changes to redraw colors (fallback) */
const observer = new MutationObserver(()=> {
  refreshChartColors();
  initBubbles(40);
});
observer.observe(bodyEl, { attributes: true, attributeFilter: ['class'] });


//Khi class của body đổi (ví dụ theme khác), nó tự động cập nhật lại màu biểu đồ và bong bóng nền.//

