/* ============================================================
   秩序尖塔 · ORDER TOWER
   引擎：随机数 / 全局状态 / 地图生成 / 战斗系统 / 奖励 / 商店 / 事件 / 存档
   ============================================================ */
"use strict";

/* ---------- 随机数 ---------- */
let _rngState = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
function RNG() {
  _rngState |= 0; _rngState = (_rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rint(a, b) { return a + Math.floor(RNG() * (b - a + 1)); }
function choice(arr) { return arr[Math.floor(RNG() * arr.length)]; }
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(RNG() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- 全局状态 ---------- */
let G = null;      // 局外状态（可存档）
let C = null;      // 战斗状态（不存档）

/* ---------- 战斗特效事件队列（ui.js 渲染后消费） ---------- */
let FXQ = [];
function fx(type, data) {
  if (!C || C.over) return;
  if (FXQ.length > 80) FXQ.length = 0;
  FXQ.push(Object.assign({ type }, data));
}
let _uid = 1;
function newCard(id, up = false) { return { uid: _uid++, id, up: !!up }; }

/* ---------- 存档 ---------- */
const SAVE_KEY = "ordertower_save_v2";
const META_KEY = "ordertower_meta_v2";

function saveGame() {
  if (!G) return;
  try {
    const snap = Object.assign({}, G);
    if (snap.screen === "combat") snap.screen = "map"; // 战斗中不存进度，读档回到地图
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
  } catch (e) { /* 存档失败不影响游戏 */ }
}
function loadSave() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
function loadMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || { endings: [], runs: 0, wins: 0 }; }
  catch (e) { return { endings: [], runs: 0, wins: 0 }; }
}
function saveMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) {} }
function unlockEnding(id) {
  const m = loadMeta();
  if (!m.endings.includes(id)) m.endings.push(id);
  saveMeta(m);
}

/* ---------- 开新局 ---------- */
function newGame() {
  _uid = 1;
  G = {
    screen: "prologue",
    act: 1,
    hp: CONFIG.maxHp, maxHp: CONFIG.maxHp,
    gold: CONFIG.startGold,
    energyMax: CONFIG.energyPerTurn,
    deck: [],
    relics: ["memory_pearl"],
    potions: [],
    map: null, pos: null,
    removeCost: CONFIG.removeCostBase,
    usedEvents: [],
    takenBossRelics: [],
    reward: null, shop: null, event: null, pick: null,
    pendingNode: null, bonusElite: false,
    stats: { battles: 0, elites: 0, bosses: 0, cardsPicked: 0 },
  };
  // 初始牌组：4 射击 / 4 防御 / 1 鱿式突进 / 1 珍珠呼叫
  for (let i = 0; i < 4; i++) G.deck.push(newCard("strike"));
  for (let i = 0; i < 4; i++) G.deck.push(newCard("defend"));
  G.deck.push(newCard("squid_dash"));
  G.deck.push(newCard("pearl_call"));
  const m = loadMeta(); m.runs++; saveMeta(m);
}

function startAct(act) {
  G.act = act;
  G.map = genMap(act);
  G.pos = null;
  if (act > 1) healPlayer(G, Math.floor(G.maxHp * CONFIG.actTransitionHeal));
  G.screen = "actIntro";
  saveGame();
}

/* ---------- 地图生成 ---------- */
function genMap(act) {
  const rows = [];
  const R = CONFIG.rowsPerAct;
  for (let r = 0; r < R; r++) {
    const n = (r === 0) ? 3 : (r === R - 1 ? 2 : rint(2, 4));
    const row = [];
    for (let c = 0; c < n; c++) row.push({ type: "battle", row: r, col: c, next: [], done: false });
    rows.push(row);
  }
  // 类型分配
  for (let r = 0; r < R; r++) {
    for (const node of rows[r]) {
      if (r === 0) { node.type = "battle"; continue; }
      if (r === R - 1) { node.type = "rest"; continue; }
      const roll = RNG();
      if (r >= 3 && roll < 0.13) node.type = "elite";
      else if (roll < 0.34) node.type = "event";
      else if (roll < 0.45 && r >= 2) node.type = (RNG() < 0.5 ? "shop" : "rest");
      else node.type = "battle";
    }
  }
  // 保证每幕至少 1 商店、1 精英
  const flat = rows.slice(1, R - 1).flat();
  if (!flat.some(n => n.type === "shop")) choice(flat.filter(n => n.row >= 2)).type = "shop";
  if (!flat.some(n => n.type === "elite")) choice(flat.filter(n => n.row >= 3)).type = "elite";
  // 连边：col 差 ≤1，保证连通
  for (let r = 0; r < R - 1; r++) {
    const cur = rows[r], nxt = rows[r + 1];
    for (const node of cur) {
      const ratio = node.col / Math.max(1, cur.length - 1);
      const mid = Math.round(ratio * (nxt.length - 1));
      const cands = [];
      for (let d = -1; d <= 1; d++) { const c = mid + d; if (c >= 0 && c < nxt.length) cands.push(c); }
      const k = rint(1, Math.min(2, cands.length));
      node.next = shuffled(cands).slice(0, k).sort((a, b) => a - b);
    }
    // 每个下一行节点至少有一个入边
    for (const nn of nxt) {
      if (!cur.some(n => n.next.includes(nn.col))) {
        let best = cur[0], bd = 1e9;
        for (const n of cur) {
          const d = Math.abs(n.col / Math.max(1, cur.length - 1) - nn.col / Math.max(1, nxt.length - 1));
          if (d < bd) { bd = d; best = n; }
        }
        best.next.push(nn.col); best.next.sort((a, b) => a - b);
      }
    }
  }
  // 分配战斗遭遇
  for (let r = 0; r < R; r++) {
    for (const node of rows[r]) {
      if (node.type === "battle") node.encounter = choice(r < 4 ? ENCOUNTERS[act].easy : ENCOUNTERS[act].hard);
      if (node.type === "elite") node.encounter = choice(ENCOUNTERS[act].elites);
    }
  }
  return { rows, boss: { type: "boss", encounter: ENCOUNTERS[act].boss, done: false } };
}

