/* ============================================================
   秩序尖塔 · ORDER TOWER
   界面渲染：所有屏幕 / 覆盖层 / 音效 / 交互入口
   ============================================================ */
"use strict";

const UI = { deckOpen: false, muted: localStorage.getItem("ordertower_mute") === "1" };

const STATUS_LABEL = {
  strength: ["💪", "墨力"], dexterity: ["🧤", "灵巧"], weak: ["🌀", "虚弱"],
  vulnerable: ["🎯", "易伤"], frail: ["🥀", "破损"], poison: ["☠️", "侵蚀"],
  thorns: ["🌵", "反墨"], artifact: ["✨", "净化层"], ritual: ["📿", "仪式"],
  barricade: ["🧱", "壁垒"], droneGuard: ["🛸", "护航"], inkStorm: ["🌧️", "墨雨"],
  poisonAura: ["☁️", "墨孢"], healPerTurn: ["💚", "能量站"], energyPerTurn: ["⚡", "激励"],
  drawPerTurn: ["📖", "强化"], afterimage: ["👤", "残像"], paletteLink: ["🎨", "连携"],
  undertow: ["🌊", "逆流"], undertowPlus: ["🌊", "逆流+"],
};

/* ---------- 音效（WebAudio 合成，无外部资源） ---------- */
let _audio = null;
function sfx(type) {
  if (UI.muted) return;
  try {
    _audio = _audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = _audio.currentTime;
    const o = _audio.createOscillator(), g = _audio.createGain();
    o.connect(g); g.connect(_audio.destination);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    const freq = { click: 520, play: 660, hit: 190, block: 330, win: 880, lose: 130, potion: 740 }[type] || 440;
    o.type = type === "hit" ? "sawtooth" : "triangle";
    o.frequency.setValueAtTime(freq, t);
    if (type === "win") o.frequency.exponentialRampToValueAtTime(1760, t + 0.16);
    if (type === "lose") o.frequency.exponentialRampToValueAtTime(65, t + 0.18);
    o.start(t); o.stop(t + 0.2);
  } catch (e) {}
}
function toggleMute() {
  UI.muted = !UI.muted;
  localStorage.setItem("ordertower_mute", UI.muted ? "1" : "0");
  render();
}

/* ---------- 小工具 ---------- */
const $screen = () => document.getElementById("screen");
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 1800);
}

function statusChips(st) {
  let h = "";
  for (const [k, v] of Object.entries(st)) {
    if (!v) continue;
    const lab = STATUS_LABEL[k] || ["❔", k];
    h += `<span class="chip" title="${lab[1]}">${lab[0]}${lab[1]} ${v === 1 && typeof v === "boolean" ? "" : v}</span>`;
  }
  return h;
}

function cardHTML(card, opts = {}) {
  const d = CARDS[card.id];
  const cost = cardCost(card);
  const col = COLORS[d.color];
  const name = d.name + (card.up ? "+" : "");
  const cls = [
    "card", col.css,
    opts.selected ? "selected" : "",
    opts.disabled ? "disabled" : "",
    opts.small ? "small" : "",
  ].join(" ");
  const flavor = d.flavor && !opts.small ? `<div class="card-flavor">${d.flavor}</div>` : "";
  return `<div class="${cls}" ${opts.onclick ? `onclick="${opts.onclick}"` : ""}>
    <div class="card-top">
      <span class="card-cost">${cost === null ? "✕" : cost}</span>
      <span class="card-name">${name}</span>
    </div>
    <div class="card-type">${col.name} · ${TYPE_NAME[d.type]}</div>
    <div class="card-desc">${d.desc(card.up)}</div>
    ${flavor}
    ${opts.footer || ""}
  </div>`;
}

