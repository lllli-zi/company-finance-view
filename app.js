/* ============================================================
 * 公司财务情况一览 —— 渲染与交互
 * 数据见 data.js（window.FINDATA），由 build_data.py 生成
 * 面板：总览 · 公司款项往来 · 五个公司页（月度/分类/明细下钻）
 * ============================================================ */
(function(){
"use strict";
var D=null;
function $id(s){return document.querySelector(s)}

/* ---------------- 登录门 + 数据解密（⑫·静态托管版）----------------
 * GitHub Pages 等纯静态托管无法做服务端认证，因此：
 * ① 登录密码经 SHA-256 摘要比对（防明文存放）；
 * ② 数据文件（data.enc）用登录密码 PBKDF2→AES-256-GCM 加密，
 *    登录成功后在浏览器内解密——公开仓库/URL 上只有密文。
 * ③ 「记住我」= 密码存本机 localStorage（等价于保存解密钥匙），
 *    不勾选则存 sessionStorage，关闭浏览器自动登出。
 */
var AUTH={user:'admin',hash:'615ed7fb1504b0c724a296d7a69e6c7b2f9ea2c57c1d8206c5afdf392ebdfd25'};
var gate=$id('#gate'),gUser=$id('#gUser'),gPass=$id('#gPass'),gErr=$id('#gErr'),gRem=$id('#gRem');
function sha256hex(s){
  if(window.crypto&&crypto.subtle){
    return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(function(b){
      return [].map.call(new Uint8Array(b),function(x){return ('0'+x.toString(16)).slice(-2)}).join('')})}
  return Promise.reject('nocrypto')}
function b64d(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
function b64cat(a,b2){var u=new Uint8Array(a.length+b2.length);u.set(a);u.set(b2,a.length);return u}

/* 数据加载：本地 data.js 直读；线上拉 data.enc 并用登录密码解密 */
function loadData(loginPwd){
  if(window.FINDATA){D=window.FINDATA;return Promise.resolve()}
  if(!loginPwd)return Promise.reject(new Error('缺少解密密码'));
  return fetch('data.enc').then(function(r){
    if(!r.ok)throw new Error('加密数据文件缺失('+r.status+')');
    return r.json()}).then(function(enc){
    if(!(window.crypto&&crypto.subtle))throw new Error('浏览器不支持 WebCrypto');
    var enc8=new TextEncoder().encode(loginPwd);
    return crypto.subtle.importKey('raw',enc8,'PBKDF2',false,['deriveKey']).then(function(km){
      return crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(enc.s),iterations:enc.n||150000,hash:'SHA-256'},
        km,{name:'AES-GCM',length:256},false,['decrypt'])}).then(function(key){
        var ct=b64cat(b64d(enc.c),b64d(enc.t));
        return crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(enc.i)},key,ct)})}).then(function(buf){
      var txt=new TextDecoder().decode(buf);
      var a=txt.indexOf('{'),b=txt.lastIndexOf('}');
      if(a<0||b<0)throw new Error('数据格式异常');
      D=window.FINDATA=JSON.parse(txt.slice(a,b+1))})}

function afterAuth(pwd){
  loadData(pwd).then(function(){bootApp()},function(err){
    alert('数据解密失败：'+((err&&err.message)||err)+'\n请确认密码，或重新发布数据。');
    logout()})}

function authed(pwd){
  document.body.classList.add('authed');
  if(gate){gate.remove();gate=null}
  afterAuth(pwd)}
function tryLogin(){
  var u=(gUser.value||'').trim(),p=gPass.value||'';
  gErr.textContent='';
  var fail=function(msg){
    gErr.textContent=msg;
    if(gate){gate.classList.remove('shake');void gate.offsetWidth;gate.classList.add('shake')}
    gPass.select()};
  if(u!==AUTH.user){fail('账号不存在');return}
  sha256hex(p).then(function(h){
    if(h===AUTH.hash){
      try{
        var store=gRem.checked?localStorage:sessionStorage;
        store.setItem('finAuth','ok');store.setItem('finPwd',p);
        var other=gRem.checked?sessionStorage:localStorage;
        other.removeItem('finAuth');other.removeItem('finPwd');
      }catch(e){}
      authed(p)}
    else fail('密码错误')},function(){fail('浏览器不支持加密接口，请用 Chrome/Safari 打开')})}
function logout(){
  try{sessionStorage.removeItem('finAuth');sessionStorage.removeItem('finPwd');
      localStorage.removeItem('finAuth');localStorage.removeItem('finPwd')}catch(e){}
  location.reload()}
if(gate){
  var remembered=false,rememberedPwd=null;
  try{
    remembered=(sessionStorage.getItem('finAuth')||localStorage.getItem('finAuth'))==='ok';
    rememberedPwd=sessionStorage.getItem('finPwd')||localStorage.getItem('finPwd');
  }catch(e){}
  if(remembered&&rememberedPwd){authed(rememberedPwd)}
  else if(remembered&&!rememberedPwd){logout()}
  else{
    $id('#gGo').addEventListener('click',tryLogin);
    gPass.addEventListener('keydown',function(e){if(e.key==='Enter')tryLogin()});
    gUser.addEventListener('keydown',function(e){if(e.key==='Enter')gPass.focus()});
    setTimeout(function(){gUser.focus()},80)}}
$id('#btnLogout').addEventListener('click',logout);
/* ------------------------------------------------------------------ */

/* ============================================================
 * 应用主体：数据就绪（本地 data.js 或解密完成）后才执行
 * ============================================================ */
