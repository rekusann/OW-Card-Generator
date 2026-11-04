(() => {
  'use strict';

  /* =========================================================
     初期値（フォームとプレビューはすべてここから作る）
  ========================================================= */
  const STORAGE_KEY = 'ow-card-generator:v1';
  const NATURAL_WIDTH = 1800;
  const AVATAR_SIZE = 360; // 書き出し×3でも粗くならないサイズ
  const DEFAULT_AVATAR = './img/icon.png';

  const DEFAULT_STATE = {
    cardNumber: '01',
    tag: '#LookingForTeam',
    showLogo: true,
    bgHero: 'Tracer', // img/ 内のファイル名（拡張子なし）。'' は背景なし
    name: 'Player',
    xid: '',
    battletag: '',
    roles: [],
    heroPool: [],
    devices: [
      { label: 'Mouse', value: '' },
      { label: 'Keyboard', value: '' },
      { label: 'Headset', value: '' },
      { label: 'Monitor', value: '' }
    ],
    sections: { device: true, results: true, intro: true, interview: true, wtpl: true },
    results: [
      { year: '2025', month: '01', title: 'Overwatch Champion Series', rank: '1' }
    ],
    intro: 'こんにちは',
    interview: [
      { q: '好きなキャラクターは？', a: 'トールビョーンです。' }
    ],
    wtpl: [
      { name: 'user', xid: 'user', comment: 'がんばって', avatar: '' }
    ],
    scale: '1',
    layout: 'single' // 'single' = 1枚 / 'split' = 2枚に分ける
  };

  /* =========================================================
     保存（localStorage）
  ========================================================= */
  const saveStatusEl = document.getElementById('save-status');

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function loadState() {
    const base = clone(DEFAULT_STATE);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      const merged = Object.assign(base, saved);
      merged.sections = Object.assign(clone(DEFAULT_STATE.sections), saved.sections || {});
      return merged;
    } catch (err) {
      console.warn('保存データの読み込みに失敗しました:', err);
      return base;
    }
  }

  const state = loadState();

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        saveStatusEl.textContent = '入力内容はこのブラウザに自動保存されます';
        saveStatusEl.classList.remove('is-error');
      } catch (err) {
        console.warn('保存に失敗しました:', err);
        saveStatusEl.textContent = '保存できませんでした（画像が大きすぎる可能性があります）';
        saveStatusEl.classList.add('is-error');
      }
    }, 300);
  }

  /* =========================================================
     共通ユーティリティ
  ========================================================= */
  const NON_HALF_WIDTH = /[^\x20-\x7E]/g;

  // 半角(ASCII印字可能文字)のみを許可する。日本語入力の変換中は触らない
  function restrictToHalfWidth(inputEl) {
    function apply() {
      const v = inputEl.value;
      const filtered = v.replace(NON_HALF_WIDTH, '');
      if (filtered === v) return;
      const pos = inputEl.selectionStart == null ? v.length : inputEl.selectionStart;
      const newPos = v.slice(0, pos).replace(NON_HALF_WIDTH, '').length;
      inputEl.value = filtered;
      inputEl.setSelectionRange(newPos, newPos);
    }
    inputEl.addEventListener('input', (e) => {
      if (!e.isComposing) apply();
    });
    inputEl.addEventListener('compositionend', () => {
      apply();
      // 変換確定後の値を他のリスナーにも反映させる
      inputEl.dispatchEvent(new Event('input'));
    });
  }

  // テキスト入力欄を state のプロパティと結び付ける
  function bindText(inputEl, target, key, render, { halfWidth = false, stripAt = false } = {}) {
    inputEl.value = target[key];
    if (halfWidth) restrictToHalfWidth(inputEl);
    inputEl.addEventListener('input', (e) => {
      if (e.isComposing) return;
      if (stripAt && inputEl.value.startsWith('@')) {
        inputEl.value = inputEl.value.replace(/^@+/, '');
      }
      target[key] = inputEl.value;
      render(target[key]);
      save();
    });
    render(target[key]);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function rankLabel(value) {
    return value + '位';
  }

  function rankClassOf(value) {
    if (value === '1') return 'rank-1st';
    if (value === '2') return 'rank-2nd';
    if (value === '3') return 'rank-3rd';
    return 'rank-other';
  }

  function formatXid(v) {
    return v ? '@' + v : '';
  }

  let uid = 0;
  function nextId(prefix) {
    uid += 1;
    return prefix + uid;
  }

  function confirmRemove() {
    return window.confirm('この項目を削除しますか？');
  }

  function makeLabel(text) {
    const el = document.createElement('label');
    el.className = 'field-label';
    el.id = nextId('lbl');
    el.textContent = text;
    return el;
  }

  function makeTextInput(labelEl, { textarea = false, rows = 3, placeholder = '' } = {}) {
    const el = document.createElement(textarea ? 'textarea' : 'input');
    if (textarea) el.rows = rows;
    else el.type = 'text';
    el.className = 'form-input';
    el.id = nextId('in');
    if (placeholder) el.placeholder = placeholder;
    labelEl.htmlFor = el.id;
    return el;
  }

  function makeRemoveButton(onRemove) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'form-btn remove-btn';
    btn.textContent = '削除';
    btn.addEventListener('click', () => {
      if (confirmRemove()) onRemove();
    });
    return btn;
  }

  /* =========================================================
     アコーディオン式セレクト（単一選択 / 複数選択共通）
     options: [{value, label, disabled?}] または見出し {header}
     multi: true なら複数選択（checkbox）、false なら単一選択（radio）
     max: multi の場合の最大選択数
  ========================================================= */
  function createAccordion({ options, multi = false, max = 1, value, placeholder = '選択してください', labelledBy = null, onChange = () => {}, onBeforeOpen = null }) {
    const wrap = document.createElement('div');
    wrap.className = 'accordion-select';

    const groupName = nextId('acc');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'accordion-toggle';
    toggle.id = groupName + '-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', groupName + '-panel');
    if (labelledBy) toggle.setAttribute('aria-labelledby', labelledBy + ' ' + toggle.id);

    const panel = document.createElement('div');
    panel.className = 'accordion-panel';
    panel.id = groupName + '-panel';

    let selected = multi ? [...(value || [])] : (value == null ? [] : [value]);
    const optionItems = []; // {value, input, item, labelSpan, disabled}

    function labelFor(v) {
      const found = optionItems.find(o => String(o.value) === String(v));
      return found ? found.labelSpan.textContent : v;
    }

    function updateToggleText() {
      toggle.textContent = (selected.length === 0 ? placeholder : selected.map(labelFor).join(' / ')) + ' ▾';
    }

    function refreshDisabledState() {
      const atMax = multi && selected.length >= max;
      optionItems.forEach(o => {
        const isChecked = selected.map(String).includes(String(o.value));
        o.input.checked = isChecked;
        o.input.disabled = !isChecked && (o.disabled || atMax);
        o.item.classList.toggle('is-disabled', o.input.disabled);
      });
    }

    function setOpen(open) {
      wrap.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }
    wrap.close = () => setOpen(false);

    options.forEach(opt => {
      if (opt.header) {
        const header = document.createElement('div');
        header.className = 'accordion-group-header';
        header.textContent = opt.header;
        panel.appendChild(header);
        return;
      }

      const item = document.createElement('label');
      item.className = 'accordion-option';

      const input = document.createElement('input');
      input.type = multi ? 'checkbox' : 'radio';
      input.name = groupName;
      input.value = opt.value;
      input.className = 'form-checkbox';

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
          setOpen(false);
          toggle.focus();
        }
        updateToggleText();
        refreshDisabledState();
        onChange(multi ? [...selected] : selected[0]);
      });

      item.appendChild(input);
      item.appendChild(labelSpan);
      panel.appendChild(item);
      optionItems.push({ value: opt.value, input, item, labelSpan, disabled: !!opt.disabled });
    });

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !wrap.classList.contains('open');
      document.querySelectorAll('.accordion-select.open').forEach(el => {
        if (el !== wrap) el.close();
      });
      if (willOpen && onBeforeOpen) onBeforeOpen(wrap);
      setOpen(willOpen);
    });

    panel.addEventListener('click', (e) => e.stopPropagation());

    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && wrap.classList.contains('open')) {
        e.stopPropagation();
        setOpen(false);
        toggle.focus();
      }
    });

    wrap.appendChild(toggle);
    wrap.appendChild(panel);
    updateToggleText();
    refreshDisabledState();

    wrap.getValue = () => (multi ? [...selected] : selected[0]);
    wrap.updateOptionLabel = (v, text) => {
      const found = optionItems.find(o => String(o.value) === String(v));
      if (found) found.labelSpan.textContent = text;
      updateToggleText();
    };
    wrap.setOptionDisabled = (v, disabled) => {
      const found = optionItems.find(o => String(o.value) === String(v));
      if (found) found.disabled = disabled;
      refreshDisabledState();
    };

    return wrap;
  }

  document.addEventListener('click', () => {
    document.querySelectorAll('.accordion-select.open').forEach(el => el.close());
  });

  function mountAccordion(mountId, acc) {
    const mount = document.getElementById(mountId);
    mount.replaceWith(acc);
    acc.id = mountId;
  }

  /* =========================================================
     プレビューの拡大縮小（縦横比を保ったまま幅に合わせる）
  ========================================================= */
  const previewPane = document.getElementById('preview-pane');
  const previewWrapper = document.getElementById('preview-scale-wrapper');
  const previewInner = document.getElementById('preview-scale-inner');
  const cardsEl = document.getElementById('cards');
  const cardContainer = document.getElementById('card-container');
  const cardContainer2 = document.getElementById('card-container-2');

  // 2枚目の上部（カード番号・タグ・ロゴ）は1枚目と同じものを複製して使う
  cardContainer2.appendChild(cardContainer.querySelector('.card-info').cloneNode(true));

  function setTextAll(selector, text) {
    cardsEl.querySelectorAll(selector).forEach(el => { el.textContent = text; });
  }

  function updatePreviewScale() {
    const paneStyle = getComputedStyle(previewPane);
    const padX = parseFloat(paneStyle.paddingLeft) + parseFloat(paneStyle.paddingRight);
    const availWidth = Math.max(previewPane.clientWidth - padX, 50);
    const scale = availWidth / NATURAL_WIDTH;
    previewInner.style.transform = `scale(${scale})`;
    const naturalHeight = cardsEl.offsetHeight;
    previewWrapper.style.width = availWidth + 'px';
    previewWrapper.style.height = (naturalHeight * scale) + 'px';
  }

  window.addEventListener('resize', updatePreviewScale);
  new ResizeObserver(updatePreviewScale).observe(cardsEl);

  /* =========================================================
     見出し番号（表示中のセクションだけで 01, 02... と振る）
  ========================================================= */
  function renumberHeadings() {
    let n = 0;
    cardsEl.querySelectorAll('.heading').forEach(h => {
      if (h.parentElement.style.display === 'none') return;
      n += 1;
      h.textContent = pad2(n) + ' ' + h.dataset.title;
    });
  }

  // page: 2枚に分けたときに何枚目に載せるか（並び順はこの順番）
  const SECTIONS = {
    profile: { el: '.sec-player-profile', page: 1 },
    device: { checkbox: 'chk-sec-device', el: '.sec-device', page: 1 },
    results: { checkbox: 'chk-sec-results', el: '.sec-results', page: 1 },
    intro: { checkbox: 'chk-sec-intro', el: '.sec-self-introduction', page: 2 },
    interview: { checkbox: 'chk-sec-interview', el: '.sec-mini-interview', page: 2 },
    wtpl: { checkbox: 'chk-sec-wtpl', el: '.sec-wtpl', page: 2 }
  };
  Object.values(SECTIONS).forEach(cfg => { cfg.node = cardContainer.querySelector(cfg.el); });

  function isSectionVisible(key) {
    if (key === 'profile') return true;
    if (!state.sections[key]) return false;
    if (key === 'device') return state.devices.some(d => d.value.trim());
    return true;
  }

  function isSplit() {
    return state.layout === 'split';
  }

  // セクションの表示/非表示と、1枚目・2枚目への振り分けをまとめて反映する
  function refreshLayout() {
    const split = isSplit();
    Object.entries(SECTIONS).forEach(([key, cfg]) => {
      cfg.node.style.display = isSectionVisible(key) ? '' : 'none';
      (split && cfg.page === 2 ? cardContainer2 : cardContainer).appendChild(cfg.node);
    });
    cardContainer2.hidden = !split;
    cardsEl.classList.toggle('is-split', split);
    cardContainer.querySelector('.js-card-page').textContent = split ? '1/2' : '';
    cardContainer2.querySelector('.js-card-page').textContent = split ? '2/2' : '';
    document.getElementById('layout-note').hidden = !split;
    renumberHeadings();
    updatePreviewScale();
  }

  Object.entries(SECTIONS).forEach(([key, cfg]) => {
    if (!cfg.checkbox) return;
    const chk = document.getElementById(cfg.checkbox);
    chk.checked = state.sections[key];
    chk.addEventListener('change', () => {
      state.sections[key] = chk.checked;
      refreshLayout();
      save();
    });
  });

  /* =========================================================
     ① カード情報
  ========================================================= */
  const cardNumberOptions = [];
  for (let i = 1; i <= 99; i++) cardNumberOptions.push({ value: pad2(i), label: pad2(i) });
  mountAccordion('acc-card-number', createAccordion({
    options: cardNumberOptions,
    value: state.cardNumber,
    placeholder: '番号',
    labelledBy: 'lbl-card-number',
    onChange: (v) => {
      state.cardNumber = v;
      setTextAll('.js-card-number', v);
      save();
    }
  }));
  setTextAll('.js-card-number', state.cardNumber);

  bindText(document.getElementById('input-tag'), state, 'tag', (v) => {
    setTextAll('.js-card-tag', v);
  }, { halfWidth: true });

  const logoChk = document.getElementById('chk-logo');
  function renderLogo() {
    cardsEl.querySelectorAll('.js-logo').forEach(img => { img.style.display = state.showLogo ? '' : 'none'; });
  }
  logoChk.checked = state.showLogo;
  renderLogo();
  logoChk.addEventListener('change', () => {
    state.showLogo = logoChk.checked;
    renderLogo();
    save();
  });

  /* =========================================================
     ヒーロー一覧の読み込み（./text/heroes.txt）
     書式: 1行1ヒーロー「表示名」または「表示名 | 画像ファイル名」
           <TANK> のような行はロールの見出し
  ========================================================= */
  const bgWarningEl = document.getElementById('bg-hero-warning');

  function heroImageSrc(file) {
    return './img/' + encodeURIComponent(file) + '.png';
  }

  const imageCheckCache = new Map();
  function imageExists(src) {
    if (!imageCheckCache.has(src)) {
      imageCheckCache.set(src, new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
      }));
    }
    return imageCheckCache.get(src);
  }

  function applyBackground() {
    const file = state.bgHero;
    bgWarningEl.hidden = true;
    const setBg = (v) => { [cardContainer, cardContainer2].forEach(c => { c.style.backgroundImage = v; }); };
    if (!file) {
      setBg('none');
      return;
    }
    const src = heroImageSrc(file);
    imageExists(src).then(ok => {
      if (state.bgHero !== file) return; // 途中で別のキャラが選ばれた
      if (ok) {
        setBg(`url("${src}")`);
      } else {
        setBg('none');
        bgWarningEl.textContent = `画像が見つかりません（img/${file}.png）`;
        bgWarningEl.hidden = false;
      }
    });
  }

  function parseHeroes(txt) {
    const groups = [];
    let current = null;
    txt.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(line => {
      const header = line.match(/^<(.+)>$/);
      if (header) {
        current = { role: header[1], heroes: [] };
        groups.push(current);
        return;
      }
      if (!current) {
        current = { role: '', heroes: [] };
        groups.push(current);
      }
      const [display, file] = line.split('|').map(s => s.trim());
      current.heroes.push({ display, file: file || display.replace(/\s+/g, '-') });
    });
    return groups;
  }

  function buildBgHeroAccordion(groups) {
    const options = [{ value: '', label: 'なし' }];
    groups.forEach(g => {
      if (g.role) options.push({ header: g.role });
      g.heroes.forEach(h => options.push({ value: h.file, label: h.display }));
    });
    const acc = createAccordion({
      options,
      value: state.bgHero,
      placeholder: '背景キャラを選択',
      labelledBy: 'lbl-bg-hero',
      onChange: (v) => {
        state.bgHero = v;
        applyBackground();
        save();
      }
    });
    mountAccordion('acc-bg-hero', acc);

    // 画像がまだ用意されていないキャラは選べないようにする
    groups.forEach(g => g.heroes.forEach(h => {
      imageExists(heroImageSrc(h.file)).then(ok => {
        if (ok) return;
        acc.updateOptionLabel(h.file, `${h.display}（画像未登録）`);
        acc.setOptionDisabled(h.file, true);
      });
    }));
  }

  function buildHeroPoolAccordion(groups) {
    const options = [];
    groups.forEach(g => {
      if (g.role) options.push({ header: g.role });
      g.heroes.forEach(h => options.push({ value: h.display, label: h.display }));
    });
    const render = (values) => {
      document.getElementById('hero-pool-cont').textContent = values.join(' / ');
    };
    mountAccordion('acc-hero-pool', createAccordion({
      options,
      multi: true,
      max: 3,
      value: state.heroPool,
      placeholder: 'ヒーローを選択',
      labelledBy: 'lbl-hero-pool',
      onChange: (values) => {
        state.heroPool = values;
        render(values);
        save();
      }
    }));
    render(state.heroPool);
  }

  applyBackground();

  fetch('./text/heroes.txt')
    .then(r => {
      if (!r.ok) throw new Error(`status ${r.status}`);
      return r.text();
    })
    .then(txt => {
      const groups = parseHeroes(txt);
      buildBgHeroAccordion(groups);
      buildHeroPoolAccordion(groups);
    })
    .catch(err => {
      console.warn('./text/heroes.txt の読み込みに失敗しました:', err);
      ['acc-bg-hero', 'acc-hero-pool'].forEach(id => {
        document.getElementById(id).textContent = 'ヒーロー一覧を読み込めませんでした';
      });
    });

  /* =========================================================
     ② プロフィール
  ========================================================= */
  bindText(document.getElementById('input-name'), state, 'name', (v) => {
    document.getElementById('player-name-el').textContent = v;
  });

  bindText(document.getElementById('input-xid'), state, 'xid', (v) => {
    document.getElementById('x-id-value').textContent = formatXid(v);
  }, { halfWidth: true, stripAt: true });

  bindText(document.getElementById('input-battletag'), state, 'battletag', (v) => {
    const hashIdx = v.indexOf('#');
    const namePart = hashIdx === -1 ? v : v.slice(0, hashIdx);
    const tagPart = hashIdx === -1 ? '' : v.slice(hashIdx);
    document.getElementById('battletag-name').textContent = namePart;
    document.getElementById('battletag-cont-2').textContent = tagPart;
  }, { halfWidth: true });

  const renderRoles = (values) => {
    document.getElementById('role-cont').textContent = values.join(' / ');
  };
  mountAccordion('acc-role', createAccordion({
    options: ['TANK', 'Main DPS', 'Flex DPS', 'Main SUP', 'Flex SUP'].map(v => ({ value: v, label: v })),
    multi: true,
    max: 2,
    value: state.roles,
    placeholder: 'ロールを選択',
    labelledBy: 'lbl-role',
    onChange: (values) => {
      state.roles = values;
      renderRoles(values);
      save();
    }
  }));
  renderRoles(state.roles);

  /* =========================================================
     ③ 使用デバイス
  ========================================================= */
  const deviceTbody = document.getElementById('device-tbody');
  const deviceFormList = document.getElementById('device-form-list');

  function addDeviceRow(d) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="date device-label"></td>
      <td class="divider">|</td>
      <td class="title"></td>
    `;
    deviceTbody.appendChild(tr);
    const labelTd = tr.querySelector('.device-label');
    const valueTd = tr.querySelector('.title');

    const item = document.createElement('div');
    item.className = 'repeat-item';

    const labelLabel = makeLabel('項目');
    const labelInput = makeTextInput(labelLabel, { placeholder: 'Mouse など' });
    labelInput.setAttribute('list', 'device-label-suggestions');
    bindText(labelInput, d, 'label', (v) => { labelTd.textContent = v; });

    const valueLabel = makeLabel('内容');
    const valueInput = makeTextInput(valueLabel, { placeholder: '製品名・設定値など' });
    bindText(valueInput, d, 'value', (v) => {
      valueTd.textContent = v;
      // 内容が空の行はカードに出さない
      tr.style.display = v.trim() ? '' : 'none';
      refreshLayout();
    });

    const removeBtn = makeRemoveButton(() => {
      state.devices.splice(state.devices.indexOf(d), 1);
      tr.remove();
      item.remove();
      save();
      refreshLayout();
    });

    item.append(labelLabel, labelInput, valueLabel, valueInput, removeBtn);
    deviceFormList.appendChild(item);
  }

  document.getElementById('btn-add-device').addEventListener('click', () => {
    const d = { label: '', value: '' };
    state.devices.push(d);
    addDeviceRow(d);
    save();
  });

  /* =========================================================
     ④ 過去の大会結果
  ========================================================= */
  const resultsTbody = document.getElementById('results-tbody');
  const resultsFormList = document.getElementById('results-form-list');

  const yearOptions = [];
  for (let y = 2016; y <= 2099; y++) yearOptions.push({ value: String(y), label: String(y) });
  const monthOptions = [];
  for (let m = 1; m <= 12; m++) monthOptions.push({ value: pad2(m), label: pad2(m) });
  const rankOptions = [];
  for (let r = 1; r <= 99; r++) rankOptions.push({ value: String(r), label: rankLabel(r) });

  function addResultRow(d) {
    // --- プレビュー側の行 ---
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="date"></td>
      <td class="divider">|</td>
      <td class="title"></td>
      <td class="rank"></td>
    `;
    resultsTbody.appendChild(tr);
    const dateTd = tr.querySelector('.date');
    const titleTd = tr.querySelector('.title');
    const rankTd = tr.querySelector('.rank');

    // --- フォーム側の行 ---
    const item = document.createElement('div');
    item.className = 'repeat-item';

    function renderDate() {
      dateTd.textContent = `${d.year}.${d.month}`;
    }
    function renderRank() {
      rankTd.textContent = rankLabel(d.rank);
      rankTd.className = 'rank ' + rankClassOf(d.rank);
    }

    const dateLabel = makeLabel('年月');
    const dateRow = document.createElement('div');
    dateRow.className = 'inline-accordions';
    dateRow.appendChild(createAccordion({
      options: yearOptions, value: d.year, placeholder: '年', labelledBy: dateLabel.id,
      onChange: (v) => { d.year = v; renderDate(); save(); }
    }));
    dateRow.appendChild(createAccordion({
      options: monthOptions, value: d.month, placeholder: '月', labelledBy: dateLabel.id,
      onChange: (v) => { d.month = v; renderDate(); save(); }
    }));

    const titleLabel = makeLabel('大会名');
    const titleInput = makeTextInput(titleLabel, { placeholder: '大会名を入力' });
    bindText(titleInput, d, 'title', (v) => { titleTd.textContent = v; });

    const rankLabelEl = makeLabel('順位');
    const rankAcc = createAccordion({
      options: rankOptions, value: d.rank, placeholder: '順位', labelledBy: rankLabelEl.id,
      onChange: (v) => { d.rank = v; renderRank(); save(); }
    });

    const removeBtn = makeRemoveButton(() => {
      state.results.splice(state.results.indexOf(d), 1);
      tr.remove();
      item.remove();
      save();
      updatePreviewScale();
    });

    item.append(dateLabel, dateRow, titleLabel, titleInput, rankLabelEl, rankAcc, removeBtn);
    resultsFormList.appendChild(item);

    renderDate();
    renderRank();
    updatePreviewScale();
  }

  document.getElementById('btn-add-result').addEventListener('click', () => {
    const now = new Date();
    const d = { year: String(now.getFullYear()), month: pad2(now.getMonth() + 1), title: '', rank: '1' };
    state.results.push(d);
    addResultRow(d);
    save();
  });

  /* =========================================================
     ⑤ 自己紹介
  ========================================================= */
  bindText(document.getElementById('input-intro'), state, 'intro', (v) => {
    document.getElementById('self-intro-el').textContent = v;
  });

  /* =========================================================
     ⑥ 一問一答
  ========================================================= */
  const interviewListEl = document.getElementById('interview-list-el');
  const interviewFormList = document.getElementById('interview-form-list');

  function addInterviewItem(d) {
    const previewItem = document.createElement('div');
    previewItem.className = 'mini-interview-item';
    previewItem.innerHTML = `
      <div class="q-text"><span class="Q">Q. </span><span data-field="q"></span></div>
      <div class="a-text"><span class="A">A. </span><span data-field="a"></span></div>
    `;
    interviewListEl.appendChild(previewItem);
    const qSpan = previewItem.querySelector('[data-field="q"]');
    const aSpan = previewItem.querySelector('[data-field="a"]');

    const item = document.createElement('div');
    item.className = 'repeat-item';

    const qLabel = makeLabel('質問');
    const qInput = makeTextInput(qLabel);
    bindText(qInput, d, 'q', (v) => { qSpan.textContent = v; });

    const aLabel = makeLabel('回答');
    const aInput = makeTextInput(aLabel);
    bindText(aInput, d, 'a', (v) => { aSpan.textContent = v; });

    const removeBtn = makeRemoveButton(() => {
      state.interview.splice(state.interview.indexOf(d), 1);
      previewItem.remove();
      item.remove();
      save();
      updatePreviewScale();
    });

    item.append(qLabel, qInput, aLabel, aInput, removeBtn);
    interviewFormList.appendChild(item);
    updatePreviewScale();
  }

  document.getElementById('btn-add-interview').addEventListener('click', () => {
    const d = { q: '', a: '' };
    state.interview.push(d);
    addInterviewItem(d);
    save();
  });

  /* =========================================================
     ⑦ 他己紹介
  ========================================================= */
  const wtplListEl = document.getElementById('wtpl-list-el');
  const wtplFormList = document.getElementById('wtpl-form-list');

  // アップロード画像を正方形に切り抜いて縮小する（保存容量を抑えるため）
  function readAvatar(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = AVATAR_SIZE;
          canvas.getContext('2d').drawImage(
            img, (img.width - side) / 2, (img.height - side) / 2, side, side,
            0, 0, AVATAR_SIZE, AVATAR_SIZE
          );
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function addWtplCard(d) {
    const previewItem = document.createElement('div');
    previewItem.className = 'wtpl-card-wrapper';
    previewItem.innerHTML = `
      <div class="wtpl-profile-sticker">
        <img class="sticker-avatar" data-field="avatar" alt="Icon">
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

    const nameLabel = makeLabel('名前');
    const nameInputEl = makeTextInput(nameLabel);
    bindText(nameInputEl, d, 'name', (v) => { nameEl.textContent = v; });

    const xidLabel = makeLabel('XのID（@なし）');
    const xidInputEl = makeTextInput(xidLabel, { placeholder: 'user_1234' });
    bindText(xidInputEl, d, 'xid', (v) => {
      xidEl.textContent = v ? '(' + formatXid(v) + ')' : '';
    }, { halfWidth: true, stripAt: true });

    // アバター：現在の画像のサムネイルと「既定に戻す」を並べて、設定状態がわかるようにする
    const avatarLabel = makeLabel('アバター画像');
    const avatarRow = document.createElement('div');
    avatarRow.className = 'avatar-row';
    const avatarThumb = document.createElement('img');
    avatarThumb.className = 'avatar-thumb';
    avatarThumb.alt = '';
    const avatarInput = document.createElement('input');
    avatarInput.type = 'file';
    avatarInput.accept = 'image/*';
    avatarInput.className = 'form-input';
    avatarInput.id = nextId('in');
    avatarLabel.htmlFor = avatarInput.id;
    const avatarResetBtn = document.createElement('button');
    avatarResetBtn.type = 'button';
    avatarResetBtn.className = 'form-btn avatar-reset-btn';
    avatarResetBtn.textContent = '既定に戻す';

    function renderAvatar() {
      const src = d.avatar || DEFAULT_AVATAR;
      avatarImg.src = src;
      avatarThumb.src = src;
      avatarResetBtn.hidden = !d.avatar;
    }
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files[0];
      if (!file) return;
      readAvatar(file)
        .then(dataUrl => {
          d.avatar = dataUrl;
          renderAvatar();
          save();
        })
        .catch(() => alert('画像を読み込めませんでした'))
        .finally(() => { avatarInput.value = ''; });
    });
    avatarResetBtn.addEventListener('click', () => {
      d.avatar = '';
      renderAvatar();
      save();
    });
    avatarRow.append(avatarThumb, avatarInput, avatarResetBtn);

    const commentLabel = makeLabel('紹介文');
    const commentInput = makeTextInput(commentLabel, { textarea: true, rows: 3 });
    bindText(commentInput, d, 'comment', (v) => { commentEl.textContent = v; });

    const removeBtn = makeRemoveButton(() => {
      state.wtpl.splice(state.wtpl.indexOf(d), 1);
      previewItem.remove();
      item.remove();
      save();
      updatePreviewScale();
    });

    item.append(nameLabel, nameInputEl, xidLabel, xidInputEl, avatarLabel, avatarRow, commentLabel, commentInput, removeBtn);
    wtplFormList.appendChild(item);

    renderAvatar();
    updatePreviewScale();
  }

  document.getElementById('btn-add-wtpl').addEventListener('click', () => {
    const d = { name: '', xid: '', comment: '', avatar: '' };
    state.wtpl.push(d);
    addWtplCard(d);
    save();
  });

  /* =========================================================
     ⑧ 画像出力
  ========================================================= */
  mountAccordion('acc-layout', createAccordion({
    options: [
      { value: 'single', label: '1枚にまとめる' },
      { value: 'split', label: '2枚に分ける' }
    ],
    value: state.layout,
    labelledBy: 'lbl-layout',
    onChange: (v) => {
      state.layout = v;
      refreshLayout();
      save();
    }
  }));

  // 出力するカード（2枚目に表示中のセクションがなければ1枚目だけ）
  function exportTargets() {
    if (!isSplit()) return [cardContainer];
    const page2HasContent = Object.entries(SECTIONS).some(([key, cfg]) => cfg.page === 2 && isSectionVisible(key));
    return page2HasContent ? [cardContainer, cardContainer2] : [cardContainer];
  }

  const scaleOptions = ['1', '1.5', '2', '2.5', '3'].map(v => ({
    value: v,
    label: v === '1' ? '等倍 (×1)' : `×${v}`
  }));
  const scaleAcc = createAccordion({
    options: scaleOptions,
    value: state.scale,
    placeholder: 'サイズを選択',
    labelledBy: 'lbl-scale',
    onBeforeOpen: () => {
      const targets = exportTargets();
      const naturalH = targets[0].offsetHeight;
      const count = targets.length > 1 ? ` ×${targets.length}枚` : '';
      scaleOptions.forEach(o => {
        const s = parseFloat(o.value);
        const w = Math.round(NATURAL_WIDTH * s);
        const h = Math.round(naturalH * s);
        const base = o.value === '1' ? '等倍' : `×${o.value}`;
        scaleAcc.updateOptionLabel(o.value, `${base}（${w}×${h}px${count}）`);
      });
    },
    onChange: (v) => {
      state.scale = v;
      save();
    }
  });
  mountAccordion('acc-scale', scaleAcc);

  document.getElementById('btn-export').addEventListener('click', async () => {
    const scale = parseFloat(state.scale || '1');
    const prevTransform = previewInner.style.transform;
    previewInner.style.transform = 'none';
    await new Promise(requestAnimationFrame);
    try {
      const targets = exportTargets();
      for (let i = 0; i < targets.length; i++) {
        const canvas = await html2canvas(targets[i], {
          scale,
          useCORS: true,
          backgroundColor: null
        });
        const link = document.createElement('a');
        link.download = targets.length > 1 ? `card-${i + 1}.png` : 'card.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (err) {
      alert('画像の出力に失敗しました: ' + err.message);
    } finally {
      previewInner.style.transform = prevTransform;
      updatePreviewScale();
    }
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!window.confirm('入力内容をすべて消して初期状態に戻しますか？')) return;
    clearTimeout(saveTimer);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn(err);
    }
    location.reload();
  });

  /* =========================================================
     繰り返し項目の初期描画
  ========================================================= */
  state.devices.forEach(addDeviceRow);
  state.results.forEach(addResultRow);
  state.interview.forEach(addInterviewItem);
  state.wtpl.forEach(addWtplCard);

  refreshLayout();
})();