function topbarHTML() {
  const relics = G.relics.map(id => {
    const r = RELICS[id];
    return `<span class="relic" title="${esc(r.name)}：${esc(r.desc)}">${r.icon}</span>`;
  }).join("");
  const potions = G.potions.map((id, i) => {
    const p = POTIONS[id];
    return `<span class="potion" onclick="usePotion(${i})" title="${esc(p.name)}：${esc(p.desc)}（点击使用）">${p.icon}</span>`;
  }).join("") + "▫".repeat(Math.max(0, CONFIG.potionSlots - G.potions.length)).split("").map(() => `<span class="potion empty">▫</span>`).join("");
  return `<div class="topbar">
    <div class="topbar-row">
      <span class="tb-item">🦑 <b>${G.hp}</b>/${G.maxHp}</span>
      <span class="tb-item">💰 <b>${G.gold}</b></span>
      <span class="tb-item">🗼 <b>${floorNumber()}</b>F</span>
      <span class="tb-item link" onclick="openDeck()">🎴 ${G.deck.length}</span>
      <span class="tb-item link" onclick="toggleMute()">${UI.muted ? "🔇" : "🔊"}</span>
    </div>
    <div class="topbar-row relics-row">${relics}<span class="tb-spacer"></span>${potions}</div>
  </div>`;
}

/* ============================================================
   主渲染
   ============================================================ */
function render() {
  const el = $screen();
  if (!el) return;
  if (!G) { el.innerHTML = titleHTML(); return; }
  let html = "";
  const noTopbar = ["prologue", "actIntro", "victory", "gameover", "help", "endings"];
  if (!noTopbar.includes(G.screen)) html += topbarHTML();
  switch (G.screen) {
    case "prologue": html += prologueHTML(); break;
    case "actIntro": html += actIntroHTML(); break;
    case "map": html += mapHTML(); break;
    case "combat": html += combatHTML(); break;
    case "reward": html += rewardHTML(); break;
    case "shop": html += shopHTML(); break;
    case "rest": html += restHTML(); break;
    case "event": html += eventHTML(); break;
    case "victory": html += victoryHTML(); break;
    case "gameover": html += gameoverHTML(); break;
    default: html += `<div class="panel">未知界面：${G.screen}</div>`;
  }
  el.innerHTML = html;
  // 地图从塔底开始看
  if (G.screen === "map") {
    const ms = el.querySelector(".map-scroll");
    if (ms) {
      const target = el.querySelector(".map-node.reach, .map-node.here");
      ms.scrollTop = target ? Math.max(0, target.offsetTop - ms.clientHeight + 90) : ms.scrollHeight;
    }
  }
  // 覆盖层
  if (G.pick) el.insertAdjacentHTML("beforeend", pickHTML());
  if (UI.deckOpen) el.insertAdjacentHTML("beforeend", deckHTML());
}

/* ---------- 标题 ---------- */
function titleHTML() {
  const meta = loadMeta();
  const hasSave = !!loadSave();
  return `<div class="title-wrap">
    <div class="title-kicker">SPLATOON · SIDE ORDER 同人致敬 · 肉鸽卡牌</div>
    <h1 class="game-title">秩序尖塔</h1>
    <div class="title-sub">ORDER TOWER</div>
    <div class="title-tower">🗼</div>
    <div class="title-menu">
      <button class="btn primary" onclick="startNewRun()">▶ 新的攀登</button>
      ${hasSave ? `<button class="btn" onclick="doContinue()">↻ 继续攀登</button>` : ""}
      <button class="btn ghost" onclick="showEndings()">🏆 结局图鉴 ${meta.endings.length}/${Object.keys(ENDINGS).length}</button>
      <button class="btn ghost" onclick="showHelp()">📖 游戏指南</button>
    </div>
    <div class="title-foot">攀登 30 层 · 用赤蓝黄紫四色卡牌夺回世界的颜色<br>已攀登 ${meta.runs} 次 · 登顶 ${meta.wins} 次</div>
  </div>`;
}

/* ---------- 序章 / 幕间 ---------- */
function prologueHTML() {
  return `<div class="story-wrap">
    <div class="story-kicker">${PROLOGUE.sub}</div>
    <h1 class="story-title">${PROLOGUE.title}</h1>
    <div class="story-text">${PROLOGUE.text}</div>
    <button class="btn primary big" onclick="proceedPrologue()">踏入秩序之塔 ▶</button>
  </div>`;
}
function actIntroHTML() {
  const a = ACT_INTROS[G.act];
  return `<div class="story-wrap">
    <h1 class="story-title">${a.title}</h1>
    <div class="story-text">${a.text}</div>
    <button class="btn primary big" onclick="proceedActIntro()">开始攀登 ▶</button>
  </div>`;
}

