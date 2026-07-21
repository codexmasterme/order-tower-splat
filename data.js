/* ============================================================
   秩序尖塔 · ORDER TOWER
   数据文件：配置 / 卡牌 / 色彩芯片 / 特饮 / 敌人 / 遭遇 / 事件 / 文案
   ============================================================ */
"use strict";

/* ---------- 全局配置 ---------- */
const CONFIG = {
  maxHp: 72,
  startGold: 99,
  energyPerTurn: 3,
  drawPerTurn: 5,
  handLimit: 10,
  potionSlots: 3,
  acts: 3,
  rowsPerAct: 9,          // 9 行 + Boss = 每幕 10 层，共 30F
  restHealRatio: 0.30,
  actTransitionHeal: 0.25,
  removeCostBase: 75,
  removeCostStep: 25,
  potionDropChance: 0.25,
};

/* v(升级?, 基础值, 升级值) */
function VU(u, a, b) { return u ? b : a; }

/* ---------- 颜色 ---------- */
const COLORS = {
  red:    { name: "赤", full: "赤 · 火力", css: "c-red" },
  blue:   { name: "蓝", full: "蓝 · 护体", css: "c-blue" },
  yellow: { name: "黄", full: "黄 · 支援", css: "c-yellow" },
  purple: { name: "紫", full: "紫 · 侵蚀", css: "c-purple" },
  gray:   { name: "灰", full: "灰 · 无色", css: "c-gray" },
};

const TYPE_NAME = { attack: "攻击", skill: "技能", power: "能力", status: "状态", curse: "诅咒" };
const RARITY_NAME = { starter: "初始", common: "普通", uncommon: "精良", rare: "稀有", special: "特殊" };

/* ---------- 关键词说明（帮助界面） ---------- */
const KEYWORDS = [
  ["墨水", "打出卡牌的资源，每回合恢复至上限（默认 3）。"],
  ["墨甲", "抵挡伤害。默认在你的回合开始时清零。"],
  ["墨力", "你或敌人的每次攻击伤害 +X。"],
  ["灵巧", "你每次获得墨甲时额外 +X。"],
  ["虚弱", "造成的攻击伤害 -25%，持续 X 回合。"],
  ["易伤", "受到的攻击伤害 +50%，持续 X 回合。"],
  ["破损", "获得的墨甲 -25%，持续 X 回合。"],
  ["侵蚀", "回合开始时失去 X 点生命（无视墨甲），随后侵蚀 -1。"],
  ["反墨", "被攻击时，攻击者受到 X 点伤害。"],
  ["净化层", "抵消下 X 次受到的负面效果。"],
  ["仪式", "每回合结束时获得 X 点墨力（敌人）。"],
  ["消耗", "打出后本场战斗中移除该牌。"],
  ["虚无", "回合结束时若仍在手中，消耗之。"],
  ["共鸣", "效果随本回合已打出的同色卡牌数量增强。"],
];

/* ============================================================
   卡牌
   play(ctx, card, target)：ctx 为战斗接口，target 为敌人对象或 null
   ============================================================ */
const CARDS = {};
function defCard(def) { CARDS[def.id] = def; }

/* ================= 初始 ================= */
defCard({
  id: "strike", name: "斯普拉射击", color: "red", type: "attack", rarity: "starter", cost: 1, target: "enemy",
  desc: u => `造成 ${VU(u,6,9)} 点伤害。`,
  flavor: "最顺手的一把。墨水上膛，别想太多。",
  play: (ctx, c, t) => ctx.dmg(t, VU(c.up,6,9)),
});
defCard({
  id: "defend", name: "墨甲展开", color: "blue", type: "skill", rarity: "starter", cost: 1, target: "self",
  desc: u => `获得 ${VU(u,5,8)} 点墨甲。`,
  flavor: "一层新鲜的墨，是这座白塔里唯一的铠甲。",
  play: (ctx, c) => ctx.block(VU(c.up,5,8)),
});
defCard({
  id: "squid_dash", name: "鱿式突进", color: "red", type: "attack", rarity: "starter", cost: 1, target: "enemy",
  desc: u => `造成 ${VU(u,5,8)} 点伤害，获得 ${VU(u,4,6)} 点墨甲。`,
  flavor: "变形、潜行、贴脸——特训出来的肌肉记忆。",
  play: (ctx, c, t) => { ctx.dmg(t, VU(c.up,5,8)); ctx.block(VU(c.up,4,6)); },
});
defCard({
  id: "pearl_call", name: "珍珠呼叫", color: "yellow", type: "skill", rarity: "starter", cost: 0, target: "self",
  desc: u => `抽 ${VU(u,1,2)} 张牌。`,
  flavor: "「小八！接住——这是战场情报，也是应援！」",
  play: (ctx, c) => ctx.draw(VU(c.up,1,2)),
});

/* ================= 赤 · 火力 ================= */
defCard({
  id: "twin_splash", name: "双联泼溅", color: "red", type: "attack", rarity: "common", cost: 1, target: "enemy",
  desc: u => `造成 ${VU(u,4,6)} 点伤害 2 次。`,
  play: (ctx, c, t) => ctx.dmg(t, VU(c.up,4,6), 2),
});
defCard({
  id: "roller_crush", name: "滚筒碾压", color: "red", type: "attack", rarity: "common", cost: 2, target: "enemy",
  desc: u => `造成 ${VU(u,12,16)} 点伤害，施加 1 层易伤。`,
  flavor: "从头顶落下的，是一整面颜色。",
  play: (ctx, c, t) => { ctx.dmg(t, VU(c.up,12,16)); ctx.apply(t, "vulnerable", 1); },
});
defCard({
  id: "quick_shot", name: "速射墨珠", color: "red", type: "attack", rarity: "common", cost: 0, target: "enemy",
  desc: u => `造成 ${VU(u,3,5)} 点伤害。`,
  play: (ctx, c, t) => ctx.dmg(t, VU(c.up,3,5)),
});
defCard({
  id: "brush_sweep", name: "墨刷横扫", color: "red", type: "attack", rarity: "common", cost: 1, target: "allEnemies",
  desc: u => `对所有敌人造成 ${VU(u,4,6)} 点伤害。`,
  play: (ctx, c) => ctx.aoe(VU(c.up,4,6)),
});
defCard({
  id: "arc_bomb", name: "曲射炸弹", color: "red", type: "attack", rarity: "common", cost: 1, target: "enemy",
  desc: u => `造成 ${VU(u,7,10)} 点伤害；溅射：对其他敌人造成 ${VU(u,3,4)} 点伤害。`,
  play: (ctx, c, t) => { ctx.dmg(t, VU(c.up,7,10)); ctx.splash(t, VU(c.up,3,4)); },
});
defCard({
  id: "charge_snipe", name: "蓄力狙击", color: "red", type: "attack", rarity: "common", cost: 2, target: "enemy",
  desc: u => `造成 ${VU(u,16,22)} 点伤害。`,
  flavor: "准星里的白色世界，安静得可怕。",
  play: (ctx, c, t) => ctx.dmg(t, VU(c.up,16,22)),
});
defCard({
  id: "trace_arrow", name: "追迹墨箭", color: "red", type: "attack", rarity: "common", cost: 1, target: "enemy",
  desc: u => `造成 ${VU(u,7,10)} 点伤害。若目标处于易伤，抽 1 张牌。`,
  play: (ctx, c, t) => { const had = (t.status.vulnerable||0) > 0; ctx.dmg(t, VU(c.up,7,10)); if (had) ctx.draw(1); },
});
defCard({
  id: "triple_bomb", name: "三连爆弹", color: "red", type: "attack", rarity: "uncommon", cost: 1, target: "enemy",
  desc: u => `造成 ${VU(u,3,4)} 点伤害 3 次。`,
  play: (ctx, c, t) => ctx.dmg(t, VU(c.up,3,4), 3),
});
defCard({
  id: "shark_ram", name: "超鲨冲撞", color: "red", type: "attack", rarity: "uncommon", cost: 2, target: "enemy",
  desc: u => `造成 ${VU(u,18,24)} 点伤害，自身受到 3 点伤害。`,
  flavor: "借来的獠牙也是獠牙。",
  play: (ctx, c, t) => { ctx.dmg(t, VU(c.up,18,24)); ctx.loseHp(3); },
});
defCard({
  id: "full_power", name: "火力全开", color: "red", type: "power", rarity: "uncommon", cost: 1, target: "self",
  desc: u => `获得 ${VU(u,2,3)} 点墨力。`,
  play: (ctx, c) => ctx.applySelf("strength", VU(c.up,2,3)),
});
defCard({
  id: "red_resonance", name: "赤色共鸣", color: "red", type: "attack", rarity: "uncommon", cost: 1, target: "enemy",
  desc: u => `共鸣：造成 ${VU(u,4,6)} + 本回合已打出赤牌数 ×${VU(u,3,4)} 点伤害。`,
  play: (ctx, c, t) => ctx.dmg(t, VU(c.up,4,6) + ctx.playedThisTurn("red") * VU(c.up,3,4)),
});
defCard({
  id: "burst_graffiti", name: "爆裂涂鸦", color: "red", type: "attack", rarity: "uncommon", cost: 1, target: "enemy",
  desc: u => `造成 ${VU(u,8,11)} 点伤害。若此牌击杀敌人，获得 1 点墨水并抽 1 张牌。`,
  play: (ctx, c, t) => { ctx.dmg(t, VU(c.up,8,11)); if (t.hp <= 0) { ctx.energy(1); ctx.draw(1); } },
});
defCard({
  id: "ult_launcher", name: "大招·终极发射器", color: "red", type: "attack", rarity: "rare", cost: 3, target: "enemy", exhaust: true,
  desc: u => `造成 ${VU(u,32,42)} 点伤害。消耗。`,
  flavor: "把整层楼的沉默轰出一个颜色的洞。",
  play: (ctx, c, t) => ctx.dmg(t, VU(c.up,32,42)),
});
defCard({
  id: "ink_storm_card", name: "大招·墨雨风暴", color: "red", type: "power", rarity: "rare", cost: 2, target: "self",
  desc: u => `每回合开始时，对所有敌人造成 ${VU(u,5,7)} 点伤害。`,
  play: (ctx, c) => ctx.applySelf("inkStorm", VU(c.up,5,7)),
});
defCard({
  id: "afterimage", name: "残像墨影", color: "red", type: "power", rarity: "rare", cost: 2, costUp: 1, target: "self",
  desc: u => `每回合你打出的第一张攻击牌将重复施放一次。`,
  flavor: "在墨里游得足够快，连塔都会看见两个你。",
  play: (ctx, c) => ctx.applySelf("afterimage", 1),
});