function floorNumber() {
  if (!G.map) return 0;
  if (G.pos === null) return (G.act - 1) * 10;
  if (G.pos === "boss") return G.act * 10;
  return (G.act - 1) * 10 + G.pos.row + 1;
}
function reachableNodes() {
  // 返回当前可以进入的节点列表
  const rows = G.map.rows;
  if (G.pos === null) return rows[0];
  if (G.pos === "boss") return [];
  const cur = rows[G.pos.row][G.pos.col];
  if (G.pos.row === rows.length - 1) return [G.map.boss];
  return cur.next.map(c => rows[G.pos.row + 1][c]);
}
function enterNode(node) {
  if (node.type === "boss") { G.pos = "boss"; } else { G.pos = { row: node.row, col: node.col }; }
  G.pendingNode = (node.type === "boss") ? "boss" : { row: node.row, col: node.col };
  saveGame();
  switch (node.type) {
    case "battle": startCombat(node.encounter, "battle"); break;
    case "elite": startCombat(node.encounter, "elite"); break;
    case "boss": startCombat(node.encounter, "boss"); break;
    case "rest": G.screen = "rest"; G.restUsed = false; saveGame(); break;
    case "shop": openShop(); break;
    case "event": openEvent(); break;
  }
}
function markNodeDone() {
  if (G.pendingNode === "boss") G.map.boss.done = true;
  else if (G.pendingNode) {
    const n = G.map.rows[G.pendingNode.row][G.pendingNode.col];
    n.done = true;
  }
  G.pendingNode = null;
}

/* ============================================================
   工具：局外数值操作（data.js 的事件会调用）
   ============================================================ */
function healPlayer(g, n) { g.hp = clamp(g.hp + n, 0, g.maxHp); if (C) C.log.push(`回复 ${n} 点生命。`); }
function damagePlayerMeta(g, n) {
  g.hp -= n;
  if (g.hp <= 0) { g.hp = 0; gameOver(); }
}
function addCardToDeck(g, id, up = false) { g.deck.push(newCard(id, up)); }
function removeCardFromDeck(g, uid) { g.deck = g.deck.filter(c => c.uid !== uid); }
function gainRandomPotion(g) {
  if (g.potions.length >= CONFIG.potionSlots) return null;
  const p = choice(Object.values(POTIONS));
  g.potions.push(p.id);
  return p.name;
}
function ownedRelicSet() { return new Set(G.relics); }
function gainRandomRelic(g) {
  const owned = new Set(g.relics);
  const pool = Object.values(RELICS).filter(r => ["common", "uncommon"].includes(r.rarity) && !owned.has(r.id));
  if (!pool.length) return null;
  const r = choice(pool);
  gainRelic(g, r.id);
  return r;
}
function gainRelic(g, id) {
  if (g.relics.includes(id)) return;
  g.relics.push(id);
  const r = RELICS[id];
  if (r.onPickup) r.onPickup(g);
}
function upgradeRandomCards(g, n) {
  const ups = [];
  const cands = shuffled(g.deck.filter(c => !c.up && CARDS[c.id].rarity !== "special"));
  for (let i = 0; i < Math.min(n, cands.length); i++) { cands[i].up = true; ups.push(CARDS[cands[i].id].name + "+"); }
  return ups;
}
function relicNum(field) {
  let v = 0;
  for (const id of G.relics) { const r = RELICS[id]; if (r && r[field]) v += r[field]; }
  return v;
}