/* ---------- 地图 ---------- */
const NODE_ICON = { battle: "⚔️", elite: "💀", event: "❓", shop: "🛒", rest: "🔥", boss: "👁️" };
const NODE_NAME = { battle: "战斗", elite: "精英", event: "异变", shop: "商店", rest: "休息", boss: "BOSS" };

function mapHTML() {
  const rows = G.map.rows;
  const reach = reachableNodes();
  const isReach = n => reach.includes(n);
  const rowH = 76, W = 100;
  const totalRows = rows.length + 1;
  const height = totalRows * rowH + 30;
  const posOf = (r, c, len) => ({ x: ((c + 1) / (len + 1)) * W, y: height - 40 - r * rowH });
  // 边
  let lines = "";
  for (let r = 0; r < rows.length - 1; r++) {
    for (const n of rows[r]) {
      const p1 = posOf(r, n.col, rows[r].length);
      for (const nc of n.next) {
        const p2 = posOf(r + 1, nc, rows[r + 1].length);
        lines += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" />`;
      }
    }
  }
  const lastRow = rows.length - 1;
  const bossPos = { x: 50, y: height - 40 - rows.length * rowH };
  for (const n of rows[lastRow]) {
    const p1 = posOf(lastRow, n.col, rows[lastRow].length);
    lines += `<line x1="${p1.x}" y1="${p1.y}" x2="${bossPos.x}" y2="${bossPos.y}" />`;
  }
  // 节点
  let nodes = "";
  for (let r = 0; r < rows.length; r++) {
    for (const n of rows[r]) {
      const p = posOf(r, n.col, rows[r].length);
      const here = G.pos && G.pos !== "boss" && G.pos.row === r && G.pos.col === n.col;
      const cls = ["map-node", n.type, isReach(n) ? "reach" : "", n.done ? "done" : "", here ? "here" : ""].join(" ");
      nodes += `<div class="${cls}" style="left:${p.x}%;top:${p.y}px" ${isReach(n) ? `onclick="clickMapNode(${r},${n.col})"` : ""} title="${NODE_NAME[n.type]}">
        <span>${NODE_ICON[n.type]}</span></div>`;
    }
  }
  const bossReach = reach.includes(G.map.boss);
  nodes += `<div class="map-node boss ${bossReach ? "reach" : ""} ${G.pos === "boss" ? "here" : ""}" style="left:${bossPos.x}%;top:${bossPos.y}px" ${bossReach ? `onclick="clickBoss()"` : ""} title="BOSS">
    <span>${NODE_ICON.boss}</span></div>`;
  return `<div class="panel map-panel">
    <div class="map-head">${ACT_INTROS[G.act].title}<div class="map-hint">选择发光的节点前进 · ⚔️战斗 💀精英 ❓异变 🛒商店 🔥休息</div></div>
    <div class="map-scroll"><div class="map-area" style="height:${height}px">
      <svg class="map-lines" viewBox="0 0 100 ${height}" preserveAspectRatio="none">${lines}</svg>
      ${nodes}
    </div></div>
  </div>`;
}