/* ================= 蓝 · 护体 ================= */
defCard({
  id: "dodge_roll", name: "紧急回避", color: "blue", type: "skill", rarity: "common", cost: 1, target: "self",
  desc: u => `获得 ${VU(u,8,11)} 点墨甲。`,
  play: (ctx, c) => ctx.block(VU(c.up,8,11)),
});
defCard({
  id: "ink_sneak", name: "墨中潜行", color: "blue", type: "skill", rarity: "common", cost: 1, target: "self",
  desc: u => `获得 ${VU(u,5,8)} 点墨甲，抽 1 张牌。`,
  play: (ctx, c) => { ctx.block(VU(c.up,5,8)); ctx.draw(1); },
});
defCard({
  id: "bubble_guard", name: "泡泡护罩", color: "blue", type: "skill", rarity: "common", cost: 2, target: "self",
  desc: u => `获得 ${VU(u,13,18)} 点墨甲。`,
  play: (ctx, c) => ctx.block(VU(c.up,13,18)),
});
defCard({
  id: "paint_retreat", name: "涂地撤离", color: "blue", type: "skill", rarity: "common", cost: 1, target: "enemy",
  desc: u => `获得 ${VU(u,6,8)} 点墨甲，对目标施加 1 层虚弱。`,
  play: (ctx, c, t) => { ctx.block(VU(c.up,6,8)); ctx.apply(t, "weak", 1); },
});
defCard({
  id: "ink_pack", name: "补给墨包", color: "blue", type: "skill", rarity: "common", cost: 0, target: "self",
  desc: u => `获得 ${VU(u,3,6)} 点墨甲。`,
  play: (ctx, c) => ctx.block(VU(c.up,3,6)),
});
defCard({
  id: "thorn_film", name: "墨膜反弹", color: "blue", type: "power", rarity: "uncommon", cost: 1, target: "self",
  desc: u => `获得 ${VU(u,3,5)} 点反墨。`,
  flavor: "碰过来的，都会带着颜色回去。",
  play: (ctx, c) => ctx.applySelf("thorns", VU(c.up,3,5)),
});
defCard({
  id: "hard_coat", name: "铁壁涂装", color: "blue", type: "power", rarity: "uncommon", cost: 1, target: "self",
  desc: u => `获得 ${VU(u,2,3)} 点灵巧。`,
  play: (ctx, c) => ctx.applySelf("dexterity", VU(c.up,2,3)),
});
defCard({
  id: "pearl_escort", name: "珍珠护航", color: "blue", type: "power", rarity: "uncommon", cost: 1, target: "self",
  desc: u => `每回合开始时获得 ${VU(u,3,5)} 点墨甲。`,
  flavor: "「防御交给本小姐的无人机形态！夸我！」",
  play: (ctx, c) => ctx.applySelf("droneGuard", VU(c.up,3,5)),
});
defCard({
  id: "blue_resonance", name: "蓝色共鸣", color: "blue", type: "skill", rarity: "uncommon", cost: 1, target: "self",
  desc: u => `共鸣：获得 ${VU(u,4,6)} + 本回合已打出蓝牌数 ×${VU(u,3,4)} 点墨甲。`,
  play: (ctx, c) => ctx.block(VU(c.up,4,6) + ctx.playedThisTurn("blue") * VU(c.up,3,4)),
});
defCard({
  id: "waterproof", name: "完全防水", color: "blue", type: "skill", rarity: "uncommon", cost: 1, target: "self",
  desc: u => `移除自身的虚弱、易伤、破损与侵蚀，获得 ${VU(u,6,9)} 点墨甲。`,
  play: (ctx, c) => { ctx.cleanse(); ctx.block(VU(c.up,6,9)); },
});
defCard({
  id: "shield_bash", name: "盾墨猛击", color: "blue", type: "attack", rarity: "uncommon", cost: 1, target: "enemy",
  desc: u => `造成等同于当前墨甲${VU(u,""," +5")} 的伤害。`,
  flavor: "防御的重量，也可以是攻击的重量。",
  play: (ctx, c, t) => ctx.dmg(t, ctx.myBlock() + VU(c.up,0,5)),
});
defCard({
  id: "ult_bubble", name: "大招·无敌泡泡", color: "blue", type: "skill", rarity: "rare", cost: 2, target: "self", exhaust: true,
  desc: u => `获得 ${VU(u,25,35)} 点墨甲。消耗。`,
  play: (ctx, c) => ctx.block(VU(c.up,25,35)),
});
defCard({
  id: "barricade", name: "墨之壁垒", color: "blue", type: "power", rarity: "rare", cost: 3, costUp: 2, target: "self",
  desc: u => `你的墨甲不再在回合开始时清零。`,
  flavor: "把每一层旧墨都留下来。这座塔抹不掉它们。",
  play: (ctx, c) => ctx.applySelf("barricade", 1),
});
defCard({
  id: "order_undertow", name: "秩序逆流", color: "blue", type: "power", rarity: "rare", cost: 2, target: "self",
  desc: u => `每回合开始时，若你拥有墨甲，获得 1 点墨水${VU(u,"","并抽 1 张牌")}。`,
  play: (ctx, c) => ctx.applySelf(c.up ? "undertowPlus" : "undertow", 1),
});