/* ============================================================
   战斗
   ============================================================ */
function makeEnemy(id) {
  const d = ENEMIES[id];
  const hp = rint(d.hp[0], d.hp[1]);
  const en = { key: _uid++, id, name: d.name, emoji: d.emoji, hp, maxHp: hp, block: 0, status: {}, state: {}, turn: 0, nextMove: null, elite: !!d.elite, boss: !!d.boss };
  if (d.onSpawn) d.onSpawn(en);
  return en;
}

function startCombat(encounter, kind) {
  C = {
    kind, // battle / elite / boss
    enemies: encounter.map(makeEnemy),
    turn: 1,
    energy: 0,
    hand: [], draw: [], discard: [], exhaust: [],
    pblock: 0, pstatus: {},
    flags: {},
    played: null, playedCombat: { total: 0 },
    selected: null,
    busy: false, over: false,
    log: [],
    firstAttackConsumed: false,
    tempAttackBonus: 0,
  };
  C.draw = shuffled(G.deck.map(c => ({ uid: c.uid, id: c.id, up: c.up })));
  G.screen = "combat";
  const bossIntro = ENEMIES[encounter[0]] && ENEMIES[encounter[0]].intro;
  if (bossIntro) C.log.push(`「${ENEMIES[encounter[0]].name}」——${bossIntro}`);
  // 敌人首个意图
  for (const en of C.enemies) planMove(en);
  // 战斗开始钩子
  for (const id of G.relics) { const r = RELICS[id]; if (r.onCombatStart) r.onCombatStart(PCTX); }
  startPlayerTurn(true);
}

function planMove(en) {
  en.turn++;
  en.nextMove = ENEMIES[en.id].ai(en, en.turn, ECTX);
}

/* ---------- 玩家回合 ---------- */
function startPlayerTurn(first = false) {
  if (C.over) return;
  C.played = { total: 0, red: 0, blue: 0, yellow: 0, purple: 0, gray: 0, attackType: 0 };
  C.afterimageUsed = false;
  if (!first || true) { /* 每回合都执行 */ }
  if (!C.pstatus.barricade) C.pblock = 0;
  // 玩家侵蚀
  if (C.pstatus.poison > 0) {
    C.log.push(`侵蚀啃噬着你：失去 ${C.pstatus.poison} 点生命。`);
    fx("pdmg", { amt: C.pstatus.poison, hpLoss: C.pstatus.poison, poison: true });
    G.hp -= C.pstatus.poison;
    C.pstatus.poison--;
    if (checkDefeat()) return;
  }
  // 能力 / 芯片回合开始效果
  if (C.pstatus.droneGuard) PCTX.block(C.pstatus.droneGuard);
  for (const id of G.relics) { const r = RELICS[id]; if (r.onTurnStart) r.onTurnStart(PCTX); }
  if (C.pstatus.inkStorm) { PCTX.aoe(C.pstatus.inkStorm, true); if (C.over) return; }
  if (C.pstatus.poisonAura) PCTX.applyAll("poison", C.pstatus.poisonAura);
  if (C.pstatus.healPerTurn) PCTX.heal(C.pstatus.healPerTurn);
  if ((C.pstatus.undertow || C.pstatus.undertowPlus) && C.pblock > 0) {
    PCTX.energyBank = (PCTX.energyBank || 0);
    C.bonusEnergyNextRefill = (C.bonusEnergyNextRefill || 0) + 1;
    if (C.pstatus.undertowPlus) C.bonusDrawNextRefill = (C.bonusDrawNextRefill || 0) + 1;
    C.log.push("秩序逆流：墨甲之下涌出墨水。");
  }
  // 能量与抽牌
  C.energy = G.energyMax + (C.pstatus.energyPerTurn || 0) + (C.bonusEnergyNextRefill || 0);
  C.bonusEnergyNextRefill = 0;
  const drawN = CONFIG.drawPerTurn + (C.pstatus.drawPerTurn || 0) + (C.bonusDrawNextRefill || 0);
  C.bonusDrawNextRefill = 0;
  PCTX.draw(drawN);
  render();
}

function drawCards(n) {
  for (let i = 0; i < n; i++) {
    if (C.hand.length >= CONFIG.handLimit) return;
    if (!C.draw.length) {
      if (!C.discard.length) return;
      C.draw = shuffled(C.discard); C.discard = [];
    }
    C.hand.push(C.draw.pop());
  }
}

