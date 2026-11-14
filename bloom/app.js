(function(){
  var portrait = window.innerWidth / window.innerHeight < 1;
  var SET = portrait ? {dir:'frames/m/', n:153} : {dir:'frames/d/', n:180};
  var N = SET.n, imgs = new Array(N), loaded = 0, ready = false;
  var canvas = document.getElementById('scene'), ctx = canvas.getContext('2d');
  var panels = [].slice.call(document.querySelectorAll('.panel'));
  var steps = [].slice.call(document.querySelectorAll('.steps span'));
  var hint = document.getElementById('hint');
  var railFill = document.getElementById('railFill');
  var ldFill = document.getElementById('ldFill'), ldPct = document.getElementById('ldPct'), loader = document.getElementById('loader');
  document.body.classList.add('loading');
  // scroll progress -> video time (holds on each chapter)
  var MAP = [[0,0],[0.10,0.04],[0.22,0.26],[0.38,0.36],[0.48,0.55],[0.64,0.66],[0.84,0.94],[1,1]];
  function mapP(p){ for(var i=1;i<MAP.length;i++){ if(p<=MAP[i][0]){ var a=MAP[i-1],b=MAP[i],k=(p-a[0])/(b[0]-a[0]); k=k*k*(3-2*k); return a[1]+(b[1]-a[1])*k; } } return 1; }
  function pad(i){ return ('00'+(i+1)).slice(-3); }
  function done(){ if(ready) return; ready = true; loader.classList.add('done'); document.body.classList.remove('loading'); tick(); }
  for (var i=0;i<N;i++){ (function(i){ var im = new Image(); im.decoding='async';
    im.onload = im.onerror = function(){ loaded++; var pc = Math.round(loaded/N*100); ldFill.style.width = pc+'%'; ldPct.textContent = pc; if(i===0) draw(0); if(loaded===N) setTimeout(done, 250); };
    im.src = SET.dir + pad(i) + '.webp'; imgs[i] = im; })(i); }
  setTimeout(done, 15000); // safety: never block more than 15s
  var W=0,H=0;
  function resize(){ var dpr = Math.min(window.devicePixelRatio||1, 2); W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = Math.round(W*dpr); canvas.height = Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.imageSmoothingQuality='high'; lastDrawn=-1; draw(cur); }
  var lastDrawn = -1;
  function nearest(f){ for (var d=0; d<N; d++){ var a=imgs[f-d], b=imgs[f+d]; if(a&&a.complete&&a.naturalWidth) return a; if(b&&b.complete&&b.naturalWidth) return b; } return null; }
  function draw(fr){ var f = Math.max(0, Math.min(N-1, Math.round(fr))); if (f===lastDrawn) return; var im = nearest(f); if(!im) return; lastDrawn = (im===imgs[f]) ? f : -1;
    var iw = im.naturalWidth, ih = im.naturalHeight, s = Math.max(W/iw, H/ih), dw = iw*s, dh = ih*s;
    var ox = portrait ? (W-dw)/2 : (W-dw)*0.8, oy = (H-dh)/2;
    ctx.fillStyle='#EFEAE6'; ctx.fillRect(0,0,W,H); ctx.drawImage(im, ox, oy, dw, dh); }
  function progress(){ var max = document.documentElement.scrollHeight - window.innerHeight; return max>0 ? Math.min(1, Math.max(0, window.scrollY/max)) : 0; }
  var cur = 0, FADE = 0.035;
  function tick(){
    var p = progress(), target = mapP(p)*(N-1);
    cur += (target-cur)*0.14; if (Math.abs(target-cur)<0.01) cur = target;
    draw(cur);
    hint.classList.toggle('off', p>0.025);
    railFill.style.height = (p*100)+'%';
    panels.forEach(function(el){ var a=+el.dataset.in, b=+el.dataset.out, o;
      if (p < a) o = a<=0 ? 1 : Math.max(0, 1-(a-p)/FADE); else if (p > b) o = Math.max(0, 1-(p-b)/FADE); else o = 1;
      if (a<=0 && p<=b) o = 1;
      var dy = (1-o)*40*(p<a?1:-1);
      el.style.opacity = o.toFixed(3);
      el.style.setProperty('--dy', dy.toFixed(1)+'px');
      el.style.transform = el.dataset.base ? el.dataset.base.replace('DY', dy.toFixed(1)+'px') : '';
      el.style.setProperty('--hl', o>0.95 ? 1 : 0);
      el.classList.toggle('vis', o>0.01);
      el.style.pointerEvents = o>0.6 ? 'auto' : 'none'; });
    var idx = p<0.17?0:p<0.43?1:p<0.75?2:3;
    steps.forEach(function(s,i){ s.classList.toggle('on', i===idx); });
    requestAnimationFrame(tick);
  }
  panels.forEach(function(el){ el.dataset.base = portrait ? 'translateY(DY)' : 'translateY(calc(-50% + DY))'; });
  document.querySelectorAll('[data-p]').forEach(function(a){ a.addEventListener('click', function(e){ e.preventDefault(); var max = document.documentElement.scrollHeight - window.innerHeight; window.scrollTo({top: +a.dataset.p*max, behavior:'smooth'}); }); });
  window.addEventListener('resize', resize); resize();
  window.addEventListener('orientationchange', function(){ setTimeout(function(){ var pr = window.innerWidth/window.innerHeight<1; if(pr!==portrait) location.reload(); }, 300); });
})();