/* ================= 黄 · 支援 ================= */
defCard({
  id: "ink_refill", name: "墨量灌注", color: "yellow", type: "skill", rarity: "common", cost: 0, target: "self", exhaust: true,
  desc: u => `获得 ${VU(u,2,3)} 点墨水。消耗。`,
  play: (ctx, c) => ctx.energy(VU(c.up,2,3)),
});
defCard({
  id: "tactic_scope", name: "战术目镜", color: "yellow", type: "skill", rarity: "common", cost: 1, target: "self",
  desc: u => `抽 ${VU(u,2,3)} 张牌。`,
  play: (ctx, c) => ctx.draw(VU(c.up,2,3)),
});
defCard({
  id: "paint_mark", name: "涂地标记", color: "yellow", type: "skill", rarity: "common", cost: 1, target: "allEnemies",
  desc: u => `对所有敌人施加 ${VU(u,1,2)} 层易伤，抽 1 张牌。`,
  play: (ctx, c) => { ctx.applyAll("vulnerable", VU(c.up,1,2)); ctx.draw(1); },
});
defCard({
  id: "pearl_snack", name: "珍珠的零食", color: "yellow", type: "skill", rarity: "common", cost: 1, target: "self", exhaust: true,
  desc: u => `回复 ${VU(u,4,7)} 点生命。消耗。`,
  flavor: "「补给品！卡路里就是战斗力！」",
  play: (ctx, c) => ctx.heal(VU(c.up,4,7)),
});
defCard({
  id: "flash_idea", name: "灵感闪现", color: "yellow", type: "skill", rarity: "common", cost: 0, target: "self", exhaust: true, exhaustUp: false,
  desc: u => `抽 1 张牌。${VU(u,"消耗。","")}`,
  play: (ctx, c) => ctx.draw(1),
});
defCard({
  id: "marina_support", name: "玛丽娜支援", color: "yellow", type: "skill", rarity: "uncommon", cost: 1, target: "self",
  desc: u => `抽 2 张牌，获得 ${VU(u,3,6)} 点墨甲。`,
  flavor: "「频段接通。小八，前方的数据……交给我来读。」",
  play: (ctx, c) => { ctx.draw(2); ctx.block(VU(c.up,3,6)); },
});
defCard({
  id: "boost_program", name: "强化程序", color: "yellow", type: "power", rarity: "uncommon", cost: 1, costUp: 0, target: "self",
  desc: u => `每回合多抽 1 张牌。`,
  play: (ctx, c) => ctx.applySelf("drawPerTurn", 1),
});
defCard({
  id: "pearl_cheer", name: "珍珠激励", color: "yellow", type: "power", rarity: "uncommon", cost: 2, costUp: 1, target: "self",
  desc: u => `每回合获得 1 点额外墨水。`,
  flavor: "「唱起来！墨量是不会背叛热血的！」",
  play: (ctx, c) => ctx.applySelf("energyPerTurn", 1),
});
defCard({
  id: "yellow_resonance", name: "黄色共鸣", color: "yellow", type: "skill", rarity: "uncommon", cost: 1, target: "self",
  desc: u => `获得 1 点墨水并抽 1 张牌。共鸣：若本回合已打出至少 ${VU(u,2,1)} 张黄牌，再获得 1 点墨水。`,
  play: (ctx, c) => { ctx.energy(1); ctx.draw(1); if (ctx.playedThisTurn("yellow") >= VU(c.up,2,1)) ctx.energy(1); },
});
defCard({
  id: "overclock", name: "超频演算", color: "yellow", type: "skill", rarity: "uncommon", cost: 1, target: "self", exhaust: true,
  desc: u => `抽 ${VU(u,3,4)} 张牌。消耗。`,
  play: (ctx, c) => ctx.draw(VU(c.up,3,4)),
});
defCard({
  id: "ult_station", name: "大招·能量站", color: "yellow", type: "power", rarity: "rare", cost: 2, target: "self",
  desc: u => `每回合开始时回复 ${VU(u,3,5)} 点生命。`,
  play: (ctx, c) => ctx.applySelf("healPerTurn", VU(c.up,3,5)),
});
defCard({
  id: "palette_link", name: "调色盘连携", color: "yellow", type: "power", rarity: "rare", cost: 3, costUp: 2, target: "self",
  desc: u => `每回合你打出的第 3 张牌触发：抽 1 张牌并获得 3 点墨甲。`,
  play: (ctx, c) => ctx.applySelf("paletteLink", 1),
});
defCard({
  id: "memory_replay", name: "记忆回放", color: "yellow", type: "skill", rarity: "rare", cost: 1, costUp: 0, target: "self",
  desc: u => `从弃牌堆随机将 2 张牌置入手牌。`,
  flavor: "塔抹得掉墙上的颜色，抹不掉你记得它。",
  play: (ctx, c) => ctx.recoverFromDiscard(2),
});

/* ================= 紫 · 侵蚀 ================= */
defCard({
  id: "erode_stain", name: "侵蚀墨渍", color: "purple", type: "skill", rarity: "common", cost: 1, target: "enemy",
  desc: u => `对目标施加 ${VU(u,4,6)} 层侵蚀。`,
  play: (ctx, c, t) => ctx.apply(t, "poison", VU(c.up,4,6)),
});
defCard({
  id: "dilute_spray", name: "稀释喷雾", color: "purple", type: "skill", rarity: "common", cost: 1, target: "allEnemies",
  desc: u => `对所有敌人施加 ${VU(u,2,3)} 层虚弱。`,
  play: (ctx, c) => ctx.applyAll("weak", VU(c.up,2,3)),
});
defCard({
  id: "corrupt_splash", name: "腐化泼洒", color: "purple", type: "attack", rarity: "common", cost: 1, target: "enemy",
  desc: u => `造成 ${VU(u,5,7)} 点伤害，施加 ${VU(u,2,3)} 层侵蚀。`,
  play: (ctx, c, t) => { ctx.dmg(t, VU(c.up,5,7)); ctx.apply(t, "poison", VU(c.up,2,3)); },
});
defCard({
  id: "reveal_mist", name: "显形墨雾", color: "purple", type: "skill", rarity: "common", cost: 0, target: "enemy",
  desc: u => `对目标施加 ${VU(u,1,2)} 层易伤。`,
  play: (ctx, c, t) => ctx.apply(t, "vulnerable", VU(c.up,1,2)),
});
defCard({
  id: "siphon_touch", name: "汲取之触", color: "purple", type: "attack", rarity: "common", cost: 1, target: "enemy",
  desc: u => `造成 ${VU(u,6,9)} 点伤害，回复 ${VU(u,3,4)} 点生命。`,
  flavor: "颜色被夺走，就从夺走它的东西身上拿回来。",
  play: (ctx, c, t) => { ctx.dmg(t, VU(c.up,6,9)); ctx.heal(VU(c.up,3,4)); },
});
defCard({
  id: "spore_cloud", name: "墨孢之云", color: "purple", type: "power", rarity: "uncommon", cost: 1, target: "self",
  desc: u => `每回合开始时，对所有敌人施加 ${VU(u,1,2)} 层侵蚀。`,
  play: (ctx, c) => ctx.applySelf("poisonAura", VU(c.up,1,2)),
});
defCard({
  id: "worsen", name: "恶化", color: "purple", type: "skill", rarity: "uncommon", cost: 0, target: "enemy", exhaust: true, exhaustUp: false,
  desc: u => `使目标的侵蚀翻倍。${VU(u,"消耗。","")}`,
  play: (ctx, c, t) => ctx.apply(t, "poison", (t.status.poison || 0)),
});
defCard({
  id: "purple_resonance", name: "紫色共鸣", color: "purple", type: "skill", rarity: "uncommon", cost: 1, target: "enemy",
  desc: u => `共鸣：施加 ${VU(u,2,3)} + 本回合已打出紫牌数 ×${VU(u,2,3)} 层侵蚀。`,
  play: (ctx, c, t) => ctx.apply(t, "poison", VU(c.up,2,3) + ctx.playedThisTurn("purple") * VU(c.up,2,3)),
});
defCard({
  id: "destabilize", name: "失稳光束", color: "purple", type: "skill", rarity: "uncommon", cost: 2, costUp: 1, target: "enemy",
  desc: u => `对目标施加 2 层虚弱与 1 层易伤。`,
  play: (ctx, c, t) => { ctx.apply(t, "weak", 2); ctx.apply(t, "vulnerable", 1); },
});
defCard({
  id: "fade_strike", name: "褪色打击", color: "purple", type: "attack", rarity: "uncommon", cost: 1, target: "enemy",
  desc: u => `造成 ${VU(u,6,8)} 点伤害，目标墨力 -${VU(u,2,3)}。`,
  flavor: "让它也尝尝被抽走力量的滋味。",
  play: (ctx, c, t) => { ctx.dmg(t, VU(c.up,6,8)); ctx.apply(t, "strength", -VU(c.up,2,3)); },
});
defCard({
  id: "abyss_chant", name: "大招·深渊咏唱", color: "purple", type: "skill", rarity: "rare", cost: 2, target: "allEnemies",
  desc: u => `对所有敌人施加 ${VU(u,5,7)} 层侵蚀与 ${VU(u,2,3)} 层虚弱。`,
  play: (ctx, c) => { ctx.applyAll("poison", VU(c.up,5,7)); ctx.applyAll("weak", VU(c.up,2,3)); },
});
defCard({
  id: "still_order", name: "凝滞秩序", color: "purple", type: "power", rarity: "rare", cost: 2, costUp: 1, target: "self",
  desc: u => `敌人的侵蚀不再随回合衰减。`,
  flavor: "秩序最擅长让一切保持原样。以其人之道——",
  play: (ctx) => ctx.setFlag("poisonNoDecay"),
});
defCard({
  id: "assimilate_blade", name: "同化之刃", color: "purple", type: "attack", rarity: "rare", cost: 1, target: "enemy",
  desc: u => `造成等同于目标侵蚀 ×${VU(u,2,3)} 的伤害。`,
  play: (ctx, c, t) => ctx.dmg(t, (t.status.poison || 0) * VU(c.up,2,3)),
});

