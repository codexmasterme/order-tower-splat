/* 秩序尖塔 · ORDER TOWER —— 引擎 */
(function () {
  const CFG = window.CONFIG, CHIPS = window.CHIPS, COLORS = window.COLORS;
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; };
  const el = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let G = null;   // 全局游戏状态

  function newGame() {
    G = {
      hp: CFG.maxHp, maxHp: CFG.maxHp, shards: 0, floor: 1,
      deck: window.STARTER.slice(),
      palette: { red: 0, blue: 0, yellow: 0, purple: 0 }, // 全程打出的各色芯片数
      cleared: 0, peace: false,
      combat: null, pending: null
    };
    renderMap();
  }

  // ============================ 楼层地图 ============================
  const NODE_TYPES = {
    combat: { icon: '⚔', name: '战斗层',  desc: '一场被同化的敌人挡在前路。' },
    elite:  { icon: '☠', name: '精英层',  desc: '强敌把守，胜则厚赏。' },
    shop:   { icon: '🛒', name: '补给站',  desc: '用记忆碎片换取芯片与治疗。' },
    event:  { icon: '❓', name: '异常信号', desc: '塔中传来说不清的波动。' },
    rest:   { icon: '🔥', name: '整备点',  desc: '休整、回血，或重铸芯片。' }
  };
  function rollNodes() {
    // 依楼层给出 2-3 个候选节点
    const n = G.floor <= 2 ? 2 : (Math.random() < 0.5 ? 2 : 3);
    const bag = [];
    const w = { combat: 5, event: 3, shop: 2, rest: 2, elite: G.floor >= 4 ? 2 : 0 };
    const types = Object.keys(w);
    const out = [];
    // 保证至少一个战斗类
    out.push(Math.random() < 0.75 ? 'combat' : 'elite');
    while (out.length < n) {
      const roll = []; types.forEach(t => { for (let i = 0; i < w[t]; i++) roll.push(t); });
      const t = pick(roll);
      out.push(t);
    }
    return shuffle(out);
  }

  function renderMap() {
    G.combat = null;
    if (G.floor > CFG.floors) return endGame('win');
    const isBoss = G.floor === CFG.floors;
    let html = topBar();
    html += `<div class="tower-head"><div class="floor-num">第 ${G.floor} / ${CFG.floors} 层</div>`;
    html += `<div class="tower-sub">${isBoss ? '塔顶 · 平行卡农就在门后' : '选择你要踏入的下一层'}</div></div>`;
    if (isBoss) {
      html += `<div class="node-list"><button class="node-card boss" data-node="boss">
        <div class="node-icon">👑</div><div class="node-name">塔顶决战</div>
        <div class="node-desc">直面「平行卡农」——被秩序同化的终焉。</div></button></div>`;
    } else {
      const nodes = rollNodes();
      html += `<div class="node-list">`;
      nodes.forEach((t, i) => {
        const nt = NODE_TYPES[t];
        html += `<button class="node-card ${t}" data-node="${t}">
          <div class="node-icon">${nt.icon}</div><div class="node-name">${nt.name}</div>
          <div class="node-desc">${nt.desc}</div></button>`;
      });
      html += `</div>`;
    }
    html += deckBar();
    setScreen(html);
    document.querySelectorAll('.node-card').forEach(b => b.addEventListener('click', () => onNode(b.dataset.node)));
    bindDeckPeek();
  }

  function onNode(type) {
    if (type === 'boss') return startCombat(clone(window.ENEMIES.boss), 'boss');
    if (type === 'combat') return startCombat(spawnNormal(), 'combat');
    if (type === 'elite') return startCombat(spawnElite(), 'elite');
    if (type === 'shop') return renderShop();
    if (type === 'rest') return renderRest();
    if (type === 'event') return renderEvent(clone(pick(window.EVENTS)));
  }

  function scaleEnemy(e) {
    const f = G.floor;
    e.maxHp = Math.round(e.hp * (1 + f * 0.05));
    e.hp = e.maxHp;
    e.intents = e.intents.map(it => ({ ...it, v: it.type === 'attack' ? Math.round(it.v * (1 + f * 0.035)) : it.v }));
    return e;
  }
  function spawnNormal() { return scaleEnemy(clone(pick(window.ENEMIES.normal))); }
  function spawnElite() { return scaleEnemy(clone(pick(window.ENEMIES.elite))); }

  // ============================ 战斗 ============================
  function startCombat(enemy, kind) {
    enemy.block = 0; enemy.weak = 0; enemy.corrupt = 0; enemy.buff = 0; enemy.intentIdx = 0;
    G.combat = {
      enemy, kind,
      draw: shuffle(G.deck.slice()), hand: [], discard: [],
      energy: CFG.energy, block: 0, thorn: 0, power: 0, corrupt: 0,
      turnColors: {}, log: []
    };
    startPlayerTurn(true);
  }

  function startPlayerTurn(first) {
    const c = G.combat;
    c.block = 0; c.thorn = 0; c.turnColors = {};
    // 玩家侵蚀结算
    if (c.corrupt > 0) { dealSelf(c.corrupt, '你受到侵蚀 ' + c.corrupt); c.corrupt = Math.max(0, c.corrupt - 1); }
    if (G.hp <= 0) return endGame('dead');
    c.energy = CFG.energy;
    drawCards(CFG.handSize);
    renderCombat();
  }

  function drawCards(n) {
    const c = G.combat;
    for (let i = 0; i < n; i++) {
      if (!c.draw.length) { if (!c.discard.length) break; c.draw = shuffle(c.discard); c.discard = []; }
      c.hand.push(c.draw.pop());
    }
  }

  function playChip(handIdx) {
    const c = G.combat; const id = c.hand[handIdx]; const chip = CHIPS[id];
    if (!chip || c.energy < chip.cost) return;
    c.energy -= chip.cost;
    c.hand.splice(handIdx, 1); c.discard.push(id);
    const tc = c.turnColors[chip.color] || 0;

    // 伤害
    if (chip.dmg != null) {
      let d = chip.dmg + c.power;
      if (chip.scale && chip.scale.stat === 'dmg') d += tc * chip.scale.per;
      if (chip.bonusCorrupt) d += (c.enemy.corrupt || 0) * chip.bonusCorrupt;
      dealEnemy(d);
      if (chip.drain) heal(Math.floor(d / 2));
    }
    // 护盾
    if (chip.block != null) {
      let b = chip.block;
      if (chip.scale && chip.scale.stat === 'block') b += tc * chip.scale.per;
      c.block += b;
    }
    if (chip.thorn) c.thorn += chip.thorn;
    if (chip.heal) heal(chip.heal);
    if (chip.selfLose) dealSelf(chip.selfLose, '');
    if (chip.energy) c.energy += chip.energy;
    if (chip.draw) drawCards(chip.draw);
    if (chip.power) c.power += chip.power;
    if (chip.cleanse) c.corrupt = 0;
    if (chip.corrupt) c.enemy.corrupt = (c.enemy.corrupt || 0) + chip.corrupt;
    if (chip.weak) c.enemy.weak = (c.enemy.weak || 0) + chip.weak;

    c.turnColors[chip.color] = tc + 1;
    G.palette[chip.color] = (G.palette[chip.color] || 0) + 1;

    if (c.enemy.hp <= 0) return winCombat();
    if (G.hp <= 0) return endGame('dead');
    renderCombat();
  }

  function dealEnemy(d) { const e = G.combat.enemy; let dmg = Math.max(0, Math.round(d)); const ab = Math.min(e.block, dmg); e.block -= ab; dmg -= ab; e.hp = Math.max(0, e.hp - dmg); }
  function dealSelf(d, msg) { const c = G.combat; let dmg = Math.max(0, Math.round(d)); const ab = Math.min(c.block, dmg); c.block -= ab; dmg -= ab; G.hp = Math.max(0, G.hp - dmg); }
  function heal(h) { G.hp = clamp(G.hp + h, 0, G.maxHp); }

  function endTurn() {
    const c = G.combat;
    // 敌人侵蚀结算（紫毒）
    if (c.enemy.corrupt > 0) { c.enemy.hp = Math.max(0, c.enemy.hp - c.enemy.corrupt); c.enemy.corrupt = Math.max(0, c.enemy.corrupt - 1); if (c.enemy.hp <= 0) return winCombat(); }
    // 弃手牌
    c.discard = c.discard.concat(c.hand); c.hand = [];
    // 敌人行动
    enemyAct();
    if (G.hp <= 0) return endGame('dead');
    if (c.enemy.hp <= 0) return winCombat();
    startPlayerTurn(false);
  }

  function enemyAct() {
    const c = G.combat, e = c.enemy;
    const it = e.intents[e.intentIdx % e.intents.length];
    e.intentIdx++;
    if (it.type === 'attack') {
      const times = it.times || 1;
      for (let k = 0; k < times; k++) {
        let dmg = it.v + (e.buff || 0);
        if (e.weak > 0) dmg = Math.round(dmg * 0.6);
        // 反弹
        let taken = dmg; const ab = Math.min(c.block, taken); c.block -= ab; taken -= ab;
        G.hp = Math.max(0, G.hp - taken);
        if (c.thorn && dmg > 0) e.hp = Math.max(0, e.hp - c.thorn);
        if (G.hp <= 0) return;
      }
    } else if (it.type === 'corrupt') {
      c.corrupt += it.v;
    } else if (it.type === 'buff') {
      e.buff = (e.buff || 0) + it.v;
    } else if (it.type === 'block') {
      e.block = (e.block || 0) + it.v;
    }
    if (e.weak > 0) e.weak--;
  }

  function nextIntent() {
    const e = G.combat.enemy; const it = e.intents[e.intentIdx % e.intents.length];
    if (it.type === 'attack') { let v = it.v + (e.buff || 0); if (e.weak > 0) v = Math.round(v * 0.6); return { txt: '攻击 ' + v + (it.times > 1 ? ' ×' + it.times : ''), cls: 'atk' }; }
    if (it.type === 'corrupt') return { txt: '侵蚀 +' + it.v, cls: 'cor' };
    if (it.type === 'buff') return { txt: '强化 +' + it.v, cls: 'buf' };
    if (it.type === 'block') return { txt: '护盾 +' + it.v, cls: 'blk' };
    return { txt: '?', cls: '' };
  }

  function winCombat() {
    G.combat = null; G.cleared++;
    if (G.floor === CFG.floors) return endGame('win');
    const reward = G.floor >= 4 && Math.random() < 0.5 ? 34 : 22;
    G.shards += reward + rnd(10);
    renderReward();
  }

  // ============================ 奖励 / 商店 / 整备 / 事件 ============================
  function threeChips() {
    const pool = shuffle(window.REWARD_POOL); const seen = {}; const out = [];
    for (const id of pool) { if (!seen[id]) { seen[id] = 1; out.push(id); } if (out.length === 3) break; }
    return out;
  }
  function renderReward() {
    const chips = threeChips();
    let html = topBar() + `<div class="panel-head">胜利！三选一，收入一枚芯片</div>`;
    html += `<div class="chip-choice">` + chips.map(id => chipCard(id, 'reward')).join('') + `</div>`;
    html += `<div class="center"><button class="btn ghost" id="skip">放弃，继续前进</button></div>`;
    html += deckBar();
    setScreen(html);
    document.querySelectorAll('.chip-card[data-pick]').forEach(b => b.addEventListener('click', () => { G.deck.push(b.dataset.pick); advance(); }));
    el('skip').addEventListener('click', advance);
    bindDeckPeek();
  }

  function renderShop() {
    const stock = threeChips().concat(threeChips().slice(0, 1));
    const uniq = [...new Set(stock)].slice(0, 4);
    let html = topBar() + `<div class="panel-head">补给站 · 记忆碎片 ${G.shards}</div><div class="shop-list">`;
    uniq.forEach(id => { const price = 24 + rnd(16); html += `<div class="shop-row"><div>${chipInline(id)}</div><button class="btn small" data-buy="${id}" data-price="${price}">${price} 碎片</button></div>`; });
    html += `<div class="shop-row"><div>🩹 治疗 · 回复 22 点血</div><button class="btn small" data-heal="1" data-price="16">16 碎片</button></div>`;
    html += `<div class="shop-row"><div>🗑 删除 · 移除一枚起始芯片</div><button class="btn small" id="removebtn" data-price="25">25 碎片</button></div>`;
    html += `</div><div class="center"><button class="btn" id="leave">离开补给站</button></div>` + deckBar();
    setScreen(html);
    document.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
      const p = +b.dataset.price; if (G.shards < p) return flash(b, '碎片不足');
      G.shards -= p; G.deck.push(b.dataset.buy); b.disabled = true; b.textContent = '已购'; el('shopcount') && (el('shopcount').textContent = G.shards); renderShop();
    }));
    document.querySelectorAll('[data-heal]').forEach(b => b.addEventListener('click', () => { const p = +b.dataset.price; if (G.shards < p) return flash(b, '碎片不足'); G.shards -= p; heal(22); renderShop(); }));
    const rb = el('removebtn'); if (rb) rb.addEventListener('click', () => { if (G.shards < 25) return flash(rb, '碎片不足'); G.shards -= 25; renderRemove('shop'); });
    el('leave').addEventListener('click', advance);
    bindDeckPeek();
  }

  function renderRemove(back) {
    let html = topBar() + `<div class="panel-head">移除一枚芯片</div><div class="chip-choice wrap">`;
    G.deck.forEach((id, i) => html += chipCard(id, 'remove', i));
    html += `</div>`;
    setScreen(html);
    document.querySelectorAll('.chip-card[data-remove]').forEach(b => b.addEventListener('click', () => { G.deck.splice(+b.dataset.remove, 1); back === 'shop' ? renderShop() : advance(); }));
  }

  function renderRest() {
    let html = topBar() + `<div class="panel-head">整备点</div><div class="rest-opts">`;
    html += `<button class="node-card rest" id="restheal"><div class="node-icon">🔥</div><div class="node-name">篝火休整</div><div class="node-desc">回复 ${Math.round(G.maxHp * 0.5)} 点血。</div></button>`;
    html += `<button class="node-card event" id="restup"><div class="node-icon">⚙</div><div class="node-name">重铸芯片</div><div class="node-desc">强化一枚芯片（数值 +50%）。</div></button>`;
    html += `</div>` + deckBar();
    setScreen(html);
    el('restheal').addEventListener('click', () => { heal(Math.round(G.maxHp * 0.5)); advance(); });
    el('restup').addEventListener('click', renderUpgrade);
    bindDeckPeek();
  }

  function renderUpgrade() {
    let html = topBar() + `<div class="panel-head">选择要强化的芯片</div><div class="chip-choice wrap">`;
    G.deck.forEach((id, i) => { if (!id.endsWith('+')) html += chipCard(id, 'up', i); });
    html += `</div>`;
    setScreen(html);
    document.querySelectorAll('.chip-card[data-up]').forEach(b => b.addEventListener('click', () => { upgradeChip(+b.dataset.up); advance(); }));
  }
  function upgradeChip(i) {
    const id = G.deck[i]; if (id.endsWith('+')) return;
    const base = CHIPS[id]; const nid = id + '+';
    if (!CHIPS[nid]) {
      const c = JSON.parse(JSON.stringify(base)); c.id = nid; c.name = base.name + '+';
      ['dmg', 'block', 'heal', 'corrupt', 'draw', 'energy', 'power'].forEach(k => { if (c[k] != null) c[k] = Math.ceil(c[k] * 1.5); });
      CHIPS[nid] = c;
    }
    G.deck[i] = nid;
  }

  function renderEvent(ev) {
    let html = topBar() + `<div class="event-box"><div class="event-title">${ev.title}</div><div class="event-text">${ev.text}</div>`;
    html += `<div class="event-opts">` + ev.options.map((o, i) => `<button class="btn wide" data-opt="${i}">${o.label}</button>`).join('') + `</div></div>`;
    setScreen(html);
    document.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', () => resolveEvent(ev.options[+b.dataset.opt].eff)));
  }
  function resolveEvent(eff) {
    switch (eff) {
      case 'heal18': heal(18); return advance();
      case 'shard20': G.shards += 20; return advance();
      case 'shard15': G.shards += 15; return advance();
      case 'shard25': G.shards += 25; return advance();
      case 'chip': return eventChip();
      case 'peace': G.peace = true; heal(8); return advance();
      case 'upgrade': return renderUpgrade();
      case 'chip_hp8': dealHpFlat(8); return eventChip();
      case 'shard30_hp6': dealHpFlat(6); G.shards += 30; return advance();
      case 'fight_elite': return startCombat(spawnElite(), 'elite');
      case 'none': default: return advance();
    }
  }
  function dealHpFlat(n) { G.hp = Math.max(1, G.hp - n); }
  function eventChip() {
    const chips = threeChips();
    let html = topBar() + `<div class="panel-head">拾取一枚芯片</div><div class="chip-choice">` + chips.map(id => chipCard(id, 'reward')).join('') + `</div>`;
    html += `<div class="center"><button class="btn ghost" id="skip">不了</button></div>`;
    setScreen(html);
    document.querySelectorAll('.chip-card[data-pick]').forEach(b => b.addEventListener('click', () => { G.deck.push(b.dataset.pick); advance(); }));
    el('skip').addEventListener('click', advance);
  }

  function advance() { G.floor++; renderMap(); }

  // ============================ 结局 ============================
  function endGame(kind) {
    let ending;
    if (kind === 'dead') ending = window.ENDINGS.white;
    else {
      if (G.peace) ending = window.ENDINGS.reconcile;
      else {
        const p = G.palette, tot = p.red + p.blue + p.yellow + p.purple || 1;
        let mc = 'red', mv = -1; ['red', 'blue', 'yellow', 'purple'].forEach(k => { if (p[k] > mv) { mv = p[k]; mc = k; } });
        if (mv / tot >= 0.45) ending = window.ENDINGS['master_' + mc];
        else ending = window.ENDINGS.purify;
      }
    }
    saveEnding(ending.id);
    renderResult(ending, kind);
  }

  function saveEnding(id) {
    try { const s = JSON.parse(localStorage.getItem('ot_endings') || '[]'); if (!s.includes(id)) { s.push(id); localStorage.setItem('ot_endings', JSON.stringify(s)); } } catch (e) {}
  }
  function seenCount() { try { return JSON.parse(localStorage.getItem('ot_endings') || '[]').length; } catch (e) { return 0; } }

  function renderResult(ending, kind) {
    const p = G.palette, tot = p.red + p.blue + p.yellow + p.purple || 1;
    let bars = '';
    ['red', 'blue', 'yellow', 'purple'].forEach(k => {
      const pct = Math.round(p[k] / tot * 100);
      bars += `<div class="pal-row"><span class="pal-name" style="color:${COLORS[k].hex}">${COLORS[k].name}·${COLORS[k].style}</span>
        <div class="pal-bg"><div class="pal-fill" style="width:${pct}%;background:${COLORS[k].hex}"></div></div><span class="pal-pct">${pct}%</span></div>`;
    });
    const total = Object.keys(window.ENDINGS).length;
    let html = `<div id="result-card" class="result-card" style="--acc:${ending.hex}">
      <div class="res-kicker">ORDER TOWER · 秩序尖塔</div>
      <div class="res-quote">${ending.quote}</div>
      <div class="res-name" style="color:${ending.hex}">${ending.name}</div>
      <div class="res-tone">【${ending.tone}】结局</div>
      <div class="res-desc">${ending.desc}</div>
      <div class="pal-box"><div class="pal-title">你的调色板</div>${bars}</div>
      <div class="res-stats">抵达第 <b>${Math.min(G.floor, CFG.floors)}</b> 层 · 击破 <b>${G.cleared}</b> 敌 · 结局图鉴 <b>${seenCount()}/${total}</b></div>
      <div class="res-qr"><div class="qr-code" id="qr"></div></div>
    </div>
    <div class="actions"><button class="btn save" id="save">保存结局卡</button><button class="btn restart" id="again">再爬一次</button></div>`;
    setScreen(html);
    genQR();
    el('save').addEventListener('click', savePoster);
    el('again').addEventListener('click', newGame);
  }

  // ============================ 渲染工具 ============================
  function setScreen(html) { el('screen').innerHTML = html; el('screen').scrollTop = 0; }
  function topBar() {
    return `<div class="hud">
      <div class="hud-hp"><span class="heart">♥</span> ${G.hp}/${G.maxHp}<div class="hpbar"><div class="hpfill" style="width:${Math.round(G.hp / G.maxHp * 100)}%"></div></div></div>
      <div class="hud-sh">◆ ${G.shards}</div>
      <div class="hud-pal">${paletteMini()}</div>
    </div>`;
  }
  function paletteMini() { return ['red', 'blue', 'yellow', 'purple'].map(k => `<span class="pdot" style="background:${COLORS[k].hex}">${G.palette[k] || 0}</span>`).join(''); }

  function chipInline(id) { const c = CHIPS[id]; return `<span class="chip-inline" style="border-color:${COLORS[c.color].hex}"><b style="color:${COLORS[c.color].hex}">${c.name}</b> · ${c.type}${c.cost != null ? ' · ' + c.cost + '墨' : ''}<br><span class="ci-text">${c.text}</span></span>`; }
  function chipCard(id, mode, idx) {
    const c = CHIPS[id]; const col = COLORS[c.color].hex;
    const attr = mode === 'reward' ? `data-pick="${id}"` : mode === 'remove' ? `data-remove="${idx}"` : mode === 'up' ? `data-up="${idx}"` : '';
    return `<div class="chip-card" ${attr} style="--c:${col}">
      <div class="cc-top"><span class="cc-cost">${c.cost}</span><span class="cc-color" style="background:${col}">${COLORS[c.color].name}</span></div>
      <div class="cc-name">${c.name}</div><div class="cc-type">${c.type}</div>
      <div class="cc-text">${c.text}</div></div>`;
  }

  function renderCombat() {
    const c = G.combat, e = c.enemy, ni = nextIntent();
    let html = topBar();
    html += `<div class="enemy ${e.boss ? 'boss' : e.elite ? 'elite' : ''}">
      <div class="enemy-top"><span class="enemy-name">${e.name}</span><span class="intent ${ni.cls}">意图：${ni.txt}</span></div>
      <div class="enemy-hpbar"><div class="enemy-hpfill" style="width:${Math.round(e.hp / e.maxHp * 100)}%"></div><span class="enemy-hp">${e.hp}/${e.maxHp}</span></div>
      <div class="enemy-tags">${e.block ? `<span class="tag blk">护盾 ${e.block}</span>` : ''}${e.corrupt ? `<span class="tag cor">侵蚀 ${e.corrupt}</span>` : ''}${e.weak ? `<span class="tag weak">虚弱 ${e.weak}</span>` : ''}${e.buff ? `<span class="tag buf">强化 ${e.buff}</span>` : ''}</div>
    </div>`;
    html += `<div class="me-tags">${c.block ? `<span class="tag blk">护盾 ${c.block}</span>` : ''}${c.corrupt ? `<span class="tag cor">侵蚀 ${c.corrupt}</span>` : ''}${c.power ? `<span class="tag buf">攻击 +${c.power}</span>` : ''}${c.thorn ? `<span class="tag thn">反弹 ${c.thorn}</span>` : ''}</div>`;
    html += `<div class="combat-mid"><span class="energy">墨力 <b>${c.energy}</b>/${CFG.energy}</span><span class="pilecount">抽 ${c.draw.length} · 弃 ${c.discard.length}</span></div>`;
    html += `<div class="hand">`;
    c.hand.forEach((id, i) => {
      const ch = CHIPS[id]; const col = COLORS[ch.color].hex; const can = c.energy >= ch.cost;
      html += `<button class="chip-card hand-chip ${can ? '' : 'disabled'}" data-h="${i}" style="--c:${col}">
        <div class="cc-top"><span class="cc-cost">${ch.cost}</span><span class="cc-color" style="background:${col}">${COLORS[ch.color].name}</span></div>
        <div class="cc-name">${ch.name}</div><div class="cc-text">${ch.text}</div></button>`;
    });
    html += `</div>`;
    html += `<div class="center"><button class="btn end" id="endturn">结束回合 ▶</button></div>`;
    setScreen(html);
    document.querySelectorAll('.hand-chip').forEach(b => { if (!b.classList.contains('disabled')) b.addEventListener('click', () => playChip(+b.dataset.h)); });
    el('endturn').addEventListener('click', endTurn);
  }

  function deckBar() { return `<div class="deckbar"><button class="btn tiny" id="peek">查看牌组（${G.deck.length}）</button></div>`; }
  function bindDeckPeek() { const p = el('peek'); if (p) p.addEventListener('click', showDeck); }
  function showDeck() {
    const counts = {}; G.deck.forEach(id => counts[id] = (counts[id] || 0) + 1);
    let html = `<div class="modal" id="deckmodal"><div class="modal-inner"><div class="panel-head">当前牌组 ${G.deck.length}</div><div class="chip-choice wrap">`;
    Object.keys(counts).forEach(id => html += `<div style="position:relative">${chipCard(id, 'view')}<span class="cc-count">×${counts[id]}</span></div>`);
    html += `</div><div class="center"><button class="btn" id="closedeck">关闭</button></div></div></div>`;
    const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d.firstChild);
    el('closedeck').addEventListener('click', () => el('deckmodal').remove());
  }

  function flash(btn, msg) { const t = btn.textContent; btn.textContent = msg; setTimeout(() => btn.textContent = t, 900); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function genQR() { const box = el('qr'); if (!box || typeof QRCode === 'undefined') return; try { new QRCode(box, { text: location.href.split('?')[0], width: 108, height: 108, correctLevel: QRCode.CorrectLevel.M }); } catch (e) {} }
  function savePoster() {
    const card = el('result-card'); if (!card || typeof html2canvas === 'undefined') return;
    const btn = el('save'); const old = btn.textContent; btn.textContent = '生成中…';
    html2canvas(card, { backgroundColor: '#0c0a16', scale: 2, useCORS: true }).then(cv => {
      cv.toBlob(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = '秩序尖塔_结局.png'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); btn.textContent = old; });
    }).catch(() => btn.textContent = old);
  }

  // ============================ 启动 ============================
  window.addEventListener('DOMContentLoaded', () => {
    const start = el('start-btn');
    if (start) start.addEventListener('click', () => { el('intro-modal').classList.add('hidden'); newGame(); });
  });
  window.__OT = { get state() { return G; }, newGame };
})();
