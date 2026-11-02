(function () {
  'use strict';

  const CLAYS = [
    { id: 'white', name: '白瓷泥', base: '#e8dfca', light: '#faf3e4', deep: '#b7a98e', note: '细腻、明亮' },
    { id: 'yellow', name: '黄陶泥', base: '#d2ab6d', light: '#efd39d', deep: '#967044', note: '温暖、可塑性强' },
    { id: 'red', name: '红陶泥', base: '#b96e4f', light: '#dea17e', deep: '#7b412e', note: '颗粒感、适合粗陶' },
    { id: 'purple', name: '紫砂泥', base: '#7f5e58', light: '#a98a80', deep: '#4f3b38', note: '沉稳、烧后温润' },
    { id: 'black', name: '黑陶泥', base: '#5a5049', light: '#82736a', deep: '#302a27', note: '深色、适合刻花' }
  ];

  const COMMON_COLORS = [
    ['porcelain', '瓷白', '#f2ecdf'], ['bone', '骨白', '#e5d7ba'], ['celadon', '青瓷', '#96b4a1'],
    ['sky', '天青', '#afd0d1'], ['cobalt', '钴蓝', '#315c87'], ['navy', '藏青', '#243e61'],
    ['underglaze-red', '釉下红', '#a64b3f'], ['coral', '珊瑚', '#d9836b'], ['rust', '铁锈', '#7d4f3d'],
    ['tenmoku', '黑釉', '#2e302e'], ['ochre', '赭石', '#ad7b45'], ['olive', '橄榄', '#7b8757'],
    ['gold', '金褐', '#b4945e'], ['copper-red', '铜红', '#873c39'], ['stone', '灰石', '#8b8b80'],
    ['plum', '梅子', '#775363'], ['jade', '碧玉', '#618878'], ['cream-yellow', '米黄', '#d8c08a']
  ];

  const MACARON_COLORS = [
    ['sakura', '樱花粉', '#efc9c9'], ['peach', '蜜桃', '#f3d6b7'], ['lemon', '柠檬', '#f2e6aa'],
    ['matcha', '抹茶', '#cfe1c2'], ['aqua', '水蓝', '#bedbd7'], ['powder-blue', '雾霾蓝', '#c9d8ed'],
    ['lavender', '薰衣草', '#d8cce9'], ['rose', '玫瑰', '#eac9dd'], ['milk-tea', '奶茶', '#d7c1a8'],
    ['mint', '薄荷', '#bcd8ca'], ['periwinkle', '长春花', '#bfd0e9'], ['apricot', '杏子', '#f0d5c4'],
    ['strawberry-milk', '草莓奶', '#f1d6df'], ['pistachio', '开心果', '#d8e7d3'], ['vanilla', '香草', '#e8d8b9'],
    ['ice-blue', '冰川蓝', '#ccdde9'], ['taro', '香芋', '#dfd1ec'], ['peach-pink', '奶粉', '#efc8b8'],
    ['cream-pink', '奶油粉', '#f6d4c5'], ['melon', '蜜瓜', '#d9e6c2'], ['sky-milk', '天空奶', '#c7e0e8'],
    ['lilac', '丁香', '#e5d2f2'], ['caramel-milk', '焦糖奶', '#f3dbc8'], ['sage-milk', '鼠尾草', '#cdd9c5']
  ];

  const COLORS = [
    ...COMMON_COLORS.map(([id, name, hex]) => ({ id, name, hex, group: '常用色' })),
    ...MACARON_COLORS.map(([id, name, hex]) => ({ id, name, hex, group: '马卡龙' }))
  ];

  const GLAZE_CATEGORIES = ['全部', '清润', '磨砂', '渐变', '挂釉', '开片', '结晶'];

  const GLAZE_PRESETS = [
    { id: 'moon-white', name: '月白', category: '清润', primary: '#ece9da', secondary: '#cbd7cf', finish: 'soft', gloss: .34, texture: 'smooth', pattern: 'solid', note: '温润月白' },
    { id: 'celadon-clear', name: '青瓷', category: '清润', primary: '#93b49f', secondary: '#c7d7bd', finish: 'gloss', gloss: .56, texture: 'crackle', pattern: 'crackle', note: '清透青绿' },
    { id: 'sky-clear', name: '天青', category: '清润', primary: '#aacbcc', secondary: '#e1ebe2', finish: 'satin', gloss: .44, texture: 'smooth', pattern: 'gradient', note: '雨后天空' },
    { id: 'shadow-blue', name: '影青', category: '清润', primary: '#c6d9d6', secondary: '#f2eee2', finish: 'gloss', gloss: .62, texture: 'rings', pattern: 'gradient', note: '薄透积釉' },
    { id: 'jade-spring', name: '碧玉春', category: '清润', primary: '#6d9480', secondary: '#b6cab1', finish: 'soft', gloss: .42, texture: 'smooth', pattern: 'marble', note: '深碧玉色' },
    { id: 'oat-matte', name: '燕麦', category: '磨砂', primary: '#c9bda4', secondary: '#e2d8c3', finish: 'matte', gloss: .12, texture: 'coarse', pattern: 'solid', note: '柔和砂面' },
    { id: 'tea-dust', name: '茶叶末', category: '磨砂', primary: '#79745d', secondary: '#a9a181', finish: 'matte', gloss: .16, texture: 'coarse', pattern: 'speckle', note: '细碎茶末' },
    { id: 'sandstone', name: '砂岩', category: '磨砂', primary: '#b98d69', secondary: '#d8b48e', finish: 'matte', gloss: .1, texture: 'hammer', pattern: 'speckle', note: '粗粝暖砂' },
    { id: 'iron-rust', name: '铁锈', category: '磨砂', primary: '#8c5541', secondary: '#c68a63', finish: 'satin', gloss: .22, texture: 'coarse', pattern: 'marble', note: '氧化铁斑' },
    { id: 'sesame', name: '芝麻釉', category: '磨砂', primary: '#d9d0b9', secondary: '#5b574d', finish: 'matte', gloss: .14, texture: 'coarse', pattern: 'speckle', note: '黑白颗粒' },
    { id: 'dusk-gradient', name: '晚霞', category: '渐变', primary: '#bf6f62', secondary: '#e8c19a', finish: 'soft', gloss: .4, texture: 'smooth', pattern: 'gradient', note: '暖粉落日' },
    { id: 'sea-salt', name: '海盐', category: '渐变', primary: '#6b9db2', secondary: '#d8e6dc', finish: 'gloss', gloss: .6, texture: 'smooth', pattern: 'gradient', note: '蓝白海风' },
    { id: 'plum-mist', name: '梅子雾', category: '渐变', primary: '#76566d', secondary: '#cbb8c9', finish: 'satin', gloss: .34, texture: 'smooth', pattern: 'gradient', note: '紫粉烟霞' },
    { id: 'autumn-gold', name: '金秋', category: '渐变', primary: '#a66536', secondary: '#e5c078', finish: 'soft', gloss: .46, texture: 'rings', pattern: 'gradient', note: '金棕秋色' },
    { id: 'mist-blue', name: '雾蓝', category: '渐变', primary: '#7f9db2', secondary: '#d5e0e5', finish: 'matte', gloss: .18, texture: 'smooth', pattern: 'gradient', note: '灰蓝雾面' },
    { id: 'blue-drip', name: '蓝釉流金', category: '挂釉', primary: '#315e83', secondary: '#c6a161', finish: 'drip', gloss: .7, texture: 'smooth', pattern: 'drip', note: '蓝底金流' },
    { id: 'cream-falls', name: '奶油瀑布', category: '挂釉', primary: '#e5d4b7', secondary: '#a97754', finish: 'drip', gloss: .52, texture: 'smooth', pattern: 'drip', note: '厚釉垂落' },
    { id: 'ink-silver', name: '墨釉银斑', category: '挂釉', primary: '#343937', secondary: '#a9ada5', finish: 'metal', gloss: .78, texture: 'smooth', pattern: 'speckle', note: '黑釉银光' },
    { id: 'moss-drip', name: '苔痕挂釉', category: '挂釉', primary: '#6e8769', secondary: '#d3d0a8', finish: 'drip', gloss: .48, texture: 'crackle', pattern: 'drip', note: '苔绿流痕' },
    { id: 'ice-celadon', name: '青瓷冰裂', category: '开片', primary: '#a8c4b5', secondary: '#6c887b', finish: 'gloss', gloss: .66, texture: 'crackle', pattern: 'crackle', note: '细密冰裂' },
    { id: 'porcelain-crackle', name: '米白开片', category: '开片', primary: '#e9dfca', secondary: '#a99c87', finish: 'satin', gloss: .36, texture: 'crackle', pattern: 'crackle', note: '暖白开片' },
    { id: 'night-crackle', name: '黑冰', category: '开片', primary: '#373b39', secondary: '#8d928d', finish: 'gloss', gloss: .72, texture: 'crackle', pattern: 'crackle', note: '深色冰纹' },
    { id: 'peach-crackle', name: '霞粉开片', category: '开片', primary: '#d79a91', secondary: '#f0d2c2', finish: 'soft', gloss: .42, texture: 'crackle', pattern: 'crackle', note: '粉色冰纹' },
    { id: 'star-sea', name: '星海', category: '结晶', primary: '#385e78', secondary: '#d8f0de', finish: 'crystal', gloss: .78, texture: 'smooth', pattern: 'crystal', note: '蓝底银晶' },
    { id: 'frost-flower', name: '霜花', category: '结晶', primary: '#c7d6d8', secondary: '#f8f2df', finish: 'crystal', gloss: .7, texture: 'smooth', pattern: 'crystal', note: '霜白结晶' },
    { id: 'gold-sand', name: '金砂', category: '结晶', primary: '#9f7747', secondary: '#efd59d', finish: 'metal', gloss: .84, texture: 'coarse', pattern: 'speckle', note: '金色微粒' },
    { id: 'blue-crystal', name: '蓝晶', category: '结晶', primary: '#48758d', secondary: '#bfe2e4', finish: 'crystal', gloss: .74, texture: 'smooth', pattern: 'crystal', note: '清蓝析晶' },
    { id: 'amber-crystal', name: '琥珀晶', category: '结晶', primary: '#8f5b32', secondary: '#e8b76d', finish: 'crystal', gloss: .8, texture: 'smooth', pattern: 'crystal', note: '暖琥珀晶' }
  ];

  const FINISHES = [
    { id: 'matte', name: '无光', specular: 0.03, shine: 0.05, note: '粗陶、干涩' },
    { id: 'satin', name: '哑光', specular: 0.12, shine: 0.16, note: '柔和、低反光' },
    { id: 'soft', name: '柔光', specular: 0.28, shine: 0.32, note: '温润、细光泽' },
    { id: 'gloss', name: '亮光', specular: 0.52, shine: 0.54, note: '玻璃质高光' },
    { id: 'high', name: '高亮', specular: 0.8, shine: 0.72, note: '强反光、镜面感' },
    { id: 'drip', name: '滴釉', specular: 0.58, shine: 0.62, note: '边缘厚釉流动' },
    { id: 'crystal', name: '结晶', specular: 0.46, shine: 0.48, note: '晶体斑点与析晶' },
    { id: 'metal', name: '金属光', specular: 0.88, shine: 0.78, note: '金属微粒反光' }
  ];

  const TEXTURES = [
    { id: 'smooth', name: '细腻', note: '没有明显肌理' },
    { id: 'rings', name: '拉坯纹', note: '细密水平旋纹' },
    { id: 'crackle', name: '冰裂纹', note: '釉面细碎开片' },
    { id: 'linen', name: '麻布纹', note: '交叉织物压痕' },
    { id: 'hammer', name: '锤目纹', note: '细密锤击凹点' },
    { id: 'carve', name: '刻花纹', note: '斜向刻线' },
    { id: 'coarse', name: '粗陶粒', note: '颗粒与砂质表面' }
  ];

  const PROFILE_SAMPLES = {
    mug: { name: '马克杯', group: '杯子', note: '微收腰的日用杯', keys: [[0,.76],[.08,.8],[.2,.82],[.52,.8],[.78,.76],[.92,.72],[1,.64]], handles: 1 },
    goblet: { name: '高脚杯', group: '杯子', note: '杯口舒展、杯脚收束', keys: [[0,.72],[.08,.78],[.18,.82],[.3,.5],[.46,.25],[.62,.34],[.75,.68],[.9,.78],[1,.66]] },
    tumbler: { name: '直筒杯', group: '杯子', note: '线条利落，适合贴花', keys: [[0,.72],[.05,.76],[.3,.76],[.65,.74],[.9,.7],[1,.64]] },
    bowl: { name: '敞口碗', group: '碗盘', note: '宽口浅腹', keys: [[0,.94],[.12,.98],[.38,.96],[.65,.8],[.86,.48],[1,.36]] },
    plate: { name: '浅口盘', group: '碗盘', note: '低矮宽展', keys: [[0,.92],[.16,.98],[.42,.96],[.68,.78],[.88,.46],[1,.36]] },
    roundVase: { name: '圆肚瓶', group: '花瓶', note: '丰肩收颈', keys: [[0,.3],[.1,.26],[.22,.36],[.42,.8],[.62,1],[.82,.74],[.95,.44],[1,.38]] },
    plumVase: { name: '梅瓶', group: '花瓶', note: '小口丰肩', keys: [[0,.24],[.12,.28],[.24,.42],[.44,.88],[.62,1],[.8,.72],[.94,.4],[1,.34]] },
    bottle: { name: '长颈瓶', group: '花瓶', note: '高颈圆腹', keys: [[0,.2],[.18,.16],[.38,.2],[.55,.76],[.72,.98],[.88,.6],[1,.42]] },
    jar: { name: '双耳罐', group: '罐壶', note: '传统储器轮廓', keys: [[0,.46],[.1,.5],[.28,.72],[.5,1],[.72,.92],[.9,.55],[1,.48]], handles: 2 },
    planter: { name: '花盆', group: '花盆', note: '上宽下收', keys: [[0,.86],[.12,.88],[.35,.82],[.65,.7],[.9,.6],[1,.56]] },
    hexPlanter: { name: '六角花盆', group: '花盆', note: '几何棱面花盆', keys: [[0,.86],[.1,.88],[.3,.82],[.65,.7],[.9,.62],[1,.58]], facets: 6 },
    widePlanter: { name: '长方花盆', group: '花盆', note: '宽口浅盆', keys: [[0,.97],[.08,.98],[.4,.88],[.72,.72],[.94,.58],[1,.54]], facets: 4 }
  };

  const ORDERS = [
    {
      id: 'tea-cup',
      title: '茶桌小杯',
      client: '茶客阿砚',
      seal: '茶',
      accent: '#839b84',
      targetSample: 'mug',
      shapeLabel: '微收腰小杯',
      preferredPresets: ['celadon-clear', 'tea-dust', 'moon-white'],
      preferredTemperatures: [1100, 1240],
      preferredAtmosphere: 'oxidation',
      challenge: '杯口匀净，留住一圈手作纹',
      copy: '不必做得一模一样。小手杯握在掌心里舒服，弧线有一点自己的起伏更好。'
    },
    {
      id: 'flower-vase',
      title: '一枝花小瓶',
      client: '花枝工作室',
      seal: '花',
      accent: '#7194a3',
      targetSample: 'roundVase',
      shapeLabel: '圆腹收颈瓶',
      preferredPresets: ['sea-salt', 'moon-white', 'dusk-gradient'],
      preferredTemperatures: [1240, 1280],
      preferredAtmosphere: 'reduction',
      challenge: '腹部圆润，颈部轻巧',
      copy: '只插一枝花的小瓶。圆腹和细颈不必精确，但轮廓要像一口气提上来的。'
    },
    {
      id: 'star-dish',
      title: '星夜小碟',
      client: '守夜人',
      seal: '星',
      accent: '#66708f',
      targetSample: 'plate',
      shapeLabel: '低矮浅口碟',
      preferredPresets: ['star-sea', 'blue-drip', 'night-crackle'],
      preferredTemperatures: [1240, 1280],
      preferredAtmosphere: 'reduction',
      challenge: '低矮舒展，让釉色像夜空',
      copy: '一件放月光、钥匙或小点心的碟子。轮廓越舒展，烧出来的釉色越有余地。'
    }
  ];

  const STAMP_CATEGORIES = ['卡通形象', '自然叶片', '传统纹样', '可爱元素', '印章纹饰'];

  function line(ctx, s, points, color, width) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p[0] * s, p[1] * s) : ctx.moveTo(p[0] * s, p[1] * s));
    ctx.strokeStyle = color;
    ctx.lineWidth = (width || .055) * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  function circle(ctx, s, x, y, r, fill, stroke, width) {
    ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = (width || .045) * s; ctx.stroke(); }
  }
  function ellipse(ctx, s, x, y, rx, ry, fill, stroke, width) {
    ctx.beginPath(); ctx.ellipse(x * s, y * s, rx * s, ry * s, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = (width || .045) * s; ctx.stroke(); }
  }
  function heartPath(ctx, s, x, y, scale) {
    ctx.beginPath();
    ctx.moveTo((x + 0) * s, (y + .16 * scale) * s);
    ctx.bezierCurveTo((x - .2 * scale) * s, (y - .02 * scale) * s, (x - .18 * scale) * s, (y - .24 * scale) * s, x * s, (y - .1 * scale) * s);
    ctx.bezierCurveTo((x + .18 * scale) * s, (y - .24 * scale) * s, (x + .2 * scale) * s, (y - .02 * scale) * s, x * s, (y + .16 * scale) * s);
    ctx.closePath();
  }

  const STAMPS = [
    { id: 'bunny', name: '兔兔', category: '卡通形象', draw(ctx, s, c) { ellipse(ctx,s,.25,.2,.09,.18,c,c,.04); ellipse(ctx,s,.75,.2,.09,.18,c,c,.04); circle(ctx,s,.5,.55,.24,c,c,.045); circle(ctx,s,.41,.52,.027,'#60483e'); circle(ctx,s,.59,.52,.027,'#60483e'); ellipse(ctx,s,.5,.61,.045,.025,'#d58f91'); line(ctx,s,[[.42,.68],[.47,.72],[.5,.69],[.53,.72],[.58,.68]],c,.035); } },
    { id: 'cat', name: '猫猫', category: '卡通形象', draw(ctx, s, c) { line(ctx,s,[[.22,.3],[.28,.08],[.42,.28]],c,.055); line(ctx,s,[[.78,.3],[.72,.08],[.58,.28]],c,.055); circle(ctx,s,.5,.54,.27,c,c,.045); circle(ctx,s,.4,.52,.03,'#60483e'); circle(ctx,s,.6,.52,.03,'#60483e'); line(ctx,s,[[.33,.62],[.45,.65],[.5,.61],[.55,.65],[.67,.62]],c,.03); } },
    { id: 'bear', name: '熊熊', category: '卡通形象', draw(ctx, s, c) { circle(ctx,s,.25,.28,.13,c,c,.04); circle(ctx,s,.75,.28,.13,c,c,.04); circle(ctx,s,.5,.55,.28,c,c,.045); circle(ctx,s,.4,.51,.03,'#60483e'); circle(ctx,s,.6,.51,.03,'#60483e'); ellipse(ctx,s,.5,.63,.07,.045,'#d19a7a'); } },
    { id: 'panda', name: '熊猫', category: '卡通形象', draw(ctx, s, c) { circle(ctx,s,.24,.25,.13,c,c,.04); circle(ctx,s,.76,.25,.13,c,c,.04); circle(ctx,s,.5,.55,.29,'#fffaf0',c,.045); ellipse(ctx,s,.39,.5,.09,.12,'#4f4944'); ellipse(ctx,s,.61,.5,.09,.12,'#4f4944'); circle(ctx,s,.4,.51,.027,'#fff'); circle(ctx,s,.6,.51,.027,'#fff'); ellipse(ctx,s,.5,.65,.05,.03,'#5c4a43'); } },
    { id: 'fox', name: '狐狸', category: '卡通形象', draw(ctx, s, c) { line(ctx,s,[[.22,.32],[.3,.08],[.45,.3]],c,.055); line(ctx,s,[[.78,.32],[.7,.08],[.55,.3]],c,.055); circle(ctx,s,.5,.55,.27,c,c,.045); circle(ctx,s,.41,.52,.028,'#5e463c'); circle(ctx,s,.59,.52,.028,'#5e463c'); line(ctx,s,[[.5,.61],[.44,.67],[.56,.67],[.5,.61]],'#7c5143',.025); } },
    { id: 'leaf', name: '叶片', category: '自然叶片', draw(ctx, s, c) { ctx.beginPath(); ctx.moveTo(.18*s,.75*s); ctx.bezierCurveTo(.08*s,.25*s,.55*s,.08*s,.82*s,.2*s); ctx.bezierCurveTo(.9*s,.55*s,.62*s,.86*s,.18*s,.75*s); ctx.strokeStyle=c; ctx.lineWidth=.055*s; ctx.stroke(); line(ctx,s,[[.2,.74],[.73,.28]],c,.035); line(ctx,s,[[.36,.67],[.36,.5]],c,.025); line(ctx,s,[[.49,.56],[.48,.38]],c,.025); line(ctx,s,[[.62,.46],[.61,.31]],c,.025); } },
    { id: 'fern', name: '蕨叶', category: '自然叶片', draw(ctx, s, c) { line(ctx,s,[[.16,.84],[.5,.18],[.82,.68]],c,.045); line(ctx,s,[[.26,.67],[.5,.58]],c,.03); line(ctx,s,[[.34,.52],[.58,.42]],c,.03); line(ctx,s,[[.43,.37],[.65,.3]],c,.03); line(ctx,s,[[.52,.3],[.32,.2]],c,.03); line(ctx,s,[[.63,.54],[.78,.46]],c,.03); } },
    { id: 'ginkgo', name: '银杏', category: '自然叶片', draw(ctx, s, c) { ctx.beginPath(); ctx.moveTo(.5*s,.82*s); ctx.bezierCurveTo(.08*s,.65*s,.14*s,.22*s,.48*s,.12*s); ctx.bezierCurveTo(.84*s,.2*s,.92*s,.64*s,.5*s,.82*s); ctx.strokeStyle=c; ctx.lineWidth=.05*s; ctx.stroke(); line(ctx,s,[[.5,.8],[.5,.25]],c,.025); } },
    { id: 'flower', name: '小花', category: '自然叶片', draw(ctx, s, c) { for(let i=0;i<6;i++){ const a=Math.PI*2*i/6; circle(ctx,s,.5+Math.cos(a)*.17,.46+Math.sin(a)*.17,.12,c,c,.035); } circle(ctx,s,.5,.46,.08,'#e9c77d'); line(ctx,s,[[.5,.62],[.5,.9]],c,.035); } },
    { id: 'mushroom', name: '蘑菇', category: '自然叶片', draw(ctx, s, c) { ctx.beginPath(); ctx.arc(.5*s,.42*s,.3*s,Math.PI,0); ctx.closePath(); ctx.fillStyle=c; ctx.fill(); ctx.strokeStyle=c; ctx.lineWidth=.045*s; ctx.stroke(); circle(ctx,s,.4,.3,.04,'#fff'); circle(ctx,s,.62,.34,.03,'#fff'); line(ctx,s,[[.42,.42],[.42,.8],[.58,.8],[.58,.42]],c,.04); } },
    { id: 'meander', name: '回纹', category: '传统纹样', draw(ctx, s, c) { line(ctx,s,[[.04,.25],[.96,.25],[.96,.75],[.22,.75],[.22,.38],[.72,.38],[.72,.62],[.48,.62],[.48,.5],[.6,.5]],c,.055); } },
    { id: 'cloud', name: '祥云', category: '传统纹样', draw(ctx, s, c) { ctx.beginPath(); ctx.moveTo(.08*s,.64*s); ctx.bezierCurveTo(.16*s,.35*s,.42*s,.38*s,.46*s,.55*s); ctx.bezierCurveTo(.58*s,.26*s,.88*s,.42*s,.8*s,.67*s); ctx.bezierCurveTo(.95*s,.7*s,.92*s,.86*s,.75*s,.84*s); ctx.bezierCurveTo(.55*s,.92*s,.28*s,.86*s,.08*s,.64*s); ctx.strokeStyle=c; ctx.lineWidth=.045*s; ctx.stroke(); } },
    { id: 'lotus', name: '莲花', category: '传统纹样', draw(ctx, s, c) { for(let i=0;i<5;i++){ ctx.beginPath(); ctx.ellipse(.5*s,.5*s,.09*s,.28*s,(-.7+i*.35)*Math.PI/2,0,Math.PI*2); ctx.strokeStyle=c; ctx.lineWidth=.035*s; ctx.stroke(); } line(ctx,s,[[.2,.76],[.8,.76]],c,.035); } },
    { id: 'fish', name: '游鱼', category: '传统纹样', draw(ctx, s, c) { ctx.beginPath(); ctx.ellipse(.46*s,.52*s,.28*s,.16*s,0,0,Math.PI*2); ctx.strokeStyle=c; ctx.lineWidth=.045*s; ctx.stroke(); line(ctx,s,[[.72,.52],[.92,.36],[.88,.56],[.92,.72],[.72,.52]],c,.04); circle(ctx,s,.35,.48,.025,c,c,.015); line(ctx,s,[[.18,.44],[.08,.3]],c,.035); line(ctx,s,[[.2,.6],[.08,.76]],c,.035); } },
    { id: 'wave', name: '海水纹', category: '传统纹样', draw(ctx, s, c) { line(ctx,s,[[.03,.35],[.2,.22],[.4,.35],[.6,.22],[.82,.35],[.97,.25]],c,.045); line(ctx,s,[[.03,.55],[.2,.42],[.4,.55],[.6,.42],[.82,.55],[.97,.45]],c,.045); line(ctx,s,[[.03,.75],[.2,.62],[.4,.75],[.6,.62],[.82,.75],[.97,.65]],c,.045); } },
    { id: 'moon', name: '月亮', category: '可爱元素', draw(ctx, s, c) { ctx.beginPath(); ctx.arc(.5*s,.5*s,.3*s,0,Math.PI*2); ctx.strokeStyle=c; ctx.lineWidth=.045*s; ctx.stroke(); circle(ctx,s,.68,.4,.24,'#fffaf0','#fffaf0',0); } },
    { id: 'star', name: '星星', category: '可爱元素', draw(ctx, s, c) { line(ctx,s,[[.5,.05],[.6,.38],[.95,.38],[.67,.58],[.77,.9],[.5,.7],[.23,.9],[.33,.58],[.05,.38],[.4,.38],[.5,.05]],c,.045); } },
    { id: 'rainbow', name: '彩虹', category: '可爱元素', draw(ctx, s, c) { [.15,.27,.39].forEach((y,i)=>{ ctx.beginPath(); ctx.arc(.5*s,.75*s,(.4-i*.08)*s,Math.PI,0); ctx.strokeStyle=i===1?'#d79a86':c; ctx.lineWidth=.04*s; ctx.stroke(); }); } },
    { id: 'heart', name: '爱心', category: '可爱元素', draw(ctx, s, c) { heartPath(ctx,s,.5,.48,.9); ctx.strokeStyle=c; ctx.lineWidth=.05*s; ctx.stroke(); } },
    { id: 'raindrop', name: '雨滴', category: '可爱元素', draw(ctx, s, c) { ctx.beginPath(); ctx.moveTo(.5*s,.08*s); ctx.bezierCurveTo(.75*s,.38*s,.75*s,.68*s,.5*s,.82*s); ctx.bezierCurveTo(.25*s,.68*s,.25*s,.38*s,.5*s,.08*s); ctx.strokeStyle=c; ctx.lineWidth=.05*s; ctx.stroke(); } },
    { id: 'sun', name: '太阳', category: '印章纹饰', draw(ctx, s, c) { circle(ctx,s,.5,.5,.2,c,c,.04); for(let i=0;i<8;i++){ const a=Math.PI*2*i/8; line(ctx,s,[[.5+Math.cos(a)*.27,.5+Math.sin(a)*.27],[.5+Math.cos(a)*.4,.5+Math.sin(a)*.4]],c,.035); } } },
    { id: 'butterfly', name: '蝴蝶', category: '印章纹饰', draw(ctx, s, c) { ellipse(ctx,s,.32,.4,.18,.22,c,c,.035); ellipse(ctx,s,.68,.4,.18,.22,c,c,.035); ellipse(ctx,s,.35,.67,.13,.17,c,c,.035); ellipse(ctx,s,.65,.67,.13,.17,c,c,.035); line(ctx,s,[[.5,.22],[.5,.78]],c,.04); } },
    { id: 'cherry', name: '樱桃', category: '印章纹饰', draw(ctx, s, c) { circle(ctx,s,.34,.65,.18,c,c,.04); circle(ctx,s,.64,.7,.18,c,c,.04); line(ctx,s,[[.34,.47],[.5,.16],[.68,.52]],c,.04); line(ctx,s,[[.5,.16],[.76,.1]],c,.035); } },
    { id: 'berry', name: '莓果', category: '印章纹饰', draw(ctx, s, c) { for(let i=0;i<7;i++){ const a=Math.PI*2*i/7; circle(ctx,s,.5+Math.cos(a)*.17,.54+Math.sin(a)*.17,.1,c,c,.025); } circle(ctx,s,.5,.54,.09,c,c,.03); line(ctx,s,[[.5,.34],[.38,.15]],c,.03); line(ctx,s,[[.5,.34],[.63,.16]],c,.03); } },
    { id: 'sprout', name: '嫩芽', category: '印章纹饰', draw(ctx, s, c) { line(ctx,s,[[.5,.88],[.5,.38]],c,.04); ctx.beginPath(); ctx.ellipse(.36*s,.33*s,.15*s,.08*s,-.5,0,Math.PI*2); ctx.strokeStyle=c; ctx.lineWidth=.035*s; ctx.stroke(); ctx.beginPath(); ctx.ellipse(.64*s,.27*s,.15*s,.08*s,.5,0,Math.PI*2); ctx.stroke(); } }
  ];

  function expandProfile(sample) {
    const keys = sample.keys;
    const points = [];
    for (let i = 0; i < 96; i += 1) {
      const t = i / 95;
      let a = keys[0], b = keys[keys.length - 1];
      for (let k = 0; k < keys.length - 1; k += 1) {
        if (t >= keys[k][0] && t <= keys[k + 1][0]) { a = keys[k]; b = keys[k + 1]; break; }
      }
      const k = (t - a[0]) / Math.max(0.0001, b[0] - a[0]);
      const eased = k * k * (3 - 2 * k);
      points.push(a[1] + (b[1] - a[1]) * eased);
    }
    return points;
  }

  window.StudioData = { CLAYS, COLORS, GLAZE_CATEGORIES, GLAZE_PRESETS, FINISHES, TEXTURES, PROFILE_SAMPLES, ORDERS, STAMP_CATEGORIES, STAMPS, expandProfile };
})();