/* ================= 状态 / 诅咒 ================= */
defCard({
  id: "disorder_foam", name: "无序泡沫", color: "gray", type: "status", rarity: "special", cost: null, target: "none", ethereal: true,
  desc: () => `不可打出。虚无。`,
  flavor: "塔的杂讯在你的墨鞘里嘶嘶作响。",
});
defCard({
  id: "faded", name: "褪色", color: "gray", type: "curse", rarity: "special", cost: null, target: "none",
  desc: () => `不可打出。`,
  flavor: "调色盘上多了一格纯白。它不属于你。",
});
defCard({
  id: "order_brand", name: "秩序烙印", color: "gray", type: "curse", rarity: "special", cost: null, target: "none",
  desc: () => `不可打出。回合结束时若在手中，失去 1 点生命。`,
  flavor: "皮肤下有细小的白线在生长。",
});

/* ---------- 卡牌奖励池 ---------- */
const CARD_POOL = Object.values(CARDS).filter(c => ["common","uncommon","rare"].includes(c.rarity));

/* ============================================================
   色彩芯片（遗物）
   ============================================================ */
const RELICS = {};
function defRelic(def) { RELICS[def.id] = def; }

defRelic({
  id: "memory_pearl", name: "记忆珍珠", icon: "🫧", rarity: "starter",
  desc: "每场战斗结束后，回复 7 点生命。",
  flavor: "从电话亭里带出来的最后一件东西，温热，会发光。",
  onCombatEnd: (G) => healPlayer(G, 7),
});
defRelic({
  id: "chip_red_edge", name: "赤芯片·锋刃", icon: "🔺", rarity: "common",
  desc: "每场战斗中你打出的第一张攻击牌伤害 +5。",
  onCombatStart: (ctx) => ctx.setFlag("firstAttackBonus"),
});
defRelic({
  id: "chip_blue_coat", name: "蓝芯片·涂层", icon: "🔷", rarity: "common",
  desc: "每场战斗开始时获得 8 点墨甲。",
  onCombatStart: (ctx) => ctx.block(8),
});
defRelic({
  id: "chip_yellow_fund", name: "黄芯片·预算", icon: "🔶", rarity: "common", goldBonus: 0.25,
  desc: "战斗获得的彩币 +25%。",
});
defRelic({
  id: "chip_purple_residue", name: "紫芯片·余毒", icon: "🟣", rarity: "common",
  desc: "每场战斗开始时，对所有敌人施加 2 层侵蚀。",
  onCombatStart: (ctx) => ctx.applyAll("poison", 2),
});
defRelic({
  id: "drone_sting", name: "无人机改装·镖刺", icon: "🛸", rarity: "common",
  desc: "每回合开始时，无人机对随机敌人造成 3 点伤害。",
  onTurnStart: (ctx) => ctx.dmgRandom(3),
});
defRelic({
  id: "drone_shield", name: "无人机改装·护盾", icon: "🛡️", rarity: "common",
  desc: "每回合开始时，若你没有墨甲，获得 4 点墨甲。",
  onTurnStart: (ctx) => { if (ctx.myBlock() === 0) ctx.block(4); },
});
defRelic({
  id: "squid_jerky", name: "鱿鱼干粮", icon: "🍖", rarity: "common", restBonus: 10,
  desc: "在休息点休息时，额外回复 10 点生命。",
});
defRelic({
  id: "acht_headphones", name: "安可的耳机", icon: "🎧", rarity: "common", shopDiscount: 0.2,
  desc: "商店价格 -20%。",
  flavor: "里面循环着一首没有发表过的曲子。",
});
defRelic({
  id: "training_band", name: "特训手环", icon: "⌚", rarity: "common",
  desc: "每场战斗开始时，多抽 2 张牌。",
  onCombatStart: (ctx) => ctx.draw(2),
});
defRelic({
  id: "ink_crystal", name: "墨力结晶", icon: "💠", rarity: "uncommon",
  desc: "每场战斗开始时获得 1 点墨力。",
  onCombatStart: (ctx) => ctx.applySelf("strength", 1),
});
defRelic({
  id: "agile_feather", name: "灵巧鳍羽", icon: "🪶", rarity: "uncommon",
  desc: "每场战斗开始时获得 1 点灵巧。",
  onCombatStart: (ctx) => ctx.applySelf("dexterity", 1),
});
defRelic({
  id: "lucky_shell", name: "幸运墨贝", icon: "🐚", rarity: "uncommon", potionChanceBonus: 0.3,
  desc: "战斗后掉落特饮的概率 +30%。",
});
defRelic({
  id: "pearl_mic", name: "珍珠的麦克风", icon: "🎤", rarity: "uncommon",
  desc: "每场战斗开始时，对所有敌人施加 1 层虚弱。",
  flavor: "开场一声吼，能把无序水母吼矮半截。",
  onCombatStart: (ctx) => ctx.applyAll("weak", 1),
});
defRelic({
  id: "chip_case", name: "记忆芯片盒", icon: "📦", rarity: "uncommon", rewardChoiceBonus: 1,
  desc: "战斗的卡牌奖励可选项 +1。",
});
defRelic({
  id: "tactical_hourglass", name: "战术沙漏", icon: "⏳", rarity: "uncommon",
  desc: "回合结束时，若你本回合未打出攻击牌，获得 5 点墨甲。",
  onTurnEnd: (ctx) => { if (ctx.playedThisTurn("attackType") === 0) ctx.block(5); },
});
defRelic({
  id: "acht_record", name: "安可的唱片", icon: "💿", rarity: "uncommon",
  desc: "每回合第一次打出紫牌时，抽 1 张牌。",
  onCardPlayed: (ctx, card) => { if (CARDS[card.id].color === "purple" && ctx.playedThisTurn("purple") === 1) ctx.draw(1); },
});
defRelic({
  id: "eight_reserve", name: "小八的储备", icon: "🎒", rarity: "uncommon",
  desc: "获得时：最大生命 +12。",
  onPickup: (G) => { G.maxHp += 12; healPlayer(G, 12); },
});
/* Boss 芯片 */
defRelic({
  id: "caffeine_ink", name: "咖啡因墨水", icon: "☕", rarity: "boss",
  desc: "墨水上限 +1。你无法再通过休息回复生命（仍可强化卡牌）。",
  flavor: "玛丽娜说这东西「理论上不算违禁品」。",
  onPickup: (G) => { G.energyMax += 1; },
});
defRelic({
  id: "heavy_order_ring", name: "沉重秩序环", icon: "⭕", rarity: "boss",
  desc: "墨水上限 +1。每场战斗开始时，一张「褪色」被塞入你的弃牌堆。",
  onPickup: (G) => { G.energyMax += 1; },
  onCombatStart: (ctx) => ctx.addToDiscard("faded"),
});
defRelic({
  id: "drone_hangar", name: "无人机整备舱", icon: "🚁", rarity: "boss",
  desc: "每回合开始时，获得 2 点墨甲，且无人机对随机敌人造成 3 点伤害。",
  onTurnStart: (ctx) => { ctx.block(2); ctx.dmgRandom(3); },
});

/* ============================================================
   特饮
   ============================================================ */
const POTIONS = {};
function defPotion(def) { POTIONS[def.id] = def; }

defPotion({ id: "p_power", name: "墨力特饮", icon: "🧃", combatOnly: true,
  desc: "本场战斗获得 2 点墨力。",
  use: (ctx) => ctx.applySelf("strength", 2) });
defPotion({ id: "p_heal", name: "修复特饮", icon: "🥤", combatOnly: false,
  desc: "回复 15 点生命。",
  use: (ctx) => ctx.heal(15) });
defPotion({ id: "p_block", name: "硬化特饮", icon: "🧋", combatOnly: true,
  desc: "获得 10 点墨甲。",
  use: (ctx) => ctx.block(10) });
defPotion({ id: "p_draw", name: "灵感特饮", icon: "🍹", combatOnly: true,
  desc: "抽 3 张牌。",
  use: (ctx) => ctx.draw(3) });
defPotion({ id: "p_energy", name: "能量特饮", icon: "⚡", combatOnly: true,
  desc: "获得 2 点墨水。",
  use: (ctx) => ctx.energy(2) });
defPotion({ id: "p_bomb", name: "炸裂特饮", icon: "🧨", combatOnly: true,
  desc: "对所有敌人造成 10 点伤害。",
  use: (ctx) => ctx.aoe(10, true) });
defPotion({ id: "p_cleanse", name: "净化特饮", icon: "🫗", combatOnly: true,
  desc: "移除自身所有负面效果。",
  use: (ctx) => ctx.cleanse() });
defPotion({ id: "p_erode", name: "侵蚀特饮", icon: "🍾", combatOnly: true,
  desc: "对所有敌人施加 4 层侵蚀。",
  use: (ctx) => ctx.applyAll("poison", 4) });

/* ============================================================
   敌人
   ai(self, turn, e) 返回行动 {name, icon, kind, dmg?, times?, act(e, self)}
   kind: attack / defend / buff / debuff
   ============================================================ */
const ENEMIES = {};
function defEnemy(def) { ENEMIES[def.id] = def; }

