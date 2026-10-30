(function () {
  'use strict';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  class DualHandTracker {
    constructor(options) {
      this.video = options.video;
      this.overlay = options.overlay;
      this.onUpdate = options.onUpdate || function () {};
      this.onStatus = options.onStatus || function () {};
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
      this.analysisInterval = 90;
      this.handCount = 0;
    }

    async start(deviceId) {
      if (this.running) return true;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.onStatus(window.isSecureContext ? '当前浏览器不支持摄像头，可先使用鼠标捏制' : '当前打开方式不安全，请使用课堂启动入口打开游戏', 'error');
        return false;
      }
      try {
        this.onStatus('正在请求摄像头权限…', 'requesting');
        const baseVideo = {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 }
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
        const track = this.stream.getVideoTracks()[0];
        const settings = track && track.getSettings ? track.getSettings() : {};
        const label = track && track.label ? track.label : '摄像头';
        this.running = true;
        this.onStatus(
          label + ' 已开启' + (settings.width ? ' · ' + settings.width + '×' + settings.height : '') + '，正在寻找双手',
          'opening'
        );
        this.loop();
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
      this.onStatus('摄像头已关闭，可使用鼠标或触屏直接塑形', 'off');
    }

    loop() {
      if (!this.running) return;
      const now = performance.now();
      if (now - this.lastAnalysis > this.analysisInterval && this.video.readyState >= 2) {
        this.lastAnalysis = now;
        this.analyze();
      }
      this.timer = requestAnimationFrame(() => this.loop());
    }

    isSkin(r, g, b) {
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      return r > 82 && g > 38 && b > 20 && r > g + 4 && r > b + 3 &&
        max - min > 12 && cb >= 72 && cb <= 132 && cr >= 128 && cr <= 182;
    }

    analyze() {
      const width = this.processingCanvas.width, height = this.processingCanvas.height;
      // Detect in the same mirrored frame shown to the user; no later axis flip is needed.
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
      this.handCount = hands.length === 2 ? 2 : hands.length;
      this.drawOverlay(hands);
      if (hands.length === 2) {
        const separation = Math.abs(hands[1].x - hands[0].x);
        const span = Math.abs(hands[1].y - hands[0].y);
        this.onUpdate({
          hands,
          separation,
          span,
          averageOpenness: (hands[0].openness + hands[1].openness) / 2,
          averageY: (hands[0].y + hands[1].y) / 2
        });
        this.onStatus('双手同步识别中 · 两只手会同时改变坯体', 'active');
      } else if (hands.length === 1) {
        this.onStatus('只找到一只手，请把另一只手也放进画面', 'searching');
      } else {
        this.onStatus('未识别到双手，请把手掌摊开并靠近转盘', 'searching');
      }
    }

    drawOverlay(hands) {
      const width = this.overlay.width = this.video.videoWidth || 640;
      const height = this.overlay.height = this.video.videoHeight || 480;
      const ctx = this.overlayCtx;
      ctx.clearRect(0, 0, width, height);
      if (!hands.length) return;
      hands.forEach((hand, index) => {
        const x = hand.x * width, y = hand.y * height;
        const w = hand.w * width, h = hand.h * height;
        const isLeft = hand.x < .5;
        const label = isLeft ? '左手 L' : '右手 R';
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
        ctx.fillText(label, x - w / 2, Math.max(18, y - h / 2 - 7));
        ctx.restore();
      });
      if (hands.length === 2) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245,225,192,.64)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(hands[0].x * width, hands[0].y * height);
        ctx.lineTo(hands[1].x * width, hands[1].y * height);
        ctx.stroke();
        ctx.restore();
      }
    }

    demoUpdate() {
      const time = performance.now() / 1000;
      const left = {
        x: .38 + Math.sin(time * .88) * .035,
        y: .53 + Math.cos(time * .72) * .045,
        w: .18,
        h: .24,
        area: .045,
        openness: .54 + Math.sin(time * 1.12) * .1
      };
      const right = {
        x: .62 - Math.sin(time * .74) * .04,
        y: .5 + Math.sin(time * .91) * .05,
        w: .18,
        h: .24,
        area: .045,
        openness: .52 - Math.sin(time * 1.03) * .09
      };
      this.handCount = 2;
      this.drawOverlay([left, right]);
      this.onUpdate({ hands: [left, right], separation: right.x - left.x, span: Math.abs(right.y - left.y), averageOpenness: (left.openness + right.openness) / 2, averageY: (left.y + right.y) / 2 });
      this.onStatus('演示双手驱动中 · 画面未使用摄像头', 'active');
    }
  }

  window.DualHandTracker = DualHandTracker;
})();