/* ---------- 战斗 ---------- */
function combatHTML() {
  const alive = C.enemies.filter(e => e.hp > 0);
  const enemies = C.enemies.map(en => {
    if (en.hp <= 0) return `<div class="enemy dead"><div class="enemy-emoji">💨</div><div class="enemy-name">${en.name}</div></div>`;
    const m = en.nextMove;
    const idmg = intentDamage(en);
    const intent = m ? `<div class="intent" title="${m.name}">${m.icon} ${m.name}${idmg !== null ? ` <b>${idmg}${m.times ? "×" + m.times : ""}</b>` : ""}</div>` : "";
    const targetable = C.selected !== null;
    const acting = C.actingEnemy === en.key;
    return `<div class="enemy ${targetable ? "targetable" : ""} ${acting ? "acting" : ""} ${en.boss ? "is-boss" : ""}" onclick="handleEnemyClick(${en.key})">
      ${intent}
      <div class="enemy-emoji">${en.emoji}</div>
      <div class="enemy-name">${en.name}</div>
      <div class="hpbar"><div class="hpfill" style="width:${Math.max(0, en.hp / en.maxHp * 100)}%"></div>
        <span class="hptext">${en.hp}/${en.maxHp}${en.block ? ` 🛡${en.block}` : ""}</span></div>
      <div class="chips">${statusChips(en.status)}</div>
    </div>`;
  }).join("");

  const hand = C.hand.map(card => {
    const d = CARDS[card.id];
    const playable = canPlay(card) && !C.busy;
    return cardHTML(card, {
      selected: C.selected === card.uid,
      disabled: !playable,
      onclick: `handleCardClick(${card.uid})`,
    });
  }).join("");

  const logs = C.log.slice(-5).map(l => `<div>${l}</div>`).join("");

  return `<div class="combat">
    <div class="enemy-zone">${enemies}</div>
    <div class="battle-log">${logs}</div>
    <div class="player-zone">
      <div class="player-stats">
        <span class="pstat energy" title="墨水">🖋 <b>${C.energy}</b>/${G.energyMax + (C.pstatus.energyPerTurn || 0)}</span>
        <span class="pstat" title="墨甲">🛡 <b>${C.pblock}</b></span>
        <span class="pstat" title="牌堆：抽牌/弃牌/消耗">📚 ${C.draw.length} / 🗑 ${C.discard.length} / 🕳 ${C.exhaust.length}</span>
        <button class="btn endturn" ${C.busy ? "disabled" : ""} onclick="endTurnClick()">结束回合 ⏩</button>
      </div>
      <div class="chips pchips">${statusChips(C.pstatus)}</div>
      <div class="hand">${hand || `<div class="hand-empty">（手牌空了）</div>`}</div>
      ${C.selected !== null && alive.length > 1 ? `<div class="target-hint">选择一个目标 ▲（再点一次卡牌取消）</div>` : ""}
    </div>
  </div>`;
}

/* ---------- 奖励 ---------- */
function rewardHTML() {
  const r = G.reward;
  let cards = "";
  if (!r.cardTaken) {
    cards = `<div class="reward-cards">${r.cards.map(id =>
      cardHTML({ uid: 0, id, up: false }, { onclick: `takeRewardCardClick('${id}')` })).join("")}</div>
      <button class="btn ghost" onclick="skipRewardCard()">跳过卡牌 ▸</button>`;
  } else {
    cards = `<div class="reward-taken">✔ 已将卡牌收入调色盘</div>`;
  }
  return `<div class="panel reward-panel">
    <h2>🎉 战斗胜利</h2>
    <div class="reward-line">💰 获得 ${r.gold} 彩币</div>
    ${r.potion ? `<div class="reward-line link" onclick="takeRewardPotion()">🧃 拾取特饮：${POTIONS[r.potion].name}（${POTIONS[r.potion].desc}）</div>` : ""}
    ${r.relic ? `<div class="reward-line link" onclick="takeRewardRelic()">${RELICS[r.relic].icon} 拾取色彩芯片：${RELICS[r.relic].name}（${RELICS[r.relic].desc}）</div>` : ""}
    ${r.bossRelics ? `<div class="reward-line">👑 选择一枚 Boss 芯片：</div>
      <div class="boss-relics">${r.bossRelics.map(id => `<div class="boss-relic" onclick="takeBossRelic('${id}')">
        <div class="br-icon">${RELICS[id].icon}</div><div class="br-name">${RELICS[id].name}</div><div class="br-desc">${RELICS[id].desc}</div></div>`).join("")}</div>` : ""}
    <div class="reward-sect">选择一张卡牌加入牌组：</div>
    ${cards}
    <button class="btn primary" onclick="finishReward()">继续前进 ▶</button>
  </div>`;
}

