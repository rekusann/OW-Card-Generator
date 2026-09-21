(() => {
  'use strict';

  /* =========================================================
     共通ユーティリティ
  ========================================================= */

  // 半角(ASCII印字可能文字)のみを許可する入力欄に適用
  function restrictToHalfWidth(inputEl) {
    inputEl.addEventListener('input', () => {
      const pos = inputEl.selectionStart;
      const filtered = inputEl.value.replace(/[^\x20-\x7E]/g, '');
      if (filtered !== inputEl.value) {
        inputEl.value = filtered;
        if (pos != null) inputEl.setSelectionRange(pos - 1, pos - 1);
      }
    });
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function rankClassOf(value) {
    if (value === '1st') return 'rank-1st';
    if (value === '2nd') return 'rank-2nd';
    if (value === '3rd') return 'rank-3rd';
    return 'rank-other';
  }

  let uid = 0;
  function nextId(prefix) {
    uid += 1;
    return prefix + uid;
  }

  /* =========================================================
     アコーディオン式セレクト（単一選択 / 複数選択共通）
     options: [{value, label}]
     multi: true なら複数選択（checkbox）、false なら単一選択（radio）
     max: multi の場合の最大選択数
  ========================================================= */
  function createAccordion({ options, multi = false, max = 1, defaultValues = [], placeholder = '選択してください', name = null, onChange = () => {}, onBeforeOpen = null }) {
    const wrap = document.createElement('div');
    wrap.className = 'accordion-select';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'accordion-toggle';

    const panel = document.createElement('div');
    panel.className = 'accordion-panel';

    const groupName = name || nextId('acc');
    let selected = [...defaultValues];
    const optionItems = []; // {value, labelSpan}

    function labelFor(value) {
      const found = options.find(o => String(o.value) === String(value));
      return found ? found.label : value;
    }

    function updateToggleText() {
      if (selected.length === 0) {
        toggle.textContent = placeholder + ' ▾';
      } else {
        toggle.textContent = selected.map(labelFor).join(' / ') + ' ▾';
      }
    }

    function refreshDisabledState() {
      if (!multi) return;
      const atMax = selected.length >= max;
      optionItems.forEach(({ value, input }) => {
        if (!input.checked) input.disabled = atMax;
      });
    }

    options.forEach(opt => {
      const item = document.createElement('label');
      item.className = 'accordion-option';

      const input = document.createElement('input');
      input.type = multi ? 'checkbox' : 'radio';
      input.name = groupName;
      input.value = opt.value;
      input.className = 'form-checkbox';
      if (selected.map(String).includes(String(opt.value))) input.checked = true;

      const labelSpan = document.createElement('span');
      labelSpan.textContent = opt.label;

      input.addEventListener('change', () => {
        if (multi) {
          if (input.checked) {
            if (selected.length >= max) {
              input.checked = false;
              return;
            }
            selected.push(opt.value);
          } else {
            selected = selected.filter(v => String(v) !== String(opt.value));
          }
        } else {
          selected = [opt.value];
          wrap.classList.remove('open');
        }
        updateToggleText();
        refreshDisabledState();
        onChange(multi ? [...selected] : selected[0]);
      });

      item.appendChild(input);
      item.appendChild(labelSpan);
      panel.appendChild(item);
      optionItems.push({ value: opt.value, input, labelSpan });
    });

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !wrap.classList.contains('open');
      document.querySelectorAll('.accordion-select.open').forEach(el => {
        if (el !== wrap) el.classList.remove('open');
      });
      if (willOpen && onBeforeOpen) onBeforeOpen(wrap);
      wrap.classList.toggle('open', willOpen);
    });

    wrap.appendChild(toggle);
    wrap.appendChild(panel);
    updateToggleText();
    refreshDisabledState();

    wrap.getValue = () => (multi ? [...selected] : selected[0]);
    wrap.setValue = (v) => {
      selected = multi ? [...v] : (v == null ? [] : [v]);
      optionItems.forEach(({ value, input }) => {
        input.checked = selected.map(String).includes(String(value));
      });
      updateToggleText();
      refreshDisabledState();
    };
    wrap.updateOptionLabel = (value, text) => {
      const found = optionItems.find(o => String(o.value) === String(value));
      if (found) found.labelSpan.textContent = text;
    };

    return wrap;
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.accordion-select.open').forEach(el => el.classList.remove('open'));
  });

  /* =========================================================
     プレビューの拡大縮小（縦横比を保ったまま幅に合わせる）
  ========================================================= */
  const previewPane = document.getElementById('preview-pane');
  const previewWrapper = document.getElementById('preview-scale-wrapper');
  const previewInner = document.getElementById('preview-scale-inner');
  const cardContainer = document.getElementById('card-container');
  const NATURAL_WIDTH = 1800;

  function updatePreviewScale() {
    const paneStyle = getComputedStyle(previewPane);
    const padX = parseFloat(paneStyle.paddingLeft) + parseFloat(paneStyle.paddingRight);
    const availWidth = Math.max(previewPane.clientWidth - padX, 50);
    const scale = availWidth / NATURAL_WIDTH;
    previewInner.style.transform = `scale(${scale})`;
    const naturalHeight = cardContainer.offsetHeight;
    previewWrapper.style.width = availWidth + 'px';
    previewWrapper.style.height = (naturalHeight * scale) + 'px';
  }

  window.addEventListener('resize', updatePreviewScale);
  new ResizeObserver(updatePreviewScale).observe(cardContainer);

  /* =========================================================
     ① カード情報
  ========================================================= */
  const cardNumberOptions = [];
  for (let i = 1; i <= 99; i++) cardNumberOptions.push({ value: pad2(i), label: pad2(i) });
  const cardNumberAcc = createAccordion({
    options: cardNumberOptions,
    defaultValues: ['01'],
    placeholder: '番号',
    name: 'card-number',
    onChange: (v) => { document.getElementById('card-number').textContent = v; }
  });
  document.getElementById('acc-card-number').replaceWith(cardNumberAcc);
  cardNumberAcc.id = 'acc-card-number';

  const tagInput = document.getElementById('input-tag');
  restrictToHalfWidth(tagInput);
  tagInput.addEventListener('input', () => {
    document.getElementById('card-tag').textContent = tagInput.value;
  });

  document.getElementById('chk-logo').addEventListener('change', (e) => {
    document.getElementById('revati-logo-img').style.display = e.target.checked ? '' : 'none';
  });

  /* =========================================================
     ヒーロー一覧の読み込み（./text/heroes.txt）
  ========================================================= */
  let heroList = [];
