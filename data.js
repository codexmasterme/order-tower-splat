/* 秩序尖塔 · ORDER TOWER —— 数据
 * 四色调色板 = 四种战斗流派：赤(进攻) 蓝(防御) 黄(辅助/回复) 紫(干扰/侵蚀)
 */
window.COLORS = {
  red:    { key:'red',    name:'赤', style:'进攻', hex:'#ff3b5c' },
  blue:   { key:'blue',   name:'蓝', style:'防御', hex:'#35a7ff' },
  yellow: { key:'yellow', name:'黄', style:'辅助', hex:'#ffd23f' },
  purple: { key:'purple', name:'紫', style:'干扰', hex:'#b072ff' }
};

/* 芯片。type: 攻/防/涂/特。scale:{color,stat,per}=本回合每打出一张同色芯片，该值额外 +per。 */
window.CHIPS = {
  // —— 赤 · 进攻 ——
  r_slap:   { id:'r_slap',   name:'平涂拍击', color:'red', cost:1, type:'攻', dmg:6,  text:'造成 6 点伤害。' },
  r_combo:  { id:'r_combo',  name:'连色斩',   color:'red', cost:1, type:'攻', dmg:4,  scale:{color:'red',stat:'dmg',per:3}, text:'造成 4 伤害；本回合每张已打出的赤芯片 +3。' },
  r_heavy:  { id:'r_heavy',  name:'重涂重击', color:'red', cost:2, type:'攻', dmg:13, text:'造成 13 点伤害。' },
  r_burst:  { id:'r_burst',  name:'爆彩',     color:'red', cost:1, type:'攻', dmg:9,  selfLose:3, text:'造成 9 伤害，自身失去 3 点血。' },
  r_finish: { id:'r_finish', name:'终结涂装', color:'red', cost:2, type:'攻', dmg:8,  bonusCorrupt:1, text:'造成 8 伤害；敌人每层「侵蚀」额外 +1 伤害。' },
  // —— 蓝 · 防御 ——
  b_guard:  { id:'b_guard',  name:'护色',     color:'blue', cost:1, type:'防', block:6, text:'获得 6 点护盾。' },
  b_wall:   { id:'b_wall',   name:'壁垒协议', color:'blue', cost:2, type:'防', block:15, text:'获得 15 点护盾。' },
  b_regen:  { id:'b_regen',  name:'稳态',     color:'blue', cost:1, type:'防', block:4, heal:4, text:'获得 4 护盾，回复 4 点血。' },
  b_scale:  { id:'b_scale',  name:'层护',     color:'blue', cost:1, type:'防', block:4, scale:{color:'blue',stat:'block',per:3}, text:'获得 4 护盾；本回合每张已打出的蓝芯片 +3。' },
  b_thorn:  { id:'b_thorn',  name:'反涂尖刺', color:'blue', cost:1, type:'防', block:5, thorn:4, text:'获得 5 护盾，本回合受击反弹 4 伤害。' },
  // —— 黄 · 辅助 ——
  y_heal:   { id:'y_heal',   name:'补色',     color:'yellow', cost:1, type:'特', heal:9,  text:'回复 9 点血。' },
  y_energy: { id:'y_energy', name:'加速',     color:'yellow', cost:0, type:'特', energy:2, draw:1, text:'获得 2 点墨力，抽 1 张。' },
  y_draw:   { id:'y_draw',   name:'检索',     color:'yellow', cost:1, type:'特', draw:2, text:'抽 2 张芯片。' },
  y_power:  { id:'y_power',  name:'强化协议', color:'yellow', cost:1, type:'特', power:3, text:'本场战斗后续攻击 +3。' },
  y_cleanse:{ id:'y_cleanse',name:'净滤',     color:'yellow', cost:1, type:'特', cleanse:true, heal:5, text:'清除自身全部侵蚀，回复 5 点血。' },
  // —— 紫 · 干扰 ——
  p_corrupt:{ id:'p_corrupt',name:'反同化',   color:'purple', cost:1, type:'涂', dmg:3, corrupt:3, text:'造成 3 伤害，给敌人 +3 侵蚀。' },
  p_spread: { id:'p_spread', name:'裂隙扩散', color:'purple', cost:1, type:'涂', corrupt:6, text:'给敌人 +6 侵蚀。' },
  p_weak:   { id:'p_weak',   name:'扰码',     color:'purple', cost:1, type:'涂', weak:2, text:'使敌人「虚弱」2 回合（攻击 -40%）。' },
  p_scale:  { id:'p_scale',  name:'侵蚀共鸣', color:'purple', cost:1, type:'涂', dmg:2, corrupt:2, scale:{color:'purple',stat:'dmg',per:2}, text:'造成 2 伤害并 +2 侵蚀；本回合每张已打出的紫芯片 +2 伤害。' },
  p_drain:  { id:'p_drain',  name:'汲色',     color:'purple', cost:2, type:'涂', dmg:8, drain:true, text:'造成 8 伤害，回复等于所造成伤害一半的血。' }
};
window.STARTER = ['r_slap','r_slap','r_slap','b_guard','b_guard','b_guard','y_heal','p_corrupt'];
// 奖励/商店池
window.REWARD_POOL = ['r_combo','r_heavy','r_burst','r_finish','b_wall','b_regen','b_scale','b_thorn',
  'y_energy','y_draw','y_power','y_cleanse','p_spread','p_weak','p_scale','p_drain','r_slap','b_guard','y_heal','p_corrupt'];

