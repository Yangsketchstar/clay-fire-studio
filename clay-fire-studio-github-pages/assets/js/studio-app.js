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
  const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
  ];

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
    cameraTogglePanelBtn: $('cameraTogglePanelBtn'),
    cameraBody: $('cameraBody'),
    calibrateHandsBtn: $('calibrateHandsBtn'),
    handDiagnosticsBtn: $('handDiagnosticsBtn'),
    calibrationStatus: $('calibrationStatus'),
    handDiagnostics: $('handDiagnostics'),
    diagFps: document.querySelector('[data-diag-fps]'),
    diagHands: document.querySelector('[data-diag-hands]'),
    diagPinch: document.querySelector('[data-diag-pinch]'),
    diagLatency: document.querySelector('[data-diag-latency]'),
    cameraSelect: $('cameraSelect'),
    refreshCameraBtn: $('refreshCameraBtn'),
    clayOptions: $('clayOptions'),
    wheelPowerBtn: $('wheelPowerBtn'),
    wheelPowerText: $('wheelPowerText'),
    sampleGrid: $('sampleGrid'),
    clayStageShell: $('clayStageShell'),
    clayHandOverlay: $('clayHandOverlay'),
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
    redoBtn: $('redoBtn'),
    centerViewBtn: $('centerViewBtn'),
    quarterViewBtn: $('quarterViewBtn'),
    topViewBtn: $('topViewBtn'),
    contactFeedback: $('contactFeedback'),
    contactRing: $('contactRing'),
    handHintLeft: $('handHintLeft'),
    handHintRight: $('handHintRight'),
    contactLabel: $('contactLabel'),
    materialsToggleBtn: $('materialsToggleBtn'),
    panelToggleBtn: $('panelToggleBtn'),
    quickWheelBtn: $('quickWheelBtn'),
    quickWheelText: $('quickWheelText'),
    dockPanelText: $('dockPanelText'),
    journeyTitle: $('journeyTitle'),
    journeyCopy: $('journeyCopy'),
    nextActionBtn: $('nextActionBtn'),
    leftDrawerCloseBtn: $('leftDrawerCloseBtn'),
    panelCloseBtn: $('panelCloseBtn'),
    presentationBtn: $('presentationBtn'),
    backPhaseBtn: $('backPhaseBtn'),
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
    resultAnglePicker: $('resultAnglePicker'),
    restartBtn: $('restartBtn'),
    saveResultBtn: $('saveResultBtn')
  };

  function makeRawProfile() {
    return Array.from({ length: 48 }, (_, i) => {
      const t = i / 47;
      const roundMass = 0.08 + Math.pow(Math.sin(t * Math.PI), 0.72) * 0.86;
      return roundMass + Math.sin(i * 1.63) * 0.018;
    });
  }

  function makeThrowProfile() {
    return Array.from({ length: 96 }, (_, index) => {
      const t = index / 95;
      const cylinder = .61 + Math.sin(t * Math.PI) * .035 + t * .018;
      return cylinder + Math.sin(index * 1.73) * .006;
    });
  }

  function initialState() {
    return {
      phase: 'clay',
      wheelOn: false,
      wheelSpeed: 1,
      pinchForce: 1,
      cameraOn: false,
      demoOn: false,
      clayId: 'white',
      knead: 0,
      rawProfile: makeRawProfile(),
      sampleId: 'custom',
      profile: makeThrowProfile(),
      heightFactor: .62,
      shapeWork: 0,
      throwProgress: 0,
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
      selectedGlazePresetId: 'celadon-clear',
      glazeCategory: '全部',
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
      exportAngle: 'side',
      finalized: false,
      history: [],
      redoHistory: []
    };
  }

  let state = initialState();
  let handTracker = null;
  let demoInterval = null;
  let lastHandAt = 0;
  let lastHandData = null;
  let pinchWasActive = false;
  let lastActivePinch = null;
  let handActionFeedback = { text: '', until: 0 };
  let handDeformCooldown = 0;
  let resultExportCache = { angle: null, dataUrl: '' };
  let lastJourneySignature = '';
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
  function selectedGlazePreset() {
    return D.GLAZE_PRESETS.find(preset => preset.id === state.selectedGlazePresetId) || null;
  }
  function selectedGlazePaint() {
    const preset = selectedGlazePreset();
    if (!preset) return selectedColor();
    return {
      id: 'preset-' + preset.id,
      name: preset.name,
      hex: preset.primary,
      secondary: preset.secondary,
      pattern: preset.pattern,
      presetId: preset.id
    };
  }
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
      heightFactor: state.phase === 'clay' ? 1 : state.heightFactor,
      throwProgress: state.phase === 'clay' ? 0 : throwPercent(),
      lumps: state.lumps,
      clay: clay(),
      glaze: state.glaze,
      finish: currentFinish(),
      gloss: state.gloss,
      texture: state.phase === 'clay' || (state.phase === 'sculpt' && throwPercent() < 35) ? 'smooth' : state.texture,
      mouth: state.mouth,
      handleCount: state.phase === 'clay' ? 0 : state.handleCount,
      bisqueDone: state.bisqueDone,
      phase: state.phase,
      wheelOn: state.wheelOn,
      wheelSpeed: state.wheelSpeed,
      finalized: state.finalized,
      fireTemperature: state.temperature,
      atmosphere: state.atmosphere,
      sampleId: state.sampleId
    };
  }

  function syncRenderer() {
    renderer.setState(rendererState());
  }

  function throwPercent() {
    const heightProgress = clamp((state.heightFactor - .62) / .4, 0, 1);
    return Math.round(Math.max(heightProgress, state.shapeWork || 0) * 100);
  }

  function surfaceRegion(v) {
    if (v < .24) return '口沿';
    if (v < .52) return '器肩';
    if (v < .8) return '器腹';
    return '底足';
  }

  function setContactVisible(visible) {
    if (!els.contactFeedback) return;
    els.contactFeedback.classList.toggle('visible', visible);
    if (!visible) {
      els.contactFeedback.classList.remove('pinching');
      clearClayHandOverlay();
    }
  }

  function pulseContact() {
    if (!els.contactRing || typeof els.contactRing.animate !== 'function') return;
    els.contactRing.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1.32)', opacity: .55 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }
      ],
      { duration: 190, easing: 'ease-out' }
    );
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function rememberHandAction(text) {
    handActionFeedback = { text, until: performance.now() + 1800 };
    els.handMessage.textContent = text;
  }

  function activeHandActionText() {
    return performance.now() < handActionFeedback.until ? handActionFeedback.text : '';
  }

  function resizeClayHandOverlay() {
    if (!els.clayHandOverlay) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = els.clayHandOverlay.clientWidth;
    const height = els.clayHandOverlay.clientHeight;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (els.clayHandOverlay.width !== pixelWidth || els.clayHandOverlay.height !== pixelHeight) {
      els.clayHandOverlay.width = pixelWidth;
      els.clayHandOverlay.height = pixelHeight;
    }
    const context = els.clayHandOverlay.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { context, width, height };
  }

  function clearClayHandOverlay() {
    if (!els.clayHandOverlay) return;
    const context = els.clayHandOverlay.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, els.clayHandOverlay.width, els.clayHandOverlay.height);
  }

  function drawClayHandSkeleton(hands, pinching) {
    const surface = resizeClayHandOverlay();
    if (!surface) return;
    const { context, width, height } = surface;
    context.clearRect(0, 0, width, height);
    if (!hands || !hands.length) return;
    const canvasWidth = els.potteryCanvas.clientWidth;
    const canvasHeight = els.potteryCanvas.clientHeight;
    const scale = Math.min(width, height) * .82;
    const visibleOnPottery = point => renderer.screenPointToUv(point.x, point.y).hit;
    const fitPointToSurface = (anchor, candidate) => {
      if (visibleOnPottery(candidate)) return candidate;
      let inside = 0;
      let outside = 1;
      for (let step = 0; step < 5; step += 1) {
        const middle = (inside + outside) * .5;
        const point = {
          x: anchor.x + (candidate.x - anchor.x) * middle,
          y: anchor.y + (candidate.y - anchor.y) * middle
        };
        if (visibleOnPottery(point)) inside = middle;
        else outside = middle;
      }
      return {
        x: anchor.x + (candidate.x - anchor.x) * inside,
        y: anchor.y + (candidate.y - anchor.y) * inside
      };
    };

    hands.forEach((hand, handIndex) => {
      if (!hand.landmarks || hand.landmarks.length < 21) return;
      const uv = renderer.screenPointToUv(hand.x * canvasWidth, hand.y * canvasHeight);
      if (!uv.hit) return;
      const contact = renderer.uvToScreen(uv.u, uv.v);
      if (!contact) return;
      const surfaceAnchor = {
        x: contact.x + clamp((width * .5 - contact.x) * .2, -24, 24),
        y: contact.y
      };
      const points = hand.landmarks.map(point => fitPointToSurface(surfaceAnchor, {
        x: surfaceAnchor.x + (point.x - hand.x) * scale,
        y: surfaceAnchor.y + (point.y - hand.y) * scale
      }));

      context.save();
      context.globalAlpha = pinching ? 1 : .58;
      context.strokeStyle = handIndex === 0 ? 'rgba(232,255,250,.99)' : 'rgba(246,255,236,.99)';
      context.fillStyle = 'rgba(255,254,246,.99)';
      context.lineWidth = pinching ? 2.7 : 1.8;
      context.shadowColor = handIndex === 0 ? 'rgba(75,233,225,.96)' : 'rgba(130,235,190,.9)';
      context.shadowBlur = pinching ? 14 : 8;
      context.lineCap = 'round';
      HAND_CONNECTIONS.forEach(([a, b]) => {
        context.beginPath();
        context.moveTo(points[a].x, points[a].y);
        context.lineTo(points[b].x, points[b].y);
        context.stroke();
      });
      points.forEach((point, pointIndex) => {
        context.beginPath();
        context.arc(point.x, point.y, pointIndex === 4 || pointIndex === 8 ? 3.1 : 1.6, 0, Math.PI * 2);
        context.fill();
      });
      if (pinching) {
        const pinchX = (points[4].x + points[8].x) * .5;
        const pinchY = (points[4].y + points[8].y) * .5;
        context.strokeStyle = 'rgba(255,215,139,.98)';
        context.lineWidth = 2.6;
        context.beginPath();
        context.moveTo(points[4].x, points[4].y);
        context.lineTo(points[8].x, points[8].y);
        context.stroke();
        context.fillStyle = 'rgba(255,247,225,.98)';
        context.shadowColor = 'rgba(255,215,139,.92)';
        context.shadowBlur = 20;
        context.beginPath();
        context.arc(pinchX, pinchY, 5, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    });
  }

  function placeContact(points, primary, detail, pinching) {
    if (!els.contactFeedback || !els.contactRing || !els.contactLabel) return;
    const canvasRect = els.potteryCanvas.getBoundingClientRect();
    const shellRect = els.clayStageShell.getBoundingClientRect();
    const offsetX = canvasRect.left - shellRect.left;
    const offsetY = canvasRect.top - shellRect.top;
    const usable = points.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!usable.length || !primary) {
      setContactVisible(false);
      return;
    }

    els.contactRing.style.left = (offsetX + primary.x) + 'px';
    els.contactRing.style.top = (offsetY + primary.y) + 'px';
    const left = usable[0];
    const right = usable[1] || usable[0];
    els.handHintLeft.style.left = (offsetX + left.x) + 'px';
    els.handHintLeft.style.top = (offsetY + left.y) + 'px';
    els.handHintRight.style.left = (offsetX + right.x) + 'px';
    els.handHintRight.style.top = (offsetY + right.y) + 'px';
    els.handHintRight.hidden = usable.length < 2;
    els.contactLabel.style.left = clamp(offsetX + primary.x, 8, shellRect.width - 155) + 'px';
    els.contactLabel.style.top = clamp(offsetY + primary.y, 8, shellRect.height - 58) + 'px';
    els.contactLabel.querySelector('strong').textContent = surfaceRegion(primary.v) + ' · ' + (primary.side || '左侧');
    els.contactLabel.querySelector('small').textContent = detail;
    els.contactFeedback.classList.toggle('pinching', !!pinching);
    setContactVisible(true);
  }

  function updateContactFromUv(uv, detail, pinching) {
    clearClayHandOverlay();
    if (!uv || uv.hit === false) {
      setContactVisible(false);
      return;
    }
    const point = renderer.uvToScreen(uv.u, uv.v);
    if (!point) return;
    placeContact(
      [{ ...point, v: uv.v, side: uv.x < els.potteryCanvas.clientWidth * .5 ? '左侧' : '右侧' }],
      { ...point, v: uv.v, side: uv.x < els.potteryCanvas.clientWidth * .5 ? '左侧' : '右侧' },
      detail,
      pinching
    );
  }

  function updateContactFromHands(data, strength) {
    const points = data.hands.map(hand => {
      const uv = renderer.screenPointToUv(
        hand.x * els.potteryCanvas.clientWidth,
        hand.y * els.potteryCanvas.clientHeight
      );
      return uv.hit ? { ...uv, side: hand.x < .5 ? '左侧' : '右侧' } : null;
    }).filter(Boolean);
    if (!points.length) {
      setContactVisible(false);
      return;
    }
    const primary = points[0];
    const pressure = Math.round(clamp(Math.abs(strength) * 220, 8, 100));
    const handText = points.length === 2 ? '双手同步' : '单手操作';
    const gestureText = activeHandActionText() || (data.pinchSupported
      ? (data.pinching ? handText + ' · 捏合中' : handText + ' · 松开预览')
      : handText + ' · 基础追踪');
    drawClayHandSkeleton(data.hands, !!data.pinching);
    placeContact(points, primary, gestureText + ' · 压力 ' + pressure + '%', !!data.pinching);
  }

  function setWorkshopDrawer(openDrawer) {
    if (openDrawer) setCameraPanelExpanded(false);
    document.body.classList.toggle('materials-open', openDrawer === 'materials');
    document.body.classList.toggle('panel-open', openDrawer === 'panel');
    els.materialsToggleBtn.setAttribute('aria-expanded', String(openDrawer === 'materials'));
    els.panelToggleBtn.setAttribute('aria-expanded', String(openDrawer === 'panel'));
  }

  function closeWorkshopDrawers() {
    setWorkshopDrawer(null);
  }

  function setViewMode(mode) {
    const views = {
      center: [-.36, .08],
      quarter: [-.36, .48],
      top: [-.36, 1.18]
    };
    const view = views[mode] || views.quarter;
    renderer.setView(view[0], view[1]);
    [els.centerViewBtn, els.quarterViewBtn, els.topViewBtn].forEach(button => {
      if (button) button.classList.toggle('active', button.id === mode + 'ViewBtn');
    });
    const labels = { center: '已回到正视', quarter: '已切换到 3/4 视角', top: '已切换到俯视，可检查口沿与内壁' };
    toast(labels[mode] || labels.quarter);
  }

  function updateSculptProgressUi() {
    const bar = $('formProgressBar');
    const text = $('formProgressText');
    const height = $('formHeightText');
    const percent = throwPercent();
    state.throwProgress = percent;
    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = percent + '%';
    if (height) height.textContent = (Math.round(state.heightFactor * 100) / 100).toFixed(2) + '×';
    const goDry = els.panelContent.querySelector('[data-action="go-dry"]');
    if (goDry) goDry.disabled = false;
  }

  function toast(message) {
    els.footerStatus.textContent = message;
    els.footerStatus.animate(
      [{ opacity: .35, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }],
      { duration: 220, easing: 'ease-out' }
    );
  }

  function snapshotEditableState(label) {
    const snapshot = {
      label: label || '编辑',
      profile: state.profile.slice(),
      rawProfile: state.rawProfile.slice(),
      lumps: state.lumps.map(l => ({ ...l })),
      heightFactor: state.heightFactor,
      shapeWork: state.shapeWork,
      knead: state.knead,
      smooth: state.edgeSmoothed,
      glaze: Object.fromEntries(Object.entries(state.glaze).map(([region, color]) => [
        region,
        color ? { ...color } : null
      ])),
      finishId: state.finishId,
      gloss: state.gloss,
      texture: state.texture,
      hasArtwork: state.hasArtwork,
      surfaceArtwork: state.surfaceArtwork,
      freeArtwork: state.freeArtwork,
      artwork: renderer.captureHistoryState()
    };
    return snapshot;
  }

  function updateHistoryButtons() {
    els.undoBtn.disabled = state.history.length === 0;
    els.redoBtn.disabled = state.redoHistory.length === 0;
    const undoItem = state.history[state.history.length - 1];
    const redoItem = state.redoHistory[state.redoHistory.length - 1];
    els.undoBtn.textContent = undoItem ? '↶ 撤销' + undoItem.label : '↶ 撤销';
    els.redoBtn.textContent = redoItem ? '↷ 重做' + redoItem.label : '↷ 重做';
    els.undoBtn.title = undoItem ? '撤销：' + undoItem.label : '没有可撤销的操作';
    els.redoBtn.title = redoItem ? '重做：' + redoItem.label : '没有可重做的操作';
  }

  function pushHistory(label) {
    const snapshot = snapshotEditableState(label);
    state.history.push(snapshot);
    if (state.history.length > 50) state.history.shift();
    state.redoHistory = [];
    updateHistoryButtons();
  }

  function restoreEditableState(snapshot) {
    state.profile = snapshot.profile.slice();
    state.rawProfile = snapshot.rawProfile.slice();
    state.lumps = snapshot.lumps.map(l => ({ ...l }));
    state.heightFactor = snapshot.heightFactor;
    state.shapeWork = snapshot.shapeWork || 0;
    state.throwProgress = throwPercent();
    state.knead = snapshot.knead;
    state.edgeSmoothed = snapshot.smooth;
    state.glaze = Object.fromEntries(Object.entries(snapshot.glaze).map(([region, color]) => [
      region,
      color ? { ...color } : null
    ]));
    state.finishId = snapshot.finishId;
    state.gloss = snapshot.gloss;
    state.texture = snapshot.texture;
    state.hasArtwork = snapshot.hasArtwork;
    state.surfaceArtwork = snapshot.surfaceArtwork;
    state.freeArtwork = snapshot.freeArtwork;
    renderer.restoreHistoryState(snapshot.artwork);
    syncRenderer();
    updateHistoryButtons();
  }

  function undo() {
    const previous = state.history.pop();
    if (!previous) return;
    state.redoHistory.push(snapshotEditableState(previous.label));
    restoreEditableState(previous);
    renderAll();
    toast('已撤销：' + previous.label);
  }

  function redo() {
    const next = state.redoHistory.pop();
    if (!next) return;
    state.history.push(snapshotEditableState(next.label));
    restoreEditableState(next);
    renderAll();
    toast('已重做：' + next.label);
  }

  function clearHistory() {
    state.history = [];
    state.redoHistory = [];
    syncRenderer();
    updateHistoryButtons();
  }

  function phaseMeta() {
    const map = {
      clay: ['STEP 01 / 06', '准备泥料', '选择泥料，打开转盘电源，再揉匀泥团。', '打开转盘电源，用单手或双手揉压泥团；也可以使用鼠标。'],
      sculpt: ['STEP 02 / 06', '自由手捏', '手掌在画面中的位置保持稳定，陶坯从手下缓慢旋转经过；捏合开始塑形，松开停止。', '选择“手部塑形”后捏合拇指与食指，或使用鼠标拖拽。'],
      dry: ['STEP 03 / 06', '修边与自然干燥', '先把粗糙口沿修顺，再让坯体慢慢干燥。', '点击一键修饰边缘，确认轮廓后进入自然干燥。'],
      bisque: ['STEP 04 / 06', '低温素烧', '素烧让泥坯变硬，并让釉层更容易附着。', '素烧后器型固定，不能再修改轮廓。'],
      decorate: ['STEP 05 / 06', '上釉与彩绘', '拖动画笔上色；滚轮旋转器物，按住 Alt 拖动可查看并绘制背面。', '拖动绘制，滚轮或 Alt+拖动旋转，纹样会附着在完整器身表面。'],
      fire: ['STEP 06 / 06', '温控本烧', '选择烧成温度和窑内气氛，最终釉色会随之改变。', '高温会让釉色加深，并形成流动、开片与火痕。']
    };
    return map[state.phase];
  }

  function nextActionConfig() {
    if (state.phase === 'clay') {
      if (!state.wheelOn) {
        return { title: '先启动转盘', copy: '转盘转起来后，泥团才会开始受力。', label: '启动转盘', action: 'power', disabled: false };
      }
      if (state.knead < 100) {
        return { title: '把泥团揉匀', copy: '也可以直接用双手揉压，准备好后进入塑形。', label: '揉匀并开始', action: 'quick-knead', disabled: false };
      }
      return { title: '泥料已经准备好', copy: '现在进入自由手捏，开始决定器物的轮廓。', label: '开始手捏', action: 'go-sculpt', disabled: false };
    }
    if (state.phase === 'sculpt') {
      return { title: '捏出你想要的器型', copy: '上下改变高度，左右调整器壁，满意后进入修边。', label: '我捏好了，下一步', action: 'go-dry', disabled: false };
    }
    if (state.phase === 'dry') {
      if (dryTimer) {
        return { title: '坯体正在自然阴干', copy: '等待水分缓慢排出，避免过快干燥造成开裂。', label: '正在阴干 ' + Math.round(state.dryProgress) + '%', action: 'none', disabled: true };
      }
      if (state.dryProgress >= 100) {
        return { title: '坯体已经干燥完成', copy: '接下来进入素烧，让坯体变得坚固。', label: '进入素烧', action: 'go-bisque', disabled: false };
      }
      return { title: '让坯体慢慢干透', copy: '开始自然阴干后，页面会实时显示进度。', label: '开始自然干燥', action: 'begin-dry', disabled: false };
    }
    if (state.phase === 'bisque') {
      return { title: '进行低温素烧', copy: '素烧会让坯体变硬，并固定当前轮廓。', label: '开始素烧', action: 'start-bisque', disabled: firingActive };
    }
    if (state.phase === 'decorate') {
      if (!state.hasArtwork && !Object.values(state.glaze).some(Boolean)) {
        return { title: '给器物上釉或彩绘', copy: '完成至少一处装饰后，就可以送入本烧。', label: '打开装饰面板', action: 'open-panel', disabled: false };
      }
      return { title: '装饰已经完成', copy: '确认釉色和背面图案后，进入最后本烧。', label: '送入本烧', action: 'go-fire', disabled: false };
    }
    return { title: '选择最终烧成效果', copy: '温度和窑内气氛会决定最后的釉色。', label: '开始本烧', action: 'start-fire', disabled: firingActive };
  }

  function updateJourneyPrompt() {
    if (!els.nextActionBtn || !els.journeyTitle || !els.journeyCopy) return;
    const config = nextActionConfig();
    els.journeyTitle.textContent = config.title;
    els.journeyCopy.textContent = config.copy;
    els.nextActionBtn.textContent = config.label;
    els.nextActionBtn.disabled = config.disabled;
    els.nextActionBtn.dataset.nextAction = config.action;
    const signature = [state.phase, config.title, config.action, config.label].join('|');
    if (els.journeyPrompt && signature !== lastJourneySignature) {
      lastJourneySignature = signature;
      els.journeyPrompt.classList.remove('is-new');
      void els.journeyPrompt.offsetWidth;
      els.journeyPrompt.classList.add('is-new');
      window.setTimeout(() => els.journeyPrompt.classList.remove('is-new'), 620);
    }
  }

  function runNextAction() {
    const action = els.nextActionBtn.dataset.nextAction;
    if (action === 'power') togglePower();
    else if (action === 'quick-knead') quickKnead();
    else if (action === 'go-sculpt') setPhase('sculpt');
    else if (action === 'go-dry') setPhase('dry');
    else if (action === 'begin-dry') beginDry();
    else if (action === 'go-bisque') setPhase('bisque');
    else if (action === 'start-bisque') openKiln('bisque');
    else if (action === 'open-panel') {
      setWorkshopDrawer('panel');
      if (state.decorMode !== 'fill' && state.decorMode !== 'paint') {
        state.decorMode = 'fill';
        renderPanel();
      }
    } else if (action === 'go-fire') setPhase('fire');
    else if (action === 'start-fire') openKiln('final');
  }

  function renderAll() {
    const meta = phaseMeta();
    document.body.dataset.phase = state.phase;
    els.stageEyebrow.textContent = meta[0];
    els.panelEyebrow.textContent = meta[0];
    els.stageTitle.textContent = meta[1];
    els.panelTitle.textContent = meta[1];
    els.stageCopy.textContent = meta[2];
    els.stageMessage.innerHTML = '<strong>操作：</strong>' + meta[3];
    els.panelBadge.textContent = state.phase === 'clay' ? clay().name : (state.phase === 'fire' ? state.temperature + '°C' : '360° 立体');
    els.exportBtn.disabled = !state.finalized;
    els.backPhaseBtn.disabled = firingActive || phaseOrder.indexOf(state.phase) <= 0;
    els.smoothBtn.hidden = state.phase !== 'sculpt' && state.phase !== 'dry';
    els.smoothBtn.disabled = state.phase !== 'sculpt' && state.phase !== 'dry';
    updateHistoryButtons();
    els.powerFloating.classList.toggle('on', state.wheelOn);
    els.powerFloating.querySelector('span').textContent = state.wheelOn ? '转盘运转中' : '转盘关闭';
    els.wheelPowerBtn.classList.toggle('on', state.wheelOn);
    els.wheelPowerBtn.setAttribute('aria-pressed', String(state.wheelOn));
    els.wheelPowerBtn.querySelector('span').textContent = state.wheelOn ? 'ON' : 'OFF';
    els.wheelPowerText.textContent = state.wheelOn ? '开启 · 可塑形' : '关闭 · 点击启动';
    els.quickWheelBtn.classList.toggle('on', state.wheelOn);
    els.quickWheelBtn.setAttribute('aria-pressed', String(state.wheelOn));
    els.quickWheelText.textContent = state.wheelOn ? '暂停转盘' : '启动转盘';
    els.dockPanelText.textContent = state.phase === 'clay'
      ? '泥料与转盘'
      : state.phase === 'decorate'
        ? '上釉与彩绘'
        : state.phase === 'fire'
          ? '温控与本烧'
          : '器型与下一步';
    updateJourneyPrompt();
    els.phases.forEach((button, index) => {
      const current = phaseOrder.indexOf(state.phase);
      button.classList.toggle('active', button.dataset.phase === state.phase);
      button.classList.toggle('done', index < current);
    });
    document.querySelectorAll('[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === state.tool));
    const toolButtons = document.querySelectorAll('#viewModes button');
    if (toolButtons.length === 2) {
      toolButtons[0].textContent = state.phase === 'clay' ? '双手揉泥' : state.phase === 'decorate' ? '涂绘 / 贴花' : '手部塑形';
      toolButtons[1].textContent = state.phase === 'decorate' ? '旋转看背面' : '360° 旋转';
    }
    const tripleNote = document.querySelector('.triple-note');
    if (tripleNote) {
      tripleNote.textContent = state.phase === 'decorate'
        ? '滚轮旋转 · Alt+拖动看背面'
        : '左右环绕 · 上下俯仰';
    }
    els.clayStageShell.classList.toggle('free-canvas-mode', state.phase === 'decorate' && state.decorMode === 'free');
    els.potteryCanvas.style.cursor = state.tool === 'rotate' ? 'grab' : state.phase === 'decorate' ? (state.decorMode === 'paint' || state.decorMode === 'free' ? 'crosshair' : 'pointer') : 'grab';
    if (!['clay', 'sculpt', 'decorate'].includes(state.phase)) setContactVisible(false);
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
    state.handleCount = 0;
    renderSamples();
    toast(sample.name + '已记为灵感参考；陶坯仍需从泥团开始由你亲手塑形');
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

  function glazePresetMarkup() {
    const activeCategory = state.glazeCategory || '全部';
    const presets = activeCategory === '全部'
      ? D.GLAZE_PRESETS
      : D.GLAZE_PRESETS.filter(preset => preset.category === activeCategory);
    const selected = selectedGlazePreset();
    return (
      '<div class="section-title"><h3>釉色方案库</h3><span>共 ' + D.GLAZE_PRESETS.length + ' 套</span></div>' +
      '<div class="glaze-category-tabs">' + D.GLAZE_CATEGORIES.map(category => (
        '<button class="' + (activeCategory === category ? 'active' : '') + '" data-action="glaze-category" data-category="' + category + '" type="button">' + category + '</button>'
      )).join('') + '</div>' +
      '<div class="glaze-preset-grid">' + presets.map(preset => (
        '<button class="glaze-preset-card ' + (state.selectedGlazePresetId === preset.id ? 'selected' : '') + '" data-action="select-glaze-preset" data-preset="' + preset.id + '" type="button" style="--glaze-a:' + preset.primary + ';--glaze-b:' + preset.secondary + '">' +
          '<span class="glaze-mini-vessel pattern-' + preset.pattern + '"></span>' +
          '<span class="glaze-card-copy"><strong>' + preset.name + '</strong><small>' + preset.category + ' · ' + preset.note + '</small></span>' +
        '</button>'
      )).join('') + '</div>' +
      '<div class="glaze-selected-summary" data-glaze-summary><strong>' + (selected ? selected.name : '自定义纯色') + '</strong><span>' +
        (selected ? selected.category + ' · ' + selected.note : '使用下方纯色色板') +
      '</span></div>'
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
      glazePresetMarkup() +
      '<div class="section-title"><h3>施釉部位</h3><span>先选区域，再应用当前方案</span></div>' +
      '<div class="region-grid">' + Object.entries(regionNames).map(([id, name]) => {
        const color = state.glaze[id];
        return '<button class="region-chip ' + (state.selectedRegion === id ? 'selected' : '') + '" data-action="select-region" data-region="' + id + '" type="button"><i style="background:' + (color ? color.hex : clay().base) + '"></i><span><strong>' + name + '</strong><small>' + (color ? color.name : '露胎') + '</small></span></button>';
      }).join('') + '</div>' +
      '<div class="glaze-custom-title">自定义纯色</div>' +
      paletteMarkup() +
      '<div class="action-row"><button class="secondary" data-action="apply-region" type="button">当前方案施到此区域</button><button class="primary" data-action="fill-all" type="button">全器施釉</button></div>'
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
      '<div class="inline-row"><button class="secondary" data-action="rotate-view" type="button">旋转看背面</button><button class="secondary" data-action="clear-paint" type="button">清除绘画</button></div>'
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
      '<div class="action-row"><button class="secondary" data-action="rotate-view" type="button">旋转看背面</button><button class="secondary" data-action="stamp-one" type="button">点击陶器贴图</button><button class="primary" data-action="stamp-around" type="button">环绕一圈</button></div>'
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
        '<div class="intro-block"><span class="intro-num">01</span><div><h3>先让泥料听话</h3><p>打开转盘电源，用单手或双手揉压。 两只手同时出现时会自动进入协同塑形。</p></div></div>' +
        '<div class="status-grid"><div><span>泥料</span><strong>' + currentClay.name + '</strong></div><div><span>泥团温度</span><strong>室温</strong></div><div><span>手部输入</span><strong>单双兼容</strong></div><div><span>气泡状态</span><strong id="bubbleState">' + (state.knead >= 100 ? '已排净' : '正在排出') + '</strong></div></div>' +
        '<div class="progress-block"><div class="progress-head"><span>练泥进度</span><strong id="panelKneadText">' + Math.round(state.knead) + '%</strong></div><div class="progress-track"><span id="panelKneadBar" style="width:' + state.knead + '%"></span></div></div>' +
        '<div class="note-card"><i>手</i><div><strong>捏合开始，松开停止</strong><p>张开手掌负责移动，拇指与食指捏合后才会塑形；单手和双手都可以。</p></div></div>' +
        '<div class="action-row"><button class="secondary" data-action="quick-knead" type="button">一键揉匀并开始</button><button class="primary" data-action="go-sculpt" type="button" ' + (state.knead >= 100 ? '' : 'disabled') + '>进入手部塑形 →</button></div>'
      );
    }
    if (state.phase === 'sculpt') {
      return (
        '<div class="intro-block"><span class="intro-num">02</span><div><h3>从自由器型开始</h3><p>不必先选参考图。直接拖动器身推、压、捏；需要时再从左侧灵感架借一个起点。</p></div></div>' +
        '<div class="progress-block"><div class="progress-head"><span>器型形成度</span><strong id="formProgressText">' + throwPercent() + '%</strong></div><div class="progress-track"><span id="formProgressBar" style="width:' + throwPercent() + '%"></span></div></div>' +
        '<div class="status-grid"><div><span>泥团高度</span><strong id="formHeightText">' + state.heightFactor.toFixed(2) + '×</strong></div><div><span>手部输入</span><strong>单双兼容</strong></div></div>' +
        '<div class="note-card"><i>360</i><div><strong>上下提压，左右塑形</strong><p>捏住后上下移动改变高度，左右扫动改变局部器型；每次动作后回到中间再移动，可以继续操作。</p></div></div>' +
        '<div class="section-title"><h3>口沿塑形</h3><span>单独调整口径与唇边</span></div>' +
        '<div class="slider-stack">' +
          '<label class="slider-row"><header><span>口径大小<small>收口 / 敞口</small></span><output>' + Math.round(state.mouth.diameter * 100) + '%</output></header><input type="range" min="65" max="140" value="' + Math.round(state.mouth.diameter * 100) + '" data-range="mouth-size" aria-label="口径大小"/></label>' +
          '<label class="slider-row"><header><span>口沿厚度<small>薄唇 / 厚唇</small></span><output>' + Math.round(state.mouth.rim * 100) + '%</output></header><input type="range" min="6" max="28" value="' + Math.round(state.mouth.rim * 100) + '" data-range="mouth-rim" aria-label="口沿厚度"/></label>' +
          '<label class="slider-row"><header><span>内壁深度<small>浅口 / 深腔</small></span><output>' + Math.round(state.mouth.depth * 100) + '%</output></header><input type="range" min="15" max="80" value="' + Math.round(state.mouth.depth * 100) + '" data-range="mouth-depth" aria-label="内壁深度"/></label>' +
        '</div>' +
        '<div class="color-tabs mouth-tabs"><button class="' + (state.mouth.style === 'round' ? 'active' : '') + '" data-action="mouth-style" data-style="round" type="button">圆口</button><button class="' + (state.mouth.style === 'flare' ? 'active' : '') + '" data-action="mouth-style" data-style="flare" type="button">外撇口</button><button class="' + (state.mouth.style === 'inward' ? 'active' : '') + '" data-action="mouth-style" data-style="inward" type="button">内收口</button></div>' +
        '<div class="section-title"><h3>手感控制</h3><span>实时影响塑形</span></div>' +
        '<div class="slider-stack">' +
          '<label class="slider-row"><header><span>转盘速度<small>慢 / 快</small></span><output>' + Math.round(state.wheelSpeed * 100) + '%</output></header><input type="range" min="25" max="250" value="' + Math.round(state.wheelSpeed * 100) + '" data-range="wheel-speed" aria-label="转盘速度"/></label>' +
          '<label class="slider-row"><header><span>捏形力度<small>轻 / 强</small></span><output>' + Math.round(state.pinchForce * 100) + '%</output></header><input type="range" min="40" max="180" value="' + Math.round(state.pinchForce * 100) + '" data-range="pinch-force" aria-label="捏形力度"/></label>' +
        '</div>' +
        '<div class="section-title"><h3>修边力度</h3><span>保留手作感</span></div>' +
        '<div class="slider-row"><header><span>平滑强度<small>轻柔 / 标准 / 精细</small></span><output>' + state.smoothStrength + '</output></header><input type="range" min="1" max="3" value="' + state.smoothStrength + '" data-range="smooth-strength" aria-label="修边力度"/></div>' +
        '<div class="action-row"><button class="secondary" data-action="smooth-edge" type="button">可选：一键修饰边缘</button><button class="primary" data-action="go-dry" type="button">我捏好了 →</button></div>' +
        '<div class="note-card"><i>✓</i><div><strong>' + (throwPercent() >= 70 ? '器型已经形成' : '可以保留当前手作感') + '</strong><p>完成度只作为参考，不限制继续。觉得轮廓满意时，随时进入修边干燥；修饰边缘也可在下一步完成。</p></div></div>'
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
    updateJourneyPrompt();
  }

  function setPhase(phase) {
    const previousPhase = state.phase;
    state.phase = phase;
    state.tool = phase === 'decorate' ? state.tool : 'sculpt';
    if (phase === 'sculpt') {
      if (previousPhase === 'clay' || !state.profile || state.profile.length === 0) {
        state.profile = makeThrowProfile();
        state.heightFactor = .62;
        state.throwProgress = 0;
        state.lumps = [];
      }
      state.handleCount = 0;
    }
    renderAll();
    if (phase !== 'clay') closeWorkshopDrawers();
    toast(phase === 'sculpt' ? '手部塑形已就绪：张开手掌定位，捏合开始，松开停止' : phaseMeta()[1]);
  }

  function returnToPhase(phase) {
    const targetIndex = phaseOrder.indexOf(phase);
    const currentIndex = phaseOrder.indexOf(state.phase);
    if (firingActive || targetIndex < 0 || targetIndex >= currentIndex) return;
    if (state.bisqueDone && targetIndex < phaseOrder.indexOf('bisque')) {
      const confirmed = window.confirm('返回素烧前的步骤会取消素烧与本烧状态，现有绘画会保留。确定继续吗？');
      if (!confirmed) return;
      state.bisqueDone = false;
      state.finalized = false;
      state.firedFinishId = state.finishId;
    } else if (state.finalized && targetIndex < phaseOrder.indexOf('fire')) {
      state.finalized = false;
    }
    setPhase(phase);
  }

  function goPreviousPhase() {
    const currentIndex = phaseOrder.indexOf(state.phase);
    if (currentIndex > 0) returnToPhase(phaseOrder[currentIndex - 1]);
  }

  function quickKnead() {
    if (!state.wheelOn) {
      toast('请先打开转盘电源');
      return;
    }
    state.knead = 100;
    state.rawProfile = makeRawProfile().map((r, i) => r * (1 + Math.sin(i * 1.7) * .035));
    renderAll();
    toast('泥团已经揉匀，正在进入手部塑形');
    window.setTimeout(() => {
      if (state.phase === 'clay' && state.knead >= 100) setPhase('sculpt');
    }, 420);
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
    if (!state.wheelOn) {
      pinchWasActive = false;
      lastActivePinch = null;
      updateContactFromHands(data, 0);
      els.handMessage.textContent = (data.handCount === 1 ? '单手' : '双手') + '已识别，但转盘电源关闭。打开电源后才会改变泥团。';
      return;
    }
    if (state.phase !== 'clay' && state.phase !== 'sculpt') return;
    if (data.pinchSupported && !data.pinching) {
      pinchWasActive = false;
      lastActivePinch = null;
      handActionFeedback = { text: '', until: 0 };
      updateContactFromHands(data, 0);
      els.handMessage.textContent = data.handCount === 1
        ? '已识别一只手；捏合拇指和食指开始局部塑形'
        : '双手已就位；捏合拇指和食指开始塑形，松开即停止';
      lastHandAt = now;
      lastHandData = {
        separation: data.separation,
        openness: data.averageOpenness,
        averageY: data.averageY,
        hands: data.hands.map(hand => ({ openness: hand.openness, x: hand.x, y: hand.y }))
      };
      return;
    }
    if (now - handDeformCooldown < 90) return;
    handDeformCooldown = now;
    const activeHands = data.pinchSupported
      ? data.hands.filter(hand => hand.pinching)
      : data.hands;
    const activeHits = activeHands.map(hand => {
      const uv = renderer.screenPointToUv(
        hand.x * els.potteryCanvas.clientWidth,
        hand.y * els.potteryCanvas.clientHeight
      );
      return uv.hit ? { hand, uv, side: hand.x < .5 ? '左侧' : '右侧' } : null;
    }).filter(Boolean);
    const carriedHits = lastActivePinch && lastActivePinch.hits ? lastActivePinch.hits : [];
    const workingHits = activeHits.length ? activeHits : carriedHits;
    if (!workingHits.length) {
      pinchWasActive = false;
      lastActivePinch = null;
      setContactVisible(false);
      els.handMessage.textContent = '已识别手部，但捏合点还没有落到陶器表面';
      return;
    }
    const activePositions = activeHands.map(hand => ({
      x: Number.isFinite(hand.palmX) ? hand.palmX : hand.x,
      y: hand.y
    }));
    const activeX = activePositions.reduce((sum, hand) => sum + hand.x, 0) / activePositions.length;
    const activeY = activePositions.reduce((sum, hand) => sum + hand.y, 0) / activePositions.length;
    const activeHorizontal = activePositions.length > 1
      ? Math.abs(activePositions[1].x - activePositions[0].x)
      : activePositions[0].x;
    const justStarted = !pinchWasActive || !lastActivePinch;
    const pressure = clamp(data.averagePinchStrength == null ? .55 : data.averagePinchStrength, .1, 1);
    const deformationScale = state.pinchForce;
    const anchorY = justStarted ? activeY : (lastActivePinch.anchorY == null ? activeY : lastActivePinch.anchorY);
    const anchorX = justStarted ? activeX : (lastActivePinch.anchorX == null ? activeX : lastActivePinch.anchorX);
    const anchorHorizontal = justStarted
      ? activeHorizontal
      : (lastActivePinch.anchorHorizontal == null ? activeHorizontal : lastActivePinch.anchorHorizontal);
    const verticalTravel = activeY - anchorY;
    const horizontalTravel = activeHorizontal - anchorHorizontal;
    let horizontalLatched = !!(lastActivePinch && lastActivePinch.horizontalLatched);
    let verticalLatched = !!(lastActivePinch && lastActivePinch.verticalLatched);

    if (state.phase === 'clay') {
      if (justStarted) {
        pushHistory('捏合揉泥');
        state.knead = clamp(state.knead + 8 + pressure * 5, 0, 100);
        workingHits.forEach(item => {
          deformLocal(item.uv.v, item.uv.angle, -.025 * (0.65 + pressure * .35) * deformationScale);
        });
        pulseContact();
        els.handMessage.textContent = '捏合一次 · 收紧一次';
      }
      updateKneadUi();
      if (activeHits.length) updateContactFromHands(data, Math.max(.03, pressure));
      else placeContact(
        workingHits.map(item => ({ ...item.uv, side: item.side })),
        { ...workingHits[0].uv, side: workingHits[0].side },
        activeHandActionText() || '保持捏合 · 拖动继续塑形',
        true
      );
      syncRenderer();
      if (state.knead >= 100) {
        const action = els.panelContent.querySelector('[data-action="go-sculpt"]');
        if (action && action.disabled) renderPanel();
      }
    } else {
      if (justStarted) {
        pushHistory('捏合塑形');
        workingHits.forEach(item => {
          deformLocal(item.uv.v, item.uv.angle, -.04 * (0.65 + pressure * .35) * deformationScale);
        });
        pulseContact();
        els.handMessage.textContent = '捏合一次 · 收紧一次';
      } else {
        const horizontalThreshold = activeHands.length > 1 ? .026 : .022;
        const verticalThreshold = .028;
        const horizontalScore = Math.abs(horizontalTravel) / horizontalThreshold;
        const verticalScore = Math.abs(verticalTravel) / verticalThreshold;
        let horizontalReady = !horizontalLatched && horizontalScore >= 1 && horizontalScore >= verticalScore * .78;
        let verticalReady = !verticalLatched && verticalScore >= 1 && verticalScore >= horizontalScore * .78;
        if (horizontalReady && verticalReady) {
          if (horizontalScore >= verticalScore) verticalReady = false;
          else horizontalReady = false;
        }
        if (horizontalReady) {
          const horizontalStep = horizontalTravel > 0 ? .045 : -.045;
          workingHits.forEach(item => {
            deformLocal(item.uv.v, item.uv.angle, horizontalStep * deformationScale);
          });
          rememberHandAction(activeHands.length > 1
            ? (horizontalTravel > 0 ? '双手分开 · 器壁扩张一格' : '双手靠近 · 器壁收窄一格')
            : (horizontalTravel > 0 ? '向右推 · 局部外扩一格' : '向左推 · 局部收窄一格'));
          horizontalLatched = true;
          pulseContact();
          syncRenderer();
        } else if (verticalReady) {
          const step = verticalTravel > 0 ? -.075 : .075;
          state.heightFactor = clamp(state.heightFactor + step * deformationScale, .62, 1.02);
          state.shapeWork = clamp((state.shapeWork || 0) + .04, 0, 1);
          rememberHandAction(verticalTravel > 0 ? '下压一次 · 降低一格' : '上提一次 · 升高一格');
          verticalLatched = true;
          pulseContact();
          syncRenderer();
        } else {
          if (horizontalLatched && Math.abs(horizontalTravel) < .009) horizontalLatched = false;
          if (verticalLatched && Math.abs(verticalTravel) < .009) verticalLatched = false;
        }
        state.edgeSmoothed = false;
      }
      state.throwProgress = throwPercent();
      updateSculptProgressUi();
      if (activeHits.length) updateContactFromHands(data, Math.max(.03, pressure));
      else placeContact(
        workingHits.map(item => ({ ...item.uv, side: item.side })),
        { ...workingHits[0].uv, side: workingHits[0].side },
        activeHandActionText() || '保持捏合 · 拖动继续塑形',
        true
      );
      syncRenderer();
    }
    pinchWasActive = true;
    lastActivePinch = {
      x: activeX,
      y: activeY,
      horizontal: activeHorizontal,
      anchorX,
      anchorY,
      anchorHorizontal,
      horizontalLatched,
      verticalLatched,
      hits: workingHits.map(item => ({ hand: { x: item.hand.x, y: item.hand.y }, uv: item.uv, side: item.side }))
    };
    lastHandAt = now;
    lastHandData = {
      separation: data.separation,
      openness: data.averageOpenness,
      averageY: data.averageY,
      pinching: data.pinching,
      hands: data.hands.map(hand => ({ openness: hand.openness, x: hand.x, y: hand.y }))
    };
  }

  function updateHandDiagnostics(stats) {
    if (!els.handDiagnostics) return;
    els.diagFps.textContent = stats.fps ? stats.fps + ' fps' : '--';
    els.diagHands.textContent = String(stats.hands || 0);
    els.diagPinch.textContent = stats.pinchDistance == null
      ? '--'
      : (stats.pinching ? '捏合 ' : '松开 ') + stats.pinchDistance.toFixed(2);
    els.diagLatency.textContent = stats.latency == null ? '--' : Math.round(stats.latency) + ' ms';
  }

  function updateCalibrationStatus(info) {
    if (!els.calibrationStatus || !info) return;
    if (info.message) {
      els.calibrationStatus.textContent = info.message;
      return;
    }
    els.calibrationStatus.textContent = info.calibrated
      ? '捏合 ' + info.enter.toFixed(2) + ' / 松开 ' + info.release.toFixed(2)
      : '捏合阈值：默认';
  }

  async function calibrateHands() {
    if (!handTracker || !state.cameraOn) {
      toast('请先开启摄像头');
      setCameraPanelExpanded(window.innerWidth >= 981);
      return;
    }
    setCameraPanelExpanded(window.innerWidth >= 981);
    els.calibrateHandsBtn.disabled = true;
    const success = await handTracker.calibrate();
    els.calibrateHandsBtn.disabled = false;
    if (success) {
      updateCalibrationStatus(handTracker.getCalibrationInfo());
      toast('手势校准完成');
    } else {
      toast('手势校准未完成，请保持手掌和拇指、食指清晰可见');
    }
  }

  function createHandTracker() {
    handTracker = new window.DualHandTracker({
      video: els.cameraVideo,
      overlay: els.handOverlay,
      onUpdate: onHandUpdate,
      onDiagnostics: updateHandDiagnostics,
      onCalibration: updateCalibrationStatus,
      onStatus: (message, kind) => {
        els.handMessage.textContent = activeHandActionText() || message;
        if (kind !== 'active') setContactVisible(false);
        const connected = kind === 'active' || kind === 'opening' || kind === 'searching' || kind === 'calibrating';
        els.cameraBadge.textContent = kind === 'active' ? '手部识别' : kind === 'calibrating' ? '校准中' : kind === 'searching' ? '寻找手部' : kind === 'opening' ? '已连接' : kind === 'requesting' ? '连接中' : '未开启';
        els.cameraBadge.classList.toggle('active', connected);
        els.topHandStatus.classList.toggle('active', connected);
        els.topHandStatus.classList.toggle('searching', kind === 'searching' || kind === 'requesting');
        els.topHandStatus.querySelector('span').textContent = kind === 'active' || kind === 'calibrating' ? message : kind === 'searching' ? '摄像头已开 · 寻找手部' : kind === 'opening' ? '摄像头已连接' : message;
      }
    });
    updateCalibrationStatus(handTracker.getCalibrationInfo());
  }

  function setCameraPanelExpanded(expanded) {
    els.cameraBody.hidden = !expanded;
    els.cameraTogglePanelBtn.setAttribute('aria-expanded', String(expanded));
    els.cameraTogglePanelBtn.textContent = expanded ? '收起' : '展开';
    document.body.classList.toggle('camera-expanded', expanded);
    const card = els.cameraBody.closest('.camera-overlay');
    if (card) card.classList.toggle('collapsed', !expanded);
  }

  async function toggleCamera() {
    if (!handTracker) createHandTracker();
    if (state.cameraOn) {
      handTracker.stop();
      state.cameraOn = false;
      els.cameraBtn.textContent = '开启摄像头';
      els.cameraPlaceholder.hidden = false;
      els.calibrateHandsBtn.disabled = true;
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
      els.calibrateHandsBtn.disabled = false;
      setCameraPanelExpanded(true);
      toast(state.wheelOn ? '摄像头已开启，捏合拇指和食指即可塑形' : '摄像头已开启，但转盘仍关闭；打开转盘电源后才能塑形');
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
      els.handMessage.textContent = '张开手掌定位，拇指与食指捏合后开始塑形。';
      pinchWasActive = false;
      lastActivePinch = null;
      handActionFeedback = { text: '', until: 0 };
      return;
    }
    if (!state.wheelOn) {
      toast('请先打开转盘电源');
      return;
    }
    if (!handTracker) createHandTracker();
    state.demoOn = true;
    handActionFeedback = { text: '', until: 0 };
    handTracker.resetDemo();
    els.demoHandsBtn.textContent = '停止演示';
    els.cameraPlaceholder.hidden = true;
    setCameraPanelExpanded(true);
    demoInterval = setInterval(() => handTracker.demoUpdate(), 90);
  }

  function smoothEdges() {
    if (state.phase !== 'sculpt' && state.phase !== 'dry') return;
    pushHistory('边缘修饰');
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
    updateHistoryButtons();
    toast('边缘已顺滑：去除了毛刺与锯齿，同时保留轻微手作起伏');
  }

  function applyGlaze(region, color) {
    pushHistory('区域施釉');
    state.glaze[region] = color;
    const preset = selectedGlazePreset();
    if (preset && color && color.presetId === preset.id) {
      state.finishId = preset.finish;
      state.gloss = preset.gloss;
      state.texture = preset.texture;
    }
    state.hasArtwork = true;
    syncRenderer();
    renderPanel();
    updateHistoryButtons();
    toast((color ? color.name : '露胎') + '已应用到' + regionNames[region]);
  }

  function fillAll() {
    pushHistory('全器施釉');
    const color = selectedGlazePaint();
    Object.keys(state.glaze).forEach(region => { state.glaze[region] = color; });
    const preset = selectedGlazePreset();
    if (preset) {
      state.finishId = preset.finish;
      state.gloss = preset.gloss;
      state.texture = preset.texture;
    }
    state.hasArtwork = true;
    syncRenderer();
    renderPanel();
    updateHistoryButtons();
    toast('全器已填色：' + color.name);
  }

  function clearPaint() {
    pushHistory('清除器表彩绘');
    renderer.clearTexture();
    state.surfaceArtwork = false;
    state.hasArtwork = state.freeArtwork || Object.values(state.glaze).some(Boolean);
    renderPanel();
    updateHistoryButtons();
    toast('器表彩绘已清除');
  }

  function clearFreeCanvas() {
    pushHistory('清空自由画布');
    renderer.clearFreeCanvas();
    state.freeArtwork = false;
    state.hasArtwork = state.surfaceArtwork || Object.values(state.glaze).some(Boolean);
    renderPanel();
    updateHistoryButtons();
    toast('自由画布已清空');
  }

  function stampAround() {
    const stamp = D.STAMPS.find(s => s.id === state.stampId);
    if (!stamp) return;
    pushHistory('环绕贴花');
    for (let i = 0; i < 4; i += 1) {
      renderer.stampUv(i / 4 + .06, .5, stamp.draw, state.stampColor, Math.max(150, state.stampSize * 1.35));
    }
    state.surfaceArtwork = true;
    state.hasArtwork = true;
    renderPanel();
    updateHistoryButtons();
    toast(stamp.name + '已环绕器身一圈');
  }

  function randomDecor() {
    pushHistory('随机配色');
    const colors = D.COLORS.filter(color => color.group === '马卡龙');
    const random = colors[Math.floor(Math.random() * colors.length)];
    state.selectedColorId = random.id;
    state.selectedGlazePresetId = '';
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
    updateHistoryButtons();
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
      updateJourneyPrompt();
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
    els.modal.classList.remove('showing-result');
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
    els.modal.classList.add('showing-result');
    els.kilnView.hidden = true;
    els.resultView.hidden = false;
    els.resultCopy.textContent = state.temperature + '°C ' + (state.atmosphere === 'oxidation' ? '氧化烧' : '还原烧') + '，形成了' + finish.name + '釉面，并且可以从 360° 任意角度欣赏。';
    els.resultSpecs.innerHTML = [
      pieceName(),
      state.temperature + '°C',
      state.atmosphere === 'oxidation' ? '氧化烧' : '还原烧',
      finish.name,
      findTexture(state.texture).name,
      glazeNames
    ].map(text => '<span>' + text + '</span>').join('');
    setResultAngle(state.exportAngle || 'side');
  }

  function resultViewAngles(angle) {
    const views = {
      front: [-.36, .08],
      side: [.92, .25],
      top: [-.36, 1.18]
    };
    return views[angle] || views.side;
  }

  function setResultAngle(angle) {
    const normalized = ['front', 'side', 'top'].includes(angle) ? angle : 'side';
    state.exportAngle = normalized;
    if (resultExportCache.angle !== normalized || !resultExportCache.dataUrl) {
      resultExportCache = {
        angle: normalized,
        dataUrl: renderer.exportPng(normalized)
      };
    }
    const label = { front: '正面', side: '侧面', top: '俯视' }[normalized];
    els.resultArt.innerHTML = '<img style="width:100%;height:100%;object-fit:contain" src="' + resultExportCache.dataUrl + '" alt="' + label + '陶器导出预览"/>';
    els.resultAnglePicker.querySelectorAll('[data-export-angle]').forEach(button => {
      const active = button.dataset.exportAngle === normalized;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function closeModal() {
    if (firingActive) return;
    if (firingTimeout) clearTimeout(firingTimeout);
    firingTimeout = null;
    els.modal.classList.remove('showing-result');
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
    const angleLabel = { front: '正面', side: '侧面', top: '俯视' }[state.exportAngle] || '侧面';
    const name = '泥火之间-' + pieceName() + '-' + angleLabel + '-' + stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) + '-' + pad(stamp.getHours()) + pad(stamp.getMinutes()) + '.png';
    const dataUrl = resultExportCache.angle === state.exportAngle && resultExportCache.dataUrl
      ? resultExportCache.dataUrl
      : renderer.exportPng(state.exportAngle);
    downloadDataUrl(dataUrl, name);
    toast(angleLabel + '视角 PNG 已保存，请到浏览器的下载文件夹查看');
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
    resultExportCache = { angle: null, dataUrl: '' };
    renderer.clearTexture();
    renderer.clearFreeCanvas();
    renderer.setView(-.36, .48);
    lastHandData = null;
    lastHandAt = 0;
    handActionFeedback = { text: '', until: 0 };
    els.cameraBtn.textContent = '开启摄像头';
    els.cameraPlaceholder.hidden = false;
    els.calibrateHandsBtn.disabled = true;
    els.handDiagnostics.hidden = true;
    els.handDiagnosticsBtn.setAttribute('aria-expanded', 'false');
    setCameraPanelExpanded(false);
    els.handMessage.textContent = '张开手掌定位，拇指与食指捏合后开始塑形。';
    els.cameraBadge.textContent = '关闭';
    els.cameraBadge.classList.remove('active');
    els.topHandStatus.classList.remove('active', 'searching');
    els.topHandStatus.querySelector('span').textContent = '摄像头未开启';
    setContactVisible(false);
    [els.centerViewBtn, els.quarterViewBtn, els.topViewBtn].forEach(button => {
      button.classList.toggle('active', button === els.quarterViewBtn);
    });
    els.modal.hidden = true;
    els.modal.classList.remove('showing-result');
    document.body.classList.remove('modal-open');
    els.resultAnglePicker.querySelectorAll('[data-export-angle]').forEach(button => {
      const active = button.dataset.exportAngle === 'side';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderAll();
    toast('新的泥料已经准备好');
  }

  function handlePanelAction(action, button) {
    if (action === 'quick-knead') quickKnead();
    else if (action === 'go-sculpt' && state.knead >= 100) setPhase('sculpt');
    else if (action === 'mouth-style') { state.mouth.style = button.dataset.style; syncRenderer(); renderPanel(); }
    else if (action === 'smooth-edge') smoothEdges();
    else if (action === 'go-dry') setPhase('dry');
    else if (action === 'begin-dry') beginDry();
    else if (action === 'go-bisque' && state.dryProgress >= 100) setPhase('bisque');
    else if (action === 'back-dry') setPhase('dry');
    else if (action === 'start-bisque') openKiln('bisque');
    else if (action === 'decor-mode') {
      state.decorMode = button.dataset.mode;
      renderAll();
    }
    else if (action === 'color-group') { state.colorGroup = button.dataset.group; renderPanel(); }
    else if (action === 'select-color') {
      state.selectedColorId = button.dataset.color;
      state.selectedGlazePresetId = '';
      renderPanel();
    }
    else if (action === 'glaze-category') {
      state.glazeCategory = button.dataset.category;
      renderPanel();
    }
    else if (action === 'select-glaze-preset') {
      const preset = D.GLAZE_PRESETS.find(item => item.id === button.dataset.preset);
      if (!preset) return;
      state.selectedGlazePresetId = preset.id;
      document.querySelectorAll('.glaze-preset-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.preset === preset.id);
      });
      const summary = els.panelContent.querySelector('[data-glaze-summary]');
      if (summary) {
        summary.querySelector('strong').textContent = preset.name;
        summary.querySelector('span').textContent = preset.category + ' · ' + preset.note;
      }
    }
    else if (action === 'select-stamp-color') {
      state.stampColorId = button.dataset.color;
      state.stampColor = selectedStampColor().hex;
      renderPanel();
    }
    else if (action === 'select-region') { state.selectedRegion = button.dataset.region; renderPanel(); }
    else if (action === 'apply-region') applyGlaze(state.selectedRegion, selectedGlazePaint());
    else if (action === 'fill-all') fillAll();
    else if (action === 'select-finish') { state.finishId = button.dataset.finish; syncRenderer(); renderPanel(); }
    else if (action === 'select-texture') { state.texture = button.dataset.texture; syncRenderer(); renderPanel(); }
    else if (action === 'brush-size') { state.brushSize = Number(button.dataset.size); renderPanel(); }
    else if (action === 'rotate-view') {
      state.tool = 'rotate';
      renderAll();
      toast('拖动或滚轮旋转器物；转到背面后点“涂绘 / 贴花”继续绘制');
    }
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
    } else if (range.dataset.range === 'wheel-speed') {
      state.wheelSpeed = Number(range.value) / 100;
      const output = range.parentElement.querySelector('output');
      if (output) output.textContent = range.value + '%';
    } else if (range.dataset.range === 'pinch-force') {
      state.pinchForce = Number(range.value) / 100;
      const output = range.parentElement.querySelector('output');
      if (output) output.textContent = range.value + '%';
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
    if (!Number.isFinite(v) || !Number.isFinite(angle) || !Number.isFinite(delta)) return;
    const profile = state.phase === 'clay' ? state.rawProfile : state.profile;
    if (state.phase !== 'clay' && Number.isFinite(delta)) {
      state.shapeWork = clamp((state.shapeWork || 0) + Math.min(.03, Math.abs(delta) * 1.8), 0, 1);
    }
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
    const rotateIntent = state.tool === 'rotate' || event.altKey || event.button === 2;
    if (event.button != null && event.button !== 0 && !rotateIntent) return;
    if ((state.phase === 'clay' || state.phase === 'sculpt') && !state.wheelOn) {
      toast('请先打开转盘电源');
      return;
    }
    const point = canvasCoords(event);
    pointerDownAt = performance.now();
    pointerStart = point;
    els.potteryCanvas.setPointerCapture(event.pointerId);
    const hoverUv = renderer.screenToUv(point.x, point.y);
    updateContactFromUv(
      hoverUv,
      state.phase === 'clay' ? '泥团受力 · 正在排出气泡' : state.wheelOn ? '按下捏压 · 移动改变器型' : '转盘关闭 · 触点预览',
      true
    );

    if (rotateIntent) {
      renderer.dragging = true;
      sculptDrag = { mode: 'rotate', lastX: point.x, lastY: point.y };
      els.studioStage.classList.add('rotating');
      return;
    }
    if (state.phase === 'clay' || state.phase === 'sculpt') {
      const uv = renderer.screenToUv(point.x, point.y);
      if (!uv.hit) {
        setContactVisible(false);
        return;
      }
      if (state.phase === 'sculpt') pushHistory('局部塑形');
      sculptDrag = { mode: 'sculpt', lastX: point.x, lastY: point.y, uv, moved: 0 };
      return;
    }
    if (state.phase === 'decorate') {
      if (state.decorMode === 'paint' || state.decorMode === 'free') {
        painting = true;
        freePainting = state.decorMode === 'free';
        const brushWidth = state.brushSize * (event.pointerType === 'touch' ? 1.3 : 1);
        if (freePainting) {
          pushHistory('自由画布笔触');
          renderer.endFreeStroke();
          renderer.freePaintAt(point.x, point.y, selectedColor().hex, brushWidth);
          state.freeArtwork = true;
        } else {
          const uv = renderer.screenToUv(point.x, point.y);
          if (!uv.hit) {
            painting = false;
            freePainting = false;
            setContactVisible(false);
            return;
          }
          pushHistory('器表彩绘笔触');
          renderer.lastPaint = null;
          renderer.paintAt(point.x, point.y, selectedColor().hex, brushWidth);
          state.surfaceArtwork = true;
        }
        state.hasArtwork = true;
      } else {
        const uv = renderer.screenToUv(point.x, point.y);
        if (!uv.hit) {
          setContactVisible(false);
          return;
        }
        sculptDrag = { mode: 'tap', lastX: point.x, lastY: point.y, moved: 0 };
      }
    }
  }

  function potteryPointerMove(event) {
    const point = canvasCoords(event);
    const touchBoost = event.pointerType === 'touch' ? 1.65 : 1;
    const brushWidth = state.brushSize * (event.pointerType === 'touch' ? 1.3 : 1);
    if (!sculptDrag && !painting) {
      if (state.phase === 'clay' || state.phase === 'sculpt' || state.phase === 'decorate') {
        updateContactFromUv(
          renderer.screenToUv(point.x, point.y),
          state.wheelOn ? '触点预览 · 按住开始操作' : '转盘关闭 · 触点预览',
          false
        );
      }
      return;
    }
    if (sculptDrag && sculptDrag.mode === 'rotate') {
      const dx = point.x - sculptDrag.lastX;
      const dy = point.y - (sculptDrag.lastY == null ? point.y : sculptDrag.lastY);
      renderer.rotateBy(dx * .0085 * touchBoost);
      renderer.tiltBy(-dy * .006 * touchBoost);
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
        if (uv.hit) sculptDrag.uv = uv;
        const activeUv = sculptDrag.uv;
        if (!activeUv) return;
        if (uv.hit) deformLocal(uv.v, uv.angle, dx * .0022 * state.pinchForce * touchBoost);
        if (state.phase === 'clay') {
          state.knead = clamp(state.knead + Math.abs(dx * touchBoost) * .16 + Math.abs(dy * touchBoost) * .1, 0, 100);
          updateKneadUi();
          updateContactFromUv(uv.hit ? uv : activeUv, '揉泥中 · 含水与受力实时变化', true);
        } else {
          state.heightFactor = clamp(state.heightFactor - dy * .0012 * state.pinchForce * touchBoost, .62, 1.02);
          state.shapeWork = clamp((state.shapeWork || 0) + Math.abs(dy * touchBoost) * .001, 0, 1);
          state.throwProgress = throwPercent();
          state.edgeSmoothed = false;
          syncRenderer();
          updateSculptProgressUi();
          updateContactFromUv(uv.hit ? uv : activeUv, '捏合拖动 · 器型 ' + state.throwProgress + '%', true);
        }
      }
      sculptDrag.lastX = point.x;
      sculptDrag.lastY = point.y;
      return;
    }
    if (painting && state.decorMode === 'paint') {
      const uv = renderer.paintAt(point.x, point.y, selectedColor().hex, brushWidth);
      if (!uv) {
        renderer.endStroke();
        painting = false;
        setContactVisible(false);
      }
    } else if (painting && state.decorMode === 'free') {
      renderer.freePaintAt(point.x, point.y, selectedColor().hex, brushWidth);
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
          const uv = renderer.screenToUv(event.clientX, event.clientY);
          if (uv.hit) {
            pushHistory('器表贴花');
            renderer.stampAt(event.clientX, event.clientY, stamp.draw, state.stampColor, state.stampSize);
            state.surfaceArtwork = true;
            state.hasArtwork = true;
            renderPanel();
            updateHistoryButtons();
            toast(stamp.name + '已贴到陶器表面');
          }
        }
      }
    }
    if (painting) {
      if (freePainting || state.decorMode === 'free') renderer.endFreeStroke();
      else renderer.endStroke();
      painting = false;
      freePainting = false;
      renderPanel();
      updateHistoryButtons();
    }
    if (state.phase === 'clay' && state.knead >= 100) renderPanel();
    if (state.phase === 'sculpt') updateSculptProgressUi();
    renderer.dragging = false;
    sculptDrag = null;
    els.contactFeedback.classList.remove('pinching');
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
    els.cameraTogglePanelBtn.addEventListener('click', () => {
      const expanded = els.cameraBody.hidden;
      if (expanded) closeWorkshopDrawers();
      setCameraPanelExpanded(expanded);
    });
    els.calibrateHandsBtn.addEventListener('click', calibrateHands);
    els.handDiagnosticsBtn.addEventListener('click', () => {
      els.handDiagnostics.hidden = !els.handDiagnostics.hidden;
      els.handDiagnosticsBtn.setAttribute('aria-expanded', String(!els.handDiagnostics.hidden));
    });
    els.refreshCameraBtn.addEventListener('click', refreshCameraDevices);
    els.demoHandsBtn.addEventListener('click', toggleDemoHands);
    els.materialsToggleBtn.addEventListener('click', () => {
      setWorkshopDrawer(document.body.classList.contains('materials-open') ? null : 'materials');
    });
    els.panelToggleBtn.addEventListener('click', () => {
      setWorkshopDrawer(document.body.classList.contains('panel-open') ? null : 'panel');
    });
    els.quickWheelBtn.addEventListener('click', togglePower);
    els.leftDrawerCloseBtn.addEventListener('click', closeWorkshopDrawers);
    els.panelCloseBtn.addEventListener('click', closeWorkshopDrawers);
    els.nextActionBtn.addEventListener('click', runNextAction);
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
    els.redoBtn.addEventListener('click', redo);
    els.centerViewBtn.addEventListener('click', () => setViewMode('center'));
    els.quarterViewBtn.addEventListener('click', () => setViewMode('quarter'));
    els.topViewBtn.addEventListener('click', () => setViewMode('top'));
    els.backPhaseBtn.addEventListener('click', goPreviousPhase);
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
    els.resultAnglePicker.addEventListener('click', event => {
      const button = event.target.closest('[data-export-angle]');
      if (!button) return;
      setResultAngle(button.dataset.exportAngle);
    });
    els.restartBtn.addEventListener('click', () => resetGame(true));
    els.closeModalBtn.addEventListener('click', closeModal);
    els.modal.addEventListener('click', event => { if (event.target === els.modal) closeModal(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !els.modal.hidden) closeModal();
      else if (event.key === 'Escape' && (document.body.classList.contains('materials-open') || document.body.classList.contains('panel-open'))) {
        closeWorkshopDrawers();
      }
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    });
    els.potteryCanvas.addEventListener('pointerdown', potteryPointerDown);
    els.potteryCanvas.addEventListener('pointermove', potteryPointerMove);
    els.potteryCanvas.addEventListener('pointerup', potteryPointerUp);
    els.potteryCanvas.addEventListener('pointercancel', potteryPointerUp);
    els.potteryCanvas.addEventListener('pointerleave', () => {
      if (!sculptDrag && !painting) setContactVisible(false);
    });
    els.potteryCanvas.addEventListener('wheel', event => {
      if (!['sculpt', 'decorate'].includes(state.phase)) return;
      event.preventDefault();
      renderer.rotateBy(event.deltaY * .0018);
    }, { passive: false });
    els.potteryCanvas.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('resize', clearClayHandOverlay);
    els.phases.forEach(button => {
      button.addEventListener('click', () => {
        const targetIndex = phaseOrder.indexOf(button.dataset.phase);
        const currentIndex = phaseOrder.indexOf(state.phase);
        if (targetIndex >= 0 && targetIndex < currentIndex) returnToPhase(button.dataset.phase);
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