let heroDisplayList = [];

function buildBgHeroAccordion() {
  const options = [{ value: '', label: 'なし' }, ...heroList.map(h => ({ value: h, label: h }))];
  const acc = createAccordion({
    options,
    defaultValues: [''],
    placeholder: '背景キャラを選択',
    name: 'bg-hero',
    onChange: (v) => {
      cardContainer.style.backgroundImage = v ? `url(./img/${v}.png)` : '';
    }
  });
  const mount = document.getElementById('acc-bg-hero');
  mount.replaceWith(acc);
  acc.id = 'acc-bg-hero';
}

function buildHeroPoolAccordion() {
  // heroList ではなく heroDisplayList を参照
  const options = heroDisplayList.map(h => ({ value: h, label: h }));
  const acc = createAccordion({
    options,
    multi: true,
    max: 3,
    defaultValues: [],
    placeholder: 'ヒーローを選択',
    onChange: (values) => {
      document.getElementById('hero-pool-cont').textContent = values.join(' / ');
    }
  });
  const mount = document.getElementById('acc-hero-pool');
  mount.replaceWith(acc);
  acc.id = 'acc-hero-pool';
}

// テキストファイルを読み込んで配列化する共通関数
function loadTextList(path) {
  return fetch(path)
    .then(r => {
      if (!r.ok) throw new Error(`${path} not found (status ${r.status})`);
      return r.text();
    })
    .then(txt => txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean))
    .catch(err => {
      console.warn(`${path} の読み込みに失敗しました:`, err);
      return [];
    });
}

