const axes = [
  {
    id: "see-hear",
    label: "自由地看和聽",
    english: "freedom to see and hear what is here",
  },
  {
    id: "say",
    label: "自由地說出所感所想",
    english: "freedom to say what one feels and thinks",
  },
  {
    id: "feel",
    label: "自由地感覺",
    english: "freedom to feel",
  },
  {
    id: "ask",
    label: "自由地要求你所想要的",
    english: "freedom to ask for what one wants",
  },
  {
    id: "risk",
    label: "自由地根據自己想法去冒險",
    english: "freedom to take risks in one's own behalf",
  },
];

const dimensions = [
  { id: "importance", label: "重視程度", fullLabel: "現今我對此自由之重視程度", color: "#d7473f" },
  { id: "usage", label: "使用頻率", fullLabel: "現今我對此自由之使用頻率", color: "#246eb9" },
  { id: "familiarity", label: "熟悉程度", fullLabel: "現今我對此自由之熟悉程度", color: "#d5a500" },
];

const storageKey = "satir-five-freedoms-responses-v1";
const gasEndpointKey = "satir-five-freedoms-gas-endpoint-v1";
const form = document.querySelector("#surveyForm");
const groupsRoot = document.querySelector("#questionGroups");
const personSelect = document.querySelector("#personSelect");
const demoButton = document.querySelector("#demoButton");
const clearButton = document.querySelector("#clearButton");
const gasEndpointInput = document.querySelector("#gasEndpoint");
const saveEndpointButton = document.querySelector("#saveEndpointButton");
const syncAllButton = document.querySelector("#syncAllButton");
const archiveCourseButton = document.querySelector("#archiveCourseButton");
const syncStatus = document.querySelector("#syncStatus");

let responses = loadResponses();

function init() {
  renderForm();
  initSheetSync();
  wireTabs();
  updateViews();
  form.addEventListener("submit", handleSubmit);
  demoButton.addEventListener("click", addDemoData);
  clearButton.addEventListener("click", clearData);
  personSelect.addEventListener("change", updatePersonalView);
}

function renderForm() {
  groupsRoot.innerHTML = dimensions.map((dimension) => `
    <section class="group-card" style="--accent: ${dimension.color}; --legend: ${dimension.color}">
      <div class="group-head">
        <div>
          <h3>${dimension.fullLabel}</h3>
          <p>請以 0～10 評估你目前的狀態。</p>
        </div>
        <span class="legend-pill">${dimension.label}</span>
      </div>
      ${axes.map((axis, index) => renderQuestion(axis, dimension, index)).join("")}
    </section>
  `).join("");
}

function renderQuestion(axis, dimension, index) {
  const name = `${dimension.id}-${axis.id}`;
  return `
    <div class="question">
      <div class="question-title">
        ${index + 1}. ${axis.label}
        <small>${axis.english}</small>
      </div>
      <div class="rating" role="radiogroup" aria-label="${dimension.fullLabel}：${axis.label}">
        ${Array.from({ length: 11 }, (_, score) => `
          <input id="${name}-${score}" type="radio" name="${name}" value="${score}" required>
          <label for="${name}-${score}">${score}</label>
        `).join("")}
      </div>
    </div>
  `;
}

function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const name = document.querySelector("#respondentName").value.trim();
  const scores = {};

  dimensions.forEach((dimension) => {
    scores[dimension.id] = {};
    axes.forEach((axis) => {
      scores[dimension.id][axis.id] = Number(formData.get(`${dimension.id}-${axis.id}`));
    });
  });

  const existingIndex = responses.findIndex((response) => response.name === name);
  const nextResponse = { id: crypto.randomUUID(), name, scores, createdAt: new Date().toISOString() };
  if (existingIndex >= 0) {
    responses[existingIndex] = nextResponse;
  } else {
    responses.push(nextResponse);
  }

  saveResponses();
  syncResponseToSheet(nextResponse);
  form.reset();
  updateViews(name);
  showView("personal");
}