/* ---- 第一幕 1F-10F ---- */
defEnemy({
  id: "pawn", name: "无序小卒", emoji: "🪼", hp: [15, 18],
  ai(self, turn, e) {
    if (turn % 2 === 1) return { name: "墨刺", icon: "⚔️", kind: "attack", dmg: 6, act: (e, s) => e.attack(s, 6) };
    return { name: "凝墨", icon: "⚔️🛡️", kind: "attack", dmg: 4, act: (e, s) => { e.attack(s, 4); e.gainBlock(s, 4); } };
  },
});
defEnemy({
  id: "shooter", name: "无序射手", emoji: "🎯", hp: [11, 14],
  ai(self, turn, e) {
    if (turn % 3 === 0) return { name: "稀释弹", icon: "⚔️🌀", kind: "debuff", dmg: 2, act: (e, s) => { e.debuff("weak", 1); e.attack(s, 2); } };
    return { name: "点射", icon: "⚔️", kind: "attack", dmg: 3, times: 2, act: (e, s) => e.attack(s, 3, 2) };
  },
});
defEnemy({
  id: "blade", name: "无序飞刃", emoji: "🔪", hp: [8, 10],
  ai(self, turn, e) {
    if (turn % 3 === 0) return { name: "锐化", icon: "💪", kind: "buff", act: (e, s) => e.buff(s, "strength", 2) };
    return { name: "掠斩", icon: "⚔️", kind: "attack", dmg: 6, act: (e, s) => e.attack(s, 6) };
  },
});
defEnemy({
  id: "bombball", name: "无序爆弹球", emoji: "💣", hp: [8, 8],
  ai(self, turn, e) {
    if (turn === 1) return { name: "充能", icon: "⏳", kind: "defend", act: (e, s) => e.gainBlock(s, 5) };
    return { name: "自爆", icon: "💥", kind: "attack", dmg: 14, act: (e, s) => { e.attack(s, 14); s.hp = 0; } };
  },
});
defEnemy({
  id: "doodler", name: "无序涂鸦兽", emoji: "🦎", hp: [17, 20],
  ai(self, turn, e) {
    if (turn % 2 === 1) return { name: "白噪涂抹", icon: "⚔️🌀", kind: "debuff", dmg: 4, act: (e, s) => { e.attack(s, 4); e.debuff("frail", 1); } };
    return { name: "扑咬", icon: "⚔️", kind: "attack", dmg: 8, act: (e, s) => e.attack(s, 8) };
  },
});
defEnemy({
  id: "shieldman", name: "无序护盾兵", emoji: "🛡️", hp: [21, 24],
  ai(self, turn, e) {
    if (turn % 2 === 1) return { name: "秩序壁", icon: "🛡️", kind: "defend", act: (e, s) => e.allies().forEach(a => e.gainBlock(a, 6)) };
    return { name: "盾压", icon: "⚔️", kind: "attack", dmg: 7, act: (e, s) => e.attack(s, 7) };
  },
});
/* 第一幕精英 */
defEnemy({
  id: "elite_bulwark", name: "失序队长·壁垒", emoji: "🏛️", hp: [66, 66], elite: true,
  ai(self, turn, e) {
    const c = turn % 3;
    if (c === 1) return { name: "白壁", icon: "🛡️", kind: "defend", act: (e, s) => { e.gainBlock(s, 10); e.buff(s, "thorns", 2); } };
    if (c === 2) return { name: "秩序重压", icon: "⚔️", kind: "attack", dmg: 12, act: (e, s) => e.attack(s, 13) };
    return { name: "压制射击", icon: "⚔️🌀", kind: "attack", dmg: 8, act: (e, s) => { e.attack(s, 8); e.debuff("weak", 2); } };
  },
});
defEnemy({
  id: "elite_executioner", name: "无序处刑者", emoji: "⚰️", hp: [62, 62], elite: true,
  ai(self, turn, e) {
    const c = turn % 3;
    if (c === 1) return { name: "斩首", icon: "⚔️", kind: "attack", dmg: 14, act: (e, s) => e.attack(s, 14) };
    if (c === 2) return { name: "连环刃", icon: "⚔️", kind: "attack", dmg: 4, times: 3, act: (e, s) => e.attack(s, 4, 3) };
    return { name: "行刑宣告", icon: "💪", kind: "buff", act: (e, s) => e.buff(s, "strength", 2) };
  },
});
/* 第一幕 Boss */
defEnemy({
  id: "boss_chorus", name: "失序合唱体·回响", emoji: "🎭", hp: [95, 95], boss: true,
  intro: "无数被漂白的歌声缝在一起，塔在替它们发声。",
  ai(self, turn, e) {
    const c = turn % 4;
    if (c === 1) return { name: "音爆", icon: "⚔️", kind: "attack", dmg: 7, times: 2, act: (e, s) => e.attack(s, 7, 2) };
    if (c === 2) return { name: "齐唱", icon: "💪🛡️", kind: "buff", act: (e, s) => { e.buff(s, "strength", 2); e.gainBlock(s, 10); } };
    if (c === 3) return { name: "尖啸", icon: "⚔️🌀", kind: "attack", dmg: 13, act: (e, s) => { e.attack(s, 13); e.debuff("weak", 1); } };
    return { name: "终止式", icon: "💥", kind: "attack", dmg: 16, act: (e, s) => e.attack(s, 16) };
  },
});

/* ---- 第二幕 11F-20F ---- */
defEnemy({
  id: "hammer_guard", name: "无序重锤卫", emoji: "🔨", hp: [38, 42],
  ai(self, turn, e) {
    if (turn % 2 === 1) return { name: "抡锤蓄力", icon: "⏳🛡️", kind: "defend", act: (e, s) => e.gainBlock(s, 8) };
    return { name: "重击", icon: "💥", kind: "attack", dmg: 18, act: (e, s) => e.attack(s, 18) };
  },
});
defEnemy({
  id: "chanter", name: "无序歌者", emoji: "🎙️", hp: [26, 30],
  ai(self, turn, e) {
    const c = turn % 3;
    if (c === 1) return { name: "白色赞歌", icon: "💪", kind: "buff", act: (e, s) => e.allies().forEach(a => e.buff(a, "strength", 1)) };
    if (c === 2) return { name: "刺耳音", icon: "⚔️", kind: "attack", dmg: 7, act: (e, s) => e.attack(s, 7) };
    return { name: "脆化咏唱", icon: "🌀", kind: "debuff", act: (e, s) => e.debuff("frail", 2) };
  },
});
defEnemy({
  id: "turret", name: "无序浮游炮", emoji: "🛰️", hp: [28, 32],
  ai(self, turn, e) {
    const c = turn % 3;
    if (c === 1) return { name: "扫射", icon: "⚔️", kind: "attack", dmg: 4, times: 3, act: (e, s) => e.attack(s, 4, 3) };
    if (c === 2) return { name: "标记射线", icon: "🌀", kind: "debuff", act: (e, s) => e.debuff("vulnerable", 2) };
    return { name: "聚能炮", icon: "💥", kind: "attack", dmg: 9, act: (e, s) => e.attack(s, 9) };
  },
});
defEnemy({
  id: "lurker", name: "无序潜伏者", emoji: "🐍", hp: [32, 36],
  ai(self, turn, e) {
    if (turn % 2 === 1) return { name: "毒牙", icon: "⚔️☠️", kind: "attack", dmg: 9, act: (e, s) => { e.attack(s, 9); e.debuff("poison", 3); } };
    return { name: "绞杀", icon: "⚔️", kind: "attack", dmg: 11, act: (e, s) => e.attack(s, 11) };
  },
});
defEnemy({
  id: "armor_crab", name: "无序装甲蟹", emoji: "🦀", hp: [37, 41],
  ai(self, turn, e) {
    const c = turn % 3;
    if (c === 1) return { name: "硬化甲壳", icon: "🛡️", kind: "defend", act: (e, s) => { e.gainBlock(s, 12); e.buff(s, "thorns", 2); } };
    if (c === 2) return { name: "钳击", icon: "⚔️", kind: "attack", dmg: 10, act: (e, s) => e.attack(s, 10) };
    return { name: "横行冲撞", icon: "⚔️🛡️", kind: "attack", dmg: 8, act: (e, s) => { e.attack(s, 8); e.gainBlock(s, 6); } };
  },
});
/* 第二幕精英 */
defEnemy({
  id: "elite_twotone", name: "双色执行官", emoji: "🃏", hp: [88, 88], elite: true,
  ai(self, turn, e) {
    const c = turn % 3;
    if (c === 1) return { name: "黑白裁决", icon: "⚔️", kind: "attack", dmg: 16, act: (e, s) => e.attack(s, 16) };
    if (c === 2) return { name: "漂白喷流", icon: "☠️", kind: "debuff", act: (e, s) => { e.debuff("poison", 4); e.debuff("weak", 1); } };
    return { name: "秩序重构", icon: "🛡️💪", kind: "buff", act: (e, s) => { e.gainBlock(s, 15); e.buff(s, "strength", 2); } };
  },
});
defEnemy({
  id: "elite_wildhunt", name: "无序狂猎手", emoji: "🏹", hp: [84, 84], elite: true,
  ai(self, turn, e) {
    const c = turn % 3;
    if (c === 1) return { name: "双连猎矢", icon: "⚔️", kind: "attack", dmg: 9, times: 2, act: (e, s) => e.attack(s, 9, 2) };
    if (c === 2) return { name: "捕获网", icon: "🌀", kind: "debuff", act: (e, s) => { e.debuff("weak", 2); e.debuff("frail", 2); } };
    return { name: "猎杀一击", icon: "💥", kind: "attack", dmg: 20, act: (e, s) => e.attack(s, 20) };
  },
});
/* 第二幕 Boss */
defEnemy({
  id: "boss_parallel", name: "拟态八爪·平行小八", emoji: "🪞", hp: [150, 150], boss: true,
  intro: "镜子里走出来的那个你，用你的招式，向你举起了武器。",
  ai(self, turn, e) {
    const c = turn % 5;
    if (c === 1) return { name: "镜像射击", icon: "⚔️", kind: "attack", dmg: 10, times: 2, act: (e, s) => e.attack(s, 10, 2) };
    if (c === 2) return { name: "墨甲翻滚", icon: "⚔️🛡️", kind: "attack", dmg: 10, act: (e, s) => { e.attack(s, 10); e.gainBlock(s, 16); } };
    if (c === 3) return { name: "三连爆弹", icon: "⚔️", kind: "attack", dmg: 7, times: 3, act: (e, s) => e.attack(s, 7, 3) };
    if (c === 4) return { name: "大招蓄力", icon: "⏳", kind: "buff", act: (e, s) => { e.gainBlock(s, 20); e.buff(s, "strength", 2); } };
    return { name: "大招·终极发射器", icon: "💥", kind: "attack", dmg: 26, act: (e, s) => e.attack(s, 26) };
  },
});

