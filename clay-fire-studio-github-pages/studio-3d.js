(function () {
  'use strict';

  const TAU = Math.PI * 2;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hexRgb(hex) {
    const clean = String(hex || '#b87555').replace('#', '');
    const value = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
    return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
  }
  function rgbColor(r, g, b, a) {
    return 'rgba(' + Math.round(clamp(r, 0, 255)) + ',' + Math.round(clamp(g, 0, 255)) + ',' + Math.round(clamp(b, 0, 255)) + ',' + (a == null ? 1 : a) + ')';
  }
  function mixRgb(a, b, t) {
    return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
  }
  function normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  }
  function seeded(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  class PotteryCanvas {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.rotation = -0.36;
      this.pitch = 0.34;
      this.minPitch = 0.06;
      this.maxPitch = 1.26;
      this.velocity = 0;
      this.dragging = false;
      this.state = null;
      this.width = 760;
      this.height = 680;
      this.dpr = 1;
      this.textureCanvas = document.createElement('canvas');
      this.textureCanvas.width = 768;
      this.textureCanvas.height = 384;
      this.textureCtx = this.textureCanvas.getContext('2d');
      this.textureData = null;
      this.refreshTexture();
      this.surfaceDecorations = [];
      this.activeSurfaceStroke = null;
      this.grainCanvas = document.createElement('canvas');
      this.grainCanvas.width = 220;
      this.grainCanvas.height = 220;
      const grainContext = this.grainCanvas.getContext('2d');
      const grainImage = grainContext.createImageData(220, 220);
      const random = seeded(48271);
      for (let i = 0; i < grainImage.data.length; i += 4) {
        const value = 95 + Math.floor(random() * 110);
        grainImage.data[i] = value;
        grainImage.data[i + 1] = value;
        grainImage.data[i + 2] = value;
        grainImage.data[i + 3] = 15 + Math.floor(random() * 38);
      }
      grainContext.putImageData(grainImage, 0, 0);
      this.grainPattern = this.ctx.createPattern(this.grainCanvas, 'repeat');
      this.freeCanvas = document.createElement('canvas');
      this.freeCtx = this.freeCanvas.getContext('2d');
      this.lastFreePoint = null;
      this.resize();
      this.boundResize = () => this.resize();
      window.addEventListener('resize', this.boundResize);
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame((time) => this.loop(time));
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.width = Math.max(320, rect.width);
      this.height = Math.max(420, rect.height);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const previousFree = this.freeCanvas;
      this.freeCanvas.width = this.canvas.width;
      this.freeCanvas.height = this.canvas.height;
      this.freeCtx = this.freeCanvas.getContext('2d');
      this.freeCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (previousFree && previousFree.width && previousFree.height) {
        this.freeCtx.drawImage(previousFree, 0, 0, this.width, this.height);
      }
    }

    setState(state) {
      this.state = state;
    }

    refreshTexture() {
      this.textureData = this.textureCtx.getImageData(0, 0, this.textureCanvas.width, this.textureCanvas.height).data;
    }

    clearTexture() {
      this.textureCtx.clearRect(0, 0, this.textureCanvas.width, this.textureCanvas.height);
      this.refreshTexture();
      this.surfaceDecorations = [];
      this.activeSurfaceStroke = null;
      this.lastPaint = null;
    }

    clearFreeCanvas() {
      this.freeCtx.clearRect(0, 0, this.width, this.height);
      this.lastFreePoint = null;
    }

    loop(time) {
      const delta = Math.min(40, time - this.lastTime);
      this.lastTime = time;
      if (!this.dragging) {
        this.rotation += this.velocity * delta;
        this.velocity *= Math.pow(0.92, delta / 16);
        if (Math.abs(this.velocity) < 0.000002) this.velocity = 0;
      }
      if (this.state) this.draw();
      this.raf = requestAnimationFrame((next) => this.loop(next));
    }

    rotateBy(amount) {
      this.rotation += amount;
      this.velocity = amount * 0.035;
    }

    setRotation(value) {
      this.rotation = value;
      this.velocity = 0;
    }

    tiltBy(amount) {
      this.pitch = clamp(this.pitch + amount, this.minPitch, this.maxPitch);
    }

    setView(rotation, pitch) {
      this.setRotation(rotation);
      this.pitch = clamp(pitch == null ? .34 : pitch, this.minPitch, this.maxPitch);
    }

    screenAngle(normalizedX) {
      const rel = clamp((normalizedX - .5) * 2, -.94, .94);
      return Math.PI * 1.5 + Math.asin(rel) - this.rotation;
    }

    profileRadius(v) {
      const profile = this.state && this.state.profile ? this.state.profile : [];
      if (!profile.length) return 0.6;
      const p = clamp(v, 0, 1) * (profile.length - 1);
      const a = Math.floor(p), b = Math.min(profile.length - 1, a + 1);
      let radius = lerp(profile[a], profile[b], p - a);
      const mouth = this.state && this.state.mouth;
      if (mouth && v < .13) {
        const styleScale = mouth.style === 'flare' ? 1.065 : mouth.style === 'inward' ? .94 : 1;
        const target = profile[0] * mouth.diameter * styleScale;
        const weight = Math.exp(-Math.pow(v / .072, 2));
        radius = lerp(radius, target, weight);
      }
      return radius;
    }

    deformedRadius(v, angle) {
      let radius = this.profileRadius(v);
      const lumps = this.state && this.state.lumps ? this.state.lumps : [];
      for (let i = 0; i < lumps.length; i += 1) {
        const lump = lumps[i];
        let delta = Math.atan2(Math.sin(angle - lump.angle), Math.cos(angle - lump.angle));
        const angular = delta / Math.max(.08, lump.angleWidth || .55);
        const vertical = (v - lump.v) / Math.max(.04, lump.vWidth || .13);
        radius += lump.strength * Math.exp(-(angular * angular + vertical * vertical));
      }
      return clamp(radius, .11, 1.25);
    }

    project(radius, angle, v, geometry) {
      const y = geometry.top + v * geometry.span - geometry.centerY;
      const x0 = Math.cos(angle) * radius;
      const z0 = Math.sin(angle) * radius;
      const cosYaw = Math.cos(this.rotation), sinYaw = Math.sin(this.rotation);
      const xYaw = x0 * cosYaw - z0 * sinYaw;
      const zYaw = x0 * sinYaw + z0 * cosYaw;
      const cosPitch = Math.cos(this.pitch), sinPitch = Math.sin(this.pitch);
      const screenY = y * cosPitch - zYaw * sinPitch;
      const z = y * sinPitch + zYaw * cosPitch;
      const scale = geometry.focal / Math.max(geometry.camera * .34, geometry.camera + z);
      return {
        x: geometry.cx + xYaw * scale,
        y: geometry.cy + screenY * scale,
        z,
        scale,
        wx: xYaw,
        wy: screenY
      };
    }

    geometry() {
      const rawClay = this.state && this.state.rawClay;
      const radiusScale = Math.min(this.width, this.height) * (rawClay ? 0.26 : 0.34);
      return {
        cx: this.width * 0.5,
        cy: this.height * (rawClay ? 0.62 : 0.55),
        centerY: 0,
        top: rawClay ? -88 : -158,
        span: rawClay ? 176 : 316,
        radiusScale,
        focal: radiusScale * 5.7,
        camera: radiusScale * 5.7
      };
    }

    materialColor(u, v, region) {
      const state = this.state;
      const clay = state.clay || { base: '#b87555', light: '#dfa17d', deep: '#76452f' };
      let color = hexRgb(clay.base);
      let glazed = false;
      let finish = state.finish || { specular: .2, shine: .25 };
      let glazeColor = null;
      if (region === 'rim' && state.glaze && state.glaze.rim) { glazeColor = state.glaze.rim; glazed = true; }
      else if (region === 'inside' && state.glaze && state.glaze.inside) { glazeColor = state.glaze.inside; glazed = true; }
      else if (region === 'foot' && state.glaze && state.glaze.foot) { glazeColor = state.glaze.foot; glazed = true; }
      else if (state.glaze && state.glaze.body) { glazeColor = state.glaze.body; glazed = true; }
      if (glazeColor) color = hexRgb(glazeColor.hex);
      if (glazed && !state.finalized) color = mixRgb(color, hexRgb(clay.base), .1);
      if (!glazed && state.bisqueDone && !state.finalized) color = mixRgb(color, { r: 245, g: 230, b: 205 }, .12);

      const texture = state.texture || 'smooth';
      const noise = Math.sin(u * 218.7 + v * 391.3) * .5 + .5;
      let mod = 1;
      if (texture === 'rings') mod += Math.sin(v * 145) * .014;
      if (texture === 'linen') mod += (Math.sin(u * 620) * Math.sin(v * 480)) * .035;
      if (texture === 'crackle') mod += Math.sin((u * 28 + v * 15) * Math.PI) * .025;
      if (texture === 'hammer') mod += (noise > .84 ? -.08 : .018);
      if (texture === 'carve') mod += Math.sin((u * 18 + v * 34) * Math.PI) > .72 ? -.07 : .012;
      if (texture === 'coarse') mod += noise * .08 - .04;
      if (glazed) mod += (noise - .5) * .03;
      if (!glazed && state.finalized) mod += noise * .055 - .022;
      if (state.finalized) {
        const tempShift = clamp(((state.fireTemperature || 1240) - 900) / 380, 0, 1);
        color = mixRgb(color, { r: color.r * .55, g: color.g * .5, b: color.b * .47 }, .05 + tempShift * .1);
        if (state.atmosphere === 'reduction') color = mixRgb(color, { r: color.r * .72, g: color.g * .66, b: color.b * .61 }, .13);
        if (state.atmosphere === 'oxidation') color = mixRgb(color, { r: Math.min(255, color.r * 1.08), g: Math.min(255, color.g * 1.06), b: Math.min(255, color.b * 1.02) }, .08);
        if (tempShift > .75 && v > .45) mod += Math.sin(u * 21 + v * 15) * .055;
      }
      color = { r: color.r * mod, g: color.g * mod, b: color.b * mod };
      const activeFinish = glazed ? (state.finalized ? finish : { ...finish, specular: finish.specular * .36, shine: finish.shine * .32 }) : { specular: .018, shine: .025 };
      return { color, glazed, finish: activeFinish };
    }

    drawHandles(context, geometry, front) {
      const state = this.state;
      if (!state || !state.handleCount) return;
      const count = state.handleCount;
      for (let h = 0; h < count; h += 1) {
        const angle = count === 1 ? 0 : (h === 0 ? 0 : Math.PI);
        const z = Math.sin(angle + this.rotation);
        const isFront = z < 0;
        if (isFront !== front) continue;
        const top = this.project(this.profileRadius(.2) * geometry.radiusScale, angle, .22, geometry);
        const bottom = this.project(this.profileRadius(.72) * geometry.radiusScale, angle, .72, geometry);
        const outer = this.project((this.profileRadius(.35) + .26) * geometry.radiusScale, angle, .44, geometry);
        const color = this.materialColor(.42, .45, 'body').color;
        context.save();
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(top.x, top.y);
        context.bezierCurveTo(outer.x, top.y + 7, outer.x, bottom.y - 7, bottom.x, bottom.y);
        context.strokeStyle = rgbColor(color.r * .56, color.g * .54, color.b * .5, .9);
        context.lineWidth = 18 * geometry.radiusScale / 260;
        context.stroke();
        context.strokeStyle = rgbColor(color.r, color.g, color.b, .94);
        context.lineWidth = 13 * geometry.radiusScale / 260;
        context.stroke();
        context.strokeStyle = 'rgba(255,255,255,.12)';
        context.lineWidth = 3;
        context.stroke();
        context.restore();
      }
    }

    draw() {
      const state = this.state;
      if (!state || !state.profile) return;
      const context = this.ctx;
      const width = this.width, height = this.height;
      const geometry = this.geometry();
      const segments = 144;
      const rings = Math.max(144, state.profile.length);
      context.clearRect(0, 0, width, height);

      const shadow = context.createRadialGradient(width * .5, height * .85, 10, width * .5, height * .85, geometry.radiusScale * 1.15);
      shadow.addColorStop(0, 'rgba(63,37,24,.32)');
      shadow.addColorStop(.46, 'rgba(63,37,24,.13)');
      shadow.addColorStop(1, 'rgba(63,37,24,0)');
      context.fillStyle = shadow;
      context.beginPath();
      context.ellipse(width * .5, height * .855, geometry.radiusScale * 1.1, geometry.radiusScale * .22, 0, 0, TAU);
      context.fill();

      context.strokeStyle = 'rgba(115,78,55,.18)';
      context.lineWidth = 1;
      for (let i = 0; i < 3; i += 1) {
        context.beginPath();
        context.ellipse(width * .5, height * .84 + i * 4, geometry.radiusScale * (1.05 - i * .08), geometry.radiusScale * (.18 - i * .009), 0, 0, TAU);
        context.stroke();
      }

      this.drawHandles(context, geometry, false);
      this.drawBottomCap(context, geometry);
      this.drawFoot(context, geometry);

      const vertices = [];
      for (let i = 0; i < rings; i += 1) {
        const v = i / (rings - 1);
        const radius = this.profileRadius(v) * geometry.radiusScale;
        const row = [];
        for (let j = 0; j < segments; j += 1) {
          row.push(this.project(this.deformedRadius(v, j / segments * TAU) * geometry.radiusScale, j / segments * TAU, v, geometry));
        }
        vertices.push(row);
      }

      const faces = [];
      for (let i = 0; i < rings - 1; i += 1) {
        for (let j = 0; j < segments; j += 1) {
          const j2 = (j + 1) % segments;
          const a = vertices[i][j], b = vertices[i][j2], c = vertices[i + 1][j2], d = vertices[i + 1][j];
          faces.push({ a, b, c, d, depth: (a.z + b.z + c.z + d.z) / 4, i, j });
        }
      }
      faces.sort((a, b) => b.depth - a.depth);

      const light = normalize([-.42, .72, -.55]);
      for (let f = 0; f < faces.length; f += 1) {
        const face = faces[f];
        const v = (face.i + .5) / (rings - 1);
        const u = (face.j + .5) / segments;
        const material = this.materialColor(u, v, 'body');
        const edge1 = [face.b.wx - face.a.wx, face.b.wy - face.a.wy, face.b.z - face.a.z];
        const edge2 = [face.d.wx - face.a.wx, face.d.wy - face.a.wy, face.d.z - face.a.z];
        let normal = normalize([
          edge1[1] * edge2[2] - edge1[2] * edge2[1],
          edge1[2] * edge2[0] - edge1[0] * edge2[2],
          edge1[0] * edge2[1] - edge1[1] * edge2[0]
        ]);
        if (normal[2] > 0) normal = [-normal[0], -normal[1], -normal[2]];
        const diffuse = Math.max(0, normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]);
        const edgeOcclusion = .975 + Math.sin(v * Math.PI) * .025;
        const shade = (.78 + diffuse * .24) * edgeOcclusion;
        const specular = material.glazed ? Math.pow(diffuse, 18 + material.finish.specular * 42) * material.finish.specular * (.35 + (state.gloss == null ? .5 : state.gloss) * .9) : 0;
        const r = material.color.r * shade + 255 * specular;
        const g = material.color.g * shade + 255 * specular;
        const b = material.color.b * shade + 255 * specular;
        context.fillStyle = rgbColor(r, g, b);
        context.strokeStyle = context.fillStyle;
        context.lineWidth = .7;
        context.beginPath();
        context.moveTo(face.a.x, face.a.y);
        context.lineTo(face.b.x, face.b.y);
        context.lineTo(face.c.x, face.c.y);
        context.lineTo(face.d.x, face.d.y);
        context.closePath();
        context.fill();
        context.stroke();
      }

      this.drawFormLight(context, geometry);
      this.drawSurfaceDecorations(context, geometry);
      this.drawHandles(context, geometry, true);
      if (state.rawClay) this.drawClayTop(context, geometry);
      else this.drawMouth(context, geometry);
      this.drawSurfaceEffects(context, geometry);
      if (this.freeCanvas) context.drawImage(this.freeCanvas, 0, 0, this.width, this.height);
    }

    surfacePoint(angle, v, geometry, scaleOffset) {
      const radius = this.deformedRadius(v, angle) * geometry.radiusScale * (scaleOffset == null ? 1 : scaleOffset);
      return this.project(radius, angle, v, geometry);
    }

    drawSurfaceDecorations(context, geometry) {
      if (!this.surfaceDecorations.length) return;
      context.save();
      this.silhouettePath(context, geometry);
      context.clip();
      context.lineCap = 'round';
      context.lineJoin = 'round';

      for (let index = 0; index < this.surfaceDecorations.length; index += 1) {
        const decal = this.surfaceDecorations[index];
        if (decal.type === 'stroke') this.drawSurfaceStroke(context, decal, geometry);
        else this.drawSurfaceStamp(context, decal, geometry);
      }

      context.restore();
    }

    drawSurfaceStroke(context, stroke, geometry) {
      if (!stroke.points.length) return;
      context.save();
      context.strokeStyle = stroke.color;
      context.fillStyle = stroke.color;
      context.globalAlpha = .9;
      let previous = null;
      for (let i = 0; i < stroke.points.length; i += 1) {
        const sample = stroke.points[i];
        const point = this.surfacePoint(sample.angle, sample.v, geometry);
        const visible = point.z < geometry.radiusScale * .06;
        if (i === 0 && visible) {
          context.beginPath();
          context.arc(point.x, point.y, Math.max(1.4, stroke.width * point.scale * .48), 0, TAU);
          context.fill();
        }
        if (previous && visible && previous.visible) {
          context.beginPath();
          context.moveTo(previous.point.x, previous.point.y);
          context.lineTo(point.x, point.y);
          context.lineWidth = stroke.width * (previous.point.scale + point.scale) * .5;
          context.stroke();
        }
        previous = { point, visible };
      }
      context.restore();
    }

    drawSurfaceStamp(context, decal, geometry) {
      const anchor = this.surfacePoint(decal.angle, decal.v, geometry);
      if (anchor.z > geometry.radiusScale * .08) return;
      const tangentAngle = decal.angle + .085;
      const tangentPoint = this.surfacePoint(tangentAngle, decal.v, geometry);
      const backPoint = this.surfacePoint(decal.angle - .085, decal.v, geometry);
      const dx = tangentPoint.x - backPoint.x;
      const dy = tangentPoint.y - backPoint.y;
      const tangentLength = Math.max(1, Math.hypot(dx, dy));
      const rotation = Math.atan2(dy, dx);
      const compression = clamp(tangentLength / Math.max(8, anchor.scale * 18), .62, 1.08);
      const width = decal.size * anchor.scale * compression;
      const height = width * (.72 + Math.abs(Math.cos(this.pitch)) * .28);
      const distanceFade = clamp(1 - Math.max(0, anchor.z) / Math.max(1, geometry.radiusScale), .35, 1);
      context.save();
      context.globalAlpha = .94 * distanceFade;
      context.translate(anchor.x, anchor.y);
      context.rotate(rotation);
      context.drawImage(decal.image, -width * .5, -height * .5, width, height);
      context.restore();
    }

    circledPoints(radius, v, geometry, segments) {
      const points = [];
      const count = segments || 72;
      for (let i = 0; i < count; i += 1) {
        points.push(this.project(radius, i / count * TAU, v, geometry));
      }
      return points;
    }

    deformedCirclePoints(v, ratio, geometry, segments) {
      const points = [];
      const count = segments || 72;
      for (let i = 0; i < count; i += 1) {
        const angle = i / count * TAU;
        const radius = this.deformedRadius(v, angle) * geometry.radiusScale * (ratio == null ? 1 : ratio);
        points.push(this.project(radius, angle, v, geometry));
      }
      return points;
    }

    tracePoints(context, points, append) {
      if (!points.length) return;
      if (!append) context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
      context.closePath();
    }

    drawBottomCap(context, geometry) {
      const state = this.state;
      const material = this.materialColor(.5, .995, state.glaze && state.glaze.foot ? 'foot' : 'body').color;
      const points = this.deformedCirclePoints(.998, .98, geometry, 72);
      this.tracePoints(context, points);
      context.fillStyle = rgbColor(material.r * .68, material.g * .65, material.b * .61);
      context.fill();
      context.strokeStyle = 'rgba(54,33,24,.24)';
      context.lineWidth = 1.6;
      context.stroke();
    }

    drawClayTop(context, geometry) {
      const state = this.state;
      const topR = this.profileRadius(0) * geometry.radiusScale;
      const clay = hexRgb(state.clay.base);
      const points = this.circledPoints(topR, 0, geometry, 80);
      const center = this.project(0, 0, 0, geometry);
      const edge = points[0];
      const rx = Math.abs(edge.x - center.x) || topR;
      const grad = context.createRadialGradient(center.x - rx * .26, center.y - rx * .1, 2, center.x, center.y, rx);
      grad.addColorStop(0, rgbColor(clay.r * 1.22, clay.g * 1.2, clay.b * 1.18));
      grad.addColorStop(1, rgbColor(clay.r * .74, clay.g * .72, clay.b * .7));
      context.save();
      this.tracePoints(context, points);
      context.fillStyle = grad;
      context.fill();
      context.strokeStyle = 'rgba(73,43,29,.22)';
      context.lineWidth = 2;
      context.stroke();
      context.restore();
    }

    drawMouth(context, geometry) {
      const state = this.state;
      const mouth = state.mouth || { diameter: 1, rim: .24, depth: .34, style: 'round' };
      const topR = this.profileRadius(0) * geometry.radiusScale;
      const rim = state.glaze && state.glaze.rim ? hexRgb(state.glaze.rim.hex) : { r: 185, g: 117, b: 82 };
      const inside = state.glaze && state.glaze.inside ? hexRgb(state.glaze.inside.hex) : { r: 74, g: 49, b: 39 };
      const style = mouth.style || 'round';
      const innerRatio = clamp(1 - mouth.rim, .5, .9);
      const depth = clamp(mouth.depth, .15, .8);
      const styleScale = style === 'flare' ? 1.035 : style === 'inward' ? .975 : 1;
      const innerR = topR * innerRatio;
      const floorR = innerR * lerp(.82, .58, depth);
      const floorV = .025 + depth * .11;
      const floorFactor = floorR / Math.max(innerR, .001);
      const outer = this.deformedCirclePoints(0, 1, geometry, 88);
      const inner = this.deformedCirclePoints(.003, innerRatio, geometry, 88);
      const floor = this.deformedCirclePoints(floorV, innerRatio * floorFactor, geometry, 72);
      context.save();
      const rimGradient = context.createLinearGradient(geometry.cx - topR, geometry.cy - geometry.span * .42, geometry.cx + topR, geometry.cy - geometry.span * .18);
      rimGradient.addColorStop(0, rgbColor(rim.r * 1.2, rim.g * 1.18, rim.b * 1.12));
      rimGradient.addColorStop(.42, rgbColor(rim.r * .92, rim.g * .88, rim.b * .82));
      rimGradient.addColorStop(1, rgbColor(rim.r * .55, rim.g * .5, rim.b * .46));

      this.tracePoints(context, outer);
      context.fillStyle = rimGradient;
      context.fill();

      this.tracePoints(context, inner);
      context.fillStyle = rgbColor(inside.r * .23, inside.g * .2, inside.b * .19);
      context.fill();

      context.save();
      this.tracePoints(context, inner);
      context.clip();
      const wallRings = 7;
      for (let row = 0; row < wallRings; row += 1) {
        const t0 = row / wallRings;
        const t1 = (row + 1) / wallRings;
        const v0 = lerp(.002, floorV, t0);
        const v1 = lerp(.002, floorV, t1);
        for (let j = 0; j < 72; j += 1) {
          const a0 = j / 72 * TAU;
          const a1 = (j + 1) / 72 * TAU;
            const ratio0 = innerRatio * lerp(1, floorFactor, t0);
            const ratio1 = innerRatio * lerp(1, floorFactor, t1);
            const r0a = this.deformedRadius(v0, a0) * geometry.radiusScale * ratio0;
            const r0b = this.deformedRadius(v0, a1) * geometry.radiusScale * ratio0;
            const r1a = this.deformedRadius(v1, a1) * geometry.radiusScale * ratio1;
            const r1b = this.deformedRadius(v1, a0) * geometry.radiusScale * ratio1;
            const p0 = this.project(r0a, a0, v0, geometry);
            const p1 = this.project(r0b, a1, v0, geometry);
            const p2 = this.project(r1a, a1, v1, geometry);
            const p3 = this.project(r1b, a0, v1, geometry);
          const lightFacing = .58 + Math.max(0, Math.cos(a0 + this.rotation)) * .42;
          const depthShade = 1 - t0 * .56;
          const shade = lightFacing * depthShade;
          context.beginPath();
          context.moveTo(p0.x, p0.y);
          context.lineTo(p1.x, p1.y);
          context.lineTo(p2.x, p2.y);
          context.lineTo(p3.x, p3.y);
          context.closePath();
          context.fillStyle = rgbColor(
            inside.r * (.36 + shade * .9),
            inside.g * (.34 + shade * .86),
            inside.b * (.31 + shade * .8)
          );
          context.strokeStyle = context.fillStyle;
          context.lineWidth = .8;
          context.fill();
          context.stroke();
        }
      }

      const floorCenter = this.project(0, 0, floorV, geometry);
      const floorEdge = floor[0];
      const floorWidth = Math.max(12, Math.abs(floorEdge.x - floorCenter.x));
      const insideGradient = context.createRadialGradient(
        floorCenter.x - floorWidth * .24,
        floorCenter.y - floorWidth * .18,
        2,
        floorCenter.x,
        floorCenter.y,
        floorWidth
      );
      insideGradient.addColorStop(0, rgbColor(inside.r * .86, inside.g * .78, inside.b * .7));
      insideGradient.addColorStop(.55, rgbColor(inside.r * .54, inside.g * .46, inside.b * .42));
      insideGradient.addColorStop(1, rgbColor(inside.r * .18, inside.g * .15, inside.b * .14));
      this.tracePoints(context, floor);
      context.fillStyle = insideGradient;
      context.fill();
      context.restore();

      this.tracePoints(context, outer);
      this.tracePoints(context, inner, true);
      context.fillStyle = rimGradient;
      context.fill('evenodd');
      context.strokeStyle = rgbColor(rim.r * .34, rim.g * .29, rim.b * .26);
      context.lineWidth = 2.2;
      this.tracePoints(context, outer);
      context.stroke();
      context.strokeStyle = rgbColor(rim.r * 1.24, rim.g * 1.14, rim.b * 1.04);
      context.lineWidth = 1.1;
      context.stroke();

      const frontRim = outer.filter((point, index) => point.z <= 0 && index < outer.length * .5 + 3);
      if (frontRim.length > 2) {
        context.beginPath();
        context.moveTo(frontRim[0].x, frontRim[0].y);
        for (let i = 1; i < frontRim.length; i += 1) context.lineTo(frontRim[i].x, frontRim[i].y);
        context.strokeStyle = 'rgba(255,240,219,.34)';
        context.lineWidth = Math.max(1.2, topR * .015);
        context.stroke();
      }
      context.restore();
    }

    silhouettePath(context, geometry) {
      const left = [], right = [];
      const segments = 64;
      for (let i = 0; i < 72; i += 1) {
        const v = i / 71;
        const radius = this.profileRadius(v) * geometry.radiusScale;
        let min = Infinity, max = -Infinity, cy = 0;
        for (let j = 0; j < segments; j += 1) {
          const angle = j / segments * TAU;
          const p = this.project(this.deformedRadius(v, angle) * geometry.radiusScale, angle, v, geometry);
          if (p.x < min) min = p.x;
          if (p.x > max) max = p.x;
          cy = p.y;
        }
        left.push({ x: min, y: cy });
        right.push({ x: max, y: cy });
      }
      context.beginPath();
      context.moveTo(left[0].x, left[0].y);
      left.forEach(p => context.lineTo(p.x, p.y));
      for (let i = right.length - 1; i >= 0; i -= 1) context.lineTo(right[i].x, right[i].y);
      context.closePath();
    }

    drawFormLight(context, geometry) {
      context.save();
      this.silhouettePath(context, geometry);
      context.clip();
      const light = context.createLinearGradient(
        geometry.cx - geometry.radiusScale,
        geometry.cy,
        geometry.cx + geometry.radiusScale,
        geometry.cy
      );
      light.addColorStop(0, 'rgba(255,249,236,.14)');
      light.addColorStop(.28, 'rgba(255,255,255,.055)');
      light.addColorStop(.58, 'rgba(255,255,255,0)');
      light.addColorStop(1, 'rgba(79,48,33,.16)');
      context.fillStyle = light;
      context.fillRect(0, 0, this.width, this.height);
      context.restore();
    }

    drawSurfaceEffects(context, geometry) {
      const state = this.state;
      context.save();
      this.silhouettePath(context, geometry);
      context.clip();
      const finish = state.finish || { shine: .25 };
      const gloss = state.gloss == null ? .5 : state.gloss;
      const bodyGlazed = !!(state.glaze && state.glaze.body);
      if (bodyGlazed) {
        const shine = context.createLinearGradient(geometry.cx - 170, 0, geometry.cx + 130, 0);
        shine.addColorStop(0, 'rgba(255,255,255,0)');
        shine.addColorStop(.28, 'rgba(255,255,255,' + (finish.shine * gloss * .48).toFixed(3) + ')');
        shine.addColorStop(.47, 'rgba(255,255,255,0)');
        shine.addColorStop(.76, 'rgba(255,255,255,' + (finish.shine * gloss * .12).toFixed(3) + ')');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = shine;
        context.fillRect(0, 0, this.width, this.height);

        const glint = context.createRadialGradient(
          geometry.cx - this.width * .16, this.height * .34, 1,
          geometry.cx - this.width * .16, this.height * .34, this.width * .18
        );
        glint.addColorStop(0, 'rgba(255,255,250,' + (.2 + finish.shine * gloss * .34).toFixed(3) + ')');
        glint.addColorStop(.34, 'rgba(255,255,248,' + (.06 + finish.shine * gloss * .12).toFixed(3) + ')');
        glint.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = glint;
        context.fillRect(0, 0, this.width, this.height);
      }

      context.save();
      context.globalAlpha = bodyGlazed ? .045 : (state.finalized ? .17 : .12);
      context.fillStyle = this.grainPattern;
      context.fillRect(0, 0, this.width, this.height);
      context.restore();

      if (!bodyGlazed) {
        const rand = seeded(state.finalized ? 2017 : 111);
        context.fillStyle = state.finalized ? 'rgba(62,40,27,.16)' : 'rgba(91,57,38,.1)';
        for (let i = 0; i < 80; i += 1) {
          context.beginPath();
          context.arc(this.width * (.2 + rand() * .6), this.height * (.25 + rand() * .56), .35 + rand() * 1.1, 0, TAU);
          context.fill();
        }
      }
      if (state.texture === 'crackle' || (state.finalized && (state.fireTemperature || 1240) >= 1200)) {
        const rand = seeded(811);
        context.strokeStyle = 'rgba(72,68,60,.22)';
        context.lineWidth = .7;
        for (let i = 0; i < 20; i += 1) {
          const x = this.width * (.2 + rand() * .6);
          const y = this.height * (.23 + rand() * .58);
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + rand() * 20 - 10, y + 15 + rand() * 21);
          context.lineTo(x + rand() * 15 - 7, y + 30 + rand() * 22);
          context.stroke();
        }
      }
      if (bodyGlazed && state.finish && state.finish.id === 'drip') {
        const rand = seeded(929);
        for (let i = 0; i < 9; i += 1) {
          const x = this.width * (.27 + rand() * .47);
          const y = this.height * .275;
          context.beginPath();
          context.moveTo(x - 2, y);
          context.quadraticCurveTo(x - 7, y + 18 + rand() * 30, x, y + 32 + rand() * 42);
          context.quadraticCurveTo(x + 7, y + 18, x + 2, y);
          context.fillStyle = 'rgba(255,255,255,.07)';
          context.fill();
        }
      }
      if (bodyGlazed && state.finish && state.finish.id === 'crystal') {
        const rand = seeded(1011);
        for (let i = 0; i < 28; i += 1) {
          context.fillStyle = 'rgba(255,255,246,' + (.12 + rand() * .25).toFixed(2) + ')';
          context.beginPath();
          context.arc(this.width * (.25 + rand() * .5), this.height * (.3 + rand() * .45), .7 + rand() * 2.1, 0, TAU);
          context.fill();
        }
      }
      if (state.finalized) {
        const rand = seeded(1224);
        for (let i = 0; i < 5; i += 1) {
          const x = this.width * (.28 + rand() * .44), y = this.height * (.55 + rand() * .25);
          const grd = context.createRadialGradient(x, y, 0, x, y, 50 + rand() * 45);
          grd.addColorStop(0, 'rgba(110,53,31,.11)');
          grd.addColorStop(1, 'rgba(110,53,31,0)');
          context.fillStyle = grd;
          context.beginPath();
          context.arc(x, y, 95, 0, TAU);
          context.fill();
        }
      }
      context.restore();
    }

    drawFoot(context, geometry) {
      const foot = this.state.glaze && this.state.glaze.foot ? hexRgb(this.state.glaze.foot.hex) : hexRgb(this.state.clay.deep);
      const outer = this.deformedCirclePoints(1.006, .64, geometry, 72);
      const inner = this.deformedCirclePoints(1.006, .5, geometry, 72);
      this.tracePoints(context, outer);
      this.tracePoints(context, inner, true);
      context.fillStyle = rgbColor(foot.r * .42, foot.g * .4, foot.b * .37);
      context.fill('evenodd');
      context.strokeStyle = 'rgba(55,33,24,.3)';
      context.lineWidth = 1.2;
      context.stroke();
    }

    screenToUv(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const geometry = this.geometry();
      const maxRadius = Math.max(...this.state.profile) * geometry.radiusScale;
      const rel = clamp((x - geometry.cx) / Math.max(24, maxRadius * 1.04), -.97, .97);
      const angle = Math.PI * 1.5 + Math.asin(rel) - this.rotation;
      let low = 0;
      let high = 1;
      for (let i = 0; i < 16; i += 1) {
        const mid = (low + high) * .5;
        const point = this.project(this.deformedRadius(mid, angle) * geometry.radiusScale, angle, mid, geometry);
        if (point.y < y) low = mid;
        else high = mid;
      }
      const v = clamp((low + high) * .5, .01, .99);
      return {
        u: ((angle % TAU) + TAU) % TAU / TAU,
        v,
        angle,
        x,
        y
      };
    }

    paintAt(clientX, clientY, color, brushWidth) {
      const uv = this.screenToUv(clientX, clientY);
      if (!this.activeSurfaceStroke) {
        this.activeSurfaceStroke = {
          type: 'stroke',
          color,
          width: brushWidth || 9,
          points: []
        };
        this.surfaceDecorations.push(this.activeSurfaceStroke);
      }
      const previous = this.activeSurfaceStroke.points[this.activeSurfaceStroke.points.length - 1];
      if (!previous || Math.abs(previous.angle - uv.angle) > .008 || Math.abs(previous.v - uv.v) > .004) {
        this.activeSurfaceStroke.points.push({ angle: uv.angle, v: uv.v });
      }
      return uv;
    }

    endStroke() {
      this.activeSurfaceStroke = null;
    }

    stampAt(clientX, clientY, drawFn, color, size) {
      const uv = this.screenToUv(clientX, clientY);
      this.stampUv(uv.u, uv.v, drawFn, color, size);
      return uv;
    }

    stampUv(u, v, drawFn, color, size) {
      const scale = size || 92;
      const image = document.createElement('canvas');
      const resolution = Math.max(180, Math.round(scale * 2.2));
      image.width = resolution;
      image.height = resolution;
      const ctx = image.getContext('2d');
      drawFn(ctx, resolution, color);
      this.surfaceDecorations.push({
        type: 'stamp',
        angle: (((u % 1) + 1) % 1) * TAU,
        v: clamp(v, .01, .99),
        size: scale,
        color,
        image
      });
    }

    freePaintAt(clientX, clientY, color, brushWidth) {
      const rect = this.canvas.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, this.width);
      const y = clamp(clientY - rect.top, 0, this.height);
      const ctx = this.freeCtx;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = brushWidth || 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (!this.lastFreePoint) {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2.5, (brushWidth || 10) * .5), 0, TAU);
        ctx.fill();
        this.lastFreePoint = { x, y };
      } else {
        ctx.beginPath();
        ctx.moveTo(this.lastFreePoint.x, this.lastFreePoint.y);
        ctx.quadraticCurveTo(this.lastFreePoint.x, this.lastFreePoint.y, x, y);
        ctx.stroke();
        this.lastFreePoint = { x, y };
      }
      ctx.restore();
    }

    endFreeStroke() {
      this.lastFreePoint = null;
    }

    exportPng() {
      const output = document.createElement('canvas');
      output.width = 1200;
      output.height = 1200;
      const ctx = output.getContext('2d');
      const bg = ctx.createRadialGradient(560, 430, 30, 600, 600, 790);
      bg.addColorStop(0, '#fff9ed');
      bg.addColorStop(.66, '#eedcc4');
      bg.addColorStop(1, '#d7bb96');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1200, 1200);
      const fit = Math.min(960 / this.canvas.width, 790 / this.canvas.height);
      ctx.save();
      ctx.translate(600 - this.canvas.width * fit * .5, 555 - this.canvas.height * fit * .5);
      ctx.drawImage(this.canvas, 0, 0, this.canvas.width * fit, this.canvas.height * fit);
      ctx.restore();
      ctx.fillStyle = 'rgba(84,57,40,.72)';
      ctx.font = '32px "Microsoft YaHei", serif';
      ctx.textAlign = 'center';
      ctx.fillText('泥火之间 · 双手手作', 600, 1080);
      ctx.font = '16px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(84,57,40,.48)';
      ctx.fillText('360° CERAMIC STUDIO · ' + new Date().toLocaleDateString('zh-CN'), 600, 1120);
      return output.toDataURL('image/png');
    }
  }

  window.PotteryCanvas = PotteryCanvas;
})();