/* ---------- 出牌 ---------- */
function canPlay(card) {
  const d = CARDS[card.id];
  if (d.cost === null) return false;
  return cardCost(card) <= C.energy;
}
function cardCost(card) {
  const d = CARDS[card.id];
  if (d.cost === null) return null;
  return (card.up && d.costUp !== undefined) ? d.costUp : d.cost;
}
function cardExhausts(card) {
  const d = CARDS[card.id];
  if (card.up && d.exhaustUp !== undefined) return d.exhaustUp;
  return !!d.exhaust;
}

function playCard(uid, targetKey) {
  if (C.busy || C.over) return;
  const idx = C.hand.findIndex(c => c.uid === uid);
  if (idx < 0) return;
  const card = C.hand[idx];
  const d = CARDS[card.id];
  if (!canPlay(card)) { C.log.push("墨水不足。"); render(); return; }
  let target = null;
  if (d.target === "enemy") {
    target = C.enemies.find(e => e.key === targetKey && e.hp > 0) || null;
    if (!target) {
      const alive = C.enemies.filter(e => e.hp > 0);
      if (alive.length === 1) target = alive[0]; else { C.selected = uid; render(); return; }
    }
  }
  C.selected = null;
  C.energy -= cardCost(card);
  C.hand.splice(idx, 1);

  // 赤芯片·锋刃：本场第一张攻击牌 +5
  C.tempAttackBonus = 0;
  if (d.type === "attack" && C.flags.firstAttackBonus && !C.firstAttackConsumed) {
    C.tempAttackBonus = 5; C.firstAttackConsumed = true;
  }
  if (d.play) d.play(PCTX, card, target);
  C.tempAttackBonus = 0;

  // 计数
  C.played.total++;
  C.played[d.color] = (C.played[d.color] || 0) + 1;
  if (d.type === "attack") C.played.attackType++;
  C.playedCombat.total++;

  // 残像墨影
  if (!C.over && d.type === "attack" && C.pstatus.afterimage && !C.afterimageUsed) {
    C.afterimageUsed = true;
    let t2 = target && target.hp > 0 ? target : (C.enemies.filter(e => e.hp > 0)[0] || null);
    if (t2 || d.target !== "enemy") {
      C.log.push(`残像墨影：「${d.name}」再次施放！`);
      if (d.play) d.play(PCTX, card, t2);
    }
  }
  // 调色盘连携
  if (!C.over && C.pstatus.paletteLink && C.played.total % 3 === 0) {
    C.log.push("调色盘连携触发：抽 1 张牌，获得 3 点墨甲。");
    PCTX.draw(1); PCTX.block(3);
  }
  // 芯片出牌钩子
  if (!C.over) for (const id of G.relics) { const r = RELICS[id]; if (r.onCardPlayed) r.onCardPlayed(PCTX, card); }

  // 弃置 / 消耗
  if (cardExhausts(card)) C.exhaust.push(card); else C.discard.push(card);
  if (!C.over) checkVictory();
  render();
}

/* ---------- 回合结束 & 敌人行动 ---------- */
async function endTurn() {
  if (C.busy || C.over) return;
  C.busy = true;
  // 芯片回合结束钩子
  for (const id of G.relics) { const r = RELICS[id]; if (r.onTurnEnd) r.onTurnEnd(PCTX); }
  // 手牌结算：虚无消耗、烙印扣血、其余弃置
  for (const card of C.hand.slice()) {
    const d = CARDS[card.id];
    if (card.id === "order_brand") { G.hp -= 1; C.log.push("秩序烙印灼烧着你：失去 1 点生命。"); }
    if (d.ethereal) { C.exhaust.push(card); C.log.push(`「${d.name}」消散了。`); }
    else C.discard.push(card);
  }
  C.hand = [];
  if (checkDefeat()) { C.busy = false; render(); return; }
  // 玩家 debuff 递减
  for (const k of ["weak", "vulnerable", "frail"]) if (C.pstatus[k] > 0) C.pstatus[k]--;
  render();
  await sleep(350);
  // 敌人行动
  for (const en of C.enemies) {
    if (C.over) break;
    if (en.hp <= 0) continue;
    // 敌人侵蚀
    if (en.status.poison > 0) {
      en.hp -= en.status.poison;
      fx("edmg", { key: en.key, amt: en.status.poison, hpLoss: en.status.poison, poison: true });
      C.log.push(`${en.name} 被侵蚀：失去 ${en.status.poison} 点生命。`);
      if (!C.flags.poisonNoDecay) en.status.poison--;
      render();
      if (en.hp <= 0) { C.log.push(`${en.name} 在侵蚀中崩解。`); checkVictory(); if (C.over) break; await sleep(250); continue; }
      await sleep(250);
    }
    en.block = 0;
    C.actingEnemy = en.key;
    render();
    await sleep(420);
    if (en.nextMove && en.nextMove.act) en.nextMove.act(ECTX, en);
    C.actingEnemy = null;
    if (checkDefeat()) break;
    checkVictory();
    if (C.over) break;
    // 仪式
    if (en.status.ritual) { en.status.strength = (en.status.strength || 0) + en.status.ritual; C.log.push(`${en.name} 的仪式：墨力 +${en.status.ritual}。`); }
    render();
    await sleep(300);
  }
  if (!C.over) {
    // 敌人 debuff 递减
    for (const en of C.enemies) {
      if (en.hp <= 0) continue;
      for (const k of ["weak", "vulnerable", "frail"]) if (en.status[k] > 0) en.status[k]--;
      planMove(en);
    }
    C.turn++;
    C.busy = false;
    startPlayerTurn();
  } else {
    C.busy = false;
    render();
  }
}
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

