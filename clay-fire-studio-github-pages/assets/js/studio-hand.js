(function () {
  'use strict';

  const SCRIPT_URL = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : window.location.href;
  const VENDOR_ROOT = new URL('../vendor/mediapipe/', SCRIPT_URL).href;
  const MODULE_URL = new URL('vision_bundle.mjs', VENDOR_ROOT).href;
  const WASM_ROOT = new URL('wasm', VENDOR_ROOT).href.replace(/\/$/, '');
  const MODEL_URL = new URL('hand_landmarker.task', VENDOR_ROOT).href;
  const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
  ];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  class DualHandTracker {
    constructor(options) {
      this.video = options.video;
      this.overlay = options.overlay;
      this.onUpdate = options.onUpdate || function () {};
      this.onStatus = options.onStatus || function () {};
      this.onDiagnostics = options.onDiagnostics || function () {};
      this.onCalibration = options.onCalibration || function () {};
      this.stream = null;
      this.running = false;
      this.timer = null;
      this.processingCanvas = document.createElement('canvas');
      this.processingCanvas.width = 160;
      this.processingCanvas.height = 120;
      this.processingCtx = this.processingCanvas.getContext('2d', { willReadFrequently: true });
      this.overlayCtx = this.overlay.getContext('2d');
      this.lastHands = null;
      this.lastAnalysis = 0;
      this.analysisInterval = 50;
      this.handCount = 0;
      this.landmarker = null;
      this.landmarkerPromise = null;
      this.usingLandmarker = false;
      this.lastVideoTime = -1;
      this.lastFrameAt = 0;
      this.smoothedHands = [];
      this.handStates = new Map();
      this.thresholds = this.readCalibration();
      this.calibration = null;
      this.fps = 0;
      this.frameCount = 0;
      this.fpsWindowStart = performance.now();
      this.lastDetectionLatency = 0;
      this.lastSentHands = [];
      this.lastSentAt = 0;
      this.demoStartedAt = 0;
    }

    readCalibration() {
      const defaults = { enter: .48, release: .62, calibrated: false };
      try {
        const stored = JSON.parse(localStorage.getItem('clay-fire-hand-calibration') || 'null');
        if (
          stored &&
          Number.isFinite(stored.enter) &&
          Number.isFinite(stored.release) &&
          stored.release > stored.enter
        ) {
          const enter = clamp(stored.enter, .28, .58);
          const release = clamp(stored.release, .42, .82);
          if (release > enter + .08) {
            return { enter, release, calibrated: !!stored.calibrated };
          }
        }
      } catch (error) {}
      return defaults;
    }

    getCalibrationInfo() {
      return { ...this.thresholds };
    }

    async calibrate() {
      const ready = await this.initLandmarker();
      if (!ready || !this.running) {
        this.onCalibration({ phase: 'failed', message: '请先开启摄像头并等待手部模型加载' });
        return false;
      }
      if (this.calibration) return false;
      this.onStatus('手势校准：先张开手掌，再连续捏合', 'calibrating');
      this.onCalibration({ phase: 'open', progress: 0, message: '第 1/2 步：张开手掌并保持' });
      return new Promise(resolve => {
        this.calibration = {
          phase: 'open',
          start: performance.now(),
          openMax: 0,
          closeMin: 1,
          resolve
        };
      });
    }

    async start(deviceId) {
      if (this.running) return true;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.onStatus(
          window.isSecureContext
            ? '当前浏览器不支持摄像头，可先使用鼠标捏制'
            : '当前打开方式不安全，请使用课堂或手机启动入口打开游戏',
          'error'
        );
        return false;
      }
      try {
        this.onStatus('正在请求摄像头权限…', 'requesting');
        const baseVideo = {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 }
        };
        if (deviceId) baseVideo.deviceId = { exact: deviceId };
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ video: baseVideo, audio: false });
        } catch (firstError) {
          if (firstError && firstError.name === 'OverconstrainedError') {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } else {
            throw firstError;
          }
        }
        this.video.srcObject = this.stream;
        this.video.muted = true;
        this.video.playsInline = true;
        await this.video.play();
        this.lastVideoTime = -1;
        this.running = true;
        const track = this.stream.getVideoTracks()[0];
        const settings = track && track.getSettings ? track.getSettings() : {};
        const label = track && track.label ? track.label : '摄像头';
        this.onStatus(
          label + ' 已开启' + (settings.width ? ' · ' + settings.width + '×' + settings.height : '') + '，正在准备手部识别',
          'opening'
        );
        this.loop();
        this.initLandmarker();
        return true;
      } catch (error) {
        this.running = false;
        if (this.stream) this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
        this.video.srcObject = null;
        const messages = {
          NotAllowedError: '摄像头权限被拒绝。请点击地址栏的摄像头图标允许访问，然后重试',
          PermissionDeniedError: '摄像头权限被拒绝。请检查 Windows 和浏览器摄像头权限',
          NotFoundError: '没有找到可用摄像头，请检查摄像头连接',
          DevicesNotFoundError: '没有找到可用摄像头，请检查摄像头连接',
          NotReadableError: '摄像头被其他程序占用，请关闭会议软件或相机后重试',
          TrackStartError: '摄像头被其他程序占用，请关闭会议软件或相机后重试',
          SecurityError: '当前打开方式阻止了摄像头，请使用课堂启动入口打开游戏',
          AbortError: '摄像头启动被系统中断，请重新连接摄像头'
        };
        this.onStatus(messages[error && error.name] || ('摄像头打开失败：' + (error && error.message ? error.message : '未知错误')), 'error');
        return false;
      }
    }

    async initLandmarker() {
      if (this.landmarker) {
        this.usingLandmarker = true;
        return true;
      }
      if (this.landmarkerPromise) return this.landmarkerPromise;
      this.landmarkerPromise = (async () => {
        try {
          this.onStatus('正在加载 AI 手部关键点…', 'opening');
          const visionTasks = await import(MODULE_URL);
          const vision = await visionTasks.FilesetResolver.forVisionTasks(WASM_ROOT);
          try {
            this.landmarker = await visionTasks.HandLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: .42,
              minHandPresenceConfidence: .4,
              minTrackingConfidence: .4
            });
          } catch (gpuError) {
            this.landmarker = await visionTasks.HandLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: .42,
              minHandPresenceConfidence: .4,
              minTrackingConfidence: .4
            });
          }
          this.usingLandmarker = true;
          this.onStatus('AI 手部关键点已就绪，捏合手指即可开始塑形', 'opening');
          return true;
        } catch (error) {
          this.usingLandmarker = false;
          this.landmarkerPromise = null;
          this.onStatus('关键点模型未能加载，已切换到基础双区域追踪', 'searching');
          return false;
        }
      })();
      return this.landmarkerPromise;
    }

    async getDevices() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'videoinput');
      } catch (error) {
        return [];
      }
    }

    stop() {
      this.running = false;
      if (this.timer) cancelAnimationFrame(this.timer);
      this.timer = null;
      if (this.stream) this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.video.srcObject = null;
      this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
      this.handCount = 0;
      this.smoothedHands = [];
      this.demoStartedAt = 0;
      if (this.calibration) {
        const resolve = this.calibration.resolve;
        this.calibration = null;
        this.onCalibration({ phase: 'failed', message: '摄像头已关闭，校准中止' });
        resolve(false);
      }
      this.onStatus('摄像头已关闭，可使用鼠标或触屏直接塑形', 'off');
    }

    loop() {
      if (!this.running) return;
      const now = performance.now();
      if (now - this.lastAnalysis > this.analysisInterval && this.video.readyState >= 2) {
        this.lastAnalysis = now;
        if (this.usingLandmarker && this.landmarker) this.analyzeLandmarks();
        else this.analyzeFallback();
      }
      this.timer = requestAnimationFrame(() => this.loop());
    }

    analyzeLandmarks() {
      if (this.video.currentTime === this.lastVideoTime) return;
      this.lastVideoTime = this.video.currentTime;
      const detectionStarted = performance.now();
      let result;
      try {
        result = this.landmarker.detectForVideo(this.video, performance.now());
      } catch (error) {
        this.usingLandmarker = false;
        this.onStatus('关键点识别暂时不可用，已切换到基础追踪', 'searching');
        return;
      }

      const rawHands = (result.landmarks || []).map((landmarks, index) => {
        const mirrored = landmarks.map(point => ({ x: 1 - point.x, y: point.y }));
        const xs = mirrored.map(point => point.x);
        const ys = mirrored.map(point => point.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const palm = [0, 5, 9, 13, 17].map(i => mirrored[i]);
        const center = palm.reduce((sum, point) => ({ x: sum.x + point.x / palm.length, y: sum.y + point.y / palm.length }), { x: 0, y: 0 });
        const palmWidth = Math.max(.04, distance(mirrored[5], mirrored[17]));
        const palmLength = Math.max(.06, distance(mirrored[0], mirrored[9]));
        const pinchDistance = distance(mirrored[4], mirrored[8]) / palmWidth;
        const pinchX = (mirrored[4].x + mirrored[8].x) / 2;
        const pinchY = (mirrored[4].y + mirrored[8].y) / 2;
        const fingerSpread = [8, 12, 16, 20]
          .map(tip => distance(mirrored[0], mirrored[tip]) / palmLength)
          .reduce((sum, value) => sum + value, 0) / 4;
        const handedness = (result.handedness || result.handednesses || [])[index] || [];
        const handKey = handedness[0] && handedness[0].categoryName
          ? handedness[0].categoryName
          : (pinchX < .5 ? 'ScreenLeft' : 'ScreenRight');
        const state = this.handStates.get(handKey) || {
          pinching: false,
          closeFrames: 0,
          openFrames: 0,
          pinchDistance
        };
        state.pinchDistance = state.pinchDistance * .55 + pinchDistance * .45;
        if (state.pinching) {
          state.openFrames = state.pinchDistance > this.thresholds.release ? state.openFrames + 1 : 0;
          if (state.openFrames >= 3) {
            state.pinching = false;
            state.closeFrames = 0;
            state.openFrames = 0;
          }
        } else {
          state.closeFrames = pinchDistance < this.thresholds.enter ? state.closeFrames + 1 : 0;
          if (state.closeFrames >= 2) {
            state.pinching = true;
            state.closeFrames = 0;
            state.openFrames = 0;
          }
        }
        this.handStates.set(handKey, state);
        return {
          handKey,
          x: pinchX,
          y: pinchY,
          palmX: center.x,
          palmY: center.y,
          w: maxX - minX,
          h: maxY - minY,
          area: (maxX - minX) * (maxY - minY),
          openness: clamp((fingerSpread - .62) / 1.1, 0, 1),
          pinchDistance: state.pinchDistance,
          pinchRawDistance: pinchDistance,
          pinchStrength: clamp((this.thresholds.release - state.pinchDistance) / Math.max(.18, this.thresholds.release - this.thresholds.enter), 0, 1),
          pinching: state.pinching,
          confidence: handedness[0] && Number.isFinite(handedness[0].score) ? handedness[0].score : 0,
          landmarks: mirrored
        };
      });

      this.updateCalibration(rawHands, detectionStarted);
      const hands = rawHands.sort((a, b) => a.x - b.x);

      this.smoothedHands = hands.map(hand => {
        const previous = this.smoothedHands.find(item => item.handKey === hand.handKey);
        const alpha = previous ? .58 : 1;
        return {
          ...hand,
          x: previous ? previous.x * (1 - alpha) + hand.x * alpha : hand.x,
          y: previous ? previous.y * (1 - alpha) + hand.y * alpha : hand.y,
          palmX: previous
            ? previous.palmX * (1 - alpha) + hand.palmX * alpha
            : hand.palmX,
          palmY: previous
            ? previous.palmY * (1 - alpha) + hand.palmY * alpha
            : hand.palmY,
          landmarks: previous
            ? hand.landmarks.map((point, pointIndex) => ({
                x: previous.landmarks[pointIndex].x * (1 - alpha) + point.x * alpha,
                y: previous.landmarks[pointIndex].y * (1 - alpha) + point.y * alpha
              }))
            : hand.landmarks
        };
      });

      this.lastHands = this.smoothedHands;
      this.handCount = this.smoothedHands.length;
      this.drawLandmarkOverlay(this.smoothedHands);
      if (!this.smoothedHands.length) {
        const now = performance.now();
        if (
          this.lastSentHands.length &&
          now - this.lastSentAt < 240 &&
          this.lastSentHands.some(hand => hand.pinching)
        ) {
          this.handCount = this.lastSentHands.length;
          this.drawLandmarkOverlay(this.lastSentHands);
          const heldAverageY = this.lastSentHands.reduce((sum, hand) => sum + hand.y, 0) / this.lastSentHands.length;
          this.onUpdate({
            hands: this.lastSentHands,
            separation: this.lastSentHands.length > 1 ? Math.abs(this.lastSentHands[1].x - this.lastSentHands[0].x) : .35,
            span: this.lastSentHands.length > 1 ? Math.abs(this.lastSentHands[1].y - this.lastSentHands[0].y) : 0,
            averageOpenness: this.lastSentHands.reduce((sum, hand) => sum + hand.openness, 0) / this.lastSentHands.length,
            averageY: heldAverageY,
            averagePinchStrength: this.lastSentHands.reduce((sum, hand) => sum + hand.pinchStrength, 0) / this.lastSentHands.length,
            pinching: true,
            pinchSupported: true,
            handCount: this.lastSentHands.length,
            held: true
          });
          this.onStatus('手部短暂遮挡 · 保持当前操作', 'active');
          this.reportDiagnostics(detectionStarted, this.lastSentHands, true);
          return;
        }
        this.onStatus('未识别到手，请让手掌完整进入画面', 'searching');
        this.reportDiagnostics(detectionStarted, [], false);
        return;
      }

      const separation = this.smoothedHands.length > 1
        ? Math.abs(this.smoothedHands[1].x - this.smoothedHands[0].x)
        : .35;
      const span = this.smoothedHands.length > 1
        ? Math.abs(this.smoothedHands[1].y - this.smoothedHands[0].y)
        : 0;
      const pinching = this.smoothedHands.some(hand => hand.pinching);
      if (!this.calibration) {
        this.lastSentHands = this.smoothedHands.map(hand => ({ ...hand }));
        this.lastSentAt = performance.now();
        this.onUpdate({
          hands: this.smoothedHands,
          separation,
          span,
          averageOpenness: this.smoothedHands.reduce((sum, hand) => sum + hand.openness, 0) / this.smoothedHands.length,
          averageY: this.smoothedHands.reduce((sum, hand) => sum + hand.y, 0) / this.smoothedHands.length,
          averagePinchStrength: this.smoothedHands.reduce((sum, hand) => sum + hand.pinchStrength, 0) / this.smoothedHands.length,
          pinching,
          pinchSupported: true,
          handCount: this.smoothedHands.length
        });
      }
      const countLabel = this.smoothedHands.length === 2 ? '双手' : '单手';
      if (!this.calibration) {
        this.onStatus(
          pinching ? countLabel + '捏合中 · 正在塑形' : countLabel + '已识别 · 捏合拇指和食指开始塑形',
          'active'
        );
      }
      this.reportDiagnostics(detectionStarted, this.smoothedHands, pinching);
    }

    updateCalibration(rawHands, now) {
      if (!this.calibration) return;
      const elapsed = now - this.calibration.start;
      const values = rawHands.map(hand => hand.pinchRawDistance).filter(Number.isFinite);
      if (this.calibration.phase === 'open') {
        values.forEach(value => { this.calibration.openMax = Math.max(this.calibration.openMax, value); });
        this.onCalibration({ phase: 'open', progress: clamp(elapsed / 1600, 0, 1), message: '第 1/2 步：张开手掌并保持' });
        if (elapsed >= 1600) {
          this.calibration.phase = 'close';
          this.calibration.start = now;
          this.onCalibration({ phase: 'close', progress: 0, message: '第 2/2 步：连续捏合拇指和食指' });
          this.onStatus('校准第 2 步：连续捏合再松开', 'calibrating');
        }
        return;
      }

      values.forEach(value => { this.calibration.closeMin = Math.min(this.calibration.closeMin, value); });
      this.onCalibration({ phase: 'close', progress: clamp(elapsed / 1600, 0, 1), message: '第 2/2 步：连续捏合拇指和食指' });
      if (elapsed < 1600) return;

      const openMax = this.calibration.openMax;
      const closeMin = this.calibration.closeMin;
      const spread = openMax - closeMin;
      const success = openMax > .35 && closeMin < .72 && spread >= .12;
      if (success) {
        this.thresholds = {
          enter: clamp(closeMin + spread * .34, .28, .58),
          release: clamp(closeMin + spread * .68, .42, .82),
          calibrated: true
        };
        if (this.thresholds.release <= this.thresholds.enter + .08) {
          this.thresholds.release = clamp(this.thresholds.enter + .1, .42, .82);
        }
        try {
          localStorage.setItem('clay-fire-hand-calibration', JSON.stringify(this.thresholds));
        } catch (error) {}
        this.handStates.clear();
        this.onCalibration({
          phase: 'complete',
          progress: 1,
          message: '校准完成 · 捏合 ' + this.thresholds.enter.toFixed(2) + ' / 松开 ' + this.thresholds.release.toFixed(2)
        });
        this.onStatus('手势校准完成，可以开始捏合塑形', 'active');
      } else {
        this.onCalibration({ phase: 'failed', progress: 1, message: '校准数据不足，已保留默认阈值' });
        this.onStatus('校准未完成，请保证手掌和两根手指完整可见后重试', 'searching');
      }
      const resolve = this.calibration.resolve;
      this.calibration = null;
      resolve(success);
    }

    reportDiagnostics(startedAt, hands, pinching) {
      const now = performance.now();
      this.lastDetectionLatency = now - startedAt;
      this.frameCount += 1;
      if (now - this.fpsWindowStart >= 600) {
        this.fps = Math.round(this.frameCount * 1000 / (now - this.fpsWindowStart));
        this.frameCount = 0;
        this.fpsWindowStart = now;
      }
      const values = hands.map(hand => hand.pinchDistance).filter(Number.isFinite);
      this.onDiagnostics({
        fps: this.fps,
        hands: hands.length,
        pinching,
        pinchDistance: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
        latency: this.lastDetectionLatency,
        enter: this.thresholds.enter,
        release: this.thresholds.release,
        calibrated: this.thresholds.calibrated,
        calibrating: !!this.calibration
      });
    }

    isSkin(r, g, b) {
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      return r > 82 && g > 38 && b > 20 && r > g + 4 && r > b + 3 &&
        max - min > 12 && cb >= 72 && cb <= 132 && cr >= 128 && cr <= 182;
    }

    analyzeFallback() {
      const width = this.processingCanvas.width, height = this.processingCanvas.height;
      this.processingCtx.save();
      this.processingCtx.translate(width, 0);
      this.processingCtx.scale(-1, 1);
      this.processingCtx.drawImage(this.video, 0, 0, width, height);
      this.processingCtx.restore();
      const image = this.processingCtx.getImageData(0, 0, width, height).data;
      const mask = new Uint8Array(width * height);
      for (let y = Math.floor(height * .12); y < Math.floor(height * .96); y += 1) {
        for (let x = Math.floor(width * .04); x < Math.floor(width * .96); x += 1) {
          const i = (y * width + x) * 4;
          if (this.isSkin(image[i], image[i + 1], image[i + 2])) mask[y * width + x] = 1;
        }
      }

      const visited = new Uint8Array(width * height);
      const components = [];
      const stack = new Int32Array(width * height);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const start = y * width + x;
          if (!mask[start] || visited[start]) continue;
          let pointer = 0;
          stack[pointer++] = start;
          visited[start] = 1;
          let count = 0, minX = x, maxX = x, minY = y, maxY = y, sumX = 0, sumY = 0;
          while (pointer > 0) {
            const current = stack[--pointer];
            const cy = Math.floor(current / width), cx = current - cy * width;
            count += 1; sumX += cx; sumY += cy;
            minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
            minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
            const neighbors = [current - 1, current + 1, current - width, current + width];
            for (let n = 0; n < neighbors.length; n += 1) {
              const next = neighbors[n];
              if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
              const nx = next % width;
              if ((n === 0 && nx === width - 1) || (n === 1 && nx === 0)) continue;
              visited[next] = 1;
              stack[pointer++] = next;
            }
          }
          const bw = maxX - minX + 1, bh = maxY - minY + 1;
          const fill = count / Math.max(1, bw * bh);
          if (count > 95 && bw > 9 && bh > 12 && bw < width * .62 && bh < height * .88 && fill > .22) {
            components.push({
              x: sumX / count / width,
              y: sumY / count / height,
              w: bw / width,
              h: bh / height,
              area: count / (width * height),
              openness: clamp(fill, 0, 1)
            });
          }
        }
      }
      components.sort((a, b) => b.area - a.area);
      let hands = components.slice(0, 2);
      if (hands.length === 2 && Math.abs(hands[0].x - hands[1].x) < .08 && hands[0].area + hands[1].area > .17) {
        const merged = hands[0];
        hands = [
          { ...merged, x: merged.x - merged.w * .22, w: merged.w * .48 },
          { ...merged, x: merged.x + merged.w * .22, w: merged.w * .48 }
        ];
      }
      hands.sort((a, b) => a.x - b.x);
      this.lastHands = hands;
      this.handCount = hands.length;
      this.drawBoundingOverlay(hands);
      if (!hands.length) {
        this.onStatus('未识别到手，请把手掌完整放进画面', 'searching');
        return;
      }
      const separation = hands.length > 1 ? Math.abs(hands[1].x - hands[0].x) : .35;
      this.onUpdate({
        hands,
        separation,
        span: hands.length > 1 ? Math.abs(hands[1].y - hands[0].y) : 0,
        averageOpenness: hands.reduce((sum, hand) => sum + hand.openness, 0) / hands.length,
        averageY: hands.reduce((sum, hand) => sum + hand.y, 0) / hands.length,
        averagePinchStrength: 0,
        pinching: true,
        pinchSupported: false,
        handCount: hands.length
      });
      this.onStatus(
        hands.length === 2 ? '基础追踪：双手已锁定，可使用捏压' : '基础追踪：单手已锁定，可继续局部塑形',
        'active'
      );
    }

    drawLandmarkOverlay(hands) {
      const width = this.overlay.width = this.video.videoWidth || 640;
      const height = this.overlay.height = this.video.videoHeight || 480;
      const ctx = this.overlayCtx;
      ctx.clearRect(0, 0, width, height);
      hands.forEach((hand, index) => {
        const isLeft = hand.x < .5;
        const color = isLeft ? '#63e9e5' : '#9aefc8';
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.lineCap = 'round';
        for (const [a, b] of HAND_CONNECTIONS) {
          const p1 = hand.landmarks[a];
          const p2 = hand.landmarks[b];
          ctx.beginPath();
          ctx.moveTo(p1.x * width, p1.y * height);
          ctx.lineTo(p2.x * width, p2.y * height);
          ctx.stroke();
        }
        ctx.shadowBlur = 5;
        hand.landmarks.forEach((point, pointIndex) => {
          ctx.fillStyle = pointIndex === 4 || pointIndex === 8 ? '#fff8e8' : '#d8fffa';
          ctx.beginPath();
          ctx.arc(point.x * width, point.y * height, pointIndex === 4 || pointIndex === 8 ? 4.2 : 2.3, 0, Math.PI * 2);
          ctx.fill();
        });
        if (hand.pinching) {
          const thumb = hand.landmarks[4];
          const indexTip = hand.landmarks[8];
          ctx.strokeStyle = '#f0c778';
          ctx.lineWidth = 3.4;
          ctx.shadowColor = '#f0c778';
          ctx.shadowBlur = 11;
          ctx.beginPath();
          ctx.moveTo(thumb.x * width, thumb.y * height);
          ctx.lineTo(indexTip.x * width, indexTip.y * height);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(240,255,252,.92)';
        ctx.shadowBlur = 3;
        ctx.font = '600 13px "Microsoft YaHei", sans-serif';
        ctx.fillText((isLeft ? '左手' : '右手') + (hand.pinching ? ' · 捏合' : ' · 张开'), hand.x * width - 24, Math.max(20, hand.y * height - hand.h * height / 2 - 8));
        ctx.restore();
      });
    }

    drawBoundingOverlay(hands) {
      const width = this.overlay.width = this.video.videoWidth || 640;
      const height = this.overlay.height = this.video.videoHeight || 480;
      const ctx = this.overlayCtx;
      ctx.clearRect(0, 0, width, height);
      hands.forEach(hand => {
        const x = hand.x * width, y = hand.y * height;
        const w = hand.w * width, h = hand.h * height;
        const isLeft = hand.x < .5;
        ctx.save();
        ctx.strokeStyle = isLeft ? '#f2a7ad' : '#d1b2e5';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, 18);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = isLeft ? 'rgba(244,176,181,.86)' : 'rgba(209,178,229,.86)';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff8ed';
        ctx.font = '600 13px "Microsoft YaHei", sans-serif';
        ctx.fillText(isLeft ? '左手 L' : '右手 R', x - w / 2, Math.max(18, y - h / 2 - 7));
        ctx.restore();
      });
    }

    demoUpdate() {
      if (!this.demoStartedAt) this.demoStartedAt = performance.now();
      const time = (performance.now() - this.demoStartedAt) / 1000;
      const cycle = time % 12;
      const verticalWindow = cycle < 3.6;
      const horizontalWindow = cycle >= 4.2 && cycle < 8.4;
      const holdWindow = cycle >= 8.8 && cycle < 10.4;
      const pinching = verticalWindow || horizontalWindow || holdWindow;
      const ease = value => value * value * (3 - 2 * value);
      const stepAndReset = (moveStart, moveEnd, returnStart, returnEnd, amplitude) => {
        if (cycle < moveStart) return 0;
        if (cycle < moveEnd) return ease((cycle - moveStart) / (moveEnd - moveStart)) * amplitude;
        if (cycle < returnStart) return amplitude;
        if (cycle < returnEnd) return amplitude * (1 - ease((cycle - returnStart) / (returnEnd - returnStart)));
        return 0;
      };
      const lift = verticalWindow
        ? stepAndReset(.6, 1.25, 1.55, 2.05, .04) +
          stepAndReset(2.2, 2.9, 3.2, 3.6, -.04)
        : 0;
      const sweep = horizontalWindow
        ? stepAndReset(4.7, 5.4, 5.65, 6.1, .045) +
          stepAndReset(6.55, 7.25, 7.55, 7.95, -.045)
        : 0;
      const leftX = .43 - sweep;
      const rightX = .57 + sweep;
      const leftY = .64 + lift;
      const rightY = .61 + lift;
      const makeLandmarks = (x, y, side, closed) => {
        const points = [
          [.5, .9], [.42, .76], [.35, .66], [.28, .58], [.21, .5],
          [.43, .57], [.4, .39], [.38, .24], [.36, .1],
          [.52, .55], [.52, .34], [.51, .18], [.51, .03],
          [.61, .58], [.64, .38], [.66, .24], [.68, .1],
          [.69, .64], [.75, .48], [.8, .36], [.84, .25]
        ];
        if (closed) {
          points[4] = [.43, .27];
          points[8] = [.48, .25];
        }
        return points.map(([px, py]) => ({
          x: x + (px - .5) * .17 * (side === 'left' ? -1 : 1),
          y: y + (py - .5) * .3
        }));
      };
      const left = {
        x: leftX,
        y: leftY,
        palmX: leftX,
        palmY: leftY,
        w: .18,
        h: .24,
        area: .045,
        openness: .54 + Math.sin(time * 1.12) * .1,
        pinchStrength: pinching ? .7 : 0,
        pinching,
        landmarks: makeLandmarks(leftX, leftY, 'left', pinching)
      };
      const right = {
        x: rightX,
        y: rightY,
        palmX: rightX,
        palmY: rightY,
        w: .18,
        h: .24,
        area: .045,
        openness: .52 - Math.sin(time * 1.03) * .09,
        pinchStrength: pinching ? .65 : 0,
        pinching,
        landmarks: makeLandmarks(rightX, rightY, 'right', pinching)
      };
      this.handCount = 2;
      this.drawLandmarkOverlay([left, right]);
      this.onUpdate({
        hands: [left, right],
        separation: right.x - left.x,
        span: Math.abs(right.y - left.y),
        averageOpenness: (left.openness + right.openness) / 2,
        averageY: (left.y + right.y) / 2,
        averagePinchStrength: pinching ? .675 : 0,
        pinching,
        pinchSupported: true,
        handCount: 2
      });
      const demoLabel = verticalWindow
        ? '演示双手 · 上提下压'
        : horizontalWindow
          ? '演示双手 · 左右开合'
          : pinching
            ? '演示双手 · 捏合保持'
            : '演示双手 · 松开状态';
      this.onStatus(demoLabel, 'active');
    }

    resetDemo() {
      this.demoStartedAt = performance.now();
    }
  }

  window.DualHandTracker = DualHandTracker;
})();
