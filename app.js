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
function brandOf(p){
  var v = (p.vendor!=null && typeof p.vendor!=='object') ? dec(p.vendor) : '';
  if (!v.trim()) { var c=['brand','manufacturer','producer','vendor_name']; for (var i=0;i<c.length;i++){ if (p[c[i]]!=null && typeof p[c[i]]!=='object' && dec(p[c[i]]).trim()){ v=dec(p[c[i]]); break; } } }
  if (!v.trim()) { var k=['Бренд','Brand','Производитель','Vendor','Марка']; for (var j=0;j<k.length;j++){ var x=param(p,k[j]); if (x.trim()){ v=x; break; } } }
  return v.replace(/[\u00a0\u2000-\u200b\u202f\u3000]/g,' ').replace(/\s+/g,' ').trim();
}
// детерминированный ключ сортировки: не зависит от браузера/локали
function skey(s){
  s = String(s||'');
  try { s = s.normalize('NFKC'); } catch(e){}
  s = s.toLowerCase().replace(/ё/g,'е').replace(/[^a-z0-9\u0430-\u044f ]+/g,' ').replace(/\s+/g,' ').trim();
  // латиница раньше кириллицы, числа внутри строки сравниваем как числа
  return s.replace(/[\u0430-\u044f]/g,function(ch){ return String.fromCharCode(0x1000+ch.charCodeAt(0)); })
          .replace(/\d+/g,function(d){ return ('00000000'+d).slice(-8); });
}
function cmp(a,b){ var x=skey(a), y=skey(b); return x<y?-1:x>y?1:0; }
// ---- Классификация позиции ----
function classify(p){
  var name = dec(p.name).toLowerCase();
  var vendor = brandOf(p).toLowerCase();
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
function itemsOf(order){
  var list = (order.products||[]).map(function(p,ix){
    var g = classify(p);
    var price = num(p.price), pd = (p.price_discount===undefined||p.price_discount==='')?price:num(p.price_discount), amt = num(p.amount);
    return {idx:ix, group:g, name:dec(p.name), vendor:brandOf(p), factory:param(p,'Завод'), quality:param(p,'Качество'),
            price:price, pd:pd, amount:amt, sum:pd*amt, unit:(g==='water')?'мл':(g==='givaudan'||g==='luzi'||g==='other')?'г':'шт'};
  });
  list.sort(function(a,b){
    var ga=GROUPS[a.group], gb=GROUPS[b.group];
    if (ga.order!==gb.order) return ga.order-gb.order;
    if (a.group==='other' && a.factory!==b.factory) return cmp(a.factory,b.factory);
    var ka=a.vendor||a.name, kb=b.vendor||b.name;
    var c=cmp(ka,kb); if (c) return c;
    return cmp(a.name,b.name) || (a.idx-b.idx);
  });
  return list;
}
function filterItems(list, mode){
  if (mode==='giv') return list.filter(function(i){return i.group==='givaudan';});
  if (mode==='nogiv') return list.filter(function(i){return i.group!=='givaudan';});
  return list;
}
// ---- Построение PDF: термоэтикетки 58x40 мм, одна позиция = одна этикетка ----
var PW=164.4094, PH=113.3858, MX=8.5039, TW=144;
var MEAS={};
function loadFonts(){
  if (MEAS.ready) return MEAS.ready;
  function ab(b64){ var bin=atob(b64), u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i); return u.buffer; }
  var R=new FontFace('NSReg', ab(pdfMake.vfs['NotoSans-Regular.ttf'])), B=new FontFace('NSBold', ab(pdfMake.vfs['NotoSans-Bold.ttf']));
  MEAS.ready = Promise.all([R.load(),B.load()]).then(function(){ document.fonts.add(R); document.fonts.add(B);
    MEAS.ctx = document.createElement('canvas').getContext('2d'); });
  return MEAS.ready;
}
function tw(text, size, bold){
  var c=MEAS.ctx; c.font=(bold?'':'')+'200px '+(bold?'NSBold':'NSReg');
  return c.measureText(text).width*size/200;
}
function wrap(text, size, bold, width){
  var out=[];
  String(text).split(/\n/).forEach(function(par){
    var words=par.split(/\s+/).filter(Boolean), line='';
    words.forEach(function(w){
      var t=line?line+' '+w:w;
      if (!line || tw(t,size,bold)<=width) line=t; else { out.push(line); line=w; }
    });
    out.push(line);
  });
  return out;
}
// baseline (pt от верха) -> y верха строки для pdfmake (calibrated: ascent = ASC*size)
var ASC=1.069;
function put(page, text, size, bold, baseline){
  if(text==='') return;
  page.push({text:text, font:bold?'NotoSans-Bold':'NotoSans', bold:false, fontSize:size, lineHeight:1,
    absolutePosition:{x:MX, y:baseline-ASC*size}, noWrap:true});
}
function blockLines(page, text, size, bold, y0, pitch){
  var ls=wrap(text,size,bold,TW), y=y0;
  ls.forEach(function(l,i){ put(page,l,size,bold,y); y+=pitch; });
  return y0+pitch*(ls.length-1);   // baseline последней строки
}
function isPerfume(g){ return g==='givaudan'||g==='luzi'||g==='other'; }
function itemLabel(it){
  var p=[];
  var last=blockLines(p, it.name, 11, true, 20.4, 13.4);
  if (isPerfume(it.group)){
    blockLines(p, it.vendor, 10, false, last+10.4, 12);
    put(p, it.factory, 10, true, 70.9);
    put(p, it.quality, 9, false, 83.6);
  }
  put(p, fmt(it.amount)+' '+it.unit, 12, true, 96.4);
  return p;
}
function orderLabel(order, total){
  var d=order.data||{}, o=d.order||{}, del=order.delivery||d.delivery||{}, ui=order.user_info||{};
  var fio=[o.fio,o.familia].filter(Boolean).join(' ')||ui.name||'';
  var phone=String(o.phone||ui.phone||'').trim(); if(/^\d/.test(phone)) phone='+'+phone;
  var email=o.email||ui.email||'', city=o.gorod||'';
  var link=o.predpocitaemyj_vami_sposob_svazi_2||'';
  var addr=del.address||(del.settings&&del.settings['Адрес доставки'])||'';
  var title='ihva-'+(order.number||order.order_id||'');
  var totalStr=fmt(total)+'\u00a0₽';
  var fields=[];
  if(fio) fields.push({t:fio, bold:true});
  if(phone) fields.push({t:phone, bold:false});
  if(email) fields.push({t:email, bold:false});
  if(city) fields.push({t:city, bold:false});
  if(link) fields.push({t:'Связь: '+link, bold:false});
  if(del.name) fields.push({t:'Доставка: '+del.name, bold:true});
  if(addr) fields.push({t:'Адрес: '+addr, bold:false});

  // body was 8pt → 6pt (−2); title 10→8; total 9→8. Auto-shrink if still too tall.
  var preferTotalY=104.9, maxTotalY=PH-5;
  var chosen=null;
  for (var bodySize=6; bodySize>=4; bodySize-=0.5){
    var titleSize=Math.max(6, bodySize+2);
    var totalSize=Math.max(6, bodySize+1.5);
    var pitch=bodySize+1;
    var rows=[];
    fields.forEach(function(f){
      wrap(f.t, bodySize, !!f.bold, TW).forEach(function(l){ rows.push({text:l, bold:!!f.bold}); });
    });
    var yTitle=14+titleSize*0.7;
    var yStart=yTitle+(titleSize+1.2);
    var contentLast=rows.length? yStart+pitch*(rows.length-1) : yTitle;
    var minTotalY=contentLast+Math.max(pitch, totalSize+1);
    var totalY=Math.max(minTotalY, preferTotalY);
    if (totalY>maxTotalY){
      if (minTotalY>maxTotalY) continue; // shrink further
      totalY=maxTotalY;
      if (minTotalY>totalY) continue;
    }
    chosen={rows:rows, yTitle:yTitle, yStart:yStart, pitch:pitch, totalY:totalY,
            titleSize:titleSize, bodySize:bodySize, totalSize:totalSize};
    break;
  }
  if(!chosen){
    // last resort: squeeze with min sizes, clamp total to bottom
    var bodySize=4, titleSize=6, totalSize=6, pitch=5;
    var rows=[];
    fields.forEach(function(f){
      wrap(f.t, bodySize, !!f.bold, TW).forEach(function(l){ rows.push({text:l, bold:!!f.bold}); });
    });
    var yTitle=12+titleSize*0.7, yStart=yTitle+(titleSize+1);
    chosen={rows:rows, yTitle:yTitle, yStart:yStart, pitch:pitch, totalY:maxTotalY,
            titleSize:titleSize, bodySize:bodySize, totalSize:totalSize};
  }
  var p=[];
  put(p, title, chosen.titleSize, true, chosen.yTitle);
  chosen.rows.forEach(function(r,i){ put(p, r.text, chosen.bodySize, r.bold, chosen.yStart+i*chosen.pitch); });
  put(p, totalStr, chosen.totalSize, true, chosen.totalY);
  return p;
}
function commentLabel(text){
  var p=[]; put(p,'Комментарий',12,true,21.4);
  blockLines(p,text,7,false,37.4,8.6);
  return p;
}
function buildDoc(orders, mode){
  var pages=[];
  orders.forEach(function(o){
    var items=filterItems(itemsOf(o),mode), total=items.reduce(function(s,i){return s+i.sum;},0);
    items.forEach(function(it){ pages.push(itemLabel(it)); });
    pages.push(orderLabel(o,total));
    var cm=dec((o.data&&o.data.order&&o.data.order.kommentarij)||o.comment||'').trim();
    if(cm) pages.push(commentLabel(cm));
  });
  var content=[];
  pages.forEach(function(p,i){ content.push({text:'',fontSize:1,pageBreak:i?'before':undefined}); content=content.concat(p); });
  return {pageSize:{width:PW,height:PH},pageMargins:[0,0,0,0],content:content,
    defaultStyle:{font:'NotoSans',fontSize:10}, info:{title:'Этикетки заказа'}};
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
    loadFonts().then(function(){ var os=parse(ta.value); var doc=buildDoc(os,mode);
      var nm='ihva-'+(os[0].number||os[0].order_id||'order')+'.pdf';
      pdfMake.createPdf(doc).download(nm);
    }).catch(function(e){ msg.className='err'; msg.textContent=e.message; });
  });
}
if (typeof document!=='undefined') document.addEventListener('DOMContentLoaded',init);
})();