/* 敌人。intents 循环；每个 intent：{type:'attack'|'corrupt'|'buff'|'block', v, times?} */
window.ENEMIES = {
  normal: [
    { id:'e_block',  name:'白块兵',     hp:22, intents:[{type:'attack',v:7},{type:'attack',v:7},{type:'buff',v:3}] },
    { id:'e_pen',    name:'涂改笔',     hp:18, intents:[{type:'attack',v:5},{type:'corrupt',v:3},{type:'attack',v:8}] },
    { id:'e_drone',  name:'秩序无人机', hp:26, intents:[{type:'attack',v:9},{type:'block',v:8},{type:'attack',v:6}] },
    { id:'e_eraser', name:'消色者',     hp:30, intents:[{type:'attack',v:6},{type:'attack',v:6},{type:'corrupt',v:4}] },
    { id:'e_static', name:'白噪残响',   hp:24, intents:[{type:'attack',v:5,times:2},{type:'buff',v:4}] }
  ],
  elite: [
    { id:'x_guard', name:'卡农护卫',   hp:48, elite:true, intents:[{type:'attack',v:11},{type:'corrupt',v:3},{type:'buff',v:4},{type:'block',v:10}] },
    { id:'x_choir', name:'和声唱机',   hp:52, elite:true, intents:[{type:'attack',v:7,times:2},{type:'corrupt',v:4},{type:'attack',v:13}] }
  ],
  boss: { id:'boss_canon', name:'平行卡农', hp:115, boss:true,
    intents:[{type:'attack',v:13},{type:'corrupt',v:5},{type:'buff',v:4},{type:'attack',v:9,times:2},{type:'block',v:16}] }
};