/* ---------- 伤害计算 ---------- */
function playerHitEnemy(t, base, isAttack = true) {
  if (!t || t.hp <= 0) return 0;
  let amt = base;
  if (isAttack) {
    amt += (C.pstatus.strength || 0) + (C.tempAttackBonus || 0);
    if (C.pstatus.weak > 0) amt = Math.floor(amt * 0.75);
    if (t.status.vulnerable > 0) amt = Math.floor(amt * 1.5);
  }
  amt = Math.max(0, amt);
  const blocked = Math.min(t.block, amt);
  t.block -= blocked;
  const hpLoss = amt - blocked;
  t.hp -= hpLoss;
  fx("edmg", { key: t.key, amt, hpLoss, dead: t.hp <= 0 });
  if (isAttack && t.status.thorns > 0 && t.hp > 0) {
    C.log.push(`${t.name} 的反墨刺伤了你（${t.status.thorns}）。`);
    hurtPlayer(t.status.thorns, false);
  }
  return amt;
}
function hurtPlayer(amt, isAttack = true, attacker = null) {
  if (isAttack && attacker) {
    amt += (attacker.status.strength || 0);
    if (attacker.status.weak > 0) amt = Math.floor(amt * 0.75);
    if (C.pstatus.vulnerable > 0) amt = Math.floor(amt * 1.5);
  }
  amt = Math.max(0, amt);
  const blocked = Math.min(C.pblock, amt);
  C.pblock -= blocked;
  const hpLoss = amt - blocked;
  G.hp -= hpLoss;
  fx("pdmg", { amt, hpLoss });
  if (isAttack && attacker && C.pstatus.thorns > 0 && attacker.hp > 0) {
    const th = C.pstatus.thorns;
    attacker.hp -= th;
    C.log.push(`反墨刺伤 ${attacker.name}（${th}）。`);
  }
  checkDefeat();
  return hpLoss;
}
/* 意图预估显示 */
function intentDamage(en) {
  const m = en.nextMove;
  if (!m || m.dmg === undefined) return null;
  let amt = m.dmg + (en.status.strength || 0);
  if (en.status.weak > 0) amt = Math.floor(amt * 0.75);
  if (C.pstatus.vulnerable > 0) amt = Math.floor(amt * 1.5);
  return Math.max(0, amt);
}

const DEBUFF_KEYS = ["weak", "vulnerable", "frail", "poison"];
function applyStatusToEnemy(t, k, n) {
  if (!t || t.hp <= 0 || n === 0) return;
  const isDebuff = DEBUFF_KEYS.includes(k) || (k === "strength" && n < 0);
  if (isDebuff && t.status.artifact > 0) {
    t.status.artifact--;
    C.log.push(`${t.name} 的净化层抵消了负面效果。`);
    fx("estatus", { key: t.key, k: "artifact", n: 0, negated: true });
    return;
  }
  t.status[k] = (t.status[k] || 0) + n;
  fx("estatus", { key: t.key, k, n });
}