/* ---- 第三幕 21F-30F ---- */
defEnemy({
  id: "mimic_soldier", name: "无序拟态兵", emoji: "👥", hp: [46, 50],
  ai(self, turn, e) {
    self.state.ramp = (self.state.ramp || 0);
    if (turn % 3 === 0) return { name: "拟态强化", icon: "🛡️💪", kind: "buff", act: (e, s) => { e.gainBlock(s, 9); e.buff(s, "strength", 1); } };
    const d = 8 + self.state.ramp * 3;
    return { name: "学习打击", icon: "⚔️", kind: "attack", dmg: d, act: (e, s) => { e.attack(s, d); s.state.ramp++; } };
  },
});
defEnemy({
  id: "order_vanguard", name: "秩序尖兵", emoji: "🤺", hp: [40, 45],
  ai(self, turn, e) {
    const c = turn % 3;
    if (c === 1) return { name: "整流突刺", icon: "⚔️", kind: "attack", dmg: 12, act: (e, s) => e.attack(s, 12) };
    if (c === 2) return { name: "净化力场", icon: "🛡️", kind: "defend", act: (e, s) => { e.gainBlock(s, 10); e.buff(s, "artifact", 1); } };
    return { name: "漂白注入", icon: "☠️", kind: "debuff", act: (e, s) => e.debuff("poison", 4) };
  },
});
defEnemy({
  id: "white_devotee", name: "白之信徒", emoji: "🕯️", hp: [36, 40],
  ai(self, turn, e) {
    if (turn === 1) return { name: "白色祷告", icon: "💪", kind: "buff", act: (e, s) => e.buff(s, "ritual", 2) };
    return { name: "献祭之触", icon: "⚔️", kind: "attack", dmg: 9, act: (e, s) => e.attack(s, 9) };
  },
});
defEnemy({
  id: "titan_larva", name: "无序泰坦幼体", emoji: "🐋", hp: [58, 64],
  ai(self, turn, e) {
    if (turn % 2 === 1) return { name: "碾压", icon: "⚔️", kind: "attack", dmg: 15, act: (e, s) => e.attack(s, 15) };
    return { name: "深渊咆哮", icon: "💥", kind: "attack", dmg: 22, act: (e, s) => e.attack(s, 22) };
  },
});
/* 第三幕精英 */
defEnemy({
  id: "elite_zero", name: "塔顶亲卫·零", emoji: "0️⃣", hp: [120, 120], elite: true,
  ai(self, turn, e) {
    const c = turn % 3;
    if (c === 1) return { name: "肃清斩", icon: "⚔️", kind: "attack", dmg: 18, act: (e, s) => e.attack(s, 18) };
    if (c === 2) return { name: "绝对秩序", icon: "🛡️💪", kind: "buff", act: (e, s) => { e.gainBlock(s, 20); e.buff(s, "strength", 3); } };
    return { name: "杂讯灌注", icon: "⚔️🌀", kind: "attack", dmg: 12, act: (e, s) => { e.attack(s, 12); e.addStatusToPlayer("disorder_foam", 2); } };
  },
});
defEnemy({
  id: "elite_archon", name: "漂白执政官", emoji: "🏺", hp: [115, 115], elite: true,
  ai(self, turn, e) {
    const c = turn % 3;
    if (c === 1) return { name: "无色权杖", icon: "⚔️", kind: "attack", dmg: 16, act: (e, s) => e.attack(s, 16) };
    if (c === 2) return { name: "漂白洪流", icon: "☠️", kind: "debuff", act: (e, s) => e.debuff("poison", 6) };
    return { name: "抽离色彩", icon: "🌀", kind: "debuff", act: (e, s) => { e.debuff("weak", 3); e.debuff("frail", 3); } };
  },
});
/* 最终 Boss */
defEnemy({
  id: "boss_overlord", name: "秩序之主·完全体", emoji: "👁️", hp: [215, 215], boss: true,
  intro: "「欢迎来到塔顶。也欢迎——回到整齐划一的、安全的、不再疼痛的世界。」",
  onSpawn: (self) => { self.status.artifact = 2; },
  ai(self, turn, e) {
    if (!self.state.phase2 && self.hp <= self.maxHp / 2) {
      self.state.phase2 = true; self.state.p2turn = 0;
      return { name: "相位迁移·纯白", icon: "⚡", kind: "buff",
        act: (e, s) => { s.status = { strength: (s.status.strength || 0) + 4, artifact: 1 }; e.gainBlock(s, 25); } };
    }
    if (self.state.phase2) {
      self.state.p2turn = (self.state.p2turn || 0) + 1;
      const c = self.state.p2turn % 3;
      if (c === 1) return { name: "秩序双矢", icon: "⚔️", kind: "attack", dmg: 12, times: 2, act: (e, s) => e.attack(s, 12, 2) };
      if (c === 2) return { name: "漂白领域", icon: "🌀☠️", kind: "debuff", act: (e, s) => { e.addStatusToPlayer("disorder_foam", 2); e.debuff("poison", 4); } };
      return { name: "终末秩序", icon: "💥", kind: "attack", dmg: 26, act: (e, s) => e.attack(s, 26) };
    }
    const c = turn % 3;
    if (c === 1) return { name: "秩序光矢", icon: "⚔️", kind: "attack", dmg: 10, times: 2, act: (e, s) => e.attack(s, 10, 2) };
    if (c === 2) return { name: "统辖", icon: "💪🛡️", kind: "buff", act: (e, s) => { e.buff(s, "strength", 3); e.gainBlock(s, 18); } };
    return { name: "白之洗礼", icon: "⚔️🌀", kind: "attack", dmg: 14, act: (e, s) => { e.attack(s, 14); e.debuff("weak", 2); } };
  },
});

/* ---------- 遭遇表 ---------- */
const ENCOUNTERS = {
  1: {
    easy: [["pawn"], ["pawn", "shooter"], ["blade", "blade"], ["doodler"], ["shooter", "shooter"]],
    hard: [["pawn", "pawn", "bombball"], ["shieldman", "shooter"], ["doodler", "blade"], ["shieldman", "pawn"], ["doodler", "shooter"]],
    elites: [["elite_bulwark"], ["elite_executioner"]],
    boss: ["boss_chorus"],
  },
  2: {
    easy: [["hammer_guard"], ["chanter", "turret"], ["lurker"], ["turret", "turret"]],
    hard: [["armor_crab", "chanter"], ["hammer_guard", "turret"], ["lurker", "turret"], ["armor_crab", "bombball", "bombball"], ["chanter", "chanter", "turret"]],
    elites: [["elite_twotone"], ["elite_wildhunt"]],
    boss: ["boss_parallel"],
  },
  3: {
    easy: [["mimic_soldier"], ["order_vanguard"], ["white_devotee", "white_devotee"], ["titan_larva"]],
    hard: [["mimic_soldier", "white_devotee"], ["order_vanguard", "order_vanguard"], ["titan_larva", "white_devotee"], ["mimic_soldier", "order_vanguard"]],
    elites: [["elite_zero"], ["elite_archon"]],
    boss: ["boss_overlord"],
  },
};