function initSheetSync() {
  const endpoint = loadGasEndpoint();
  gasEndpointInput.value = "";
  setSyncStatus(endpoint ? "已設定 Google Sheet 同步連結。" : "尚未設定 Google Sheet 同步。", endpoint ? "ok" : "");

  saveEndpointButton.addEventListener("click", () => {
    const nextEndpoint = gasEndpointInput.value.trim();
    if (nextEndpoint && !nextEndpoint.startsWith("https://script.google.com/")) {
      setSyncStatus("請貼上 Apps Script 部署後的 Web App URL。", "warn");
      return;
    }

    localStorage.setItem(gasEndpointKey, nextEndpoint);
    gasEndpointInput.value = "";
    setSyncStatus(nextEndpoint ? "已儲存 Google Sheet 同步連結。" : "已清除 Google Sheet 同步連結。", nextEndpoint ? "ok" : "");
  });

  syncAllButton.addEventListener("click", () => {
    if (!responses.length) {
      setSyncStatus("目前沒有本機資料可以同步。", "warn");
      return;
    }

    responses.forEach((response) => syncResponseToSheet(response, false));
    setSyncStatus(`已送出 ${responses.length} 筆本機資料至 Google Sheet。`, "ok");
  });

  archiveCourseButton.addEventListener("click", archiveCurrentCourse);
}

function syncResponseToSheet(response, showSkipped = true) {
  const endpoint = loadGasEndpoint();
  if (!endpoint) {
    if (showSkipped) setSyncStatus("已儲存在本機；尚未設定 Google Sheet 同步連結。", "warn");
    return;
  }

  const payload = {
    survey: "Satir 五種自由",
    respondent: response.name,
    responseId: response.id,
    createdAt: response.createdAt,
    axes,
    dimensions,
    scores: response.scores,
  };

  fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
    .then(() => setSyncStatus("已送出至 Google Sheet。", "ok"))
    .catch(() => setSyncStatus("Google Sheet 同步失敗，資料仍已保存在本機。", "warn"));
}

function archiveCurrentCourse() {
  const endpoint = loadGasEndpoint();
  if (!endpoint) {
    setSyncStatus("請先設定 Google Sheet 同步連結，再進行課程備份。", "warn");
    return;
  }

  const confirmed = confirm("確定要備份目前 Google Sheet 回應，並清空主要回應表與本機資料，開始新的課程嗎？");
  if (!confirmed) return;

  const payload = {
    action: "archive",
    survey: "Satir 五種自由",
    createdAt: new Date().toISOString(),
    axes,
    dimensions,
    scores: {},
  };

  fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
    .then(() => {
      responses = [];
      saveResponses();
      updateViews();
      setSyncStatus("已送出備份與重置要求；本機資料已清空，可開始新課程。", "ok");
    })
    .catch(() => setSyncStatus("備份要求送出失敗，請確認 Google Sheet 連結或網路狀態。", "warn"));
}

function loadGasEndpoint() {
  return localStorage.getItem(gasEndpointKey) || "";
}

function setSyncStatus(message, tone = "") {
  syncStatus.textContent = message;
  syncStatus.classList.toggle("ok", tone === "ok");
  syncStatus.classList.toggle("warn", tone === "warn");
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
}

function showView(view) {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  document.querySelector(`#${view}View`).classList.add("active");
  updateViews();
}

function updateViews(preferredName) {
  refreshPersonSelect(preferredName);
  updatePersonalView();
  updateAverageView();
  updateAllView();
}

function refreshPersonSelect(preferredName) {
  const current = preferredName || personSelect.value || responses.at(-1)?.name || "";
  personSelect.innerHTML = responses.map((response) => `
    <option value="${response.id}">${response.name}</option>
  `).join("");

  const selected = responses.find((response) => response.name === current) || responses.at(-1);
  if (selected) personSelect.value = selected.id;
}