/* ---------- 玩家侧战斗接口（供卡牌/芯片/特饮调用） ---------- */
const PCTX = {
  dmg(t, base, times = 1) {
    for (let i = 0; i < times; i++) {
      if (!t || t.hp <= 0) break;
      playerHitEnemy(t, base, true);
    }
    checkVictory();
  },
  aoe(base, pure = false) {
    for (const en of C.enemies) if (en.hp > 0) playerHitEnemy(en, base, !pure ? true : false);
    checkVictory();
  },
  splash(exclude, base) {
    for (const en of C.enemies) if (en.hp > 0 && en !== exclude) playerHitEnemy(en, base, true);
    checkVictory();
  },
  dmgRandom(base) {
    const alive = C.enemies.filter(e => e.hp > 0);
    if (!alive.length) return;
    playerHitEnemy(choice(alive), base, false);
    checkVictory();
  },
  block(n) {
    let amt = n + (C.pstatus.dexterity || 0);
    if (C.pstatus.frail > 0) amt = Math.floor(amt * 0.75);
    amt = Math.max(0, amt);
    C.pblock += amt;
    fx("pblock", { amt });
  },
  draw(n) { drawCards(n); },
  energy(n) { C.energy += n; if (n > 0) fx("penergy", { n }); },
  heal(n) { G.hp = clamp(G.hp + n, 0, G.maxHp); fx("pheal", { n }); },
  loseHp(n) { G.hp -= n; fx("pdmg", { amt: n, hpLoss: n }); checkDefeat(); },
  apply(t, k, n) { applyStatusToEnemy(t, k, n); },
  applyAll(k, n) { for (const en of C.enemies) if (en.hp > 0) applyStatusToEnemy(en, k, n); },
  applySelf(k, n) { C.pstatus[k] = (C.pstatus[k] || 0) + n; fx("pstatus", { k, n }); },
  cleanse() { for (const k of ["weak", "vulnerable", "frail", "poison"]) delete C.pstatus[k]; },
  myBlock() { return C.pblock; },
  playedThisTurn(key) { return (C.played && C.played[key]) || 0; },
  setFlag(f) { C.flags[f] = true; },
  addToDiscard(id) { C.discard.push({ uid: _uid++, id, up: false }); },
  recoverFromDiscard(n) {
    for (let i = 0; i < n; i++) {
      if (!C.discard.length || C.hand.length >= CONFIG.handLimit) break;
      const idx = Math.floor(RNG() * C.discard.length);
      C.hand.push(C.discard.splice(idx, 1)[0]);
    }
  },
};

/* ---------- 敌人侧接口 ---------- */
const ECTX = {
  attack(self, dmg, times = 1) {
    for (let i = 0; i < times; i++) {
      if (C.over || self.hp <= 0) break;
      hurtPlayer(dmg, true, self);
    }
  },
  gainBlock(self, n) { self.block += n; fx("eblock", { key: self.key, n }); },
  buff(self, k, n) { self.status[k] = (self.status[k] || 0) + n; fx("estatus", { key: self.key, k, n, buff: true }); },
  debuff(k, n) { C.pstatus[k] = (C.pstatus[k] || 0) + n; fx("pstatus", { k, n }); },
  allies() { return C.enemies.filter(e => e.hp > 0); },
  addStatusToPlayer(id, count) {
    for (let i = 0; i < count; i++) C.discard.push({ uid: _uid++, id, up: false });
    C.log.push(`${count} 张「${CARDS[id].name}」被塞入你的弃牌堆！`);
  },
};

/* ---------- 战斗结束 ---------- */
function checkDefeat() {
  if (G.hp <= 0 && !(C && C.over)) { G.hp = 0; gameOver(); return true; }
  return G.hp <= 0;
}
function checkVictory() {
  if (!C || C.over) return;
  if (C.enemies.every(e => e.hp <= 0)) {
    C.over = true;
    winCombat();
  }
}
function gameOver() {
  if (C) C.over = true;
  unlockEnding("white");
  clearSave();
  G.screen = "gameover";
  render();
}

function winCombat() {
  const kind = C.kind;
  G.stats.battles++;
  if (kind === "elite") G.stats.elites++;
  if (kind === "boss") G.stats.bosses++;
  for (const id of G.relics) { const r = RELICS[id]; if (r.onCombatEnd) r.onCombatEnd(G); }

  if (kind === "boss" && G.act === CONFIG.acts) { victory(); return; }

  // 奖励
  let gold = kind === "boss" ? rint(95, 110) : kind === "elite" ? rint(42, 60) : rint(18, 28);
  gold = Math.floor(gold * (1 + relicNum("goldBonus")));
  const nChoices = 3 + relicNum("rewardChoiceBonus");
  const reward = {
    gold,
    cards: genCardChoices(nChoices, kind),
    cardTaken: false,
    potion: null, relic: null, bossRelics: null,
  };
  const potChance = CONFIG.potionDropChance + relicNum("potionChanceBonus") + (G.bonusElite ? 1 : 0);
  if (RNG() < potChance) reward.potion = choice(Object.values(POTIONS)).id;
  if (kind === "elite" || G.bonusElite) {
    const owned = new Set(G.relics);
    const pool = Object.values(RELICS).filter(r => ["common", "uncommon"].includes(r.rarity) && !owned.has(r.id));
    if (pool.length) reward.relic = choice(pool).id;
  }
  if (kind === "boss") {
    reward.bossRelics = Object.values(RELICS).filter(r => r.rarity === "boss" && !G.takenBossRelics.includes(r.id) && !G.relics.includes(r.id)).map(r => r.id);
  }
  G.bonusElite = false;
  G.gold += reward.gold;
  G.reward = reward;
  markNodeDone();
  G.screen = "reward";
  saveGame();
  render();
}