/* ============================================================
   事件
   options: [{label, sub?, cond?(G), resolve(G)}]
   resolve 返回 {text} 或 {pickUpgrade|pickRemove|eliteFight: true, text}
   ============================================================ */
const EVENTS = [
  {
    id: "vending", name: "褪色的自动贩卖机", icon: "🥫",
    text: "走廊尽头立着一台自动贩卖机，涂装被漂成了灰白，但指示灯还倔强地闪着一点粉色。投币口旁边贴着一张便签：「还能用。大概。——A」",
    options: [
      { label: "投入 50 彩币", sub: "获得 2 瓶随机特饮", cond: G => G.gold >= 50,
        resolve: G => { G.gold -= 50; const got = [gainRandomPotion(G), gainRandomPotion(G)].filter(Boolean); return { text: got.length ? `咔啦、咔啦。掉出了：${got.join("、")}。机器似乎很高兴。` : "咔啦。可惜你的特饮栏已经满了，多出来的滚进了够不到的缝里。" }; } },
      { label: "投入 30 彩币", sub: "回复 15 点生命", cond: G => G.gold >= 30,
        resolve: G => { G.gold -= 30; healPlayer(G, 15); return { text: "一罐冒着凉气的碳酸墨水。顺着喉咙滑下去的瞬间，你觉得自己的颜色鲜艳了一点。" }; } },
      { label: "用力摇晃它", sub: "50%：掉出 60 彩币 / 50%：获得诅咒「褪色」",
        resolve: G => { if (RNG() < 0.5) { G.gold += 60; return { text: "哗啦——一整盒硬币从出货口涌出来！机器发出类似叹气的声音。<br>获得 60 彩币。" }; } addCardToDeck(G, "faded"); return { text: "机器闪了一下刺眼的白光。你低头，发现指尖的颜色淡了一格。<br>获得诅咒「褪色」。" }; } },
      { label: "离开", resolve: G => ({ text: "你朝它挥了挥手。指示灯眨了眨，像是道别。" }) },
    ],
  },
  {
    id: "hologram", name: "玛丽娜的全息终端", icon: "📡",
    text: "一台还在运作的终端。屏幕亮起，玛丽娜的全息影像浮现出来，信号断断续续：「小八！听得到吗——我把能调的资源都调给你了，选一样吧。快，这个节点马上要被塔回收了！」",
    options: [
      { label: "「帮我强化装备。」", sub: "升级 1 张牌", resolve: G => ({ pickUpgrade: true, text: "" }) },
      { label: "「帮我处理伤口。」", sub: "回复 25% 最大生命",
        resolve: G => { healPlayer(G, Math.floor(G.maxHp * 0.25)); return { text: "纳米墨雾从终端喷出，包住你的伤口。「撑住。塔顶见。」影像消散前，她比了一个大拇指。" }; } },
      { label: "「留着资源，你也要小心。」", sub: "什么都不拿",
        resolve: G => ({ text: "影像沉默了一秒，随后笑了：「……你真的一点都没变。那我把资源存到上面几层。别死在半路，笨蛋。」" }) },
    ],
  },
  {
    id: "acht_melody", name: "安可的旋律", icon: "🎵",
    text: "某个房间里飘出低保真的旋律——是安可。耳机搭在颈间，指尖在一台白色改装台上敲着节拍。「哟，八号。塔把我的曲子也漂白了一半……趁我还记得副歌，要我帮你调整一下节奏吗？」",
    options: [
      { label: "「帮我删掉一段杂音。」", sub: "移除 1 张牌", resolve: G => ({ pickRemove: true, text: "" }) },
      { label: "「给我一段新的采样。」", sub: "获得 1 张随机紫牌",
        resolve: G => { const purples = CARD_POOL.filter(c => c.color === "purple"); const c = choice(purples); addCardToDeck(G, c.id); return { text: `安可把一枚发着紫光的芯片拍进你的调色盘。「拿去。这段贝斯线，塔消化不了。」<br>获得「${c.name}」。` }; } },
      { label: "静静听完这首曲子", sub: "回复 10 点生命，获得 30 彩币",
        resolve: G => { healPlayer(G, 10); G.gold += 30; return { text: "你靠着墙听完了整首曲子。旋律结束时，安可把几枚硬币抛给你：「听众费。走吧，别让下一层等太久。」" }; } },
    ],
  },
  {
    id: "memory_pool", name: "记忆水洼", icon: "💧",
    text: "地面凹陷处积着一汪不属于这里的、彩色的水。水面映出的不是天花板，而是某段旧日的街景：广场、涂鸦墙、震耳的音乐。水底沉着一枚微微发光的色彩芯片。",
    options: [
      { label: "伸手去捞", sub: "失去 8 点生命，获得 1 枚随机色彩芯片",
        resolve: G => { damagePlayerMeta(G, 8); const r = gainRandomRelic(G); return { text: `冰冷刺骨。回忆像细针一样扎进指尖——但你抓住了它。<br>获得色彩芯片「${r ? r.name : "……"}」。` }; } },
      { label: "只是看着", sub: "回复 6 点生命",
        resolve: G => { healPlayer(G, 6); return { text: "你蹲在水洼边看了很久。那些颜色没有消失，它们只是在等。你起身时，脚步轻了一些。" }; } },
    ],
  },
  {
    id: "vortex", name: "无序漩涡", icon: "🌀",
    text: "楼层中央悬浮着一个缓慢旋转的墨色漩涡，里面隐约有硬币的反光。旁边歪歪扭扭写着一行字：「投喂它，它有时候会加倍吐出来。有时候。」",
    options: [
      { label: "投入 30 彩币", sub: "50%：返还 80 / 50%：血本无归", cond: G => G.gold >= 30,
        resolve: G => { G.gold -= 30; if (RNG() < 0.5) { G.gold += 80; return { text: "漩涡欢快地转了两圈，喷出一大把硬币砸在你头上。稳赚！<br>获得 80 彩币。" }; } return { text: "漩涡「咕咚」一声，安静了。你好像听到里面传来打嗝声。<br>彩币有去无回。" }; } },
      { label: "绕开它", resolve: G => ({ text: "你决定不和流体力学讨价还价。" }) },
    ],
  },
  {
    id: "mirror_hall", name: "镜之回廊", icon: "🪞",
    text: "整条走廊由镜面构成。镜中的你晚了半拍才跟上动作——然后，它停下来，直勾勾地看着你。镜面泛起涟漪，一个轮廓正试图从里面挤出来。",
    options: [
      { label: "先发制人", sub: "挑战精英敌人，胜利后获得色彩芯片与特饮", resolve: G => ({ eliteFight: true, text: "" }) },
      { label: "砸碎最近的镜子撤退", sub: "失去 6 点生命",
        resolve: G => { damagePlayerMeta(G, 6); return { text: "镜片的碎屑划过手臂。身后传来玻璃质感的、愤怒的尖啸，但没有东西追出来。" }; } },
    ],
  },
  {
    id: "snack_bay", name: "珍珠的零食舱", icon: "🍙",
    text: "无人机「啵」地弹开一个隐藏舱门：「锵锵——！本小姐的秘密补给舱！塔改建的时候我偷偷藏的，连玛丽娜都不知道！随便挑！」",
    options: [
      { label: "海苔饭团 ×3", sub: "回复 20 点生命",
        resolve: G => { healPlayer(G, 20); return { text: "冷的，硬的，咸得要命。是活着的味道。珍珠在旁边哼起了不成调的歌。" }; } },
      { label: "神秘蛋白粉", sub: "最大生命 +7",
        resolve: G => { G.maxHp += 7; healPlayer(G, 7); return { text: "包装上的字被漂白得看不清了。珍珠：「放心！大概是草莓味！」你感觉身体确实结实了一点。" }; } },
    ],
  },
  {
    id: "broken_lift", name: "损坏的电梯", icon: "🛗",
    text: "一部电梯卡在楼层之间，门板扭曲，检修面板半开着，里面有什么东西在反光。警示灯规律地闪烁，像一颗机械心脏。",
    options: [
      { label: "撬开检修面板", sub: "获得 55 彩币，受到 8 点伤害",
        resolve: G => { G.gold += 55; damagePlayerMeta(G, 8); return { text: "面板弹开的瞬间电弧扫过你的手臂——但里面确实塞着一袋硬币，还有半张写着「应急基金 ——P」的便签。" }; } },
      { label: "不去碰它", resolve: G => ({ text: "有些门卡住，是有理由的。你选择走楼梯。" }) },
    ],
  },
  {
    id: "white_statue", name: "纯白鱿鱼像", icon: "🗿",
    text: "大厅中央立着一座巨大的鱿鱼雕像，通体纯白，表面光滑得没有一丝纹理。它让你想起广场上那些被同化的居民。基座上刻着：「献给秩序」。",
    options: [
      { label: "在基座涂上自己的颜色", sub: "升级 2 张随机牌",
        resolve: G => { const ups = upgradeRandomCards(G, 2); return { text: ups.length ? `你把墨水拍在纯白的基座上。颜色顺着雕像的纹路向上蔓延，你手中的调色盘随之共鸣。<br>升级了：${ups.join("、")}。` : "你的牌全都已经升级过了。雕像沉默地看着你炫耀。" }; } },
      { label: "推倒它", sub: "获得 45 彩币，获得诅咒「秩序烙印」",
        resolve: G => { G.gold += 45; addCardToDeck(G, "order_brand"); return { text: "雕像轰然倒地，摔出一堆藏在底座里的硬币。但碎裂声里混着一声极轻的、像是从你自己喉咙里发出的哀鸣。<br>获得 45 彩币与诅咒「秩序烙印」。" }; } },
      { label: "鞠躬离开", resolve: G => ({ text: "无论它变成了什么，它曾经也是谁的样子。你安静地离开了。" }) },
    ],
  },
  {
    id: "lost_jelly", name: "迷路的小水母", icon: "🎐",
    text: "楼梯拐角，一只巴掌大的水母怯生生地漂浮着。它没有被完全漂白——伞盖边缘还残留着一圈淡淡的蓝。看到你，它犹豫了一下，轻轻碰了碰你的手背。",
    options: [
      { label: "让它待在背包里", sub: "最大生命 +5",
        resolve: G => { G.maxHp += 5; healPlayer(G, 5); return { text: "它在背包侧袋里安顿下来，偶尔发出微弱的蓝光。不知为何，有它在，伤口好得快一些。" }; } },
      { label: "指给它下行的路", sub: "回复 12 点生命",
        resolve: G => { healPlayer(G, 12); return { text: "它绕着你转了三圈——像某种道谢的仪式——然后向着塔底、向着出口的方向飘走了。你目送那点蓝色消失，心里某处松了一口气。" }; } },
    ],
  },
];