function bootApp(){
/* ---------------- 基础工具 ---------------- */
function $(sel,root){return (root||document).querySelector(sel)}
function el(tag,cls,html){var e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function yuan(v){return Number(v).toLocaleString('zh-CN',{maximumFractionDigits:2})}
function wan(v){if(v<10000)return String(Math.round(v));var w=v/10000;return (w>=100?Math.round(w):w>=10?Math.round(w*10)/10:Math.round(w*100)/100)+'万'}
function pct(v,t){return t>0?(v/t*100).toFixed(1)+'%':'0.0%'}
function niceMax(v){if(v<=0)return 1;var p=Math.pow(10,Math.floor(Math.log10(v)));var d=v/p;var n=d<=1?1:d<=2?2:d<=2.5?2.5:d<=5?5:10;return n*p}
function sum(arr){return arr.reduce(function(a,b){return a+b},0)}
var CO={};D.companies.forEach(function(c){CO[c.key]=c});
var COMAP={};D.companies.forEach(function(c){COMAP[c.name]=c});
function shortName(n){var c=COMAP[n];if(c)return c.short;
  return {'上海洛克思企业管理咨询合伙企业（有限合伙）':'上海洛克思','上海洛克思':'上海洛克思'}[n]||
         (n.length>8?n.slice(0,8)+'…':n)}

/* ---------------- 分类配色 ---------------- */
var CAT_COLOR={
  '借款往来（公司间）':'#d97706','投资款':'#7c3aed','工资薪酬':'#2563eb','社保公积金':'#0891b2',
  '税费':'#64748b','银行手续费':'#a3a3a3','报销（差旅·办公·招待）':'#16a34a','房租物业水电':'#ca8a04',
  '电商与办公采购':'#db2777','云与通信服务':'#0ea5e9','会议展览与市场':'#f59e0b',
  '法律财税与专业服务':'#6d28d9','技术服务与开发':'#c026d3','其他支出':'#78716c',
  '课题支出':'#9333ea','退回冲销（原路退回）':'#94a3b8','其他':'#78716c',
  '投资款流入':'#7c3aed','借款流入（公司间往来）':'#d97706','业务收入（服务费等）':'#0d9488',
  '利息收入':'#65a30d','退款及其他流入':'#94a3b8'
};
var PAL=['#2563eb','#d97706','#7c3aed','#db2777','#0891b2','#16a34a','#ca8a04','#9333ea','#64748b','#dc2626','#0d9488','#78716c'];
function catColor(c){return CAT_COLOR[c]||PAL[Math.abs(hash(c))%PAL.length]}
function hash(s){var h=0;for(var i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0}return h}

/* ---------------- 提示框 ---------------- */
var tip=$('#tip');
function showTip(ev,html){tip.innerHTML=html;tip.style.display='block';moveTip(ev)}
function moveTip(ev){
  var x=ev.clientX+14,y=ev.clientY+14;
  var r=tip.getBoundingClientRect();
  if(x+r.width>innerWidth-8)x=ev.clientX-r.width-12;
  if(y+r.height>innerHeight-8)y=ev.clientY-r.height-12;
  tip.style.left=x+'px';tip.style.top=y+'px'}
function hideTip(){tip.style.display='none'}
document.addEventListener('mousemove',function(e){if(tip.style.display==='block')moveTip(e)});

var SVGNS='http://www.w3.org/2000/svg';
function svgEl(tag,attrs){var e=document.createElementNS(SVGNS,tag);for(var k in attrs)e.setAttribute(k,attrs[k]);return e}
function catTag(c){var col=catColor(c);return '<span class="cat-tag" style="background:'+col+'14;color:'+col+';border-color:'+col+'40">'+esc(c)+'</span>'}

/* ============================================================
 * 图表：堆叠月度柱
 * ============================================================ */
function stackedBars(mount,opt){
  var months=opt.months,series=opt.series,W=opt.width||920,H=opt.height||250;
  var padL=46,padR=10,padT=14,padB=30;
  var iw=W-padL-padR,ih=H-padT-padB;
  var totals=months.map(function(_,i){return sum(series.map(function(s){return s.values[i]||0}))});
  var ymax=opt.ymax?opt.ymax:niceMax(Math.max.apply(null,totals.concat([1])));
  var svg=svgEl('svg',{viewBox:'0 0 '+W+' '+H,class:'chart',style:'width:100%'});
  // 网格与Y轴
  for(var t=0;t<=4;t++){
    var yv=ymax*t/4,y=padT+ih-ih*t/4;
    svg.appendChild(svgEl('line',{x1:padL,y1:y,x2:W-padR,y2:y,class:t===0?'axis':'gridline'}));
    var lb=svgEl('text',{x:padL-6,y:y+3.5,'text-anchor':'end',class:'ylabel'});
    lb.textContent=opt.yFmt?opt.yFmt(yv):wan(yv);svg.appendChild(lb)}
  months.forEach(function(m,i){
    var bw=Math.min(46,iw/months.length*0.62);
    var cx=padL+iw*(i+.5)/months.length;
    var x=cx-bw/2;
    var acc=0;
    series.forEach(function(s){
      var v=s.values[i]||0;if(v<=0)return;
      var h=ih*v/ymax;
      var r=svgEl('rect',{x:x,y:padT+ih-acc-h,width:bw,height:Math.max(h,.8),fill:s.color,
        rx:s===series[0]&&series.length?0:0,class:'bar'});
      if(s.rx)r.setAttribute('rx',s.rx);
      r.addEventListener('mouseenter',function(e){
        showTip(e,'<div class="tt">'+m+' · '+esc(s.name)+'</div><div class="tr"><span class="lb">金额</span><span class="vl">'+yuan(v)+' 元</span></div>');
        r.setAttribute('opacity','.8')});
      r.addEventListener('mouseleave',function(){r.removeAttribute('opacity');hideTip()});
      if(opt.onBar)r.addEventListener('click',function(){opt.onBar(m)});
      svg.appendChild(r);acc+=h});
    // 悬停整月汇总
    var hit=svgEl('rect',{x:cx-iw/months.length/2,y:padT,width:iw/months.length,height:ih,fill:'transparent'});
    (function(i,m,tot){
      hit.addEventListener('mouseenter',function(e){
        var rows=series.filter(function(s){return (s.values[i]||0)>0}).map(function(s){
          return '<div class="tr"><span class="lb"><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:'+s.color+';margin-right:5px"></i>'+esc(s.name)+'</span><span class="vl">'+yuan(s.values[i])+'</span></div>'});
        showTip(e,'<div class="tt">'+m+' · '+esc(opt.title||'')+'合计 '+yuan(tot)+' 元</div>'+rows.join(''))});
      hit.addEventListener('mouseleave',hideTip)})(i,m,totals[i]);
    if(opt.onBar){hit.style.cursor='pointer';hit.addEventListener('click',function(){opt.onBar(m)})}
    svg.appendChild(hit);
    var tx=svgEl('text',{x:cx,y:H-8,'text-anchor':'middle',class:'xlabel'});
    tx.textContent=m.slice(2).replace('-','/');svg.appendChild(tx)});
  mount.appendChild(svg);
  // 图例
  var lg=el('div','legend');
  series.forEach(function(s){lg.appendChild(el('span','li','<span class="d" style="background:'+s.color+'"></span>'+esc(s.name)))});
  mount.appendChild(lg)}

/* ============================================================
 * 图表：分组柱（收入 vs 支出）
 * ============================================================ */
function groupedBars(mount,opt){
  var months=opt.months,W=opt.width||920,H=opt.height||250;
  var series=opt.series; // 2组
  var padL=46,padR=10,padT=14,padB=30,iw=W-padL-padR,ih=H-padT-padB;
  var ymax=niceMax(Math.max.apply(null,months.map(function(_,i){return Math.max.apply(null,series.map(function(s){return s.values[i]||0}))}).concat([1])));
  var svg=svgEl('svg',{viewBox:'0 0 '+W+' '+H,class:'chart',style:'width:100%'});
  for(var t=0;t<=4;t++){var yv=ymax*t/4,y=padT+ih-ih*t/4;
    svg.appendChild(svgEl('line',{x1:padL,y1:y,x2:W-padR,y2:y,class:t===0?'axis':'gridline'}));
    var lb=svgEl('text',{x:padL-6,y:y+3.5,'text-anchor':'end',class:'ylabel'});
    lb.textContent=wan(yv);svg.appendChild(lb)}
  var slot=iw/months.length;
  months.forEach(function(m,i){
    var cx=padL+slot*(i+.5),gw=Math.min(slot*.72,40),bw=gw/series.length;
    series.forEach(function(s,si){
      var v=s.values[i]||0;if(v<=0)return;
      var h=ih*v/ymax,x=cx-gw/2+si*bw;
      var r=svgEl('rect',{x:x,y:padT+ih-h,width:bw-1.5,height:Math.max(h,.8),fill:s.color,rx:2,class:'bar'});
      r.addEventListener('mouseenter',function(e){
        showTip(e,'<div class="tt">'+m+' · '+esc(s.name)+'</div><div class="tr"><span class="lb">金额</span><span class="vl">'+yuan(v)+' 元</span></div>');r.setAttribute('opacity','.8')});
      r.addEventListener('mouseleave',function(){r.removeAttribute('opacity');hideTip()});
      if(opt.onBar)r.addEventListener('click',function(){opt.onBar(m,s.name)});
      svg.appendChild(r)});
    var hit=svgEl('rect',{x:cx-slot/2,y:padT,width:slot,height:ih,fill:'transparent'});
    (function(i,m){
      hit.addEventListener('mouseenter',function(e){
        showTip(e,'<div class="tt">'+m+'</div>'+series.map(function(s){
          return '<div class="tr"><span class="lb">'+esc(s.name)+'</span><span class="vl">'+yuan(s.values[i]||0)+'</span></div>'}).join('')+
          '<div class="tr"><span class="lb">净额</span><span class="vl">'+yuan((series[0].values[i]||0)-(series[1].values[i]||0))+'</span></div>')});
      hit.addEventListener('mouseleave',hideTip)})(i,m);
    if(opt.onBar){hit.style.cursor='pointer';hit.addEventListener('click',function(){opt.onBar(m)})}
    svg.appendChild(hit);
    var tx=svgEl('text',{x:cx,y:H-8,'text-anchor':'middle',class:'xlabel'});
    tx.textContent=m.slice(2).replace('-','/');svg.appendChild(tx)});
  mount.appendChild(svg);
  var lg=el('div','legend');
  series.forEach(function(s){lg.appendChild(el('span','li','<span class="d" style="background:'+s.color+'"></span>'+esc(s.name)))});
  mount.appendChild(lg)}

/* ============================================================
 * 图表：环形占比
 * ============================================================ */
function donut(mount,opt){
  var items=opt.items,W=210,H=210,cx=W/2,cy=H/2,r=74,sw=30;
  var total=sum(items.map(function(d){return d.value}));
  var svg=svgEl('svg',{viewBox:'0 0 '+W+' '+H,class:'chart',style:'flex:none'});
  var a0=-Math.PI/2;
  items.forEach(function(d){
    if(d.value<=0)return;
    var a1=a0+d.value/total*Math.PI*2;
    var large=(a1-a0)>Math.PI?1:0;
    var x0=cx+r*Math.cos(a0),y0=cy+r*Math.sin(a0),x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);
    var p=svgEl('path',{d:'M '+x0+' '+y0+' A '+r+' '+r+' 0 '+large+' 1 '+x1+' '+y1,
      fill:'none',stroke:d.color,'stroke-width':sw,'stroke-linecap':'butt',style:'cursor:pointer'});
    p.addEventListener('mouseenter',function(e){
      p.setAttribute('stroke-width',sw+6);
      showTip(e,'<div class="tt">'+esc(d.name)+'</div><div class="tr"><span class="lb">金额</span><span class="vl">'+yuan(d.value)+' 元</span></div><div class="tr"><span class="lb">占比</span><span class="vl">'+pct(d.value,total)+'</span></div>'+(d.n?'<div class="tr"><span class="lb">笔数</span><span class="vl">'+d.n+'</span></div>':''))});
    p.addEventListener('mouseleave',function(){p.setAttribute('stroke-width',sw);hideTip()});
    if(opt.onItemClick)p.addEventListener('click',function(){opt.onItemClick(d.name)});
    svg.appendChild(p);a0=a1});
  var t1=svgEl('text',{x:cx,y:cy-4,'text-anchor':'middle','font-size':'17','font-weight':'800',fill:'#0f172a'});
  t1.textContent=opt.centerBig||wan(total);svg.appendChild(t1);
  var t2=svgEl('text',{x:cx,y:cy+15,'text-anchor':'middle','font-size':'10.5',fill:'#94a3b8'});
  t2.textContent=opt.centerSmall||'合计';svg.appendChild(t2);
  mount.appendChild(svg);
  if(opt.legend!==false){
    var lg=el('div','dlegend');
    items.forEach(function(d){
      var li=el('div','li','<span class="d" style="background:'+d.color+'"></span><span class="nm">'+esc(d.name)+(d.n?' <i style="color:#cbd5e1;font-style:normal">'+d.n+'笔</i>':'')+'</span><span class="num" style="color:#475569">'+yuan(d.value)+'</span><span class="pc num">'+pct(d.value,total)+'</span>');
      if(opt.onItemClick){li.style.cursor='pointer';li.addEventListener('click',function(){opt.onItemClick(d.name)})}
      lg.appendChild(li)});
    mount.appendChild(lg)}}

/* ============================================================
 * 图表：资金流向（可按款项性质过滤，独立标尺）
 * flows: {aKey|bKey: {n, amt, rows:[{d,amt,zy,nature}]}}
 * opt: {color, title}  color 为箭头/标签主色
 * ============================================================ */
function flowDiagram(mount,flows,opt){
  opt=opt||{};
  var W=880,H=430;
  var ALLNODES={
    zhidaxin:{x:150,y:100,w:150,label:'上海智达信',color:'#2563eb'},
    shendu:{x:150,y:300,w:170,label:'深度垂域上海',color:'#d97706'},
    modeng:{x:660,y:70,w:150,label:'上海垂域模盾',color:'#7c3aed'},
    lingdong:{x:660,y:200,w:150,label:'上海灵动能知',color:'#0d9488'},
    changsha:{x:660,y:320,w:160,label:'长沙深度垂域',color:'#16a34a'},
    luokesi:{x:400,y:395,w:120,label:'洛克思(外部)',color:'#94a3b8'}
  };
  var nodes={},touched={};
  Object.keys(flows).forEach(function(k){
    var ab=k.split('|');touched[ab[0]]=1;touched[ab[1]]=1});
  Object.keys(ALLNODES).forEach(function(k){if(touched[k])nodes[k]=ALLNODES[k]});
  // 汇总各节点转出/转入
  var outA={},inA={};
  Object.keys(flows).forEach(function(k){
    var ab=k.split('|'),f=flows[k];
    outA[ab[0]]=(outA[ab[0]]||0)+f.amt;inA[ab[1]]=(inA[ab[1]]||0)+f.amt});
  var svg=svgEl('svg',{viewBox:'0 0 '+W+' '+H,class:'chart',style:'width:100%;min-width:700px'});
  var defs=svgEl('defs',{});svg.appendChild(defs);
  function mkArrow(id,color){var m=svgEl('marker',{id:id,viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});
    m.appendChild(svgEl('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:color}));defs.appendChild(m)}
  // 独立标尺：本图最大金额 → 最粗箭头
  var maxAmt=Math.max.apply(null,Object.keys(flows).map(function(k){return flows[k].amt}).concat([1]));
  var arrowIds={};
  Object.keys(flows).forEach(function(k){
    var ab=k.split('|'),a=nodes[ab[0]],b=nodes[ab[1]],f=flows[k];
    if(!a||!b)return;
    var color=opt.color||ALLNODES[ab[0]].color;
    var id='ar'+(opt.id||'x')+ab[0]+'_'+ab[1];
    if(!arrowIds[id]){mkArrow(id,color);arrowIds[id]=1}
    var x1=a.x+a.w/2,y1=a.y,x2=b.x-b.w/2-4,y2=b.y;
    var mx=(x1+x2)/2;
    var wdt=2.2+6.8*Math.sqrt(f.amt/maxAmt);
    var p=svgEl('path',{d:'M '+x1+' '+y1+' C '+mx+' '+y1+', '+mx+' '+y2+', '+x2+' '+y2,
      fill:'none',stroke:color,'stroke-width':wdt,opacity:.6,'marker-end':'url(#'+id+')',style:'cursor:pointer'});
    p.addEventListener('mouseenter',function(e){
      p.setAttribute('opacity','.95');
      var rowsTxt=f.rows.slice(0,8).map(function(r){
        return '<div class="tr"><span class="lb">'+r.d+' '+(r.zy?'('+esc(r.zy)+')':'')+'</span><span class="vl">'+yuan(r.amt)+'</span></div>'}).join('');
      if(f.rows.length>8)rowsTxt+='<div class="tr"><span class="lb">…</span><span class="vl">共'+f.n+'笔</span></div>';
      showTip(e,'<div class="tt">'+esc(a.label)+' → '+esc(b.label)+' · '+yuan(f.amt)+' 元 · '+f.n+'笔</div>'+rowsTxt)});
    p.addEventListener('mouseleave',function(){p.setAttribute('opacity','.6');hideTip()});
    svg.appendChild(p);
    var lx=mx,ly=(y1+y2)/2-8;
    var tx=svgEl('text',{x:lx,y:ly,'text-anchor':'middle','font-size':'11.5','font-weight':'700',fill:color});
    tx.textContent=wan(f.amt);svg.appendChild(tx);
    var tn=svgEl('text',{x:lx,y:ly+13,'text-anchor':'middle','font-size':'9.5',fill:'#94a3b8'});
    tn.textContent=f.n+'笔';svg.appendChild(tn)});
  // 节点（只画本性质涉及的）
  Object.keys(nodes).forEach(function(k){
    var n=nodes[k],h=k==='luokesi'?52:64;
    var g=svgEl('g',{});
    g.appendChild(svgEl('rect',{x:n.x-n.w/2,y:n.y-h/2,width:n.w,height:h,rx:11,fill:'#fff',stroke:n.color,'stroke-width':1.6}));
    g.appendChild(svgEl('rect',{x:n.x-n.w/2,y:n.y-h/2,width:4.5,height:h,rx:2,fill:n.color}));
    var t1=svgEl('text',{x:n.x+3,y:n.y-(k==='luokesi'?4:10),'text-anchor':'middle','font-size':'12.5','font-weight':'800',fill:'#0f172a'});
    t1.textContent=n.label;g.appendChild(t1);
    var t2=svgEl('text',{x:n.x+3,y:n.y+(k==='luokesi'?14:10),'text-anchor':'middle','font-size':'9.5',fill:'#94a3b8'});
    t2.textContent='转出 '+(outA[k]?wan(outA[k]):'—')+' · 转入 '+(inA[k]?wan(inA[k]):'—');g.appendChild(t2);
    svg.appendChild(g)});
  mount.appendChild(svg)}

/* ============================================================
 * 明细流水表（筛选 + 分页）
 * ============================================================ */
function txTable(mount,coKey){
  var rows=D.tx[coKey].map(function(r,i){return{r:r,i:i}})   // 原始为时间升序
    .sort(function(a,b){return a.r[1]===b.r[1]?b.i-a.i:(a.r[1]<b.r[1]?1:-1)})  // 按日期降序，同日内晚的在前面
    .map(function(x){return x.r}); // [m,date,io,amt,cp,zy,tp,cat,bal]
  var cats=[];rows.forEach(function(r){if(cats.indexOf(r[7])<0)cats.push(r[7])});
  var st={m:'all',cat:'all',io:'all',q:'',page:1,ps:25};
  var box=el('div','');
  var fbar=el('div','filters');
  function sel(opts,cls){
    var s=el('select',cls||'');
    opts.forEach(function(o){var op=el('option','',o[1]);op.value=o[0];s.appendChild(op)});
    return s}
  var sM=sel([['all','月份：全部']].concat(D.months.map(function(m){return[m,m]})));
  var sC=sel([['all','分类：全部']].concat(cats.map(function(c){return[c,c]})));
  var sIO=sel([['all','收支：全部'],['in','仅收入'],['out','仅支出']]);
  var iQ=el('input','');iQ.placeholder='搜索对方户名 / 摘要…';
  var rst=el('button','rst','重置');rst.type='button';
  var exp=el('button','rst','⬇ 导出CSV');exp.type='button';exp.style.color='#0d9488';
  fbar.appendChild(sM);fbar.appendChild(sC);fbar.appendChild(sIO);fbar.appendChild(iQ);
  fbar.appendChild(el('span','fgap'));fbar.appendChild(exp);fbar.appendChild(rst);
  var tblScroll=el('div','tbl-scroll');
  var ftotal=el('div','ftotal');
  var pagerow=el('div','pagerow');
  box.appendChild(fbar);box.appendChild(tblScroll);box.appendChild(ftotal);box.appendChild(pagerow);
  mount.appendChild(box);

  function filtered(){
    var q=st.q.toLowerCase();
    return rows.filter(function(r){
      if(st.m!=='all'&&r[0]!==st.m)return false;
      if(st.cat!=='all'&&r[7]!==st.cat)return false;
      if(st.io!=='all'&&r[2]!==st.io)return false;
      if(q&&(r[4]+' '+r[5]).toLowerCase().indexOf(q)<0)return false;
      return true})}

  function render(){
    sM.value=st.m;sC.value=st.cat;sIO.value=st.io;iQ.value=st.q;
    var list=filtered();
    var pages=Math.max(1,Math.ceil(list.length/st.ps));
    if(st.page>pages)st.page=pages;
    var start=(st.page-1)*st.ps;
    var pageRows=list.slice(start,start+st.ps);
    var tin=sum(list.filter(function(r){return r[2]==='in'}).map(function(r){return r[3]}));
    var tout=sum(list.filter(function(r){return r[2]==='out'}).map(function(r){return r[3]}));
    var t=el('table','t');
    t.innerHTML='<thead><tr><th>日期</th><th>收/支</th><th class="r">金额(元)</th><th>对方户名</th><th>摘要</th><th>分类</th><th class="r">余额(元)</th></tr></thead>';
    var tb=el('tbody','');
    pageRows.forEach(function(r){
      var tr=el('tr','');
      tr.innerHTML='<td class="num">'+r[1]+'</td>'+
        '<td class="'+(r[2]==='in'?'io-in':'io-out')+'">'+(r[2]==='in'?'收入':'支出')+'</td>'+
        '<td class="num r">'+yuan(r[3])+'</td>'+
        '<td>'+(r[4]?esc(r[4]):'<i style="color:#cbd5e1">（批量代发·户名空）</i>')+'</td>'+
        '<td style="max-width:260px">'+esc(r[5]||'')+'</td>'+
        '<td>'+catTag(r[7])+'</td>'+
        '<td class="num r" style="color:#94a3b8">'+(r[8]==null?'—':yuan(r[8]))+'</td>';
      tb.appendChild(tr)});
    t.appendChild(tb);tblScroll.innerHTML='';tblScroll.appendChild(t);
    ftotal.innerHTML='筛选结果 <b>'+list.length+'</b> / '+rows.length+' 笔 · 收入 <b style="color:var(--in)">'+yuan(tin)+'</b> · 支出 <b style="color:var(--out)">'+yuan(tout)+'</b>';
    pagerow.innerHTML='';
    var bp=el('button','','‹ 上一页');bp.type='button';bp.disabled=st.page<=1;
    bp.onclick=function(){st.page--;render();tblScroll.scrollTop=0};
    var bn=el('button','','下一页 ›');bn.type='button';bn.disabled=st.page>=pages;
    bn.onclick=function(){st.page++;render();tblScroll.scrollTop=0};
    var info=el('span','','第 '+st.page+' / '+pages+' 页');
    pagerow.appendChild(bp);pagerow.appendChild(bn);pagerow.appendChild(info)}

  sM.onchange=function(){st.m=sM.value;st.page=1;render()};
  sC.onchange=function(){st.cat=sC.value;st.page=1;render()};
  sIO.onchange=function(){st.io=sIO.value;st.page=1;render()};
  var deb;iQ.oninput=function(){clearTimeout(deb);var v=iQ.value;deb=setTimeout(function(){st.q=v;st.page=1;render()},180)};
  rst.onclick=function(){st={m:'all',cat:'all',io:'all',q:'',page:1,ps:st.ps};render()};
  // ⑤ 导出当前筛选结果为 CSV（带BOM，Excel直接打开不乱码）
  exp.onclick=function(){
    var list=filtered();
    var head='月份,日期,收/支,金额(元),对方户名,摘要,交易类型,分类,余额(元)';
    var body=list.map(function(r){
      return [r[0],r[1],r[2]==='in'?'收入':'支出',r[3],'"'+String(r[4]||'').replace(/"/g,'""')+'"',
              '"'+String(r[5]||'').replace(/"/g,'""')+'"','"'+String(r[6]||'').replace(/"/g,'""')+'"',r[7],
              r[8]==null?'':r[8]].join(',')}).join('\r\n');
    var blob=new Blob(['\ufeff'+head+'\r\n'+body],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    var co=CO[coKey]?CO[coKey].short:coKey;
    var tag=(st.m!=='all'?st.m:'')+(st.cat!=='all'?'_'+st.cat.slice(0,6):'')+(st.io!=='all'?'_'+st.io:'');
    a.download=co+'_流水明细'+(tag?'_'+tag:'')+'.csv';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(a.href)},3000)};
  render();
  return {setFilter:function(k,v){st[k]=v;st.page=1;render();if(k==='m'||k==='cat')setTimeout(function(){tblScroll.scrollIntoView({behavior:'smooth',block:'nearest'})},50)}};
}

/* ============================================================
 * 面板 1：总览
 * ============================================================ */
function panelOverview(){
  var p=el('section','panel');p.id='p-overview';
  var w=el('div','wrap');p.appendChild(w);
  var totIn=sum(D.companies.map(function(c){return c.amtIn})),
      totOut=sum(D.companies.map(function(c){return c.amtOut})),
      totN=sum(D.companies.map(function(c){return c.nTx}));
  var interOut=0;Object.keys(D.inter.flows).forEach(function(k){interOut+=D.inter.flows[k].amt});
  w.appendChild(el('h2','pt','<span class="dot" style="background:linear-gradient(135deg,#2563EB,#16A34A)"></span>总览'));
  w.appendChild(el('div','psub','五公司银行流水（招商银行对公账户）· <b>'+D.range+'</b> · 数据与银行对账单逐笔核对，余额链 <b>0 断链</b>'));
  var kpi=el('div','kpi-row');
  [['合计收入',yuan(totIn)+' 元','var(--in)'],['合计支出',yuan(totOut)+' 元','var(--out)'],
   ['净流入',yuan(totIn-totOut)+' 元',''],['其中：公司间互转',yuan(interOut)+' 元',''],
   ['对外支出（剔互转）',yuan(totOut-interOut)+' 元',''],['流水笔数',totN+' 笔','']]
  .forEach(function(k){
    kpi.appendChild(el('div','kpi','<div class="k">'+k[0]+'</div><div class="v num" style="color:'+(k[2]||'var(--ink)')+'">'+k[1].replace(/ 元$/,'')+'</div><div class="s">'+(k[1].indexOf('元')>=0?'元':'')+'</div>'))});
  w.appendChild(kpi);

  // 月度支出/收入堆叠（上下两行，共用同一坐标刻度，可直接对比高低）
  var g2=el('div','');g2.style.cssText='display:grid;gap:14px;margin-bottom:14px';w.appendChild(g2);
  var cOut=el('div','card','<h3>每月支出 · 按公司堆叠<span class="r">与下图共用坐标刻度 · 点击月份可对比</span></h3>');
  var cIn=el('div','card','<h3>每月收入 · 按公司堆叠<span class="r">与上图共用坐标刻度</span></h3>');
  var sOut=D.companies.map(function(c){return{name:c.short,color:c.color,values:D.months.map(function(m){return (D.monthly[c.key][m]||{}).out||0})}});
  var sIn=D.companies.map(function(c){return{name:c.short,color:c.color,values:D.months.map(function(m){return (D.monthly[c.key][m]||{}).in||0})}});
  var mTotals=D.months.map(function(_,i){
    return Math.max(sum(sOut.map(function(s){return s.values[i]||0})),
                    sum(sIn.map(function(s){return s.values[i]||0})))});
  var peak=Math.max.apply(null,mTotals.concat([1]));
  var sharedY=peak<=3000000?3000000:niceMax(peak);  // 常态上限300万，数据超限时才抬高
  stackedBars(cOut,{months:D.months,series:sOut,title:'支出',ymax:sharedY});
  stackedBars(cIn,{months:D.months,series:sIn,title:'收入',ymax:sharedY});
  g2.appendChild(cOut);g2.appendChild(cIn);

  // ② 每月人力成本（工资+社保+公积金）· 按公司堆叠
  var sLabor=D.companies.map(function(c){
    return{name:c.short,color:c.color,values:D.months.map(function(m){
      var cm=D.catMonthly[c.key][m]||{};
      return (cm['工资薪酬']||0)+(cm['社保公积金']||0)})}});
  var laborTot=sum(sLabor.map(function(s){return sum(s.values)}));
  var laborPeak=Math.max.apply(null,D.months.map(function(_,i){return sum(sLabor.map(function(s){return s.values[i]||0}))}).concat([1]));
  var cL=el('div','card','<h3>每月人力成本（工资+社保+公积金）· 按公司堆叠'
    +'<span class="chip in" style="cursor:default">区间合计 '+yuan(laborTot)+' 元 · 峰值月 '+wan(laborPeak)+'</span>'
    +'<span class="r">独立刻度</span></h3>');
  stackedBars(cL,{months:D.months,series:sLabor,title:'人力成本',ymax:niceMax(laborPeak)});
  g2.appendChild(cL);

  // 公司卡
  var g=el('div','grid');g.style.gridTemplateColumns='repeat(auto-fit,minmax(230px,1fr))';g.style.marginTop='14px';
  D.companies.forEach(function(c){
    var card=el('div','card co-card');card.style.setProperty('--cc',c.color);
    card.innerHTML='<div class="nm"><span class="tag">公司</span>'+esc(c.short)+'</div>'+
      '<div class="row"><span>流水月份</span><b>'+c.firstMonth+' ~ '+c.lastMonth+'</b></div>'+
      '<div class="row"><span>收入 / 支出</span><b>'+wan(c.amtIn)+' / '+wan(c.amtOut)+'</b></div>'+
      '<div class="row"><span>净额</span><b style="color:'+(c.net>=0?'var(--in)':'var(--out)')+'">'+yuan(c.net)+'</b></div>'+
      '<div class="row"><span>期末余额</span><b>'+yuan(c.endBal)+'</b></div>'+
      '<div class="row"><span>笔数（收/支）</span><b>'+c.nTx+'（'+c.nIn+'/'+c.nOut+'）</b></div>'+
      '<div class="row"><span>主要支出</span><b>'+esc(topCat(c.key))+'</b></div>';
    card.style.cursor='pointer';card.onclick=function(){goTo('p-'+c.key)};
    g.appendChild(card)});
  w.appendChild(g);

  // ⑦ 五公司分类对比表（万元，行内热力）
  var union={};
  D.companies.forEach(function(c){Object.keys(D.catOut[c.key]).forEach(function(k){union[k]=(union[k]||0)+D.catOut[c.key][k].amt})});
  var cats=Object.keys(union).sort(function(a,b){return union[b]-union[a]});
  var grandOut=sum(D.companies.map(function(c){return c.amtOut}));
  var cCmp=el('div','card','<h3>五公司支出分类对比<span class="r">单位：万元 · 颜色越深金额越大 · 括号为占该公司支出比</span></h3>');
  cCmp.style.marginTop='14px';
  var ct=el('table','t');ct.style.fontSize='12px';
  var thead='<thead><tr><th>分类</th>'+D.companies.map(function(c){return'<th class="r" style="color:'+c.color+'">'+esc(c.short)+'</th>'}).join('')+'<th class="r">合计</th><th class="r">占比</th></tr></thead>';
  var trows=cats.map(function(k){
    var vals=D.companies.map(function(c){return (D.catOut[c.key][k]||{amt:0}).amt});
    var rowMax=Math.max.apply(null,vals);
    var tds=vals.map(function(v,ci){
      if(v<=0)return '<td class="num r" style="color:#e2e8f0">·</td>';
      var a=.07+.43*(v/rowMax);
      var pc=' <i style="font-style:normal;color:#94a3b8;font-size:10px">'+(v/D.companies[ci].amtOut*100).toFixed(0)+'%</i>';
      return '<td class="num r" style="background:rgba(37,99,235,'+a.toFixed(2)+')">'+(v/10000).toFixed(1)+pc+'</td>'}).join('');
    return '<tr><td>'+catTag(k)+'</td>'+tds+'<td class="num r" style="font-weight:700">'+(union[k]/10000).toFixed(1)+'</td><td class="num r" style="color:#64748b">'+pct(union[k],grandOut)+'</td></tr>'});
  var totTds=D.companies.map(function(c){return '<td class="num r" style="font-weight:700">'+(c.amtOut/10000).toFixed(1)+'</td>'}).join('');
  trows.push('<tr style="border-top:2px solid #cbd5e1"><td style="font-weight:700">合计</td>'+totTds+'<td class="num r" style="font-weight:800">'+(grandOut/10000).toFixed(1)+'</td><td></td></tr>');
  ct.innerHTML=thead+'<tbody>'+trows.join('')+'</tbody>';
  cCmp.appendChild(ct);
  w.appendChild(cCmp);

  w.appendChild(el('div','foot',
    '口径说明：① 各公司均为单账户，期初余额由首笔交易推算（五公司账户均在区间内新开，期初为 0）。② 「公司间互转」为五公司及洛克思之间的全部转账（借款+投资款+服务费），与《公司间借款往来整理》26 笔核对表一致。③ 支出分类由「摘要+对方户名+交易类型」规则归并生成（报销/差旅等近似摘要已合并），规则见 build_data.py。④ 数据更新：替换 流水/ 下 Excel 后重跑 build_data.py 即可。'));
  return p}
function topCat(key){var c=D.catOut[key];var ks=Object.keys(c).sort(function(a,b){return c[b].amt-c[a].amt});return ks[0]?ks[0]+' '+wan(c[ks[0]].amt):'—'}

/* ============================================================
 * 面板 2：公司款项往来
 * ============================================================ */
function panelInter(){
  var p=el('section','panel');p.id='p-inter';
  var w=el('div','wrap');p.appendChild(w);
  w.appendChild(el('h2','pt','<span class="dot" style="background:linear-gradient(135deg,#D97706,#7C3AED)"></span>公司款项往来'));
  w.appendChild(el('div','psub','口径：<b>往来款＝借款</b>；依据银行流水与《公司间借款往来整理_20260830》核对，截至 <b>2026-08-30</b>'));
  // 性质汇总
  var byNat={};D.inter.check26.forEach(function(r){if(r.amt)byNat[r.nature]=(byNat[r.nature]||0)+r.amt});
  var chips=el('div','');chips.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px';
  Object.keys(byNat).sort(function(a,b){return byNat[b]-byNat[a]}).forEach(function(n){
    var cls=n.indexOf('投资')>=0?'invest':(n.indexOf('服务')>=0?'fee':'loan');
    chips.appendChild(el('span','chip '+cls,'<span class="d"></span>'+esc(n)+'合计 <b class="num">'+yuan(byNat[n])+'</b> 元'))});
  w.appendChild(chips);

  // 欠款关系（⑨ 含挂账账龄）
  var g=el('div','grid');g.style.gridTemplateColumns='repeat(auto-fit,minmax(250px,1fr))';g.style.marginBottom='14px';
  // 各欠款对的首笔借款日期 → 账龄
  function coKey(n){
    n=shortName(n);
    if(n.indexOf('智达信')>=0)return 'zhidaxin';
    if(n.indexOf('模盾')>=0)return 'modeng';
    if(n.indexOf('灵动能知')>=0)return 'lingdong';
    if(n.indexOf('长沙')>=0)return 'changsha';
    if(n.indexOf('深度垂域')>=0)return 'shendu';
    if(n.indexOf('洛克思')>=0)return 'luokesi';
    return null}
  function agingChip(debtor,creditor){
    var dk=coKey(debtor),ck=coKey(creditor),first=null;
    D.inter.check26.forEach(function(r){
      if(r.nature!=='往来款')return;
      if(coKey(r.from)!==ck||coKey(r.to)!==dk)return;   // 出借方→欠款方
      if(!first||r.d<first)first=r.d});
    if(!first)return '';
    var days=(new Date('2026-08-30')-new Date(first))/864e5;
    var months=Math.floor(days/30.44);
    return '<span class="chip" style="cursor:default;'+(months>=3?'background:#fef2f2;border-color:#fecaca;color:#b91c1c':'')+'">首笔 '+first+' · 挂账约 '+months+' 个月</span>'}
  D.inter.debts.forEach(function(d){
    var card=el('div','debt-card');
    card.innerHTML='<div class="pair"><b>'+esc(shortName(d.debtor))+'</b><span class="arr">欠</span><b>'+esc(shortName(d.creditor))+'</b></div>'+
      '<div class="amt num" style="color:#b91c1c">'+yuan(d.amt)+'<span style="font-size:12px;color:#94a3b8"> 元</span></div>'+
      '<div style="margin-bottom:6px">'+agingChip(shortName(d.debtor),shortName(d.creditor))+'</div>'+
      '<div class="ev">'+esc(d.evidence)+'</div>'+
      (d.note?'<div style="font-size:11.5px;color:#475569;margin-top:6px;padding-top:6px;border-top:1px dashed #e2e8f0">'+esc(d.note)+'</div>':'');
    g.appendChild(card)});
  w.appendChild(g);

  // 流向图：按款项性质拆成三张（投资款 / 往来款·借款 / 服务费），各自独立标尺
  var NATURES=[
    {key:'投资款',   label:'投资款流向',     color:'#7c3aed'},
    {key:'往来款',   label:'往来款（借款）流向', color:'#d97706'},
    {key:'服务费',   label:'服务费流向',     color:'#0891b2'}
  ];
  var flowWrap=el('div','');flowWrap.style.cssText='display:grid;gap:14px';
  w.appendChild(flowWrap);
  NATURES.forEach(function(nat){
    var sub={};
    Object.keys(D.inter.flows).forEach(function(k){
      var f=D.inter.flows[k];
      f.rows.forEach(function(r){
        var rn=(r.nature==='借款往来')?'往来款':r.nature;
        if(rn!==nat.key)return;
        if(!sub[k])sub[k]={n:0,amt:0,rows:[]};
        sub[k].n++;sub[k].amt+=r.amt;
        sub[k].rows.push({d:r.d,amt:r.amt,zy:r.zy,nature:rn})})});
    var keys=Object.keys(sub);
    if(!keys.length)return;
    var tot=sum(keys.map(function(k){return sub[k].amt})),n=sum(keys.map(function(k){return sub[k].n}));
    var card=el('div','card','<h3><span class="d" style="width:10px;height:10px;border-radius:3px;background:'+nat.color+';display:inline-block"></span>'
      +nat.label+'<span class="chip" style="color:'+nat.color+';border-color:'+nat.color+'55;background:'+nat.color+'0d">合计 '+yuan(tot)+' 元 · '+n+' 笔</span>'
      +'<span class="r">箭头粗细≈本图金额 · 悬停看逐笔</span></h3>');
    var fb=el('div','flow-box');card.appendChild(fb);
    flowDiagram(fb,sub,{color:nat.color,id:nat.key});
    flowWrap.appendChild(card)});

  // 26笔核对表
  var tc=el('div','card');tc.style.marginTop='14px';
  tc.appendChild(el('h3','','公司间互转明细（银行流水核实 · '+D.inter.check26.length+' 笔）'));
  var t=el('table','t');
  t.innerHTML='<thead><tr><th>日期</th><th>付方</th><th>收方</th><th class="r">金额(元)</th><th>性质</th><th>审批单 / 备注</th></tr></thead>';
  var tb=el('tbody','');
  D.inter.check26.slice().sort(function(a,b){return a.d<b.d?-1:1}).forEach(function(r){
    var cls=r.nature.indexOf('投资')>=0?'invest':(r.nature.indexOf('服务')>=0?'fee':'loan');
    var tr=el('tr','');
    tr.innerHTML='<td class="num">'+r.d+'</td><td><b>'+esc(shortName(r.from))+'</b></td><td><b>'+esc(shortName(r.to))+'</b></td>'+
      '<td class="num r" style="font-weight:700">'+yuan(r.amt)+'</td>'+
      '<td><span class="chip '+cls+'" style="cursor:default">'+esc(r.nature)+'</span></td>'+
      '<td style="color:#64748b;font-size:11.5px">'+esc(r.note||'')+'</td>';
    tb.appendChild(tr)});
  t.appendChild(tb);tc.appendChild(t);w.appendChild(tc);

  // ④ 账面（余额表往来科目） vs 银行流水
  if(D.inter.bookRows&&D.inter.bookRows.length){
    var bc=el('div','card');bc.style.marginTop='14px';
    bc.appendChild(el('h3','','账面（余额表往来科目） vs 银行流水<span class="r">账面余额为正=对方欠本公司口径见各行解读</span>'));
    var bt=el('table','t');
    bt.innerHTML='<thead><tr><th>账套公司</th><th>账期</th><th>科目</th><th>对方</th><th class="r">账面余额(元)</th><th>核对</th></tr></thead>';
    var bb=el('tbody','');
    D.inter.bookRows.forEach(function(b){
      var bal=b.credit-b.debit;
      bb.appendChild(el('tr','',
        '<td><b>'+esc(b.co)+'</b></td><td class="num">'+esc(b.period)+'</td><td>'+esc(b.subject)+'</td><td>'+esc(b.party)+'</td>'+
        '<td class="num r" style="font-weight:600">'+(bal?yuan(bal):'0')+'</td>'+
        '<td style="font-size:11.5px;color:#64748b">'+esc(b.read)+'</td>'))});
    bt.appendChild(bb);bc.appendChild(bt);w.appendChild(bc)}

  // 对账说明（源自《公司间借款往来整理》）
  if(D.inter.notes&&D.inter.notes.length){
    var nc=el('div','card');nc.style.marginTop='14px';
    nc.appendChild(el('h3','','对账结论'));
    var ol=el('ul','note-list');
    D.inter.notes.forEach(function(n){ol.appendChild(el('li','',esc(n)))});
    nc.appendChild(ol);
    w.appendChild(nc)}
  w.appendChild(el('div','foot',
    '往来口径：① 摘要「往来款」计借款；「服务费」为业务往来不计借款；「投资款」单列。② 银行流水显示借款均<b>零还款</b>（无反方向转账）。③ 核对表合计：借款 683,150（含洛克思垫付 200，其中模盾借款 556,800）＋投资款 486,000＋服务费 157,000。'));
  return p}

/* ============================================================
 * 面板 3~7：公司页
 * ============================================================ */
function panelCompany(c){
  var p=el('section','panel');p.id='p-'+c.key;
  var w=el('div','wrap');p.appendChild(w);
  w.appendChild(el('h2','pt','<span class="dot" style="background:'+c.color+'"></span>'+esc(c.name)));
  w.appendChild(el('div','psub','流水区间 <b>'+c.firstMonth+' ~ '+c.lastMonth+'</b>（'+c.firstMonth+' 为起始月）· 共 <b>'+c.nTx+'</b> 笔（收 '+c.nIn+' / 支 '+c.nOut+'）· 期初余额 0 → 期末 <b>'+yuan(c.endBal)+' 元</b>'));

  // KPI
  var kpi=el('div','kpi-row');
  [['收入',c.amtIn,'var(--in)'],['支出',c.amtOut,'var(--out)'],['净额',c.net,c.net>=0?'var(--in)':'var(--out)'],
   ['期末余额',c.endBal,''],['支出类别数',Object.keys(D.catOut[c.key]).length,'']]
  .forEach(function(k){kpi.appendChild(el('div','kpi','<div class="k">'+k[0]+'</div><div class="v num" style="color:'+(k[2]||'var(--ink)')+'">'+wan(k[1])+'</div><div class="s num">'+yuan(k[1])+' 元</div>'))});
  w.appendChild(kpi);

  var tbl=null;
  // 每月收支：通栏横向铺开
  var cM=el('div','card','<h3>每月收支<span class="r">点击月份 → 联动下方明细</span></h3>');
  w.appendChild(cM);
  groupedBars(cM,{months:D.months,width:1180,height:270,series:[
    {name:'收入',color:'#0d9488',values:D.months.map(function(m){return (D.monthly[c.key][m]||{}).in||0})},
    {name:'支出',color:'#dc2626',values:D.months.map(function(m){return (D.monthly[c.key][m]||{}).out||0})}],
    onBar:function(m){if(tbl)tbl.setFilter('m',m)}});
  var catItems=Object.keys(D.catOut[c.key]).map(function(k){return{name:k,value:D.catOut[c.key][k].amt,n:D.catOut[c.key][k].n,color:catColor(k)}});

  // 占比环形 + 收入构成 + 分类支出：一行三列
  var g3=el('div','row3');g3.style.marginTop='14px';w.appendChild(g3);
  var cD=el('div','card','<h3>支出分类占比</h3>');
  var cI=el('div','card','<h3>收入构成</h3>');
  var cH=el('div','card','<h3>分类支出（全部期间）<span class="r">点击分类 → 联动明细</span></h3>');
  g3.appendChild(cD);g3.appendChild(cI);g3.appendChild(cH);
  var dw=el('div','donut-wrap');cD.appendChild(dw);
  donut(dw,{items:catItems,centerBig:wan(c.amtOut),centerSmall:'支出合计',
    onItemClick:function(name){if(tbl)tbl.setFilter('cat',name)}});
  var inKeys=Object.keys(D.catIn[c.key]||{});
  if(inKeys.length){
    var inItems=inKeys.map(function(k){return{name:k,value:D.catIn[c.key][k],color:catColor(k)}});
    var iw=el('div','donut-wrap');cI.appendChild(iw);
    donut(iw,{items:inItems,centerBig:wan(c.amtIn),centerSmall:'收入合计'})}
  var hb=el('div','');cH.appendChild(hb);
  // ③ 报销类二级构成（可展开）
  var REIM='报销（差旅·办公·招待）';
  var subReim=null;
  if(D.catOut[c.key][REIM]){
    var SUBS=[['差旅报销',['差旅','机票','火车','住宿','高铁']],['业务招待',['招待','餐饮','餐费','宴']],
              ['停车交通',['停车','交通','打车','油费','过路']],['办公杂费报销',['办公','物料','设计','设备','团建']],['其他报销',[]]];
    subReim={};
    D.tx[c.key].forEach(function(r){
      if(r[7]!==REIM)return;
      var zy=r[5],hit='其他报销';
      for(var si=0;si<SUBS.length-1;si++){if(SUBS[si][1].some(function(k){return zy.indexOf(k)>=0})){hit=SUBS[si][0];break}}
      subReim[hit]=(subReim[hit]||0)+r[3]})}
  catItems.forEach(function(it){
    var row=el('div','hbar-row');
    var exp='';
    if(it.name===REIM&&subReim){
      exp='<span class="exp" title="展开子类" style="flex:none;cursor:pointer;color:#94a3b8;font-size:10px;width:14px;text-align:center;user-select:none">▸</span>'}
    row.innerHTML='<span class="nm" style="'+(exp?'min-width:0':'')+'">'+exp+'<span class="d" style="background:'+it.color+'"></span>'+esc(it.name)+'</span>'+
      '<span class="track"><span class="fill" style="width:'+(it.value/c.amtOut*100).toFixed(2)+'%;background:'+it.color+'"></span></span>'+
      '<span class="amt num">'+yuan(it.value)+'</span><span class="pct num">'+pct(it.value,c.amtOut)+'</span>';
    row.onclick=function(){[].forEach.call(hb.querySelectorAll('.hbar-row'),function(x){x.classList.remove('on')});row.classList.add('on');if(tbl)tbl.setFilter('cat',it.name)};
    hb.appendChild(row);
    if(exp){
      var subBox=el('div','');subBox.style.display='none';
      var subNames=Object.keys(subReim).sort(function(a,b){return subReim[b]-subReim[a]});
      subNames.forEach(function(sn){
        var sr=el('div','hbar-row');sr.style.cssText='padding-left:26px;font-size:11.5px;opacity:.92';
        sr.innerHTML='<span class="nm"><span class="d" style="background:#86efac"></span>└ '+esc(sn)+'</span>'+
          '<span class="track"><span class="fill" style="width:'+(subReim[sn]/it.value*100).toFixed(2)+'%;background:#4ade80"></span></span>'+
          '<span class="amt num">'+yuan(subReim[sn])+'</span><span class="pct num">'+pct(subReim[sn],it.value)+'</span>';
        subBox.appendChild(sr)});
      hb.appendChild(subBox);
      row.querySelector('.exp').addEventListener('click',function(e){
        e.stopPropagation();
        var open=subBox.style.display!=='none';
        subBox.style.display=open?'none':'block';
        this.textContent=open?'▸':'▾'})}});

  // 月度×分类矩阵：通栏全尺寸（不截断、无滚动条、列名完整）
  var cMM=el('div','card','<h3>月度 × 分类矩阵（万元）</h3>');
  cMM.style.marginTop='14px';
  var topCats=catItems.map(function(x){return x.name});
  var hasRest=false;
  if(topCats.length>12){hasRest=true;topCats=topCats.slice(0,11).concat(['__rest__'])}  // 其余合并列，行合计仍=支出总额
  var mt=el('table','t');mt.style.fontSize='12px';
  var th='<thead><tr><th>月份</th>'+topCats.map(function(k){return'<th class="r" title="'+esc(k)+'">'+(k==='__rest__'?'其余':esc(k))+'</th>'}).join('')+'<th class="r">合计</th></tr></thead>';
  // ⑥ 热力标尺：先算全表峰值
  var allCats=catItems.map(function(x){return x.name});
  var heatPeak=0;
  D.months.forEach(function(m){var cm=D.catMonthly[c.key][m]||{};
    topCats.forEach(function(k){heatPeak=Math.max(heatPeak,cellOf(cm,k))})});
  function cellOf(cm,k){
    if(k!=='__rest__')return cm[k]||0;
    return sum(allCats.map(function(n){return cm[n]||0}))-sum(topCats.filter(function(x){return x!=='__rest__'}).map(function(x){return cm[x]||0}))}
  var tb2='';var colSum={};
  D.months.forEach(function(m){
    var cm=D.catMonthly[c.key][m]||{};
    var rowSum=0;var tds=topCats.map(function(k){
      var v=cellOf(cm,k);rowSum+=v;colSum[k]=(colSum[k]||0)+v;
      if(v<=0)return '<td class="num r" style="color:#e2e8f0">·</td>';
      var a=(0.06+0.42*(v/heatPeak)).toFixed(2);
      return '<td class="num r" style="background:rgba(37,99,235,'+a+')">'+(v/10000).toFixed(1)+'</td>'}).join('');
    tb2+='<tr><td class="num">'+m+'</td>'+tds+'<td class="num r" style="font-weight:700">'+(rowSum>0?(rowSum/10000).toFixed(1):'·')+'</td></tr>'});
  tb2+='<tr style="border-top:2px solid #cbd5e1"><td style="font-weight:700">合计</td>'+
    topCats.map(function(k){return '<td class="num r" style="font-weight:700">'+((colSum[k]||0)/10000).toFixed(1)+'</td>'}).join('')+
    '<td class="num r" style="font-weight:800">'+(c.amtOut/10000).toFixed(1)+'</td></tr>';
  mt.innerHTML=th+'<tbody>'+tb2+'</tbody>';
  cMM.appendChild(mt);
  w.appendChild(cMM);

  // 明细表
  var cT=el('div','card');cT.style.marginTop='14px';
  cT.appendChild(el('h3','','全部流水明细（按月 / 分类 / 关键词筛选）'));
  var tm=el('div','');cT.appendChild(tm);w.appendChild(cT);
  tbl=txTable(tm,c.key);
  w.appendChild(el('div','foot',
    '注：「对方户名」为空的支出多为银行批量<b>代发工资</b>（收款人为清算户），已按「代发」交易类型归入工资薪酬；当日原路退回的付款计入「退回冲销」，不计入公司间借款。'));
  return p}

/* ============================================================
 * 导航
 * ============================================================ */
var panelsBox=$('#panels'),navBox=$('#topnav');
var defs=[{id:'p-overview',label:'总览',dot:'linear-gradient(135deg,#2563EB,#16A34A)'},
          {id:'p-inter',label:'公司款项往来',dot:'linear-gradient(135deg,#D97706,#7C3AED)'}]
  .concat(D.companies.map(function(c){return{id:'p-'+c.key,label:c.short,dot:c.color}}));
defs.forEach(function(d,i){
  var a=el('a','','<span class="dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;background:'+d.dot+';vertical-align:1px"></span>'+d.label);
  a.dataset.goto=d.id;a.href='#'+d.id;navBox.appendChild(a)});

var panelEls=[];
function build(){
  panelEls=[
    panelOverview(),
    panelInter()
  ].concat(D.companies.map(function(c){return panelCompany(c)}));
  panelEls.forEach(function(p){panelsBox.appendChild(p)})}
build();

var cur=0;
function goTo(i,hash){
  if(typeof i==='string'){i=panelEls.findIndex(function(p){return p.id===i});if(i<0)return}
  cur=Math.max(0,Math.min(panelEls.length-1,i));
  panelsBox.style.transform='translateX('+(-cur*100)+'%)';
  panelEls.forEach(function(p,idx){p.classList.toggle('cur',idx===cur)});   // 打印样式锚点
  panelEls[cur].scrollTop=0;
  [].forEach.call(navBox.children,function(a){a.classList.toggle('on',a.dataset.goto===panelEls[cur].id)});
  $('#pager').textContent=(cur+1)+' / '+panelEls.length;
  $('#navPrev').hidden=cur===0;$('#navNext').hidden=cur===panelEls.length-1;
  if(!hash)try{history.replaceState(null,'','#'+panelEls[cur].id)}catch(e){}}
window.goTo=goTo;
[].forEach.call(navBox.children,function(a){
  a.addEventListener('click',function(ev){ev.preventDefault();goTo(a.dataset.goto)})});
$('#navPrev').onclick=function(){goTo(cur-1)};
$('#navNext').onclick=function(){goTo(cur+1)};
document.addEventListener('keydown',function(e){
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;
  if(e.key==='ArrowLeft')goTo(cur-1);
  if(e.key==='ArrowRight')goTo(cur+1)});
var h=location.hash.slice(1);
goTo(panelEls.findIndex(function(p){return p.id===h})>=0?h:0,true);
}
})();