function updatePersonalView() {
  const response = responses.find((item) => item.id === personSelect.value) || responses.at(-1);
  const chart = document.querySelector("#personalChart");
  const scores = document.querySelector("#personalScores");

  if (!response) {
    drawEmptyChart(chart, "尚未有填答資料");
    scores.innerHTML = `<div class="empty">送出第一份問卷後，這裡會顯示個人分數。</div>`;
    return;
  }

  drawRadar(chart, dimensions.map((dimension) => ({
    label: dimension.label,
    color: dimension.color,
    values: axes.map((axis) => response.scores[dimension.id][axis.id]),
  })), response.name);
  scores.innerHTML = renderScoreTable(response.scores);
}

function updateAverageView() {
  const count = responses.length;
  const chart = document.querySelector("#averageChart");
  const scores = document.querySelector("#averageScores");
  document.querySelector("#averageCount").textContent = count ? `目前 ${count} 位填答者` : "尚未有填答資料";

  if (!count) {
    drawEmptyChart(chart, "尚未有團體資料");
    scores.innerHTML = `<div class="empty">加入示範資料或送出問卷後，這裡會顯示平均分數。</div>`;
    return;
  }

  const averageScores = getAverageScores(responses);
  drawRadar(chart, dimensions.map((dimension) => ({
    label: dimension.label,
    color: dimension.color,
    values: axes.map((axis) => averageScores[dimension.id][axis.id]),
  })), "團體平均");
  scores.innerHTML = renderScoreTable(averageScores, true);
}

function updateAllView() {
  const root = document.querySelector("#allPeople");
  if (!responses.length) {
    root.innerHTML = `<div class="empty">目前沒有資料。可先加入示範資料，查看全部個人的排列效果。</div>`;
    return;
  }

  root.innerHTML = responses.map((response) => `
    <article class="person-row">
      <div class="person-name">${response.name}</div>
      <div class="mini-chart overview" style="--mini-color: #477b5a">
        <h3>三狀態總覽</h3>
        <canvas id="mini-${response.id}-overview" width="300" height="300"></canvas>
      </div>
      ${dimensions.map((dimension) => `
        <div class="mini-chart" style="--mini-color: ${dimension.color}">
          <h3>${dimension.label}</h3>
          <canvas id="mini-${response.id}-${dimension.id}" width="300" height="300"></canvas>
        </div>
      `).join("")}
    </article>
  `).join("");

  responses.forEach((response) => {
    drawRadar(
      document.querySelector(`#mini-${response.id}-overview`),
      dimensions.map((dimension) => ({
        label: dimension.label,
        color: dimension.color,
        values: axes.map((axis) => response.scores[dimension.id][axis.id]),
      })),
      "",
      { compact: true }
    );

    dimensions.forEach((dimension) => {
      drawRadar(
        document.querySelector(`#mini-${response.id}-${dimension.id}`),
        [{
          label: dimension.label,
          color: dimension.color,
          values: axes.map((axis) => response.scores[dimension.id][axis.id]),
        }],
        "",
        { compact: true }
      );
    });
  });
}