function genCardChoices(n, kind) {
  const picks = [];
  const pool = CARD_POOL.slice();
  for (let i = 0; i < n; i++) {
    let rarity;
    const roll = RNG();
    if (kind === "boss") rarity = "rare";
    else if (kind === "elite") rarity = roll < 0.15 ? "rare" : roll < 0.55 ? "uncommon" : "common";
    else rarity = roll < 0.06 ? "rare" : roll < 0.40 ? "uncommon" : "common";
    const cands = pool.filter(c => c.rarity === rarity && !picks.includes(c.id));
    const all = cands.length ? cands : pool.filter(c => !picks.includes(c.id));
    if (!all.length) break;
    picks.push(choice(all).id);
  }
  return picks;
}

function takeRewardCard(id) {
  if (!G.reward || G.reward.cardTaken) return;
  addCardToDeck(G, id);
  G.reward.cardTaken = true;
  G.stats.cardsPicked++;
  saveGame(); render();
}
function takeRewardPotion() {
  if (!G.reward || !G.reward.potion) return;
  if (G.potions.length >= CONFIG.potionSlots) { toast("特饮栏已满。"); return; }
  G.potions.push(G.reward.potion);
  G.reward.potion = null;
  saveGame(); render();
}
function takeRewardRelic() {
  if (!G.reward || !G.reward.relic) return;
  gainRelic(G, G.reward.relic);
  G.reward.relic = null;
  saveGame(); render();
}
function takeBossRelic(id) {
  if (!G.reward || !G.reward.bossRelics) return;
  gainRelic(G, id);
  G.takenBossRelics.push(id);
  G.reward.bossRelics = null;
  saveGame(); render();
}
function finishReward() {
  G.reward = null;
  if (G.pos === "boss" || (G.map && G.map.boss.done)) {
    if (G.map.boss.done) { startAct(G.act + 1); render(); return; }
  }
  G.screen = "map";
  saveGame(); render();
}

/* ---------- 胜利结算 ---------- */
function deckColorRatio() {
  const counts = { red: 0, blue: 0, yellow: 0, purple: 0 };
  let total = 0;
  for (const c of G.deck) {
    const col = CARDS[c.id].color;
    if (counts[col] !== undefined) { counts[col]++; total++; }
  }
  return { counts, total };
}
function victory() {
  const { counts, total } = deckColorRatio();
  let ending = ENDINGS.balance;
  if (total > 0) {
    for (const col of ["red", "blue", "yellow", "purple"]) {
      if (counts[col] / total >= 0.45) { ending = ENDINGS[col]; break; }
    }
  }
  unlockEnding(ending.id);
  const m = loadMeta(); m.wins++; saveMeta(m);
  clearSave();
  G.ending = ending.id;
  G.screen = "victory";
  render();
}

/* ============================================================
   商店
   ============================================================ */
function shopPrice(base) { return Math.max(5, Math.floor(base * (1 - relicNum("shopDiscount")))); }
function openShop() {
  const owned = new Set(G.relics);
  const cardIds = genCardChoices(5, "shop_mix");
  const relicPool = shuffled(Object.values(RELICS).filter(r => ["common", "uncommon"].includes(r.rarity) && !owned.has(r.id))).slice(0, 2);
  G.shop = {
    cards: cardIds.map(id => ({ id, price: shopPrice(CARDS[id].rarity === "rare" ? rint(135, 160) : CARDS[id].rarity === "uncommon" ? rint(70, 95) : rint(45, 60)), sold: false })),
    relics: relicPool.map(r => ({ id: r.id, price: shopPrice(r.rarity === "uncommon" ? rint(140, 170) : rint(90, 120)), sold: false })),
    potions: [0, 1].map(() => ({ id: choice(Object.values(POTIONS)).id, price: shopPrice(rint(45, 60)), sold: false })),
    removePrice: shopPrice(G.removeCost),
    removeUsed: false,
  };
  G.screen = "shop";
  saveGame();
}
function buyShopCard(i) {
  const it = G.shop.cards[i];
  if (!it || it.sold || G.gold < it.price) return;
  G.gold -= it.price; it.sold = true;
  addCardToDeck(G, it.id);
  saveGame(); render();
}
function buyShopRelic(i) {
  const it = G.shop.relics[i];
  if (!it || it.sold || G.gold < it.price) return;
  G.gold -= it.price; it.sold = true;
  gainRelic(G, it.id);
  saveGame(); render();
}
function buyShopPotion(i) {
  const it = G.shop.potions[i];
  if (!it || it.sold || G.gold < it.price) return;
  if (G.potions.length >= CONFIG.potionSlots) { toast("特饮栏已满。"); return; }
  G.gold -= it.price; it.sold = true;
  G.potions.push(it.id);
  saveGame(); render();
}
function shopRemoveService() {
  if (G.shop.removeUsed || G.gold < G.shop.removePrice) return;
  G.pick = { mode: "remove", back: "shop", price: G.shop.removePrice };
  render();
}
function leaveShop() { G.shop = null; markNodeDone(); G.screen = "map"; saveGame(); render(); }

