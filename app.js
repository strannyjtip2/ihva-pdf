(function(){
'use strict';
var GROUPS = {
  givaudan:{title:'Завод Givaudan', order:1},
  luzi:{title:'Завод Luzi', order:2},
  other:{title:'', order:3},          // прочие заводы (Seluz и т.п.) — после Luzi
  bottles:{title:'Флаконы', order:4},
  accessories:{title:'Аксессуары', order:5},
  water:{title:'Парфюмерная вода', order:6},
  misc:{title:'Прочее', order:7}
};
function dec(s){
  s = String(s==null?'':s);
  var ta = document.createElement('textarea'); ta.innerHTML = s; s = ta.value;
  return s.replace(/\uFE0F/g,'').replace(/\u200d/g,'');
}
function num(x){ var n = parseFloat(String(x).replace(',','.').replace(/\s/g,'')); return isFinite(n)?n:0; }
function fmt(n, d){
  var r = Math.round(n*100)/100;
  var s = (d===undefined ? (r%1===0? r.toFixed(0): r.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')) : r.toFixed(d));
  var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0');
  return p.join(',');
}
function param(p, key){
  var arr = p.params || [];
  if (!Array.isArray(arr)) arr = [arr];
  for (var i=0;i<arr.length;i++){ var o = arr[i]||{}; for (var k in o){ if (k.toLowerCase()===key.toLowerCase()) return dec(o[k]); } }
  return '';
}
// ---- Классификация позиции ----
function classify(p){
  var name = dec(p.name).toLowerCase();
  var vendor = dec(p.vendor).toLowerCase();
  var folders = String(p.folders||'').split(',').map(function(s){return s.trim();});
  var factory = param(p,'Завод');
  var f = factory.toLowerCase();
  if (vendor.indexOf('парфюмерная вода')===0 || name.indexOf('парфюмерная вода')===0) return 'water';
  if (/флакон/.test(name) || folders.indexOf('387410909')>=0) return 'bottles';
  if (/картридж/.test(name) || folders.indexOf('387410709')>=0) return 'accessories';
  if (f==='givaudan') return 'givaudan';
  if (f==='luzi') return 'luzi';
  if (f && f.indexOf('ihva')<0) return 'other';
  if (f) return 'accessories';
  return 'misc';
}
function cmp(a,b){ return a.localeCompare(b,'ru',{sensitivity:'base',numeric:true}); }
function itemsOf(order){
  var list = (order.products||[]).map(function(p){
    var g = classify(p);
    var price = num(p.price), pd = (p.price_discount===undefined||p.price_discount==='')?price:num(p.price_discount), amt = num(p.amount);
    return {group:g, name:dec(p.name), vendor:dec(p.vendor), factory:param(p,'Завод'), quality:param(p,'Качество'),
            price:price, pd:pd, amount:amt, sum:pd*amt, unit:(g==='givaudan'||g==='luzi'||g==='other'||g==='water')?'г':'шт'};
  });
  list.sort(function(a,b){
    var ga=GROUPS[a.group], gb=GROUPS[b.group];
    if (ga.order!==gb.order) return ga.order-gb.order;
    if (a.group==='other' && a.factory!==b.factory) return cmp(a.factory,b.factory);
    var v = cmp(a.vendor,b.vendor); if (v) return v;
    return cmp(a.name,b.name);
  });
  return list;
}
function filterItems(list, mode){
  if (mode==='giv') return list.filter(function(i){return i.group==='givaudan';});
  if (mode==='nogiv') return list.filter(function(i){return i.group!=='givaudan';});
  return list;
}
// ---- Построение PDF ----
var TEAL='#1f6f78', GREY='#777777', LIGHT='#eef3f4';
function groupTitle(g, first){ return g.group==='other' ? 'Завод '+g.factory : GROUPS[g.group].title; }
function buildOrderContent(order, mode, items, isLast){
  var d = order.data||{}, o = d.order||{}, del = order.delivery||d.delivery||{}, ui = order.user_info||{};
  var fio = [o.familia, o.fio].filter(Boolean).join(' ') || ui.name || '';
  var phone = o.phone || ui.phone || '';
  var city = o.gorod || '';
  var addr = del.address || (del.settings && del.settings['Адрес доставки']) || '';
  var comment = dec(o.kommentarij || order.comment || '').trim();
  var num_ = order.number || order.order_id || '';
  var created = order.created ? String(order.created).slice(0,10).split('-').reverse().join('.') : '';
  var modeName = mode==='giv'?'только Givaudan':mode==='nogiv'?'всё кроме Givaudan':'всё';
  var total = items.reduce(function(s,i){return s+i.sum;},0);
  var c = [];
  c.push({columns:[
    {text:'Заказ №'+num_, style:'h1', width:'*'},
    {text:[created, created?'\n':'', {text:'Состав: '+modeName, color:GREY}], alignment:'right', fontSize:10, width:'auto'}
  ]});
  c.push({text:[fio, city?(' · '+city):'', phone?(' · '+phone):''], fontSize:11, margin:[0,2,0,10]});
  var body = [], widths=[18,'*',150,70,46,50,60];
  var headerRow = ['№','Бренд','Название','Качество','Кол-во','Цена','Сумма'].map(function(t,i){return {text:t,bold:true,fontSize:8.5,color:'#fff',fillColor:TEAL,alignment:i>=4?'right':'left',margin:[0,2,0,2]};});
  var cur=null, n=0, gsum=0, rows=[];
  function flush(){
    if(cur===null) return;
    rows.push([{text:'Итого: '+cur, colSpan:6, bold:true, alignment:'right', fontSize:9, fillColor:LIGHT},{},{},{},{},{}, {text:fmt(gsum)+' ₽', bold:true, alignment:'right', fontSize:9, fillColor:LIGHT}]);
  }
  items.forEach(function(i){
    var t = groupTitle(i);
    if (t!==cur){ flush(); cur=t; gsum=0;
      rows.push([{text:t, colSpan:7, bold:true, fontSize:11, color:TEAL, margin:[0,6,0,2], border:[false,false,false,true]},{},{},{},{},{},{}]);
    }
    n++; gsum+=i.sum;
    var priceCell = {text:fmt(i.pd)+'\u00a0₽', alignment:'right', fontSize:9};
    if (Math.abs(i.pd-i.price)>1e-9) priceCell = {alignment:'right', fontSize:9, stack:[{text:fmt(i.pd)+'\u00a0₽'},{text:fmt(i.price)+'\u00a0₽',decoration:'lineThrough',color:GREY,fontSize:7}]};
    rows.push([{text:String(n),fontSize:8.5,color:GREY},{text:i.vendor,fontSize:9},{text:i.name,fontSize:9,bold:true},{text:i.quality,fontSize:8.5,color:GREY},
      {text:fmt(i.amount)+'\u00a0'+i.unit,alignment:'right',fontSize:9},priceCell,{text:fmt(i.sum)+'\u00a0₽',alignment:'right',fontSize:9,bold:true}]);
  });
  flush();
  if (!items.length) rows.push([{text:'Нет позиций для выбранного фильтра',colSpan:7,italics:true,color:GREY},{},{},{},{},{},{}]);
  body = [headerRow].concat(rows);
  c.push({table:{headerRows:1,widths:widths,body:body,dontBreakRows:true},
    layout:{hLineWidth:function(i,node){return (i===0||i===1)?0.8:0.25;},vLineWidth:function(){return 0;},hLineColor:function(){return '#cfd8da';},paddingTop:function(){return 2;},paddingBottom:function(){return 2;}}});
  c.push({text:'ИТОГО: '+fmt(total)+' ₽', style:'total', alignment:'right', margin:[0,10,0,0]});
  // --- наклейки ---
  function sticker(label, big, extra){
    return {table:{widths:['*'],body:[[{stack:[{text:label,fontSize:9,color:GREY,margin:[0,0,0,4]}].concat(big), margin:[12,10,12,12]}]]},
      layout:{hLineWidth:function(){return 1.2;},vLineWidth:function(){return 1.2;},hLineColor:function(){return '#222';},vLineColor:function(){return '#222';}}, margin:[0,0,0,16]};
  }
  c.push({text:'', pageBreak:'before'});
  c.push(sticker('Получатель',[
    {text:fio||'—',fontSize:26,bold:true},
    {text:phone||'',fontSize:18,margin:[0,4,0,0]},
    {text:[city, (city&&addr&&addr.indexOf(city)<0)?', ':'' , (addr.indexOf(city)<0||!city)?addr:''].join('') || addr,fontSize:16,margin:[0,8,0,0]},
    ]));
  c.push(sticker('Адрес доставки',[{text:addr||'—',fontSize:22,bold:true}]));
  c.push(sticker('Способ доставки',[{text:(del.name||'—'),fontSize:26,bold:true}]));
  c.push(sticker('Сумма заказа',[{text:fmt(total)+' ₽',fontSize:40,bold:true},{text:'Заказ №'+num_+' · '+modeName+' · позиций: '+items.length,fontSize:9,color:GREY,margin:[0,4,0,0]}]));
  c.push(sticker('Комментарий',[{text:comment||'—',fontSize:18,color:comment?'#000':GREY}]));
  if(!isLast) c.push({text:'',pageBreak:'after'});
  return c;
}
function buildDoc(orders, mode){
  var content=[];
  orders.forEach(function(o,idx){
    var items = filterItems(itemsOf(o), mode);
    content = content.concat(buildOrderContent(o, mode, items, idx===orders.length-1));
  });
  return {pageSize:'A4',pageMargins:[28,30,28,30],content:content,
    defaultStyle:{font:'Roboto',fontSize:10},
    styles:{h1:{fontSize:20,bold:true,color:TEAL},total:{fontSize:16,bold:true}},
    footer:function(p,n){return {text:p+' / '+n,alignment:'center',fontSize:8,color:GREY,margin:[0,8,0,0]};}};
}
function parse(text){
  var t=text.trim(); if(!t) throw new Error('Вставьте JSON заказа.');
  var j; try{ j=JSON.parse(t);}catch(e){ throw new Error('Не получилось прочитать JSON: '+e.message); }
  var arr = Array.isArray(j)?j:(j.orders&&Array.isArray(j.orders)?j.orders:[j]);
  arr = arr.map(function(o){return (o && !o.products && o.order && o.order.products)?o.order:o;});
  arr.forEach(function(o){ if(!o||!Array.isArray(o.products)) throw new Error('В JSON нет списка products.'); });
  return arr;
}
window.IHVA = {parse:parse,buildDoc:buildDoc,itemsOf:itemsOf,filterItems:filterItems,classify:classify};
function init(){
  var ta=document.getElementById('json'), msg=document.getElementById('msg'), mode='all';
  var btns=document.querySelectorAll('.mode');
  Array.prototype.forEach.call(btns,function(b){b.addEventListener('click',function(){
    mode=b.getAttribute('data-mode'); Array.prototype.forEach.call(btns,function(x){x.classList.toggle('on',x===b);}); upd();});});
  function upd(){
    try{ var os=parse(ta.value); var it=filterItems(itemsOf(os[0]),mode);
      var s=it.reduce(function(a,i){return a+i.sum;},0);
      msg.className='info'; msg.textContent='Позиций: '+it.length+' из '+os[0].products.length+' · сумма: '+fmt(s)+' ₽';
    }catch(e){ msg.className=ta.value.trim()?'err':'info'; msg.textContent=ta.value.trim()?e.message:''; }
  }
  ta.addEventListener('input',upd);
  document.getElementById('go').addEventListener('click',function(){
    try{ var os=parse(ta.value); var doc=buildDoc(os,mode);
      var nm='order-'+(os[0].number||os[0].order_id||'')+'-'+(mode==='giv'?'givaudan':mode==='nogiv'?'bez-givaudan':'vse')+'.pdf';
      pdfMake.createPdf(doc).download(nm);
    }catch(e){ msg.className='err'; msg.textContent=e.message; }
  });
}
if (typeof document!=='undefined') document.addEventListener('DOMContentLoaded',init);
})();