/* ---------- 商店 ---------- */
function shopHTML() {
  const s = G.shop;
  const cardItems = s.cards.map((it, i) => it.sold
    ? `<div class="shop-slot sold">已售出</div>`
    : `<div class="shop-slot">${cardHTML({ uid: 0, id: it.id, up: false }, { small: true, onclick: `buyShopCard(${i})`, footer: `<div class="price ${G.gold < it.price ? "poor" : ""}">💰${it.price}</div>` })}</div>`
  ).join("");
  const relicItems = s.relics.map((it, i) => it.sold
    ? `<div class="shop-slot sold">已售出</div>`
    : `<div class="shop-slot relic-slot" onclick="buyShopRelic(${i})">
        <div class="br-icon">${RELICS[it.id].icon}</div><div class="br-name">${RELICS[it.id].name}</div>
        <div class="br-desc">${RELICS[it.id].desc}</div><div class="price ${G.gold < it.price ? "poor" : ""}">💰${it.price}</div></div>`
  ).join("");
  const potItems = s.potions.map((it, i) => it.sold
    ? `<div class="shop-slot sold">已售出</div>`
    : `<div class="shop-slot relic-slot" onclick="buyShopPotion(${i})">
        <div class="br-icon">${POTIONS[it.id].icon}</div><div class="br-name">${POTIONS[it.id].name}</div>
        <div class="br-desc">${POTIONS[it.id].desc}</div><div class="price ${G.gold < it.price ? "poor" : ""}">💰${it.price}</div></div>`
  ).join("");
  return `<div class="panel shop-panel">
    <h2>🛒 深海商城 · 塔内分店</h2>
    <div class="shop-talk">「欢迎光临——塔里生意不好做，看在你还有颜色的份上，给你个面子价。」</div>
    <div class="shop-sect">卡牌</div><div class="shop-row">${cardItems}</div>
    <div class="shop-sect">色彩芯片</div><div class="shop-row">${relicItems}</div>
    <div class="shop-sect">特饮</div><div class="shop-row">${potItems}</div>
    <div class="shop-sect">服务</div>
    <div class="shop-row">
      ${s.removeUsed ? `<div class="shop-slot sold">本店删卡服务已使用</div>`
        : `<div class="shop-slot relic-slot" onclick="shopRemoveService()">
            <div class="br-icon">✂️</div><div class="br-name">删除卡牌</div>
            <div class="br-desc">从牌组中永久移除一张牌</div><div class="price ${G.gold < s.removePrice ? "poor" : ""}">💰${s.removePrice}</div></div>`}
    </div>
    <button class="btn primary" onclick="leaveShop()">离开商店 ▶</button>
  </div>`;
}

/* ---------- 休息 ---------- */
function restHTML() {
  if (G.restResult) {
    return `<div class="panel rest-panel">
      <h2>🔥 整备点</h2>
      <div class="story-text">${G.restResult}</div>
      <button class="btn primary" onclick="leaveRest()">继续前进 ▶</button>
    </div>`;
  }
  const noHeal = G.relics.includes("caffeine_ink");
  return `<div class="panel rest-panel">
    <h2>🔥 整备点</h2>
    <div class="story-text">一小片被人布置过的角落：旧沙发、还能加热的墨水炉，墙上贴着褪色的演唱会海报。塔的白噪音在这里轻了很多。</div>
    <div class="rest-options">
      <div class="rest-opt ${noHeal ? "disabled" : ""}" onclick="restHeal()">
        <div class="br-icon">💤</div><div class="br-name">休息</div>
        <div class="br-desc">${noHeal ? "咖啡因墨水：无法入睡" : `回复 ${Math.floor(G.maxHp * CONFIG.restHealRatio) + relicNum("restBonus")} 点生命`}</div>
      </div>
      <div class="rest-opt" onclick="restUpgrade()">
        <div class="br-icon">⚒️</div><div class="br-name">锻墨</div>
        <div class="br-desc">升级 1 张卡牌</div>
      </div>
    </div>
    <button class="btn ghost" onclick="leaveRest()">什么都不做，继续前进 ▸</button>
  </div>`;
}