// 2つのファイルを並行して取得し、両方終わったら描画する
Promise.all([
  loadTextList('./text/heroes.txt'),
  loadTextList('./text/heroes_for_display.txt')
]).then(([heroes, heroesForDisplay]) => {
  heroList = heroes;
  heroDisplayList = heroesForDisplay;
  
  buildBgHeroAccordion();
  buildHeroPoolAccordion();
});

  /* =========================================================
     ② プロフィール
  ========================================================= */
  const nameInput = document.getElementById('input-name');
  nameInput.addEventListener('input', () => {
    document.getElementById('player-name-el').textContent = nameInput.value;
  });

  const xidInput = document.getElementById('input-xid');
  restrictToHalfWidth(xidInput);
  xidInput.addEventListener('input', () => {
    const v = xidInput.value;
    document.getElementById('x-id-value').textContent = v ? '@' + v : '';
  });

  const battletagInput = document.getElementById('input-battletag');
  restrictToHalfWidth(battletagInput);
  battletagInput.addEventListener('input', () => {
    const v = battletagInput.value;
    const hashIdx = v.indexOf('#');
    let namePart = v, tagPart = '';
    if (hashIdx !== -1) {
      namePart = v.slice(0, hashIdx);
      tagPart = v.slice(hashIdx);
    }
    document.getElementById('battletag-name').textContent = namePart;
    document.getElementById('battletag-cont-2').textContent = tagPart;
  });

  const roleAcc = createAccordion({
    options: [
      { value: 'TANK', label: 'TANK' },
      { value: 'Main DPS', label: 'Main DPS' },
      { value: 'Flex DPS', label: 'Flex DPS' },
      { value: 'Main SUP', label: 'Main SUP' },
      { value: 'Flex SUP', label: 'Flex SUP' }
    ],
    multi: true,
    max: 2,
    placeholder: 'ロールを選択',
    onChange: (values) => {
      document.getElementById('role-cont').textContent = values.join(' / ');
    }
  });
  const roleMount = document.getElementById('acc-role');
  roleMount.replaceWith(roleAcc);
  roleAcc.id = 'acc-role';

  /* =========================================================
     ③ 過去の大会結果
  ========================================================= */
  const resultsTbody = document.getElementById('results-tbody');
  const resultsFormList = document.getElementById('results-form-list');

  const yearOptions = [];
  for (let y = 2016; y <= 2099; y++) yearOptions.push({ value: String(y), label: String(y) });
  const monthOptions = [];
  for (let m = 0; m <= 12; m++) monthOptions.push({ value: pad2(m), label: pad2(m) });
  const rankOptions = [
    { value: '1st', label: '1st' },
    { value: '2nd', label: '2nd' },
    { value: '3rd', label: '3rd' }
  ];
  for (let r = 4; r <= 99; r++) rankOptions.push({ value: r + 'th', label: r + 'th' });

  function addResultRow(defaults = {}) {
    const d = Object.assign({ year: '2025', month: '01', title: 'Overwatch Champion Series', rank: '1st' }, defaults);
    const rowId = nextId('res');

    // --- プレビュー側の行 ---
    const tr = document.createElement('tr');
    tr.dataset.rowId = rowId;
    tr.innerHTML = `
      <td class="date" data-field="date"></td>
      <td class="divider">|</td>
      <td class="title" data-field="title"></td>
      <td class="rank" data-field="rank"></td>
    `;
    resultsTbody.appendChild(tr);
    const dateTd = tr.querySelector('[data-field="date"]');
    const titleTd = tr.querySelector('[data-field="title"]');
    const rankTd = tr.querySelector('[data-field="rank"]');

    // --- フォーム側の行 ---
    const item = document.createElement('div');
    item.className = 'repeat-item';
    item.dataset.rowId = rowId;

    const dateLabel = document.createElement('div');
    dateLabel.className = 'field-label';
    dateLabel.textContent = '年月';
    const dateRow = document.createElement('div');
    dateRow.className = 'inline-accordions';

    function updateDate() {
      dateTd.textContent = `${yearAcc.getValue()}.${monthAcc.getValue()}`;
    }
    const yearAcc = createAccordion({ options: yearOptions, defaultValues: [d.year], placeholder: '年', name: rowId + '-year', onChange: updateDate });
    const monthAcc = createAccordion({ options: monthOptions, defaultValues: [d.month], placeholder: '月', name: rowId + '-month', onChange: updateDate });
    dateRow.appendChild(yearAcc);
    dateRow.appendChild(monthAcc);

    const titleLabel = document.createElement('div');
    titleLabel.className = 'field-label';
    titleLabel.textContent = '大会名';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'form-input';
    titleInput.value = d.title;
    titleInput.addEventListener('input', () => { titleTd.textContent = titleInput.value; });

    const rankLabel = document.createElement('div');
    rankLabel.className = 'field-label';
    rankLabel.textContent = '順位';
    function applyRank(v) {
      rankTd.textContent = v;
      rankTd.className = 'rank ' + rankClassOf(v);
    }
    const rankAcc = createAccordion({ options: rankOptions, defaultValues: [d.rank], placeholder: '順位', name: rowId + '-rank', onChange: applyRank });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'form-btn remove-btn';
    removeBtn.textContent = '削除';
    removeBtn.addEventListener('click', () => {
      tr.remove();
      item.remove();
      updatePreviewScale();
    });

    item.appendChild(dateLabel);
    item.appendChild(dateRow);
    item.appendChild(titleLabel);
    item.appendChild(titleInput);
    item.appendChild(rankLabel);
    item.appendChild(rankAcc);
    item.appendChild(removeBtn);
    resultsFormList.appendChild(item);

    // 初期表示反映
    updateDate();
    titleTd.textContent = d.title;
    applyRank(d.rank);
    updatePreviewScale();
  }

  document.getElementById('btn-add-result').addEventListener('click', () => addResultRow());
  document.getElementById('chk-sec-results').addEventListener('change', (e) => {
    document.querySelector('.sec-results').style.display = e.target.checked ? '' : 'none';
  });

  /* =========================================================
     ④ 自己紹介
  ========================================================= */
  const introInput = document.getElementById('input-intro');
  introInput.addEventListener('input', () => {
    document.getElementById('self-intro-el').textContent = introInput.value;
  });
  document.getElementById('chk-sec-intro').addEventListener('change', (e) => {
    document.querySelector('.sec-self-introduction').style.display = e.target.checked ? '' : 'none';
  });

  /* =========================================================
     ⑤ 一問一答
  ========================================================= */
  const interviewListEl = document.getElementById('interview-list-el');
  const interviewFormList = document.getElementById('interview-form-list');

  function addInterviewItem(defaults = {}) {
    const d = Object.assign({ q: '好きなキャラクターは？', a: 'トールビョーンです。' }, defaults);
    const rowId = nextId('qa');

    const previewItem = document.createElement('div');
    previewItem.className = 'mini-interview-item';
    previewItem.dataset.rowId = rowId;
    previewItem.innerHTML = `
      <div class="q-text"><span class="Q">Q. </span><span data-field="q"></span></div>
      <div class="a-text"><span class="A">A. </span><span data-field="a"></span></div>
    `;
    interviewListEl.appendChild(previewItem);
    const qSpan = previewItem.querySelector('[data-field="q"]');
    const aSpan = previewItem.querySelector('[data-field="a"]');

    const item = document.createElement('div');
    item.className = 'repeat-item';
    item.dataset.rowId = rowId;

    const qLabel = document.createElement('div');
    qLabel.className = 'field-label';
    qLabel.textContent = '質問';
    const qInput = document.createElement('input');
    qInput.type = 'text';
    qInput.className = 'form-input';
    qInput.value = d.q;
    qInput.addEventListener('input', () => { qSpan.textContent = qInput.value; });

    const aLabel = document.createElement('div');
    aLabel.className = 'field-label';
    aLabel.textContent = '回答';
    const aInput = document.createElement('input');
    aInput.type = 'text';
    aInput.className = 'form-input';
    aInput.value = d.a;
    aInput.addEventListener('input', () => { aSpan.textContent = aInput.value; });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'form-btn remove-btn';
    removeBtn.textContent = '削除';
    removeBtn.addEventListener('click', () => {
      previewItem.remove();
      item.remove();
      updatePreviewScale();
    });

    item.appendChild(qLabel);
    item.appendChild(qInput);
    item.appendChild(aLabel);
    item.appendChild(aInput);
    item.appendChild(removeBtn);
    interviewFormList.appendChild(item);

    qSpan.textContent = d.q;
    aSpan.textContent = d.a;
    updatePreviewScale();
  }

  document.getElementById('btn-add-interview').addEventListener('click', () => addInterviewItem());
  document.getElementById('chk-sec-interview').addEventListener('change', (e) => {
    document.querySelector('.sec-mini-interview').style.display = e.target.checked ? '' : 'none';
  });

  /* =========================================================
     ⑥ 他己紹介
  ========================================================= */
  const wtplListEl = document.getElementById('wtpl-list-el');
  const wtplFormList = document.getElementById('wtpl-form-list');

  function addWtplCard(defaults = {}) {
    const d = Object.assign({ name: 'user', xid: '@user', comment: 'がんばって' }, defaults);
    const rowId = nextId('wtpl');

    const previewItem = document.createElement('div');
    previewItem.className = 'wtpl-card-wrapper';
    previewItem.dataset.rowId = rowId;
    previewItem.innerHTML = `
      <div class="wtpl-profile-sticker">
        <img class="sticker-avatar" data-field="avatar" src="./img/icon.png" alt="Icon">
      </div>
      <div class="wtpl-speech-bubble">
        <div class="wtpl-comment" data-field="comment"></div>
        <div class="wtpl-tag"><span data-field="name"></span> <span class="tag-sub" data-field="xid"></span></div>
      </div>
    `;
    wtplListEl.appendChild(previewItem);
    const avatarImg = previewItem.querySelector('[data-field="avatar"]');
    const commentEl = previewItem.querySelector('[data-field="comment"]');
    const nameEl = previewItem.querySelector('[data-field="name"]');
    const xidEl = previewItem.querySelector('[data-field="xid"]');

    const item = document.createElement('div');
    item.className = 'repeat-item';
    item.dataset.rowId = rowId;

    const nameLabel = document.createElement('div');
    nameLabel.className = 'field-label';
    nameLabel.textContent = '名前';
    const nameInputEl = document.createElement('input');
    nameInputEl.type = 'text';
    nameInputEl.className = 'form-input';
    nameInputEl.value = d.name;
    nameInputEl.addEventListener('input', () => { nameEl.textContent = nameInputEl.value; });

    const xidLabel = document.createElement('div');
    xidLabel.className = 'field-label';
    xidLabel.textContent = 'XのID';
    const xidInputEl = document.createElement('input');
    xidInputEl.type = 'text';
    xidInputEl.className = 'form-input';
    xidInputEl.value = d.xid;
    restrictToHalfWidth(xidInputEl);
    xidInputEl.addEventListener('input', () => { xidEl.textContent = '(' + xidInputEl.value + ')'; });

    const avatarLabel = document.createElement('div');
    avatarLabel.className = 'field-label';
    avatarLabel.textContent = 'アバター画像';
    const avatarInput = document.createElement('input');
    avatarInput.type = 'file';
    avatarInput.accept = 'image/*';
    avatarInput.className = 'form-input';
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { avatarImg.src = reader.result; };
      reader.readAsDataURL(file);
    });

    const commentLabel = document.createElement('div');
    commentLabel.className = 'field-label';
    commentLabel.textContent = '紹介文';
    const commentInput = document.createElement('textarea');
    commentInput.className = 'form-input';
    commentInput.rows = 3;
    commentInput.value = d.comment;
    commentInput.addEventListener('input', () => { commentEl.textContent = commentInput.value; });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'form-btn remove-btn';
    removeBtn.textContent = '削除';
    removeBtn.addEventListener('click', () => {
      previewItem.remove();
      item.remove();
      updatePreviewScale();
    });

    item.appendChild(nameLabel);
    item.appendChild(nameInputEl);
    item.appendChild(xidLabel);
    item.appendChild(xidInputEl);
    item.appendChild(avatarLabel);
    item.appendChild(avatarInput);
    item.appendChild(commentLabel);
    item.appendChild(commentInput);
    item.appendChild(removeBtn);
    wtplFormList.appendChild(item);

    nameEl.textContent = d.name;
    xidEl.textContent = '(' + d.xid + ')';
    commentEl.textContent = d.comment;
    updatePreviewScale();
  }

  document.getElementById('btn-add-wtpl').addEventListener('click', () => addWtplCard());
  document.getElementById('chk-sec-wtpl').addEventListener('change', (e) => {
    document.querySelector('.sec-wtpl').style.display = e.target.checked ? '' : 'none';
  });

  /* =========================================================
     ⑦ 画像出力
  ========================================================= */
  const scaleOptions = [
    { value: '1', label: '等倍 (×1)' },
    { value: '1.5', label: '×1.5' },
    { value: '2', label: '×2' },
    { value: '2.5', label: '×2.5' },
    { value: '3', label: '×3' }
  ];
  const scaleAcc = createAccordion({
    options: scaleOptions,
    defaultValues: ['1'],
    placeholder: 'サイズを選択',
    name: 'scale',
    onBeforeOpen: () => {
      const naturalH = cardContainer.offsetHeight;
      scaleOptions.forEach(o => {
        const s = parseFloat(o.value);
        const w = Math.round(NATURAL_WIDTH * s);
        const h = Math.round(naturalH * s);
        const base = o.value === '1' ? '等倍' : `×${o.value}`;
        scaleAcc.updateOptionLabel(o.value, `${base}（${w}×${h}px）`);
      });
    },
    onChange: () => {}
  });
  document.getElementById('acc-scale').replaceWith(scaleAcc);
  scaleAcc.id = 'acc-scale';

  document.getElementById('btn-export').addEventListener('click', async () => {
    const scale = parseFloat(scaleAcc.getValue() || '1');
    const prevTransform = previewInner.style.transform;
    previewInner.style.transform = 'none';
    await new Promise(requestAnimationFrame);
    try {
      const canvas = await html2canvas(cardContainer, {
        scale,
        useCORS: true,
        backgroundColor: null
      });
      const link = document.createElement('a');
      link.download = 'card.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      alert('画像の出力に失敗しました: ' + err.message);
    } finally {
      previewInner.style.transform = prevTransform;
      updatePreviewScale();
    }
  });

  /* =========================================================
     初期データ
  ========================================================= */
  addResultRow({ year: '2025', month: '01', title: 'Overwatch Champion Series', rank: '1st' });
  addResultRow({ year: '2025', month: '01', title: 'Overwatch Champion Series', rank: '1st' });
  addInterviewItem();
  addInterviewItem();
  addWtplCard();

  updatePreviewScale();
})();