/* 事件。effect 代码由引擎解释。 */
window.EVENTS = [
  { id:'ev_fount', title:'色彩喷泉', text:'一眼从白墙裂缝里涌出的彩色墨泉，微微发烫。',
    options:[ {label:'畅饮（回复 18 点血）', eff:'heal18'}, {label:'装瓶带走（获得 20 记忆碎片）', eff:'shard20'}, {label:'伸手取一枚沉在泉底的芯片', eff:'chip'} ] },
  { id:'ev_eight', title:'8 号的低语', text:'走廊尽头，8 号静静看着你。「你……也是来被抹平的吗？」',
    options:[ {label:'伸出手，与她并肩', eff:'peace'}, {label:'保持距离，独自前行', eff:'shard15'} ] },
  { id:'ev_forge', title:'芯片熔炉', text:'一台还在运转的旧熔炉，可以把一枚芯片重铸得更强。',
    options:[ {label:'强化一枚芯片', eff:'upgrade'}, {label:'不了，继续走', eff:'none'} ] },
  { id:'ev_merchant', title:'褪色商人', text:'一个几乎透明的身影摊开货架：「用一点生命，换一点力量？」',
    options:[ {label:'付出 8 点血，换一枚芯片', eff:'chip_hp8'}, {label:'付出 6 点血，换 30 记忆碎片', eff:'shard30_hp6'}, {label:'离开', eff:'none'} ] },
  { id:'ev_trial', title:'秩序试炼', text:'一道封印的门后传来压迫感——击败守卫可得厚赏。',
    options:[ {label:'挑战精英，胜则厚赏', eff:'fight_elite'}, {label:'绕道而行', eff:'none'} ] },
  { id:'ev_shard', title:'记忆残片', text:'地上散落着前人遗落的记忆碎片。',
    options:[ {label:'全部拾起（获得 25 记忆碎片）', eff:'shard25'}, {label:'只取一枚完整的芯片', eff:'chip'} ] }
];

/* 结局。 */
window.ENDINGS = {
  purify:   { id:'purify',   name:'还世界以色彩', tone:'净化', hex:'#8bff3e',
    quote:'白墙裂开，四色的墨潮涌回这个世界。',
    desc:'你没有让任何一种颜色吞没其余——赤蓝黄紫在你手中彼此成全。塔顶的秩序被真正的「多彩」瓦解，世界重新有了参差与生机。' },
  master_red:    { id:'master_red',    name:'铁血塔主', tone:'塔主', hex:'#ff3b5c',
    quote:'秩序没有被消灭，只是换了一位主人——一位只信进攻的主人。',
    desc:'你以压倒性的赤色登顶。你没有还世界以色彩，而是用自己的颜色重新粉刷了它。一座新的、猩红的塔拔地而起。' },
  master_blue:   { id:'master_blue',   name:'壁垒塔主', tone:'塔主', hex:'#35a7ff',
    quote:'固若金汤的蓝，成了新的高墙。',
    desc:'你以绝对的防御登顶。世界不再被抹白，却被你的蓝色壁垒圈了起来——安全，但依旧只有一种颜色。' },
  master_yellow: { id:'master_yellow', name:'辉光塔主', tone:'塔主', hex:'#ffd23f',
    quote:'温暖的黄光普照，却也刺得人睁不开眼。',
    desc:'你以辅助与治愈之黄登顶。你善待每一个人，也用同一种光芒覆盖了每一个人。塔顶从此金光万丈，别无二色。' },
  master_purple: { id:'master_purple', name:'诡影塔主', tone:'塔主', hex:'#b072ff',
    quote:'侵蚀反噬了侵蚀，紫雾笼罩塔尖。',
    desc:'你以干扰与侵蚀之紫登顶。你用秩序的手段打败了秩序，也活成了它的样子——一位在紫雾里微笑的新主人。' },
  reconcile:{ id:'reconcile', name:'与 8 号和解', tone:'和解', hex:'#12e0d4',
    quote:'两个人的颜色叠在一起，比塔顶的白更亮。',
    desc:'你伸出的那只手，改变了结局。你和 8 号并肩走完全程——不是谁净化了谁，而是两个不完美的人，一起从白色里走了出来。' },
  white:    { id:'white',    name:'褪为白色', tone:'同化', hex:'#dfe3ee',
    quote:'你的颜色，一点一点，被抹平了。',
    desc:'墨力耗尽的那一刻，秩序温柔地覆盖了你。你成了塔中又一块完美的、没有个性的白。——但只要再来一次，颜色还会回来。' }
};

window.CONFIG = { maxHp:55, handSize:5, energy:3, floors:10 };