/* ---------- 事件 ---------- */
function eventHTML() {
  const ev = EVENTS.find(e => e.id === G.event.id);
  if (G.event.result !== null) {
    return `<div class="panel event-panel">
      <h2>${ev.icon} ${ev.name}</h2>
      <div class="story-text">${G.event.result}</div>
      <button class="btn primary" onclick="leaveEvent()">继续前进 ▶</button>
    </div>`;
  }
  const opts = ev.options.map((o, i) => {
    const ok = !o.cond || o.cond(G);
    return `<div class="event-opt ${ok ? "" : "disabled"}" ${ok ? `onclick="chooseEventOption(${i})"` : ""}>
      <div class="eo-label">${o.label}</div>${o.sub ? `<div class="eo-sub">${o.sub}</div>` : ""}</div>`;
  }).join("");
  return `<div class="panel event-panel">
    <h2>${ev.icon} ${ev.name}</h2>
    <div class="story-text">${ev.text}</div>
    <div class="event-opts">${opts}</div>
  </div>`;
}

/* ---------- 胜利 / 失败 ---------- */
function victoryHTML() {
  const e = ENDINGS[G.ending];
  const { counts, total } = deckColorRatio();
  const bar = ["red", "blue", "yellow", "purple"].map(c =>
    total ? `<div class="pal-seg pal-${c}" style="flex:${counts[c] || 0.0001}" title="${COLORS[c].name} ${counts[c]}"></div>` : "").join("");
  return `<div class="story-wrap">
    <div class="story-kicker">结局达成 · 已录入图鉴</div>
    <h1 class="story-title">${e.icon} ${e.name}</h1>
    <div class="palette-bar">${bar}</div>
    <div class="pal-note">最终调色盘：赤${counts.red} · 蓝${counts.blue} · 黄${counts.yellow} · 紫${counts.purple}</div>
    <div class="story-text">${e.text}</div>
    <div class="run-stats">战斗 ${G.stats.battles} 场 · 精英 ${G.stats.elites} · Boss ${G.stats.bosses} · 牌组 ${G.deck.length} 张</div>
    <button class="btn primary big" onclick="backTitle()">回到标题 ▶</button>
  </div>`;
}
function gameoverHTML() {
  const e = ENDINGS.white;
  return `<div class="story-wrap">
    <div class="story-kicker">结局 · 已录入图鉴</div>
    <h1 class="story-title white-title">${e.icon} ${e.name}</h1>
    <div class="story-text">${e.text}</div>
    <div class="run-stats">倒在 ${floorNumber()}F · 战斗 ${G.stats.battles} 场 · 牌组 ${G.deck.length} 张</div>
    <button class="btn primary big" onclick="backTitle()">再爬一次 ▶</button>
  </div>`;
}

/* ---------- 结局图鉴 / 帮助 ---------- */
function endingsHTML() {
  const meta = loadMeta();
  const items = Object.values(ENDINGS).map(e => {
    const got = meta.endings.includes(e.id);
    return `<div class="ending-item ${got ? "" : "locked"}">
      <div class="ei-icon">${got ? e.icon : "🔒"}</div>
      <div><div class="ei-name">${got ? e.name : "？？？"}</div>
      <div class="ei-cond">${e.cond}</div></div></div>`;
  }).join("");
  return `<div class="story-wrap">
    <h1 class="story-title">🏆 结局图鉴 ${meta.endings.length}/${Object.keys(ENDINGS).length}</h1>
    <div class="endings-list">${items}</div>
    <button class="btn primary" onclick="backTitle()">返回 ▶</button>
  </div>`;
}
function helpHTML() {
  const kw = KEYWORDS.map(([k, v]) => `<div class="kw"><b>${k}</b>：${v}</div>`).join("");
  return `<div class="story-wrap help-wrap">
    <h1 class="story-title">📖 游戏指南</h1>
    <div class="story-text" style="text-align:left">
      <b>目标</b>：攀登 30 层秩序之塔，击败三名 Boss，夺回世界的颜色。生命耗尽即被同化。<br><br>
      <b>地图</b>：每幕 10 层，在发光节点中选择路线：⚔️战斗 / 💀精英（更强，掉落色彩芯片）/ ❓异变事件 / 🛒商店 / 🔥休息（回血或升级卡牌）。<br><br>
      <b>战斗</b>：每回合恢复墨水并抽 5 张牌。点击卡牌打出；需要目标时再点击敌人。敌人头顶会预告下回合行动。回合结束手牌全部弃置。<br><br>
      <b>四色流派</b>：<span class="tag-red">赤·火力</span> 高伤爆发 / <span class="tag-blue">蓝·护体</span> 墨甲反击 / <span class="tag-yellow">黄·支援</span> 抽牌回费 / <span class="tag-purple">紫·侵蚀</span> 毒与削弱。「共鸣」卡牌随本回合同色出牌数增强。<br><br>
      <b>结局</b>：登顶时按牌组配色结算——某色 ≥45% 触发单色结局，均衡配色触发真结局。共 6 种结局可收集。<br><br>
      <b>关键词</b>：<br>${kw}
    </div>
    <button class="btn primary" onclick="backTitle()">返回 ▶</button>
  </div>`;
}