/* ============================================================
   结局
   ============================================================ */
const ENDINGS = {
  balance: { id: "balance", name: "还世界以色彩", icon: "🌈",
    cond: "登顶，且调色盘均衡（无单色 ≥ 45%）",
    text: "你没有让任何一种颜色独大——赤的锋锐、蓝的沉稳、黄的温度、紫的暗涌，在你的调色盘上彼此依存。<br><br>当秩序之主崩解为漫天白屑，你把整块调色盘按在塔顶的核心上。<br><br>颜色炸开了。<br><br>它们顺着三十层塔身倾泻而下，漫过广场，漫过那些纯白的身影。有人先是恢复了发梢的一点绿，然后是眼睛，然后是笑声。<br><br>塔还立在那里，但它现在只是一座塔。<br>电梯抵达地面，门打开，外面是喧闹的、混乱的、五颜六色的世界。<br><br>——欢迎回家，八号。" },
  red: { id: "red", name: "烈焰塔主", icon: "🔥",
    cond: "登顶，且赤色 ≥ 45%",
    text: "你用压倒性的火力烧穿了三十层秩序。<br><br>坐上塔顶王座的那一刻，你的调色盘只剩一种颜色在燃烧。世界恢复了色彩——但每一抹颜色都带着灼热的红边。<br><br>广场上的人们仰望塔顶，那里日夜亮着一团不熄的赤色火光。他们说，那是新的塔主，说他们曾亲眼看见那团火烧掉了「秩序」。<br><br>只是没有人敢问：火焰与秩序，究竟哪个更不容异色？" },
  blue: { id: "blue", name: "深海壁垒", icon: "🌊",
    cond: "登顶，且蓝色 ≥ 45%",
    text: "没有什么能击穿你。三十层的恶意，全部被一层又一层的墨甲挡在体外。<br><br>你登顶之后，塔变成了海。<br><br>深蓝色的水温柔地灌满每一层，那些被漂白的居民在水中缓缓舒展，像回到潮池的海葵。塔不再向上生长，而是向四周漫开，成为一座沉静的、被壁垒守护的水下都市。<br><br>你悬浮在最深处。安全。绝对安全。<br><br>偶尔你会想起地面上的风。只是想起而已。" },
  yellow: { id: "yellow", name: "辉光之翼", icon: "⚡",
    cond: "登顶，且黄色 ≥ 45%",
    text: "你不是最强的武器，你是永不枯竭的引擎。<br><br>抽牌、补给、连携、再来一轮——你以塔理解不了的效率把它的秩序拆成了零件。<br><br>登顶时，你的调色盘明亮得像一枚小型太阳。色彩以你为中心辐射而出，整座塔被点亮成一座通天的灯塔。<br><br>后来，迷失在白色海域的旅人都循着这道辉光找到归途。<br>他们不知道塔顶站着谁，只知道那里的光，永远快人一步。" },
  purple: { id: "purple", name: "暗紫深渊", icon: "🌑",
    cond: "登顶，且紫色 ≥ 45%",
    text: "你没有正面击碎秩序——你让它从内部腐烂。<br><br>侵蚀、稀释、同化。你用塔对付世界的方式对付了塔。当秩序之主意识到自己的机体里爬满紫色纹路时，一切已经太迟。<br><br>塔倒了。颜色回来了。<br><br>但在庆典的欢呼声外，你站在阴影里，看着自己指尖那一缕散不去的暗紫。<br><br>凝视深渊的代价，你比谁都清楚。所以这一次，由你来替所有人凝视它。" },
  white: { id: "white", name: "褪为纯白", icon: "🕊️",
    cond: "在塔中倒下",
    text: "膝盖先失去了知觉，然后是指尖，然后是记忆里广场的颜色。<br><br>不疼。真的不疼。<br><br>塔温柔地接住了你。它低声说，休息吧，这里没有胜负，没有噪音，没有那么多累人的「不一样」。<br><br>你最后看了一眼自己的调色盘。<br>白色。全部都是，白色。<br><br>——但在意识彻底沉入白色之前，你仿佛听见很远的地方，有一台无人机在声嘶力竭地喊你的名字。<br><br><em>所以，请再爬一次。</em>" },
};

/* ---------- 幕间文案 ---------- */
const ACT_INTROS = {
  1: { title: "第一幕 · 苍白大堂 1F–10F",
    text: "电梯门在身后合拢。眼前的大厅像一张被橡皮擦过度使用的画——轮廓还在，颜色没了。<br><br>珍珠无人机贴着你的肩膀盘旋：「信号很糟，玛丽娜的声音传不上来……总之，向上走！塔顶那家伙就是把世界漂白的元凶，锤它一顿，什么都会好起来的！」<br><br>你握了握手中的调色盘。四种颜色，微微发烫。" },
  2: { title: "第二幕 · 回声中层 11F–20F",
    text: "中层的墙壁会说话——用你自己的声音。<br><br>它们播放你的记忆，走音的、变形的，唱给你听。「别听！」珍珠的声线出现了少见的紧绷，「塔在扫描你。它想知道你是用什么颜色画成的……然后照着画一个白色的你。」<br><br>走廊深处，某个和你一模一样的脚步声，不紧不慢地跟了上来。" },
  3: { title: "第三幕 · 无色圣所 21F–30F",
    text: "最后十层没有墙纸、没有涂装、没有影子。纯白得连「白」这个概念都快要失去意义。<br><br>玛丽娜的信号突然清晰：「小八，听好——塔的核心就在顶层。它不恨你，这比恨更麻烦：它真心认为抹掉颜色是在拯救你们。」<br><br>「所以，」珍珠接过话头，「去用最大声的颜色，告诉它它错了！」" },
};

/* ---------- 开场文案 ---------- */
const PROLOGUE = {
  title: "秩序尖塔",
  sub: "ORDER TOWER · 色彩肉鸽 · 卡牌爬塔",
  text: "再次醒来时，广场安静得能听见灰尘落地。<br><br>建筑是白的，天空是白的，路过的行人是白的——他们脸上挂着相同弧度的微笑，像同一条流水线上的产品。<br><br>只有两样东西还有颜色：<br>你手中的<strong>调色盘</strong>，和城市中央那座缓缓旋转的<strong>秩序之塔</strong>。<br><br>「八号！你也没被漂白对吧！」一台小小的无人机撞进你怀里，声音又急又亮，「塔顶的家伙把所有人的颜色都收走了！玛丽娜在外面支援，我陪你上去——三十层，一层都别让它！」<br><br>用<strong>赤·蓝·黄·紫</strong>四色卡牌构筑你的战斗方式。<br>你的配色，将决定你在塔顶成为怎样的存在。",
};