/* ============================================================
   休息点
   ============================================================ */
function restHeal() {
  if (G.restUsed) return;
  if (G.relics.includes("caffeine_ink")) { toast("咖啡因墨水的副作用：无法入睡。"); return; }
  G.restUsed = true;
  const amt = Math.floor(G.maxHp * CONFIG.restHealRatio) + relicNum("restBonus");
  healPlayer(G, amt);
  G.restResult = `你蜷进一段还残留着体温的管道里，睡了一场没有白色的梦。<br>回复 ${amt} 点生命。`;
  saveGame(); render();
}
function restUpgrade() {
  if (G.restUsed) return;
  G.pick = { mode: "upgrade", back: "rest" };
  render();
}
function leaveRest() { G.restUsed = false; G.restResult = null; markNodeDone(); G.screen = "map"; saveGame(); render(); }

/* ============================================================
   事件
   ============================================================ */
function openEvent() {
  const pool = EVENTS.filter(e => !G.usedEvents.includes(e.id));
  const ev = choice(pool.length ? pool : EVENTS);
  G.usedEvents.push(ev.id);
  G.event = { id: ev.id, result: null };
  G.screen = "event";
  saveGame();
}
function chooseEventOption(i) {
  const ev = EVENTS.find(e => e.id === G.event.id);
  const opt = ev.options[i];
  if (opt.cond && !opt.cond(G)) return;
  const res = opt.resolve(G);
  if (G.screen === "gameover") return; // 事件伤害致死
  if (res.pickUpgrade) { G.pick = { mode: "upgrade", back: "event" }; render(); return; }
  if (res.pickRemove) { G.pick = { mode: "remove", back: "event" }; render(); return; }
  if (res.eliteFight) {
    G.bonusElite = true;
    startCombat(choice(ENCOUNTERS[G.act].elites), "elite");
    render(); return;
  }
  G.event.result = res.text;
  saveGame(); render();
}
function leaveEvent() { G.event = null; markNodeDone(); G.screen = "map"; saveGame(); render(); }

/* ============================================================
   卡牌选择（升级 / 移除）
   ============================================================ */
function pickCard(uid) {
  const p = G.pick;
  if (!p) return;
  const card = G.deck.find(c => c.uid === uid);
  if (!card) return;
  if (p.mode === "upgrade") {
    if (card.up || CARDS[card.id].rarity === "special") return;
    card.up = true;
    if (p.back === "rest") { G.restUsed = true; G.restResult = `锻炉的墨火舔过卡牌边缘。<br>「${CARDS[card.id].name}」升级为「${CARDS[card.id].name}+」。`; }
    if (p.back === "event") G.event.result = `全息影像调出强化程序，一束彩光注入你的卡牌。<br>「${CARDS[card.id].name}」升级为「${CARDS[card.id].name}+」。`;
  } else if (p.mode === "remove") {
    if (p.back === "shop") {
      G.gold -= p.price;
      G.shop.removeUsed = true;
      G.removeCost += CONFIG.removeCostStep;
    }
    removeCardFromDeck(G, uid);
    if (p.back === "event") G.event.result = `安可把那张牌抽出来，随手拍进采样器，按下了「删除」。<br>「${CARDS[card.id].name}」从你的牌组中消失了。`;
  }
  G.pick = null;
  saveGame(); render();
}
function cancelPick() { G.pick = null; render(); }

/* ============================================================
   特饮使用
   ============================================================ */
function usePotion(i) {
  const pid = G.potions[i];
  if (!pid) return;
  const p = POTIONS[pid];
  const inCombat = G.screen === "combat" && C && !C.over;
  if (p.combatOnly && !inCombat) { toast("只能在战斗中使用。"); return; }
  if (inCombat) {
    p.use(PCTX);
    checkVictory();
  } else {
    if (pid === "p_heal") healPlayer(G, 15);
    else { toast("只能在战斗中使用。"); return; }
  }
  G.potions.splice(i, 1);
  saveGame(); render();
}
function dropPotion(i) { G.potions.splice(i, 1); saveGame(); render(); }

/* ---------- 继续游戏 ---------- */
function continueGame() {
  const s = loadSave();
  if (!s) return false;
  G = s;
  C = null;
  // uid 计数续接，避免冲突
  let mx = 1;
  for (const c of G.deck) mx = Math.max(mx, c.uid || 1);
  _uid = mx + 1;
  return true;
}