/* ---------- 覆盖层：选牌 / 牌组 ---------- */
function pickHTML() {
  const p = G.pick;
  const title = p.mode === "upgrade" ? "选择要升级的卡牌" : "选择要移除的卡牌";
  const cards = G.deck.map(c => {
    const invalid = p.mode === "upgrade" && (c.up || CARDS[c.id].rarity === "special");
    return cardHTML(c, { small: true, disabled: invalid, onclick: invalid ? "" : `pickCard(${c.uid})` });
  }).join("");
  return `<div class="overlay">
    <div class="overlay-inner">
      <h2>${title}</h2>
      <div class="deck-grid">${cards}</div>
      <button class="btn ghost" onclick="cancelPick()">取消 ✕</button>
    </div>
  </div>`;
}
function deckHTML() {
  const cards = G.deck.slice().sort((a, b) => CARDS[a.id].color.localeCompare(CARDS[b.id].color) || (cardCost(a) ?? 9) - (cardCost(b) ?? 9))
    .map(c => cardHTML(c, { small: true })).join("");
  return `<div class="overlay" onclick="closeDeck(event)">
    <div class="overlay-inner">
      <h2>🎴 我的调色盘（${G.deck.length} 张）</h2>
      <div class="deck-grid">${cards}</div>
      <button class="btn ghost" onclick="closeDeck()">关闭 ✕</button>
    </div>
  </div>`;
}

/* ============================================================
   交互入口（inline onclick 调用）
   ============================================================ */
function startNewRun() { sfx("click"); newGame(); render(); }
function doContinue() { sfx("click"); if (continueGame()) render(); }
function showEndings() { sfx("click"); G = G; $screen().innerHTML = endingsHTML(); }
function showHelp() { sfx("click"); $screen().innerHTML = helpHTML(); }
function backTitle() { sfx("click"); G = null; render(); }
function proceedPrologue() { sfx("click"); startAct(1); render(); }
function proceedActIntro() { sfx("click"); G.screen = "map"; saveGame(); render(); }
function clickMapNode(r, c) {
  sfx("click");
  const node = G.map.rows[r][c];
  if (!reachableNodes().includes(node)) return;
  enterNode(node); render();
}
function clickBoss() {
  sfx("click");
  if (!reachableNodes().includes(G.map.boss)) return;
  enterNode(G.map.boss); render();
}
function handleCardClick(uid) {
  if (C.busy || C.over) return;
  const card = C.hand.find(c => c.uid === uid);
  if (!card) return;
  if (C.selected === uid) { C.selected = null; render(); return; }
  const d = CARDS[card.id];
  if (!canPlay(card)) { toast(d.cost === null ? "这张牌无法打出。" : "墨水不足。"); return; }
  const alive = C.enemies.filter(e => e.hp > 0);
  if (d.target === "enemy" && alive.length > 1) { C.selected = uid; sfx("click"); render(); return; }
  sfx("play");
  playCard(uid, alive.length === 1 ? alive[0].key : null);
}
function handleEnemyClick(key) {
  if (!C || C.selected === null) return;
  sfx("play");
  playCard(C.selected, key);
}
function endTurnClick() { sfx("click"); endTurn(); }
function takeRewardCardClick(id) { sfx("click"); takeRewardCard(id); }
function skipRewardCard() { sfx("click"); G.reward.cardTaken = true; saveGame(); render(); }
function openDeck() { sfx("click"); UI.deckOpen = true; render(); }
function closeDeck(ev) { if (ev && ev.target !== ev.currentTarget) return; UI.deckOpen = false; render(); }
