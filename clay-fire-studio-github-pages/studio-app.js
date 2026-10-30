(function () {
  'use strict';

  const D = window.StudioData;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const findClay = (id) => D.CLAYS.find(c => c.id === id) || D.CLAYS[0];
  const findColor = (id) => D.COLORS.find(c => c.id === id) || D.COLORS[0];
  const findFinish = (id) => D.FINISHES.find(f => f.id === id) || D.FINISHES[2];
  const findTexture = (id) => D.TEXTURES.find(t => t.id === id) || D.TEXTURES[0];
  const sampleEntries = () => Object.entries(D.PROFILE_SAMPLES);
  const customSample = {
    name: '自由器型',
    note: '不套模板，直接从泥团塑形',
    keys: [[0, .72], [.08, .76], [.28, .88], [.48, .9], [.68, .84], [.88, .7], [1, .64]],
    handles: 0
  };
  const phaseOrder = ['clay', 'sculpt', 'dry', 'bisque', 'decorate', 'fire'];

  const els = {
    topHandStatus: $('topHandStatus'),
    cameraBadge: $('cameraBadge'),
    cameraView: $('cameraView'),
    cameraVideo: $('cameraVideo'),
    handOverlay: $('handOverlay'),
    cameraPlaceholder: $('cameraPlaceholder'),
    handMessage: $('handMessage'),
    cameraBtn: $('cameraBtn'),
    demoHandsBtn: $('demoHandsBtn'),
    cameraSelect: $('cameraSelect'),
    refreshCameraBtn: $('refreshCameraBtn'),
    clayOptions: $('clayOptions'),
    wheelPowerBtn: $('wheelPowerBtn'),
    wheelPowerText: $('wheelPowerText'),
    sampleGrid: $('sampleGrid'),
    clayStageShell: $('clayStageShell'),
    studioStage: document.querySelector('.studio-stage'),
    stageEyebrow: $('stageEyebrow'),
    stageTitle: $('stageTitle'),
    stageCopy: $('stageCopy'),
    stageMessage: $('stageMessage'),
    panelEyebrow: $('panelEyebrow'),
    panelTitle: $('panelTitle'),
    panelBadge: $('panelBadge'),
    panelContent: $('panelContent'),
    potteryCanvas: $('potteryCanvas'),
    powerFloating: $('powerFloating'),
    anglePill: $('anglePill'),
    smoothBtn: $('smoothBtn'),
    undoBtn: $('undoBtn'),
    centerViewBtn: $('centerViewBtn'),
    topViewBtn: $('topViewBtn'),
    presentationBtn: $('presentationBtn'),
    resetBtn: $('resetBtn'),
    exportBtn: $('exportBtn'),
    footerStatus: $('footerStatus'),
    phases: [...document.querySelectorAll('.phase')],
    modal: $('kilnModal'),
    kilnView: $('kilnView'),
    resultView: $('resultView'),
    closeModalBtn: $('closeModalBtn'),
    kilnKicker: $('kilnKicker'),
    kilnTitle: $('kilnTitle'),
    kilnPot: $('kilnPot'),
    kilnTemp: $('kilnTemp'),
    kilnStatus: $('kilnStatus'),
    kilnProgress: $('kilnProgress'),
    resultCopy: $('resultCopy'),
    resultArt: $('resultArt'),
    resultSpecs: $('resultSpecs'),
    restartBtn: $('restartBtn'),
    saveResultBtn: $('saveResultBtn')
  };

  function makeRawProfile() {
    return Array.from({ length: 48 }, (_, i) => {
      const t = i / 47;
      return 0.5 + Math.sin(t * Math.PI) * 0.52 + t * t * 0.16;
    });
  }

  function makeCustomProfile() {
    return D.expandProfile(customSample);
  }

  function initialState() {
    return {
      phase: 'clay',
      wheelOn: false,
      cameraOn: false,
      demoOn: false,
      clayId: 'white',
      knead: 0,
      rawProfile: makeRawProfile(),
      sampleId: 'custom',
      profile: makeCustomProfile(),
      lumps: [],
      handleCount: 0,
      mouth: { diameter: 1, rim: 0.14, depth: 0.34, style: 'round' },
      tool: 'sculpt',
      smoothStrength: 2,
      edgeSmoothed: false,
      dryProgress: 0,
      bisqueDone: false,
      glaze: { body: null, rim: null, inside: null, foot: null },
      selectedRegion: 'body',
      selectedColorId: 'celadon',
      colorGroup: '常用色',
      decorMode: 'fill',
      brushSize: 11,
      finishId: 'soft',
      gloss: 0.56,
      texture: 'rings',
      stampCategory: '传统纹样',
      stampId: 'lotus',
      stampSize: 110,
      stampColorId: 'cobalt',
      stampColor: '#315c87',
      hasArtwork: false,
      surfaceArtwork: false,
      freeArtwork: false,
      temperature: 1240,
      atmosphere: 'oxidation',
      firedFinishId: 'soft',
      finalized: false,
      history: []
    };
  }

  let state = initialState();
  let handTracker = null;
  let demoInterval = null;
  let lastHandAt = 0;
  let lastHandData = null;
  let handDeformCooldown = 0;
  let lastHistoryAt = 0;
  let firingTimer = null;
  let firingTimeout = null;
  let firingActive = false;
  let dryTimer = null;
  let sculptDrag = null;
  let painting = false;
  let freePainting = false;
  let pointerDownAt = 0;
  let pointerStart = null;

  const renderer = new window.PotteryCanvas(els.potteryCanvas);

  function clay() { return findClay(state.clayId); }
  function selectedColor() { return findColor(state.selectedColorId); }
  function selectedStampColor() { return findColor(state.stampColorId); }
  function pieceName() {
    return state.sampleId === 'custom' ? customSample.name : (D.PROFILE_SAMPLES[state.sampleId] || customSample).name;
  }
  function currentFinish() {
    return findFinish(state.finalized ? state.firedFinishId : state.finishId);
  }

  function rendererState() {
    return {
      rawClay: state.phase === 'clay',
      profile: state.phase === 'clay' ? state.rawProfile : state.profile,
      lumps: state.lumps,
      clay: clay(),
      glaze: state.glaze,
      finish: currentFinish(),
      gloss: state.gloss,
      texture: state.texture,
      mouth: state.mouth,
      handleCount: state.phase === 'clay' ? 0 : state.handleCount,
      bisqueDone: state.bisqueDone,
      phase: state.phase,
      finalized: state.finalized,
      fireTemperature: state.temperature,
      atmosphere: state.atmosphere
    };
  }

  function syncRenderer() {
    renderer.setState(rendererState());
  }

  function toast(message) {
    els.footerStatus.textContent = message;
    els.footerStatus.animate(
      [{ opacity: .35, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }],
      { duration: 220, easing: 'ease-out' }
    );
  }

  function pushHistory() {
    const snapshot = {
      profile: state.profile.slice(),
      lumps: state.lumps.map(l => ({ ...l })),
      smooth: state.edgeSmoothed
    };
    state.history.push(snapshot);
    if (state.history.length > 30) state.history.shift();
    els.undoBtn.disabled = false;
  }

  function undo() {
    const previous = state.history.pop();
    if (!previous) return;
    state.profile = previous.profile;
    state.lumps = previous.lumps;
    state.edgeSmoothed = previous.smooth;
    els.undoBtn.disabled = state.history.length === 0;
    syncRenderer();
    renderPanel();
    toast('已撤销上一步塑形');
  }

  function phaseMeta() {
    const map = {
      clay: ['STEP 01 / 06', '准备泥料', '选择泥料，打开转盘电源，再揉匀泥团。', '打开转盘电源，用双手揉压泥团；也可以使用鼠标。'],
      sculpt: ['STEP 02 / 06', '双手自由手捏', '两只手会同时改变同一件坯体，拖动画面可旋转 360° 查看。', '选择“双手捏制”后按住坯体，或开启摄像头让双手同步塑形。'],
      dry: ['STEP 03 / 06', '修边与自然干燥', '先把粗糙口沿修顺，再让坯体慢慢干燥。', '点击一键修饰边缘，确认轮廓后进入自然干燥。'],
      bisque: ['STEP 04 / 06', '低温素烧', '素烧让泥坯变硬，并让釉层更容易附着。', '素烧后器型固定，不能再修改轮廓。'],
      decorate: ['STEP 05 / 06', '上釉与彩绘', '选择全区域填色或自由绘画，再叠加贴花和纹理。', '拖动陶器可以从任意角度观察和绘制。'],
      fire: ['STEP 06 / 06', '温控本烧', '选择烧成温度和窑内气氛，最终釉色会随之改变。', '高温会让釉色加深，并形成流动、开片与火痕。']
    };
    return map[state.phase];
  }

  function renderAll() {
    const meta = phaseMeta();
    els.stageEyebrow.textContent = meta[0];
    els.panelEyebrow.textContent = meta[0];
    els.stageTitle.textContent = meta[1];
    els.panelTitle.textContent = meta[1];
    els.stageCopy.textContent = meta[2];
    els.stageMessage.innerHTML = '<strong>操作：</strong>' + meta[3];
    els.panelBadge.textContent = state.phase === 'clay' ? clay().name : (state.phase === 'fire' ? state.temperature + '°C' : '360° 立体');
    els.exportBtn.disabled = !state.finalized;
    els.smoothBtn.hidden = state.phase !== 'sculpt' && state.phase !== 'dry';
    els.smoothBtn.disabled = state.phase !== 'sculpt' && state.phase !== 'dry';
    els.undoBtn.disabled = state.history.length === 0;
    els.powerFloating.classList.toggle('on', state.wheelOn);
    els.powerFloating.querySelector('span').textContent = state.wheelOn ? '转盘运转中' : '转盘关闭';
    els.wheelPowerBtn.classList.toggle('on', state.wheelOn);
    els.wheelPowerBtn.setAttribute('aria-pressed', String(state.wheelOn));
    els.wheelPowerBtn.querySelector('span').textContent = state.wheelOn ? 'ON' : 'OFF';
    els.wheelPowerText.textContent = state.wheelOn ? '开启 · 可塑形' : '关闭 · 点击启动';
    els.phases.forEach((button, index) => {
      const current = phaseOrder.indexOf(state.phase);
      button.classList.toggle('active', button.dataset.phase === state.phase);
      button.classList.toggle('done', index < current);
    });
    document.querySelectorAll('[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === state.tool));
    const toolButtons = document.querySelectorAll('#viewModes button');
    if (toolButtons.length === 2) {
      toolButtons[0].textContent = state.phase === 'clay' ? '双手揉泥' : state.phase === 'decorate' ? '涂绘 / 贴花' : '双手捏制';
      toolButtons[1].textContent = '360° 旋转';
    }
    els.clayStageShell.classList.toggle('free-canvas-mode', state.phase === 'decorate' && state.decorMode === 'free');
    els.potteryCanvas.style.cursor = state.tool === 'rotate' ? 'grab' : state.phase === 'decorate' ? (state.decorMode === 'paint' || state.decorMode === 'free' ? 'crosshair' : 'pointer') : 'grab';
    renderClayOptions();
    renderSamples();
    renderPanel();
    syncRenderer();
  }

  function renderClayOptions() {
    els.clayOptions.innerHTML = D.CLAYS.map(c => (
      '<button class="clay-option ' + (c.id === state.clayId ? 'selected' : '') + '" data-clay="' + c.id + '" type="button" title="' + c.note + '">' +
        '<i style="background:' + c.base + '"></i><span>' + c.name + '</span>' +
      '</button>'
    )).join('');
  }

  function drawSamplePreview(canvas, sample) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width = 90;
    const h = canvas.height = 78;
    ctx.clearRect(0, 0, w, h);
    const profile = D.expandProfile(sample);
    const left = [], right = [];
    for (let i = 0; i < profile.length; i += 2) {
      const t = i / (profile.length - 1);
      const py = 7 + t * 61;
      const r = profile[i] * 25;
      left.push([45 - r, py]);
      right.push([45 + r, py]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    left.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
    for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    const grad = ctx.createLinearGradient(18, 0, 72, 0);
    grad.addColorStop(0, clay().light);
    grad.addColorStop(.5, clay().base);
    grad.addColorStop(1, clay().deep);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(75,47,32,.48)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(45, 7, profile[0] * 25, 4.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = clay().deep;
    ctx.globalAlpha = .38;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function renderSamples() {
    const entries = [['custom', customSample], ...sampleEntries()];
    els.sampleGrid.innerHTML = entries.map(([id, sample]) => (
      '<button class="sample-card ' + (state.sampleId === id ? 'selected' : '') + '" data-sample="' + id + '" type="button" title="' + sample.note + '">' +
        '<canvas></canvas><span>' + sample.name + '</span>' +
      '</button>'
    )).join('');
    els.sampleGrid.querySelectorAll('[data-sample]').forEach(button => {
      const sample = button.dataset.sample === 'custom' ? customSample : D.PROFILE_SAMPLES[button.dataset.sample];
      drawSamplePreview(button.querySelector('canvas'), sample);
    });
  }

  function applySample(id) {
    const sample = id === 'custom' ? customSample : D.PROFILE_SAMPLES[id];
    if (!sample) return;
    state.sampleId = id;
    if (state.phase === 'clay') {
      renderSamples();
      toast(sample.name + '已记为灵感参考，揉匀泥团后可继续自由塑形');
      return;
    }
    state.profile = id === 'custom' ? makeCustomProfile() : D.expandProfile(sample);
    state.handleCount = sample.handles || 0;
    state.lumps = [];
    state.history = [];
    state.edgeSmoothed = false;
    syncRenderer();
    renderAll();
    toast(sample.name + '已作为灵感起点，接下来仍可自由捏出不对称形状');
  }

  const regionNames = { body: '器身', rim: '口沿', inside: '内壁', foot: '底足' };
  const colorByGroup = () => D.COLORS.filter(color => color.group === state.colorGroup);

  function paletteMarkup() {
    const groups = ['常用色', '马卡龙'];
    return (
      '<div class="section-title"><h3>釉色与绘画颜色</h3><span>共 ' + D.COLORS.length + ' 色</span></div>' +
      '<div class="color-tabs">' + groups.map(group => '<button class="' + (state.colorGroup === group ? 'active' : '') + '" data-action="color-group" data-group="' + group + '" type="button">' + group + '</button>').join('') + '</div>' +
      '<div class="palette-grid">' + colorByGroup().map(color => (
        '<button class="palette-swatch ' + (state.selectedColorId === color.id ? 'selected' : '') + '" data-action="select-color" data-color="' + color.id + '" data-name="' + color.name + '" style="background:' + color.hex + '" aria-label="' + color.name + '"></button>'
      )).join('') + '</div>' +
      '<div class="selected-color"><span>当前颜色</span><strong>' + selectedColor().name + ' · ' + selectedColor().hex.toUpperCase() + '</strong></div>'
    );
  }

  function finishMarkup() {
    return (
      '<div class="section-title"><h3>釉面与光泽</h3><span>真实反射层级</span></div>' +
      '<div class="finish-grid">' + D.FINISHES.map(finish => (
        '<button class="finish-chip ' + (state.finishId === finish.id ? 'selected' : '') + '" data-action="select-finish" data-finish="' + finish.id + '" data-id="' + finish.id + '" data-name="' + finish.name + '" title="' + finish.note + '" type="button"></button>'
      )).join('') + '</div>' +
      '<div class="gloss-row"><span>光泽度</span><input type="range" min="0" max="100" value="' + Math.round(state.gloss * 100) + '" data-range="gloss" aria-label="光泽度"/><b>' + Math.round(state.gloss * 100) + '%</b></div>'
    );
  }

  function textureMarkup() {
    return (
      '<div class="section-title"><h3>表面纹理</h3><span>会随 360° 曲面显示</span></div>' +
      '<div class="texture-grid">' + D.TEXTURES.map(texture => (
        '<button class="texture-chip ' + (state.texture === texture.id ? 'selected' : '') + '" data-action="select-texture" data-texture="' + texture.id + '" data-id="' + texture.id + '" data-name="' + texture.name + '" title="' + texture.note + '" type="button"></button>'
      )).join('') + '</div>'
    );
  }

  function fillPanel() {
    return (
      '<div class="section-title"><h3>全区域填色</h3><span>器身 / 口沿 / 内壁 / 底足</span></div>' +
      '<div class="region-grid">' + Object.entries(regionNames).map(([id, name]) => {
        const color = state.glaze[id];
        return '<button class="region-chip ' + (state.selectedRegion === id ? 'selected' : '') + '" data-action="select-region" data-region="' + id + '" type="button"><i style="background:' + (color ? color.hex : clay().base) + '"></i><span><strong>' + name + '</strong><small>' + (color ? color.name : '露胎') + '</small></span></button>';
      }).join('') + '</div>' +
      paletteMarkup() +
      '<div class="action-row"><button class="secondary" data-action="apply-region" type="button">施到此区域</button><button class="primary" data-action="fill-all" type="button">全器填色</button></div>'
    );
  }

  function paintPanel() {
    return (
      '<div class="intro-block"><span class="intro-num">笔</span><div><h3>器表彩绘</h3><p>笔迹附着在陶器曲面，旋转后会跟着器身一起转动。</p></div></div>' +
      paletteMarkup() +
      '<div class="brush-row"><span>笔刷</span>' +
        [5, 10, 17].map((size, index) => (
          '<button class="brush-btn ' + (state.brushSize === size ? 'selected' : '') + '" data-action="brush-size" data-size="' + size + '" type="button"><i style="width:' + (5 + index * 3) + 'px;height:' + (5 + index * 3) + 'px"></i><span>' + ['细', '中', '粗'][index] + '</span></button>'
        )).join('') +
      '</div>' +
      '<div class="inline-row"><button class="secondary" data-action="clear-paint" type="button">清除绘画</button></div>'
    );
  }

  function freePanel() {
    return (
      '<div class="intro-block"><span class="intro-num">画</span><div><h3>自由画布</h3><p>整张画布都能画。笔迹不吸附器身，也不会因为旋转陶器而卷到背面。</p></div></div>' +
      paletteMarkup() +
      '<div class="brush-row"><span>笔刷</span>' +
        [5, 10, 17].map((size, index) => (
          '<button class="brush-btn ' + (state.brushSize === size ? 'selected' : '') + '" data-action="brush-size" data-size="' + size + '" type="button"><i style="width:' + (5 + index * 3) + 'px;height:' + (5 + index * 3) + 'px"></i><span>' + ['细', '中', '粗'][index] + '</span></button>'
        )).join('') +
      '</div>' +
      '<div class="note-card"><i>画</i><div><strong>不跟随器身轮廓</strong><p>自由画布用于画面构图、背景涂绘和完整草图；如需上陶，请切换到“器表彩绘”。</p></div></div>' +
      '<div class="inline-row"><button class="secondary" data-action="clear-free" type="button">清空自由画布</button></div>'
    );
  }

  function stampColorMarkup() {
    const colors = D.COLORS.slice(0, 12);
    return (
      '<div class="section-title"><h3>纹样颜色</h3><span>独立于釉色</span></div>' +
      '<div class="palette-grid stamp-palette">' + colors.map(color => (
        '<button class="palette-swatch ' + (state.stampColorId === color.id ? 'selected' : '') + '" data-action="select-stamp-color" data-color="' + color.id + '" data-name="' + color.name + '" style="background:' + color.hex + '" aria-label="' + color.name + '"></button>'
      )).join('') + '</div>' +
      '<div class="selected-color"><span>纹样颜色</span><strong>' + selectedStampColor().name + ' · ' + selectedStampColor().hex.toUpperCase() + '</strong></div>'
    );
  }

  function stampsMarkup() {
    const stamps = D.STAMPS.filter(stamp => stamp.category === state.stampCategory);
    return (
      '<div class="intro-block"><span class="intro-num">纹</span><div><h3>贴花与纹样</h3><p>每个纹样都显示为可识别的图形缩略图，选中后可单独更换纹样颜色。</p></div></div>' +
      '<div class="stamp-categories">' + D.STAMP_CATEGORIES.map(category => (
        '<button class="' + (state.stampCategory === category ? 'active' : '') + '" data-action="stamp-category" data-category="' + category + '" type="button">' + category + '</button>'
      )).join('') + '</div>' +
      '<div class="stamp-grid">' + stamps.map(stamp => (
        '<button class="stamp-card ' + (state.stampId === stamp.id ? 'selected' : '') + '" data-action="select-stamp" data-stamp="' + stamp.id + '" type="button"><canvas data-stamp-preview="' + stamp.id + '"></canvas><span>' + stamp.name + '</span></button>'
      )).join('') + '</div>' +
      stampColorMarkup() +
      '<div class="gloss-row"><span>贴花大小</span><input type="range" min="45" max="130" value="' + state.stampSize + '" data-range="stamp-size" aria-label="贴花大小"/><b>' + state.stampSize + '</b></div>' +
      '<div class="action-row"><button class="secondary" data-action="stamp-one" type="button">点击陶器贴图</button><button class="primary" data-action="stamp-around" type="button">环绕器身一圈</button></div>'
    );
  }

  function decoratePanel() {
    const mode = state.decorMode;
    const content = mode === 'fill' ? fillPanel() : mode === 'paint' ? paintPanel() : mode === 'free' ? freePanel() : stampsMarkup();
    return (
      '<div class="mode-tabs decorate-tabs"><button class="' + (mode === 'fill' ? 'active' : '') + '" data-action="decor-mode" data-mode="fill" type="button">施釉</button><button class="' + (mode === 'paint' ? 'active' : '') + '" data-action="decor-mode" data-mode="paint" type="button">器表彩绘</button><button class="' + (mode === 'free' ? 'active' : '') + '" data-action="decor-mode" data-mode="free" type="button">自由画布</button><button class="' + (mode === 'stamp' ? 'active' : '') + '" data-action="decor-mode" data-mode="stamp" type="button">纹样</button></div>' +
      content +
      finishMarkup() +
      textureMarkup() +
      '<div class="action-row"><button class="secondary" data-action="random-decor" type="button">随机配色</button><button class="primary" data-action="go-fire" type="button" ' + (state.hasArtwork || Object.values(state.glaze).some(Boolean) ? '' : 'disabled') + '>送入本烧 →</button></div>'
    );
  }

  function panelMarkup() {
    const currentClay = clay();
    if (state.phase === 'clay') {
      return (
        '<div class="intro-block"><span class="intro-num">01</span><div><h3>先让泥料听话</h3><p>打开转盘电源，用双手同时揉压。摄像头寻找两只手，不提供单手切换模式。</p></div></div>' +
        '<div class="status-grid"><div><span>泥料</span><strong>' + currentClay.name + '</strong></div><div><span>泥团温度</span><strong>室温</strong></div><div><span>塑形方式</span><strong>双手协同</strong></div><div><span>气泡状态</span><strong id="bubbleState">' + (state.knead >= 100 ? '已排净' : '正在排出') + '</strong></div></div>' +
        '<div class="progress-block"><div class="progress-head"><span>练泥进度</span><strong id="panelKneadText">' + Math.round(state.knead) + '%</strong></div><div class="progress-track"><span id="panelKneadBar" style="width:' + state.knead + '%"></span></div></div>' +
        '<div class="note-card"><i>手</i><div><strong>两只手都要出现</strong><p>手心朝向镜头，双手一起靠近、张开或压住泥团。只识别到一只手时会提示继续寻找。</p></div></div>' +
        '<div class="action-row"><button class="secondary" data-action="quick-knead" type="button">快速揉匀</button><button class="primary" data-action="go-sculpt" type="button" ' + (state.knead >= 100 ? '' : 'disabled') + '>进入双手塑形 →</button></div>'
      );
    }
    if (state.phase === 'sculpt') {
      return (
        '<div class="intro-block"><span class="intro-num">02</span><div><h3>从自由器型开始</h3><p>不必先选参考图。直接拖动器身推、压、捏；需要时再从左侧灵感架借一个起点。</p></div></div>' +
        '<div class="note-card"><i>360</i><div><strong>任意轮廓，任意起伏</strong><p>上下拖动可改变俯视角，左右拖动可环绕观察。口沿、内壁与器身会保持同一个三维关系。</p></div></div>' +
        '<div class="section-title"><h3>口沿塑形</h3><span>单独调整口径与唇边</span></div>' +
        '<div class="slider-stack">' +
          '<label class="slider-row"><header><span>口径大小<small>收口 / 敞口</small></span><output>' + Math.round(state.mouth.diameter * 100) + '%</output></header><input type="range" min="65" max="140" value="' + Math.round(state.mouth.diameter * 100) + '" data-range="mouth-size" aria-label="口径大小"/></label>' +
          '<label class="slider-row"><header><span>口沿厚度<small>薄唇 / 厚唇</small></span><output>' + Math.round(state.mouth.rim * 100) + '%</output></header><input type="range" min="6" max="28" value="' + Math.round(state.mouth.rim * 100) + '" data-range="mouth-rim" aria-label="口沿厚度"/></label>' +
          '<label class="slider-row"><header><span>内壁深度<small>浅口 / 深腔</small></span><output>' + Math.round(state.mouth.depth * 100) + '%</output></header><input type="range" min="15" max="80" value="' + Math.round(state.mouth.depth * 100) + '" data-range="mouth-depth" aria-label="内壁深度"/></label>' +
        '</div>' +
        '<div class="color-tabs mouth-tabs"><button class="' + (state.mouth.style === 'round' ? 'active' : '') + '" data-action="mouth-style" data-style="round" type="button">圆口</button><button class="' + (state.mouth.style === 'flare' ? 'active' : '') + '" data-action="mouth-style" data-style="flare" type="button">外撇口</button><button class="' + (state.mouth.style === 'inward' ? 'active' : '') + '" data-action="mouth-style" data-style="inward" type="button">内收口</button></div>' +
        '<div class="section-title"><h3>修边力度</h3><span>保留手作感</span></div>' +
        '<div class="slider-row"><header><span>平滑强度<small>轻柔 / 标准 / 精细</small></span><output>' + state.smoothStrength + '</output></header><input type="range" min="1" max="3" value="' + state.smoothStrength + '" data-range="smooth-strength" aria-label="修边力度"/></div>' +
        '<div class="action-row"><button class="secondary" data-action="smooth-edge" type="button">✦ 一键修饰边缘</button><button class="primary" data-action="go-dry" type="button" ' + (state.edgeSmoothed ? '' : 'disabled') + '>进入修边干燥 →</button></div>' +
        '<div class="note-card"><i>' + (state.edgeSmoothed ? '✓' : '!') + '</i><div><strong>' + (state.edgeSmoothed ? '边缘已经修饰' : '先修饰粗糙边缘') + '</strong><p>修边会顺滑口沿、锯齿和毛刺，但保留轻微手捏起伏。修边完成后仍可继续塑形。</p></div></div>'
      );
    }
    if (state.phase === 'dry') {
      return (
        '<div class="intro-block"><span class="intro-num">03</span><div><h3>让坯体慢慢定型</h3><p>自然干燥排走水分。干燥完成后才能进入素烧，否则容易开裂。</p></div></div>' +
        '<div class="progress-block"><div class="progress-head"><span>干燥进度</span><strong id="dryText">' + Math.round(state.dryProgress) + '%</strong></div><div class="progress-track"><span id="dryBar" style="width:' + state.dryProgress + '%"></span></div></div>' +
        '<div class="status-grid"><div><span>当前阶段</span><strong>' + (state.dryProgress >= 100 ? '已完成' : '阴干中') + '</strong></div><div><span>器型</span><strong>已锁定</strong></div></div>' +
        '<div class="note-card"><i>风</i><div><strong>避免快速烘干</strong><p>干燥过程中不能修改器型。请等待进度达到 100%。</p></div></div>' +
        '<div class="action-row"><button class="secondary" data-action="smooth-edge" type="button">再次修饰边缘</button>' + (state.dryProgress >= 100 ? '<button class="primary" data-action="go-bisque" type="button">进入素烧 →</button>' : '<button class="primary" data-action="begin-dry" type="button">开始自然干燥</button>') + '</div>'
      );
    }
    if (state.phase === 'bisque') {
      return (
        '<div class="intro-block"><span class="intro-num">04</span><div><h3>低温烧成</h3><p>素烧让泥坯变得坚固，也为施釉和绘画打好基础。</p></div></div>' +
        '<div class="status-grid"><div><span>窑温</span><strong>840°C</strong></div><div><span>时长</span><strong>约 4 秒</strong></div><div><span>器型</span><strong>已固定</strong></div><div><span>颜色</span><strong>' + currentClay.name + '</strong></div></div>' +
        '<div class="note-card"><i>火</i><div><strong>素烧不可逆</strong><p>烧制后返回上一步也不能再改变轮廓。确认器型与修边效果后开始。</p></div></div>' +
        '<div class="action-row"><button class="secondary" data-action="back-dry" type="button">返回检查</button><button class="primary" data-action="start-bisque" type="button">开始素烧 →</button></div>'
      );
    }
    if (state.phase === 'decorate') return decoratePanel();
    const effects = fireEffects();
    return (
      '<div class="intro-block"><span class="intro-num">06</span><div><h3>最后一道火</h3><p>温度与窑内气氛会改变釉色、光泽、流动和开片。选择你想要的最终效果。</p></div></div>' +
      '<div class="section-title"><h3>烧成温度</h3><span>不同温度产生不同釉面</span></div>' +
      '<div class="temp-grid">' +
        '<button class="temp-card ' + (state.temperature === 900 ? 'selected' : '') + '" data-action="temperature" data-temp="900" type="button"><strong>900°C</strong><small>低温</small><em>哑光、颜色稳定、细开片</em></button>' +
        '<button class="temp-card ' + (state.temperature === 1100 ? 'selected' : '') + '" data-action="temperature" data-temp="1100" type="button"><strong>1100°C</strong><small>中温</small><em>柔光、釉色柔和</em></button>' +
        '<button class="temp-card ' + (state.temperature === 1240 ? 'selected' : '') + '" data-action="temperature" data-temp="1240" type="button"><strong>1240°C</strong><small>高温</small><em>亮釉、颜色加深、细火痕</em></button>' +
        '<button class="temp-card ' + (state.temperature === 1280 ? 'selected' : '') + '" data-action="temperature" data-temp="1280" type="button"><strong>1280°C</strong><small>高温流动</small><em>流釉、滴釉、金属光泽</em></button>' +
      '</div>' +
      '<div class="section-title"><h3>窑内气氛</h3><span>影响颜色与火痕</span></div>' +
      '<div class="atmosphere-row"><button class="' + (state.atmosphere === 'oxidation' ? 'selected' : '') + '" data-action="atmosphere" data-atmosphere="oxidation" type="button">氧化烧 · 清透</button><button class="' + (state.atmosphere === 'reduction' ? 'selected' : '') + '" data-action="atmosphere" data-atmosphere="reduction" type="button">还原烧 · 深沉</button></div>' +
      '<div class="firing-summary"><div><span>器型</span><strong>' + pieceName() + '</strong></div><div><span>温度</span><strong>' + state.temperature + '°C</strong></div><div><span>气氛</span><strong>' + (state.atmosphere === 'oxidation' ? '氧化' : '还原') + '</strong></div></div>' +
      '<div class="effect-list">' + effects.map(effect => '<span>' + effect + '</span>').join('') + '</div>' +
      '<div class="action-row"><button class="secondary" data-action="back-decorate" type="button">返回调整</button><button class="primary" data-action="start-fire" type="button">开始本烧 →</button></div>'
    );
  }

  function fireEffects() {
    if (state.temperature === 900) return ['哑光', '细开片', '颜色变化小'];
    if (state.temperature === 1100) return ['柔光', '釉色温润', '轻微流动'];
    if (state.temperature === 1280) return ['流釉', '滴釉', '强火痕'];
    return ['高亮', '颜色加深', '柔和火痕'];
  }

  function renderPanel() {
    els.panelContent.innerHTML = panelMarkup();
    if (state.phase === 'decorate' && state.decorMode === 'stamp') {
      els.panelContent.querySelectorAll('[data-stamp-preview]').forEach(canvas => {
        const stamp = D.STAMPS.find(s => s.id === canvas.dataset.stampPreview);
        if (!stamp) return;
        canvas.width = 74;
        canvas.height = 74;
        stamp.draw(canvas.getContext('2d'), 74, state.stampColor);
      });
    }
  }

  function setPhase(phase) {
    const previousPhase = state.phase;
    state.phase = phase;
    state.tool = phase === 'decorate' ? state.tool : 'sculpt';
    if (phase === 'sculpt') {
      const sample = state.sampleId === 'custom' ? customSample : (D.PROFILE_SAMPLES[state.sampleId] || customSample);
      if (previousPhase === 'clay' || !state.profile || state.profile.length === 0) {
        state.profile = state.sampleId === 'custom' ? makeCustomProfile() : D.expandProfile(sample);
        state.lumps = [];
      }
      state.handleCount = sample.handles || 0;
    }
    renderAll();
    toast(phase === 'sculpt' ? '双手塑形已就绪，两只手会同时改变坯体' : phaseMeta()[1]);
  }

  function quickKnead() {
    if (!state.wheelOn) {
      toast('请先打开转盘电源');
      return;
    }
    state.knead = 100;
    state.rawProfile = makeRawProfile().map((r, i) => r * (1 + Math.sin(i * 1.7) * .035));
    renderAll();
    toast('泥团已经揉匀，可以开始双手塑形');
  }

  function updateKneadUi() {
    const bar = $('panelKneadBar'), text = $('panelKneadText'), bubble = $('bubbleState');
    if (bar) bar.style.width = state.knead + '%';
    if (text) text.textContent = Math.round(state.knead) + '%';
    if (bubble) bubble.textContent = state.knead >= 100 ? '已排净' : '正在排出';
  }

  function addGestureLump(v, angle, strength, angleWidth, vWidth) {
    if (Math.abs(strength) < .0015) return;
    let nearest = null;
    for (let i = 0; i < state.lumps.length; i += 1) {
      const lump = state.lumps[i];
      const da = Math.abs(Math.atan2(Math.sin(lump.angle - angle), Math.cos(lump.angle - angle)));
      if (da < .32 && Math.abs(lump.v - v) < .12) { nearest = lump; break; }
    }
    if (nearest) {
      nearest.strength = clamp(nearest.strength * .78 + strength * .25, -.13, .13);
      nearest.v = nearest.v * .8 + v * .2;
      nearest.angle = nearest.angle * .8 + angle * .2;
    } else {
      state.lumps.push({ v, angle, strength: clamp(strength, -.13, .13), angleWidth: angleWidth || .58, vWidth: vWidth || .15 });
    }
    if (state.lumps.length > 26) state.lumps.shift();
  }

  function onHandUpdate(data) {
    const now = performance.now();
    const deltaTime = lastHandAt ? Math.min(250, now - lastHandAt) : 100;
    if (!state.wheelOn) {
      els.handMessage.textContent = '双手已识别，但转盘电源关闭。打开电源后才会改变泥团。';
      return;
    }
    if (state.phase !== 'clay' && state.phase !== 'sculpt') return;
    if (now - handDeformCooldown < 90) return;
    handDeformCooldown = now;
    const separationDelta = lastHandData ? data.separation - lastHandData.separation : 0;

    if (state.phase === 'clay') {
      state.knead = clamp(state.knead + deltaTime * .012 + Math.abs(separationDelta) * 16, 0, 100);
      data.hands.forEach((hand, index) => {
        const v = clamp(1 - hand.y, .08, .92);
        const angle = renderer.screenAngle(hand.x);
        addGestureLump(v, angle, (hand.openness - .5) * .055, .5, .17);
        const center = clamp(Math.round(v * (state.rawProfile.length - 1)), 1, state.rawProfile.length - 2);
        for (let i = 0; i < state.rawProfile.length; i += 1) {
          const d = Math.abs(i - center) / (state.rawProfile.length * .2);
          state.rawProfile[i] = clamp(state.rawProfile[i] + (hand.openness - .5) * .0035 * Math.exp(-d * d), .18, 1.1);
        }
      });
      updateKneadUi();
      syncRenderer();
      if (state.knead >= 100) {
        const action = els.panelContent.querySelector('[data-action="go-sculpt"]');
        if (action && action.disabled) renderPanel();
      }
    } else {
      if (now - lastHistoryAt > 1400) {
        pushHistory();
        lastHistoryAt = now;
      }
      state.edgeSmoothed = false;
      data.hands.forEach(hand => {
        const v = clamp(1 - hand.y, .08, .94);
        const angle = renderer.screenAngle(hand.x);
        const strength = (hand.openness - .5) * .16 + separationDelta * .42;
        addGestureLump(v, angle, strength, .56, .14);
        const center = clamp(Math.round(v * (state.profile.length - 1)), 1, state.profile.length - 2);
        for (let i = 0; i < state.profile.length; i += 1) {
          const d = Math.abs(i - center) / (state.profile.length * .19);
          state.profile[i] = clamp(state.profile[i] + strength * .055 * Math.exp(-d * d), .14, 1.14);
        }
      });
      syncRenderer();
    }
    lastHandAt = now;
    lastHandData = {
      separation: data.separation,
      openness: data.averageOpenness,
      hands: data.hands.map(hand => ({ openness: hand.openness }))
    };
  }

  function createHandTracker() {
    handTracker = new window.DualHandTracker({
      video: els.cameraVideo,
      overlay: els.handOverlay,
      onUpdate: onHandUpdate,
      onStatus: (message, kind) => {
        els.handMessage.textContent = message;
        const connected = kind === 'active' || kind === 'opening' || kind === 'searching';
        els.cameraBadge.textContent = kind === 'active' ? '双手同步' : kind === 'searching' ? '寻找双手' : kind === 'opening' ? '已连接' : kind === 'requesting' ? '连接中' : '未开启';
        els.cameraBadge.classList.toggle('active', connected);
        els.topHandStatus.classList.toggle('active', connected);
        els.topHandStatus.classList.toggle('searching', kind === 'searching' || kind === 'requesting');
        els.topHandStatus.querySelector('span').textContent = kind === 'active' ? '双手同步中' : kind === 'searching' ? '摄像头已开 · 寻找双手' : kind === 'opening' ? '摄像头已连接' : message;
      }
    });
  }

  async function toggleCamera() {
    if (!handTracker) createHandTracker();
    if (state.cameraOn) {
      handTracker.stop();
      state.cameraOn = false;
      els.cameraBtn.textContent = '开启摄像头';
      els.cameraPlaceholder.hidden = false;
      return;
    }
    els.cameraBtn.disabled = true;
    els.cameraBtn.textContent = '正在连接…';
    els.topHandStatus.classList.add('searching');
    els.topHandStatus.querySelector('span').textContent = '正在请求摄像头权限';
    const started = await handTracker.start(els.cameraSelect.value || undefined);
    state.cameraOn = started;
    els.cameraBtn.disabled = false;
    if (started) {
      els.cameraBtn.textContent = '关闭摄像头';
      els.cameraPlaceholder.hidden = true;
      toast(state.wheelOn ? '摄像头已开启，双手会同时改变坯体' : '摄像头已开启，但转盘仍关闭；打开转盘电源后才能塑形');
    } else {
      els.cameraBtn.textContent = '重试摄像头';
      els.cameraPlaceholder.hidden = false;
    }
    refreshCameraDevices();
  }

  async function refreshCameraDevices() {
    if (!handTracker) createHandTracker();
    const devices = await handTracker.getDevices();
    const selected = els.cameraSelect.value;
    els.cameraSelect.innerHTML = '<option value="">默认摄像头</option>' + devices.map((device, index) => (
      '<option value="' + device.deviceId + '">' + (device.label || '摄像头 ' + (index + 1)) + '</option>'
    )).join('');
    if (selected && devices.some(device => device.deviceId === selected)) els.cameraSelect.value = selected;
  }

  function toggleDemoHands() {
    if (state.demoOn) {
      clearInterval(demoInterval);
      demoInterval = null;
      state.demoOn = false;
      els.demoHandsBtn.textContent = '双手演示';
      els.cameraPlaceholder.hidden = false;
      els.cameraBadge.textContent = '关闭';
      els.cameraBadge.classList.remove('active');
      els.topHandStatus.classList.remove('active', 'searching');
      els.topHandStatus.querySelector('span').textContent = '摄像头未开启';
      els.handMessage.textContent = '把双手一起放进画面，掌心朝向镜头。';
      return;
    }
    if (!state.wheelOn) {
      toast('请先打开转盘电源');
      return;
    }
    if (!handTracker) createHandTracker();
    state.demoOn = true;
    els.demoHandsBtn.textContent = '停止演示';
    els.cameraPlaceholder.hidden = true;
    demoInterval = setInterval(() => handTracker.demoUpdate(), 90);
  }

  function smoothEdges() {
    if (state.phase !== 'sculpt' && state.phase !== 'dry') return;
    pushHistory();
    const passes = state.smoothStrength;
    let profile = state.profile.slice();
    for (let pass = 0; pass < passes; pass += 1) {
      profile = profile.map((r, i) => {
        if (i === 0 || i === profile.length - 1) return r;
        return profile[i - 1] * .25 + r * .5 + profile[i + 1] * .25;
      });
      profile[0] = profile[0] * .28 + profile[1] * .72;
      profile[profile.length - 1] = profile[profile.length - 1] * .28 + profile[profile.length - 2] * .72;
    }
    const edgeBlend = (r, index) => {
      const distance = Math.min(index, profile.length - 1 - index) / (profile.length * .18);
      return r + (state.profile[index] - r) * clamp(distance, 0, 1) * .35;
    };
    state.profile = profile.map(edgeBlend);
    const rand = Math.random;
    state.lumps = state.lumps.map(lump => ({ ...lump, strength: lump.strength * .55 + (rand() - .5) * .006 })).filter(lump => Math.abs(lump.strength) > .003);
    state.edgeSmoothed = true;
    syncRenderer();
    renderPanel();
    toast('边缘已顺滑：去除了毛刺与锯齿，同时保留轻微手作起伏');
  }

  function applyGlaze(region, color) {
    state.glaze[region] = color;
    state.hasArtwork = true;
    syncRenderer();
    renderPanel();
    toast((color ? color.name : '露胎') + '已应用到' + regionNames[region]);
  }

  function fillAll() {
    const color = selectedColor();
    Object.keys(state.glaze).forEach(region => { state.glaze[region] = color; });
    state.hasArtwork = true;
    syncRenderer();
    renderPanel();
    toast('全器已填色：' + color.name);
  }

  function clearPaint() {
    renderer.clearTexture();
    state.surfaceArtwork = false;
    state.hasArtwork = state.freeArtwork || Object.values(state.glaze).some(Boolean);
    renderPanel();
    toast('器表彩绘已清除');
  }

  function clearFreeCanvas() {
    renderer.clearFreeCanvas();
    state.freeArtwork = false;
    state.hasArtwork = state.surfaceArtwork || Object.values(state.glaze).some(Boolean);
    renderPanel();
    toast('自由画布已清空');
  }

  function stampAround() {
    const stamp = D.STAMPS.find(s => s.id === state.stampId);
    if (!stamp) return;
    for (let i = 0; i < 4; i += 1) {
      renderer.stampUv(i / 4 + .06, .5, stamp.draw, state.stampColor, Math.max(150, state.stampSize * 1.35));
    }
    state.surfaceArtwork = true;
    state.hasArtwork = true;
    renderPanel();
    toast(stamp.name + '已环绕器身一圈');
  }

  function randomDecor() {
    const colors = D.COLORS.filter(color => color.group === '马卡龙');
    const random = colors[Math.floor(Math.random() * colors.length)];
    state.selectedColorId = random.id;
    const regions = Object.keys(state.glaze);
    state.glaze.body = random;
    state.glaze.rim = Math.random() > .42 ? D.COLORS[Math.floor(Math.random() * D.COLORS.length)] : null;
    state.glaze.inside = Math.random() > .45 ? colors[Math.floor(Math.random() * colors.length)] : null;
    state.glaze.foot = Math.random() > .72 ? colors[Math.floor(Math.random() * colors.length)] : null;
    state.finishId = D.FINISHES[Math.floor(Math.random() * D.FINISHES.length)].id;
    state.texture = D.TEXTURES[Math.floor(Math.random() * D.TEXTURES.length)].id;
    state.gloss = .34 + Math.random() * .52;
    state.hasArtwork = true;
    syncRenderer();
    renderPanel();
    toast('随机釉色、光泽和纹理已经组合完成');
  }

  function beginDry() {
    if (state.dryProgress >= 100 || dryTimer) return;
    state.dryProgress = Math.max(1, state.dryProgress);
    dryTimer = setInterval(() => {
      state.dryProgress = clamp(state.dryProgress + Math.random() * 1.9 + .8, 0, 100);
      const bar = $('dryBar'), text = $('dryText');
      if (bar) bar.style.width = state.dryProgress + '%';
      if (text) text.textContent = Math.round(state.dryProgress) + '%';
      if (state.dryProgress >= 100) {
        clearInterval(dryTimer);
        dryTimer = null;
        renderPanel();
        toast('自然干燥完成，可以进入素烧');
      }
    }, 90);
  }

  function snapshotImage() {
    return renderer.canvas.toDataURL('image/png');
  }

  function openKiln(mode) {
    if (firingActive) return;
    firingActive = true;
    els.modal.hidden = false;
    document.body.classList.add('modal-open');
    els.kilnView.hidden = false;
    els.resultView.hidden = true;
    els.closeModalBtn.disabled = true;
    els.kilnProgress.style.width = '0%';
    els.kilnTemp.textContent = '20';
    const isBisque = mode === 'bisque';
    const target = isBisque ? 840 : state.temperature;
    const duration = isBisque ? 3800 : 5200;
    els.kilnKicker.textContent = isBisque ? 'BISQUE FIRING · 840°C' : 'GLAZE FIRING · ' + target + '°C';
    els.kilnTitle.textContent = isBisque ? '素烧定型' : '温控本烧';
    els.kilnStatus.textContent = '窑温正在缓慢升高';
    els.kilnPot.innerHTML = '<img src="' + snapshotImage() + '" alt="" style="width:100%;height:100%;object-fit:contain"/>';
    const start = performance.now();
    firingTimer = setInterval(() => {
      const progress = clamp((performance.now() - start) / duration, 0, 1);
      const eased = Math.pow(progress, .72);
      const temp = Math.round(20 + (target - 20) * eased);
      els.kilnTemp.textContent = temp;
      els.kilnProgress.style.width = (progress * 100).toFixed(1) + '%';
      if (progress > .2) els.kilnStatus.textContent = isBisque ? '泥坯中的水分正在排出，胎体逐渐变硬' : '釉料开始软化，颜色正在发生变化';
      if (progress > .55) els.kilnStatus.textContent = isBisque ? '坯体结构稳定，窑温继续上升' : '釉层熔融，形成玻璃质表面与细开片';
      if (progress > .82) els.kilnStatus.textContent = isBisque ? '保温完成，正在自然降温' : '釉色逐渐稳定，火痕留在器身';
      if (progress >= 1) {
        clearInterval(firingTimer);
        firingTimer = null;
        finishFiring(mode);
      }
    }, 65);
  }

  function finishFiring(mode) {
    if (mode === 'bisque') {
      state.bisqueDone = true;
      state.phase = 'decorate';
      els.kilnTemp.textContent = '840';
      els.kilnProgress.style.width = '100%';
      els.kilnStatus.textContent = '素烧完成，可以开始上釉与彩绘';
      renderAll();
      firingActive = false;
      els.closeModalBtn.disabled = false;
      firingTimeout = setTimeout(() => {
        closeModal();
        toast('素烧完成，接下来可以填色、绘画或贴花');
      }, 850);
      return;
    }
    state.finalized = true;
    state.firedFinishId = state.finishId;
    if (state.temperature === 900) state.firedFinishId = ['matte', 'satin'].includes(state.finishId) ? state.finishId : 'matte';
    if (state.temperature === 1100 && ['matte', 'gloss', 'high'].includes(state.finishId)) state.firedFinishId = 'satin';
    if (state.temperature === 1280) state.firedFinishId = 'drip';
    if (state.temperature === 1240 && state.finishId === 'matte') state.firedFinishId = 'soft';
    state.gloss = clamp(state.gloss + (state.temperature >= 1240 ? .12 : -.06), .08, 1);
    els.kilnTemp.textContent = String(state.temperature);
    els.kilnProgress.style.width = '100%';
    els.kilnStatus.textContent = '本烧完成，釉色与火痕已经固定';
    renderAll();
    firingActive = false;
    els.closeModalBtn.disabled = false;
    firingTimeout = setTimeout(showResult, 650);
  }

  function showResult() {
    const applied = Object.values(state.glaze).filter(Boolean);
    const glazeNames = [...new Set(applied.map(color => color.name))].join('、') || '无釉露胎';
    const finish = findFinish(state.firedFinishId);
    els.kilnView.hidden = true;
    els.resultView.hidden = false;
    els.resultCopy.textContent = state.temperature + '°C ' + (state.atmosphere === 'oxidation' ? '氧化烧' : '还原烧') + '，形成了' + finish.name + '釉面，并且可以从 360° 任意角度欣赏。';
    els.resultArt.innerHTML = '<img style="width:100%;height:100%;object-fit:contain" src="' + snapshotImage() + '" alt="本烧完成的陶器"/>';
    els.resultSpecs.innerHTML = [
      pieceName(),
      state.temperature + '°C',
      state.atmosphere === 'oxidation' ? '氧化烧' : '还原烧',
      finish.name,
      findTexture(state.texture).name,
      glazeNames
    ].map(text => '<span>' + text + '</span>').join('');
  }

  function closeModal() {
    if (firingActive) return;
    if (firingTimeout) clearTimeout(firingTimeout);
    firingTimeout = null;
    els.modal.hidden = true;
    document.body.classList.remove('modal-open');
    els.kilnView.hidden = false;
    els.resultView.hidden = true;
  }

  function downloadDataUrl(dataUrl, fileName) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function saveImage() {
    if (!state.finalized) {
      toast('完成本烧后才能保存成品');
      return;
    }
    const stamp = new Date();
    const pad = value => String(value).padStart(2, '0');
    const name = '泥火之间-' + D.PROFILE_SAMPLES[state.sampleId].name + '-' + stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) + '-' + pad(stamp.getHours()) + pad(stamp.getMinutes()) + '.png';
    downloadDataUrl(renderer.exportPng(), name);
    toast('成品 PNG 已保存，请到浏览器的下载文件夹查看');
  }

  function stopAuxiliaryTimers() {
    if (dryTimer) clearInterval(dryTimer);
    dryTimer = null;
    if (demoInterval) clearInterval(demoInterval);
    demoInterval = null;
    if (firingTimer) clearInterval(firingTimer);
    firingTimer = null;
    if (firingTimeout) clearTimeout(firingTimeout);
    firingTimeout = null;
    firingActive = false;
  }

  function resetGame(force) {
    if (!force && !window.confirm('重新开始会清空当前泥料、坯体、釉色和贴花，确定继续吗？')) return;
    stopAuxiliaryTimers();
    if (handTracker) handTracker.stop();
    handTracker = null;
    state = initialState();
    renderer.clearTexture();
    renderer.clearFreeCanvas();
    renderer.setView(-.36, .34);
    lastHandData = null;
    lastHandAt = 0;
    els.cameraBtn.textContent = '开启摄像头';
    els.cameraPlaceholder.hidden = false;
    els.handMessage.textContent = '把双手一起放进画面，掌心朝向镜头。';
    els.cameraBadge.textContent = '关闭';
    els.cameraBadge.classList.remove('active');
    els.topHandStatus.classList.remove('active', 'searching');
    els.topHandStatus.querySelector('span').textContent = '摄像头未开启';
    els.modal.hidden = true;
    document.body.classList.remove('modal-open');
    renderAll();
    toast('新的泥料已经准备好');
  }

  function handlePanelAction(action, button) {
    if (action === 'quick-knead') quickKnead();
    else if (action === 'go-sculpt' && state.knead >= 100) setPhase('sculpt');
    else if (action === 'mouth-style') { state.mouth.style = button.dataset.style; syncRenderer(); renderPanel(); }
    else if (action === 'smooth-edge') smoothEdges();
    else if (action === 'go-dry' && state.edgeSmoothed) setPhase('dry');
    else if (action === 'begin-dry') beginDry();
    else if (action === 'go-bisque' && state.dryProgress >= 100) setPhase('bisque');
    else if (action === 'back-dry') setPhase('dry');
    else if (action === 'start-bisque') openKiln('bisque');
    else if (action === 'decor-mode') {
      state.decorMode = button.dataset.mode;
      renderAll();
    }
    else if (action === 'color-group') { state.colorGroup = button.dataset.group; renderPanel(); }
    else if (action === 'select-color') { state.selectedColorId = button.dataset.color; renderPanel(); }
    else if (action === 'select-stamp-color') {
      state.stampColorId = button.dataset.color;
      state.stampColor = selectedStampColor().hex;
      renderPanel();
    }
    else if (action === 'select-region') { state.selectedRegion = button.dataset.region; renderPanel(); }
    else if (action === 'apply-region') applyGlaze(state.selectedRegion, selectedColor());
    else if (action === 'fill-all') fillAll();
    else if (action === 'select-finish') { state.finishId = button.dataset.finish; syncRenderer(); renderPanel(); }
    else if (action === 'select-texture') { state.texture = button.dataset.texture; syncRenderer(); renderPanel(); }
    else if (action === 'brush-size') { state.brushSize = Number(button.dataset.size); renderPanel(); }
    else if (action === 'clear-paint') clearPaint();
    else if (action === 'clear-free') clearFreeCanvas();
    else if (action === 'stamp-category') { state.stampCategory = button.dataset.category; renderPanel(); }
    else if (action === 'select-stamp') { state.stampId = button.dataset.stamp; renderPanel(); }
    else if (action === 'stamp-one') { state.tool = 'sculpt'; toast('现在点击陶器表面放置贴花'); }
    else if (action === 'stamp-around') stampAround();
    else if (action === 'random-decor') randomDecor();
    else if (action === 'go-fire') setPhase('fire');
    else if (action === 'temperature') { state.temperature = Number(button.dataset.temp); renderAll(); }
    else if (action === 'atmosphere') { state.atmosphere = button.dataset.atmosphere; renderPanel(); }
    else if (action === 'back-decorate') setPhase('decorate');
    else if (action === 'start-fire') openKiln('final');
  }

  function handlePanelClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    handlePanelAction(button.dataset.action, button);
  }

  function handlePanelInput(event) {
    const range = event.target.closest('[data-range]');
    if (!range) return;
    if (range.dataset.range === 'gloss') {
      state.gloss = Number(range.value) / 100;
      const output = range.parentElement.querySelector('b');
      if (output) output.textContent = range.value + '%';
      syncRenderer();
    } else if (range.dataset.range === 'stamp-size') {
      state.stampSize = Number(range.value);
      const output = range.parentElement.querySelector('b');
      if (output) output.textContent = range.value;
    } else if (range.dataset.range === 'smooth-strength') {
      state.smoothStrength = Number(range.value);
      const output = range.parentElement.querySelector('output');
      if (output) output.textContent = range.value;
    } else if (range.dataset.range === 'mouth-size') {
      state.mouth.diameter = Number(range.value) / 100;
      const output = range.parentElement.querySelector('output');
      if (output) output.textContent = range.value + '%';
      syncRenderer();
    } else if (range.dataset.range === 'mouth-rim') {
      state.mouth.rim = Number(range.value) / 100;
      const output = range.parentElement.querySelector('output');
      if (output) output.textContent = range.value + '%';
      syncRenderer();
    } else if (range.dataset.range === 'mouth-depth') {
      state.mouth.depth = Number(range.value) / 100;
      const output = range.parentElement.querySelector('output');
      if (output) output.textContent = range.value + '%';
      syncRenderer();
    }
  }

  function deformLocal(v, angle, delta) {
    const profile = state.phase === 'clay' ? state.rawProfile : state.profile;
    const center = clamp(Math.round(v * (profile.length - 1)), 1, profile.length - 2);
    for (let i = 0; i < profile.length; i += 1) {
      const distance = Math.abs(i - center) / (profile.length * .15);
      profile[i] = clamp(profile[i] + delta * Math.exp(-distance * distance), .13, 1.16);
    }
    addGestureLump(v, angle, delta * 2.8, .5, .14);
    if (state.phase !== 'clay') state.edgeSmoothed = false;
    syncRenderer();
  }

  function canvasCoords(event) {
    return { x: event.clientX, y: event.clientY };
  }

  function potteryPointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    if ((state.phase === 'clay' || state.phase === 'sculpt') && !state.wheelOn) {
      toast('请先打开转盘电源');
      return;
    }
    const point = canvasCoords(event);
    pointerDownAt = performance.now();
    pointerStart = point;
    els.potteryCanvas.setPointerCapture(event.pointerId);

    if (state.tool === 'rotate') {
      renderer.dragging = true;
      sculptDrag = { mode: 'rotate', lastX: point.x, lastY: point.y };
      els.studioStage.classList.add('rotating');
      return;
    }
    if (state.phase === 'clay' || state.phase === 'sculpt') {
      if (state.phase === 'sculpt') pushHistory();
      const uv = renderer.screenToUv(point.x, point.y);
      sculptDrag = { mode: 'sculpt', lastX: point.x, lastY: point.y, uv, moved: 0 };
      return;
    }
    if (state.phase === 'decorate') {
      if (state.decorMode === 'paint' || state.decorMode === 'free') {
        painting = true;
        freePainting = state.decorMode === 'free';
        if (freePainting) {
          renderer.endFreeStroke();
          renderer.freePaintAt(point.x, point.y, selectedColor().hex, state.brushSize);
          state.freeArtwork = true;
        } else {
          renderer.lastPaint = null;
          renderer.paintAt(point.x, point.y, selectedColor().hex, state.brushSize);
          state.surfaceArtwork = true;
        }
        state.hasArtwork = true;
      } else {
        sculptDrag = { mode: 'tap', lastX: point.x, lastY: point.y, moved: 0 };
      }
    }
  }

  function potteryPointerMove(event) {
    if (!sculptDrag && !painting) return;
    const point = canvasCoords(event);
    if (sculptDrag && sculptDrag.mode === 'rotate') {
      const dx = point.x - sculptDrag.lastX;
      const dy = point.y - (sculptDrag.lastY == null ? point.y : sculptDrag.lastY);
      renderer.rotateBy(dx * .0085);
      renderer.tiltBy(-dy * .006);
      sculptDrag.lastX = point.x;
      sculptDrag.lastY = point.y;
      return;
    }
    if (sculptDrag && sculptDrag.mode === 'sculpt') {
      const dx = point.x - sculptDrag.lastX;
      const dy = point.y - sculptDrag.lastY;
      sculptDrag.moved += Math.abs(dx) + Math.abs(dy);
      if (Math.abs(dx) > .4 || Math.abs(dy) > .4) {
        const uv = renderer.screenToUv(point.x, point.y);
        deformLocal(uv.v, uv.angle, dx * .0022);
        if (state.phase === 'clay') {
          state.knead = clamp(state.knead + Math.abs(dx) * .16 + Math.abs(dy) * .1, 0, 100);
          updateKneadUi();
        }
      }
      sculptDrag.lastX = point.x;
      sculptDrag.lastY = point.y;
      return;
    }
    if (painting && state.decorMode === 'paint') {
      renderer.paintAt(point.x, point.y, selectedColor().hex, state.brushSize);
    } else if (painting && state.decorMode === 'free') {
      renderer.freePaintAt(point.x, point.y, selectedColor().hex, state.brushSize);
    }
    if (sculptDrag && sculptDrag.mode === 'tap') {
      sculptDrag.moved += Math.abs(point.x - sculptDrag.lastX) + Math.abs(point.y - sculptDrag.lastY);
      sculptDrag.lastX = point.x;
      sculptDrag.lastY = point.y;
    }
  }

  function potteryPointerUp(event) {
    if (!sculptDrag && !painting) return;
    if (els.potteryCanvas.hasPointerCapture(event.pointerId)) els.potteryCanvas.releasePointerCapture(event.pointerId);
    if (sculptDrag && sculptDrag.mode === 'tap' && sculptDrag.moved < 8 && state.phase === 'decorate') {
      if (state.decorMode === 'fill') {
        applyGlaze(state.selectedRegion, selectedColor());
      } else if (state.decorMode === 'stamp') {
        const stamp = D.STAMPS.find(s => s.id === state.stampId);
        if (stamp) {
          renderer.stampAt(event.clientX, event.clientY, stamp.draw, state.stampColor, state.stampSize);
          state.surfaceArtwork = true;
          state.hasArtwork = true;
          renderPanel();
          toast(stamp.name + '已贴到陶器表面');
        }
      }
    }
    if (painting) {
      if (freePainting || state.decorMode === 'free') renderer.endFreeStroke();
      else renderer.endStroke();
      painting = false;
      freePainting = false;
      renderPanel();
    }
    if (state.phase === 'clay' && state.knead >= 100) renderPanel();
    renderer.dragging = false;
    sculptDrag = null;
    els.studioStage.classList.remove('rotating');
  }

  function togglePower() {
    state.wheelOn = !state.wheelOn;
    renderAll();
    toast(state.wheelOn ? '转盘已经启动，可以开始揉泥' : '转盘已经关闭');
  }

  function bindEvents() {
    els.clayOptions.addEventListener('click', event => {
      const button = event.target.closest('[data-clay]');
      if (!button) return;
      state.clayId = button.dataset.clay;
      syncRenderer();
      renderAll();
      toast('已更换为' + clay().name);
    });
    els.sampleGrid.addEventListener('click', event => {
      const button = event.target.closest('[data-sample]');
      if (!button) return;
      applySample(button.dataset.sample);
    });
    els.wheelPowerBtn.addEventListener('click', togglePower);
    els.cameraBtn.addEventListener('click', toggleCamera);
    els.refreshCameraBtn.addEventListener('click', refreshCameraDevices);
    els.demoHandsBtn.addEventListener('click', toggleDemoHands);
    els.panelContent.addEventListener('click', handlePanelClick);
    els.panelContent.addEventListener('input', handlePanelInput);
    document.querySelectorAll('#viewModes [data-tool]').forEach(button => {
      button.addEventListener('click', () => {
        state.tool = button.dataset.tool;
        renderAll();
      });
    });
    els.smoothBtn.addEventListener('click', smoothEdges);
    els.undoBtn.addEventListener('click', undo);
    els.centerViewBtn.addEventListener('click', () => {
      renderer.setView(-.36, .22);
      toast('已回到正视角度');
    });
    els.topViewBtn.addEventListener('click', () => {
      renderer.setView(-.36, 1.18);
      toast('已切换俯视，可检查口沿与内壁');
    });
    els.presentationBtn.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          toast('已进入课堂投屏模式，按 Esc 退出全屏');
        } else {
          await document.exitFullscreen();
        }
      } catch (error) {
        toast('浏览器阻止了全屏，可按 F11 进入投屏模式');
      }
    });
    els.resetBtn.addEventListener('click', () => resetGame(false));
    els.exportBtn.addEventListener('click', saveImage);
    els.saveResultBtn.addEventListener('click', saveImage);
    els.restartBtn.addEventListener('click', () => resetGame(true));
    els.closeModalBtn.addEventListener('click', closeModal);
    els.modal.addEventListener('click', event => { if (event.target === els.modal) closeModal(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !els.modal.hidden) closeModal();
    });
    els.potteryCanvas.addEventListener('pointerdown', potteryPointerDown);
    els.potteryCanvas.addEventListener('pointermove', potteryPointerMove);
    els.potteryCanvas.addEventListener('pointerup', potteryPointerUp);
    els.potteryCanvas.addEventListener('pointercancel', potteryPointerUp);
    els.phases.forEach(button => {
      button.addEventListener('click', () => {
        if (button.classList.contains('done') && button.dataset.phase !== 'bisque' && button.dataset.phase !== 'fire') {
          setPhase(button.dataset.phase);
        }
      });
    });
  }

  bindEvents();
  renderAll();
  setInterval(() => {
    const degrees = ((renderer.rotation * 180 / Math.PI) % 360 + 360) % 360;
    const pitch = Math.round(renderer.pitch * 180 / Math.PI);
    els.anglePill.textContent = '环绕 ' + Math.round(degrees) + '° · 俯视 ' + pitch + '°';
  }, 120);
})();