function renderScoreTable(scores, isAverage = false) {
  return `
    <table class="score-table">
      <thead>
        <tr>
          <th>自由項目</th>
          ${dimensions.map((dimension) => `<th class="score-heading" style="--heading-color: ${dimension.color}">${dimension.label}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${axes.map((axis) => `
          <tr>
            <td>${axis.label}</td>
            ${dimensions.map((dimension) => {
              const value = scores[dimension.id][axis.id];
              return `<td>${isAverage ? value.toFixed(1) : value}</td>`;
            }).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function drawRadar(canvas, datasets, title, options = {}) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const compact = options.compact;
  const center = { x: width / 2, y: compact ? height / 2 + 8 : height / 2 - 8 };
  const radius = Math.min(width, height) * (compact ? 0.31 : 0.27);
  const startAngle = -Math.PI / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  if (title) {
    ctx.fillStyle = "#2d2a26";
    ctx.font = compact ? "700 16px Microsoft JhengHei, Arial" : "700 24px Microsoft JhengHei, Arial";
    ctx.textAlign = "center";
    ctx.fillText(title, width / 2, compact ? 22 : 38);
  }

  ctx.strokeStyle = "#d9d2c5";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#f9f6ef";
  for (let level = 10; level >= 2; level -= 2) {
    drawPolygon(ctx, axes.map((_, index) => pointFor(index, radius * (level / 10), center, startAngle)));
    ctx.stroke();
  }

  axes.forEach((axis, index) => {
    const outer = pointFor(index, radius, center, startAngle);
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(outer.x, outer.y);
    ctx.stroke();

    const labelPoint = labelPosition(index, center, radius, compact);
    ctx.fillStyle = "#4f4940";
    ctx.font = compact ? "12px Microsoft JhengHei, Arial" : "18px Microsoft JhengHei, Arial";
    ctx.textAlign = labelPoint.align;
    ctx.textBaseline = labelPoint.baseline;
    wrapLabel(
      ctx,
      compact ? shortLabel(axis.label) : readableLabel(axis.label),
      labelPoint.x,
      labelPoint.y,
      compact ? 62 : 150,
      compact ? 14 : 22
    );
  });

  const styledDatasets = applyOverlapStyles(datasets);

  styledDatasets.forEach((dataset) => {
    const points = dataset.values.map((value, index) => pointFor(index, radius * (value / 10), center, startAngle));
    drawPolygon(ctx, points);
    ctx.fillStyle = hexToRgba(dataset.color, compact ? 0.08 : 0.09);
    ctx.fill();
  });

  styledDatasets.forEach((dataset) => {
    const points = dataset.values.map((value, index) => pointFor(index, radius * (value / 10), center, startAngle));
    drawPolygon(ctx, points);
    ctx.setLineDash(dataset.dash || []);
    ctx.strokeStyle = dataset.color;
    ctx.lineWidth = compact ? 2.5 : 4;
    ctx.stroke();
    ctx.setLineDash([]);

    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, compact ? 3.5 : 6, 0, Math.PI * 2);
      ctx.fillStyle = dataset.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = compact ? 1 : 1.5;
      ctx.stroke();
    });
  });

  if (!compact) drawLegend(ctx, styledDatasets, width, height);
}

function applyOverlapStyles(datasets) {
  return datasets.map((dataset, index) => {
    const sameShapeCount = datasets.filter((other) => sameValues(dataset.values, other.values)).length;
    if (sameShapeCount < 2) return { ...dataset, dash: [] };

    const matchingIndex = datasets
      .slice(0, index)
      .filter((other) => sameValues(dataset.values, other.values)).length;
    const dashStyles = [[], [12, 7], [3, 7]];
    return { ...dataset, dash: dashStyles[matchingIndex] || [8, 5] };
  });
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => Number(value) === Number(right[index]));
}

function drawEmptyChart(canvas, message) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#706a61";
  ctx.font = "700 22px Microsoft JhengHei, Arial";
  ctx.textAlign = "center";
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

function drawPolygon(ctx, points) {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

function pointFor(index, radius, center, startAngle) {
  const angle = startAngle + (Math.PI * 2 * index) / axes.length;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function labelPosition(index, center, radius, compact) {
  if (!compact) {
    return [
      { x: center.x, y: center.y - radius - 38, align: "center", baseline: "bottom" },
      { x: center.x + radius + 78, y: center.y - radius * 0.42, align: "center", baseline: "middle" },
      { x: center.x + radius * 0.72, y: center.y + radius + 44, align: "center", baseline: "top" },
      { x: center.x - radius * 0.72, y: center.y + radius + 44, align: "center", baseline: "top" },
      { x: center.x - radius - 78, y: center.y - radius * 0.42, align: "center", baseline: "middle" },
    ][index];
  }

  return [
    { x: center.x, y: 38, align: "center", baseline: "bottom" },
    { x: 256, y: 120, align: "center", baseline: "middle" },
    { x: 222, y: 244, align: "center", baseline: "top" },
    { x: 78, y: 244, align: "center", baseline: "top" },
    { x: 44, y: 120, align: "center", baseline: "middle" },
  ][index];
}

function drawLegend(ctx, datasets, width, height) {
  const itemWidth = 132;
  const totalWidth = datasets.length * itemWidth;
  let x = (width - totalWidth) / 2;
  const y = height - 22;
  datasets.forEach((dataset) => {
    ctx.fillStyle = dataset.color;
    ctx.fillRect(x, y - 12, 16, 16);
    ctx.fillStyle = "#2d2a26";
    ctx.font = "15px Microsoft JhengHei, Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(dataset.label, x + 24, y - 4);
    x += itemWidth;
  });
}

function wrapLabel(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.includes("\n") ? text.split("\n") : text.split("");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if (text.includes("\n")) {
      lines.push(word);
      return;
    }
    const test = line + word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  lines.push(line);
  const offset = ctx.textBaseline === "bottom" ? -(lines.length - 1) * lineHeight : 0;
  lines.forEach((item, index) => ctx.fillText(item, x, y + offset + index * lineHeight));
}

function readableLabel(label) {
  return label
    .replace("自由地根據自己想法去冒險", "自由地根據自己\n想法去冒險")
    .replace("自由地要求你所想要的", "自由地要求你所\n想要的")
    .replace("自由地說出所感所想", "自由地說出\n所感所想");
}

function shortLabel(label) {
  return label
    .replace("自由地", "")
    .replace("根據自己想法去", "");
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getAverageScores(items) {
  const average = {};
  dimensions.forEach((dimension) => {
    average[dimension.id] = {};
    axes.forEach((axis) => {
      const total = items.reduce((sum, response) => sum + response.scores[dimension.id][axis.id], 0);
      average[dimension.id][axis.id] = total / items.length;
    });
  });
  return average;
}

function addDemoData() {
  const demoNames = ["林以安", "陳映竹", "王品辰", "張若庭", "黃子軒", "劉家瑜"];
  const seed = [
    [[8, 9, 7, 6, 6], [6, 5, 6, 4, 3], [7, 6, 6, 5, 4]],
    [[9, 8, 8, 7, 5], [7, 6, 7, 5, 4], [8, 7, 7, 6, 5]],
    [[7, 7, 6, 6, 8], [5, 4, 5, 4, 6], [6, 5, 5, 5, 7]],
    [[8, 6, 9, 5, 6], [6, 5, 8, 3, 4], [7, 5, 8, 4, 5]],
    [[6, 8, 6, 7, 9], [4, 6, 5, 6, 7], [5, 7, 5, 6, 8]],
    [[9, 9, 8, 8, 7], [8, 7, 6, 6, 5], [8, 8, 7, 7, 6]],
  ];

  responses = demoNames.map((name, personIndex) => {
    const scores = {};
    dimensions.forEach((dimension, dimensionIndex) => {
      scores[dimension.id] = {};
      axes.forEach((axis, axisIndex) => {
        scores[dimension.id][axis.id] = seed[personIndex][dimensionIndex][axisIndex];
      });
    });
    return { id: crypto.randomUUID(), name, scores, createdAt: new Date().toISOString() };
  });
  saveResponses();
  updateViews();
  showView("all");
}

function clearData() {
  if (!confirm("確定要清除目前儲存在這台電腦的填答資料嗎？")) return;
  responses = [];
  saveResponses();
  updateViews();
}

function loadResponses() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveResponses() {
  localStorage.setItem(storageKey, JSON.stringify(responses));
}

init();
