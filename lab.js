/* Keyse Adam – Lab: interaktive Live-Demos (Vanilla JS, kein Backend) */
(function(){
'use strict';
var RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var INK='#111',PAPER='#f3f1ec',RED='#d52b1e',GREEN='#2fbf66',AMBER='#f5b83d',MUTE='#8b8983',LINE='#d6d2c9';
function $(s,r){return (r||document).querySelector(s)}
function rnd(a,b){return a+Math.random()*(b-a)}
function now(){return performance.now()}
function pad(n){return (n<10?'0':'')+n}
function clock(){var d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())}

/* Canvas mit DPR + Sichtbarkeits-Loop */
function Stage(canvas,draw){
  var ctx=canvas.getContext('2d'),st={w:0,h:0,vis:false,raf:0,last:0,ctx:ctx,canvas:canvas};
  function size(){var r=canvas.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);st.w=r.width;st.h=r.height;canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);if(st.onResize)st.onResize()}
  function frame(t){var dt=Math.min(0.05,(t-(st.last||t))/1000);st.last=t;draw(dt,t);if(st.vis&&!RM)st.raf=requestAnimationFrame(frame)}
  st.start=function(){if(st.raf)cancelAnimationFrame(st.raf);st.last=0;st.raf=requestAnimationFrame(frame)};
  st.size=size;
  if('ResizeObserver' in window)new ResizeObserver(size).observe(canvas);else window.addEventListener('resize',size);
  size();
  if('IntersectionObserver' in window)new IntersectionObserver(function(e){st.vis=e[0].isIntersecting;if(st.vis)st.start();else cancelAnimationFrame(st.raf),st.raf=0},{rootMargin:'100px'}).observe(canvas);
  else{st.vis=true;st.start()}
  return st;
}
function whenVisible(el,fn){if(!('IntersectionObserver' in window))return fn();var io=new IntersectionObserver(function(e){if(e[0].isIntersecting){io.disconnect();fn()}},{threshold:.35});io.observe(el)}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}

/* 1 ─ Cluster mit Load-Balancing und Auto-Failover */
function cluster(root){
  var cv=$('canvas',root),stats=$('.lab-stats',root),btn=$('[data-act=fail]',root),log=$('.lab-log',root);
  var nodes=[0,1,2,3].map(function(i){return{name:'node-'+(i+1),state:'ok',load:0,t:0,served:0}});
  var pk=[],acc=0,rps=0,served=0,lastS=0,lat=38;
  function L(msg,cls){var li=document.createElement('li');li.innerHTML='<span>'+clock()+'</span> '+msg;if(cls)li.className=cls;log.prepend(li);while(log.children.length>4)log.lastChild.remove()}
  function pick(){var best=null;nodes.forEach(function(n){if(n.state==='ok'&&(!best||n.load<best.load))best=n});return best}
  btn.addEventListener('click',function(){
    var cand=nodes.filter(function(n){return n.state==='ok'});if(cand.length<2)return;
    var n=cand[Math.floor(Math.random()*cand.length)];n.state='down';n.t=0;
    L(n.name+' antwortet nicht – Health-Check fehlgeschlagen','bad');
    setTimeout(function(){L('Traffic umgeleitet auf '+nodes.filter(function(x){return x.state==='ok'}).length+' gesunde Nodes')},500);
    setTimeout(function(){n.state='boot';L('Auto-Failover: neue Instanz '+n.name+' startet')},2600);
    setTimeout(function(){n.state='ok';L(n.name+' wieder gesund – zurück im Pool','good')},5600);
  });
  L('Cluster bereit · Least-Connections-Balancing');
  var S=Stage(cv,function(dt){
    var c=S.ctx,w=S.w,h=S.h,lbx=w*0.36,lby=h/2,nx=w*0.8;
    acc+=dt*(14+6*Math.sin(now()/1800));
    while(acc>1){acc--;pk.push({ph:0,y0:rnd(0.12,0.88)*h,p:0,node:null,sp:rnd(.9,1.3)})}
    c.clearRect(0,0,w,h);
    var nh=Math.min(54,(h-40)/4-10),ny=function(i){return h/2+(i-1.5)*(nh+12)};
    /* Linien */
    c.strokeStyle=LINE;c.lineWidth=1;
    nodes.forEach(function(n,i){c.beginPath();c.moveTo(lbx,lby);c.lineTo(nx-8,ny(i));c.stroke()});
    /* Pakete */
    for(var i=pk.length-1;i>=0;i--){var p=pk[i];p.p+=dt*p.sp*1.6;
      var x,y;
      if(p.ph===0){x=p.p*lbx;y=p.y0+(lby-p.y0)*p.p;if(p.p>=1){p.ph=1;p.p=0;p.node=pick();if(!p.node){pk.splice(i,1);continue}p.node.load++}}
      else{var ni=nodes.indexOf(p.node);if(p.node.state!=='ok'){p.node.load--;p.node=pick();if(!p.node){pk.splice(i,1);continue}p.node.load++;p.p=0;ni=nodes.indexOf(p.node)}
        x=lbx+(nx-8-lbx)*p.p;y=lby+(ny(ni)-lby)*p.p;
        if(p.p>=1){p.node.load--;p.node.served++;served++;pk.splice(i,1);continue}}
      c.fillStyle=p.ph?INK:MUTE;c.fillRect(x-2.5,y-2.5,5,5)}
    /* Load Balancer */
    c.fillStyle=INK;rr(c,lbx-34,lby-22,68,44,6);c.fill();c.fillStyle='#fff';c.font='600 11px Inter,sans-serif';c.textAlign='center';c.fillText('LOAD',lbx,lby-3);c.fillText('BALANCER',lbx,lby+11);
    /* Nodes */
    nodes.forEach(function(n,i){var y=ny(i)-nh/2,x=nx-8,ww=Math.min(w*0.2+8,w-x-4);
      c.fillStyle=n.state==='down'?'#fbe4e1':n.state==='boot'?'#fdf3dc':'#fff';rr(c,x,y,ww,nh,5);c.fill();
      c.strokeStyle=n.state==='down'?RED:n.state==='boot'?AMBER:LINE;c.lineWidth=n.state==='ok'?1:1.5;c.stroke();
      c.fillStyle=n.state==='down'?RED:n.state==='boot'?AMBER:GREEN;c.beginPath();c.arc(x+12,y+14,4,0,7);c.fill();
      c.fillStyle=INK;c.textAlign='left';c.font='600 11px Inter,sans-serif';c.fillText(n.name,x+22,y+18);
      var lv=n.state==='ok'?Math.min(1,n.load/9):0;c.fillStyle='#ebe8e1';c.fillRect(x+10,y+nh-16,ww-20,6);c.fillStyle=lv>.75?AMBER:INK;c.fillRect(x+10,y+nh-16,(ww-20)*lv,6);
      if(n.state!=='ok'){c.fillStyle=n.state==='down'?RED:'#9a6b00';c.font='600 10px Inter,sans-serif';c.fillText(n.state==='down'?'OFFLINE':'STARTET …',x+22,y+nh-22+ (nh<44?6:0))}
    });
    c.fillStyle=MUTE;c.font='500 10px Inter,sans-serif';c.textAlign='left';c.fillText('CLIENTS',4,14);
    if(now()-lastS>700){var ok=nodes.filter(function(n){return n.state==='ok'}).length;rps=Math.round(served/((now()-lastS)/1000));served=0;lastS=now();lat=Math.round(32+ (4-ok)*14+rnd(-4,4));
      stats.innerHTML='<b>'+rps+'</b> req/s<b>'+lat+' ms</b> Latenz<b class="'+(ok<4?'warn':'')+'">'+ok+'/4</b> Nodes gesund'}
  });
}

/* 2 ─ Privater KI-Assistent (Retrieval im Browser, mit Quellenangabe) */
function assistant(root){
  var docs=[
    ['Personalreglement','Mitarbeitende haben Anspruch auf 25 Ferientage pro Jahr. Ferienwünsche für das Folgejahr werden bis Ende Januar im Portal eingetragen. Überstunden werden im Folgemonat kompensiert oder auf Wunsch ausbezahlt.'],
    ['Lieferbedingungen','Die Lieferfrist für Küchen beträgt in der Regel sechs bis acht Wochen ab Planfreigabe. Montage und Entsorgung des Altmaterials sind im Angebot separat ausgewiesen.'],
    ['Garantie','Auf Möbel aus eigener Produktion gewähren wir fünf Jahre Garantie. Für Beschläge und Elektrogeräte gelten die Garantien der Hersteller.'],
    ['Spesenweisung','Spesen werden monatlich abgerechnet. Belege fotografieren Sie im Mitarbeiterportal und laden sie bis zum Fünften des Folgemonats hoch.'],
    ['Werkstatt','Die CNC-Fräse wird jeden Freitag ab 15 Uhr gewartet. Bei Störungen informieren Sie sofort die Werkstattleitung und dokumentieren den Fehlercode im Störungsjournal.'],
    ['Ausstellung','Die Ausstellung ist Montag bis Freitag von 8 bis 12 und 13.30 bis 17.30 Uhr geöffnet, am Samstag von 9 bis 12 Uhr. Beratungen ausserhalb dieser Zeiten nach Vereinbarung.']
  ];
  var syn={urlaub:'ferien',ferie:'ferien',freitage:'ferien',lieferzeit:'lieferfrist',dauert:'lieferfrist',lange:'lieferfrist',wann:'',offen:'geöffnet',öffnungszeit:'geöffnet',öffnungszeiten:'geöffnet',offnungszeiten:'geöffnet',gewährleistung:'garantie',kaputt:'störungen',defekt:'störungen',fräse:'cnc',maschine:'cnc',quittung:'belege',quittungen:'belege',beleg:'belege',spese:'spesen',küche:'küchen',kuche:'küchen',samstags:'samstag',überzeit:'überstunden'};
  var stop='der die das und oder ist sind wie wir ich sie es ein eine einen mit für von im in am an zu auf bei wird werden haben hat was wo wer wie viel viele gibt kann können man den dem des nach ab bis'.split(' ');
  function norm(w){w=w.toLowerCase().replace(/[^a-zäöüß0-9-]/g,'');if(syn[w]!==undefined)w=syn[w];if(!w||stop.indexOf(w)>=0)return '';if(w.length>5)w=w.replace(/(en|er|e|n|s)$/,'');return w}
  var sents=[];docs.forEach(function(d){d[1].split(/\.\s+/).forEach(function(s){if(!/\.$/.test(s))s+='.';sents.push({doc:d[0],s:s,t:s.split(/\s+/).map(norm).filter(Boolean)})})});
  var box=$('.chat',root),form=$('form',root),inp=$('input',root);
  function add(cls,html){var d=document.createElement('div');d.className='msg '+cls;d.innerHTML=html;box.appendChild(d);box.scrollTop=box.scrollHeight;return d}
  function ask(q){
    if(!q.trim())return;add('me',q.replace(/</g,'&lt;'));
    var qt=q.split(/\s+/).map(norm).filter(Boolean);
    var t=add('bot typing','<i></i><i></i><i></i><small>durchsucht '+docs.length+' Dokumente …</small>');
    var scored=sents.map(function(s){var sc=0;qt.forEach(function(w){s.t.forEach(function(x){if(x===w)sc+=2;else if(w.length>3&&(x.indexOf(w)===0||w.indexOf(x)===0)&&x.length>3)sc+=1})});return{s:s,sc:sc}}).filter(function(x){return x.sc>0}).sort(function(a,b){return b.sc-a.sc});
    setTimeout(function(){t.remove();
      if(!scored.length){add('bot','Dazu finde ich nichts in den freigegebenen Dokumenten. Ich erfinde keine Antwort – fragen Sie z. B. nach Ferien, Lieferfrist, Garantie, Spesen oder Öffnungszeiten.');return}
      var top=scored.slice(0,scored.length>1&&scored[1].sc>=scored[0].sc-1&&scored[1].s.doc===scored[0].s.doc?2:1);
      add('bot',top.map(function(x){return x.s.s}).join(' ')+'<span class="src">Quelle: '+top[0].s.doc+'.pdf · Relevanz '+Math.min(99,60+scored[0].sc*8)+'%</span>');
    },RM?100:750);
  }
  form.addEventListener('submit',function(e){e.preventDefault();ask(inp.value);inp.value=''});
  root.querySelectorAll('[data-q]').forEach(function(b){b.addEventListener('click',function(){ask(b.getAttribute('data-q'))})});
  add('bot','Grüezi! Ich beantworte Fragen zu den internen Dokumenten der <b>Muster Schreinerei</b> (Beispieldaten) – mit Quelle, ohne Cloud.');
}

/* 3 ─ Beleg-Automation: Eingang → Texterkennung → Felder → Prüfung → Buchung */
function invoices(root){
  var samples=[
    {lf:'Holzhandel Beispiel GmbH',nr:'RE-2026-0418',dt:'02.10.2026',pos:[['Eichenplatten 40 mm',812.00],['Leim, 10 kg',96.40],['Lieferung',85.00]],kto:'4000 Materialaufwand'},
    {lf:'Werkzeug Muster AG',nr:'71-55821',dt:'05.10.2026',pos:[['Fräser-Set HM',349.00],['Schleifpapier K120',64.80]],kto:'4400 Werkzeuge'},
    {lf:'Energie Rheintal Beispiel',nr:'E-20260930',dt:'30.09.2026',pos:[['Strom Werkstatt, Sept.',1184.25]],kto:'6400 Energie'}
  ],k=0,busy=false;
  var doc=$('.inv-doc',root),fields=$('.inv-fields',root),steps=[].slice.call(root.querySelectorAll('.inv-steps li')),btn=$('[data-act=run]',root);
  function f2(n){return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,"'")}
  function render(s){var sub=s.pos.reduce(function(a,p){return a+p[1]},0);s.sub=sub;s.mw=Math.round(sub*8.1)/100;s.tot=sub+s.mw;
    doc.innerHTML='<div class="inv-h"><b>'+s.lf+'</b><span>Rechnung '+s.nr+'<br>'+s.dt+'</span></div>'+s.pos.map(function(p){return '<div class="inv-r"><span>'+p[0]+'</span><span>'+f2(p[1])+'</span></div>'}).join('')+'<div class="inv-r"><span>MWST 8.1 %</span><span>'+f2(s.mw)+'</span></div><div class="inv-r tot"><span>Total</span><span>'+f2(s.tot)+'</span></div><i class="scan"></i>';
    fields.innerHTML=['Lieferant','Rechnungs-Nr.','Datum','Netto','MWST','Total','Konto'].map(function(l){return '<div><dt>'+l+'</dt><dd>–</dd></div>'}).join('');
    steps.forEach(function(li){li.className=''});root.classList.remove('booked')}
  function run(){if(busy)return;busy=true;var s=samples[k];render(s);var dd=fields.querySelectorAll('dd'),vals=[s.lf,s.nr,s.dt,f2(s.sub),f2(s.mw),f2(s.tot),s.kto],T=RM?60:1;
    function step(i,ms){setTimeout(function(){steps.forEach(function(li,j){li.className=j<i?'done':j===i?'on':''})},ms*T)}
    step(0,0);step(1,600);setTimeout(function(){doc.classList.add('scanning')},600*T);
    vals.forEach(function(v,i){setTimeout(function(){dd[i].textContent=v;dd[i].className='hit'},(1500+i*230)*T)});
    step(2,1500);setTimeout(function(){doc.classList.remove('scanning')},2300*T);
    step(3,3300);step(4,4300);
    setTimeout(function(){steps.forEach(function(li){li.className='done'});root.classList.add('booked');busy=false;k=(k+1)%samples.length;btn.textContent='Nächsten Beleg verarbeiten'},4900*T);
  }
  render(samples[0]);btn.addEventListener('click',run);whenVisible(root,function(){setTimeout(run,500)});
}

/* 4 ─ Disposition: Routenoptimierung (Nearest Neighbour + 2-opt, animiert) */
function routes(root){
  var cv=$('canvas',root),out=$('.lab-stats',root),pts=[],route=[],phase='idle',start=0,van=0,best=0,swaps=0,iter=0;
  function gen(){pts=[{x:.5,y:.52,d:1}];for(var i=0;i<16;i++)pts.push({x:rnd(.06,.94),y:rnd(.1,.9)});route=pts.map(function(_,i){return i});for(var j=route.length-1;j>1;j--){var r=1+Math.floor(Math.random()*j);var t=route[j];route[j]=route[r];route[r]=t}phase='idle';van=0;start=len(route);show()}
  function dist(a,b){var w=S?S.w:600,h=S?S.h:300,dx=(pts[a].x-pts[b].x)*w,dy=(pts[a].y-pts[b].y)*h;return Math.sqrt(dx*dx+dy*dy)}
  function len(r){var s=0;for(var i=0;i<r.length;i++)s+=dist(r[i],r[(i+1)%r.length]);return s}
  function km(v){return (v/ (S?S.w:600)*38).toFixed(1)}
  function show(){var cur=len(route);out.innerHTML='<b>'+km(start)+' km</b> Start<b>'+km(cur)+' km</b> aktuell<b class="'+(cur<start-1?'good':'')+'">'+(start?Math.max(0,Math.round((1-cur/start)*100)):0)+' %</b> kürzer'}
  function nn(){var left=route.slice(1),r=[0];while(left.length){var l=r[r.length-1],bi=0,bd=1e9;left.forEach(function(p,i){var d=dist(l,p);if(d<bd){bd=d;bi=i}});r.push(left.splice(bi,1)[0])}route=r}
  function twoOptPass(){for(var i=1;i<route.length-1;i++)for(var j=i+1;j<route.length;j++){var a=route[i-1],b=route[i],c=route[j],d=route[(j+1)%route.length];if(dist(a,c)+dist(b,d)<dist(a,b)+dist(c,d)-0.01){var seg=route.slice(i,j+1).reverse();route.splice.apply(route,[i,seg.length].concat(seg));return true}}return false}
  $('[data-act=opt]',root).addEventListener('click',function(){if(phase!=='idle'&&phase!=='drive')return;nn();show();phase='opt';iter=0});
  $('[data-act=new]',root).addEventListener('click',gen);
  var S=Stage(cv,function(dt){var c=S.ctx,w=S.w,h=S.h;
    if(phase==='opt'){iter+=dt;if(iter>.12){iter=0;if(!twoOptPass()){phase='drive';van=0}show()}}
    if(phase==='drive')van=(van+dt*0.08)%1;
    c.clearRect(0,0,w,h);c.strokeStyle='#e4e0d8';c.lineWidth=1;for(var gx=0;gx<w;gx+=28){c.beginPath();c.moveTo(gx,0);c.lineTo(gx,h);c.stroke()}for(var gy=0;gy<h;gy+=28){c.beginPath();c.moveTo(0,gy);c.lineTo(w,gy);c.stroke()}
    c.strokeStyle=phase==='idle'?'#b9b3a8':INK;c.lineWidth=phase==='idle'?1.2:2;c.setLineDash(phase==='idle'?[4,4]:[]);c.beginPath();route.forEach(function(p,i){var q=pts[p];i?c.lineTo(q.x*w,q.y*h):c.moveTo(q.x*w,q.y*h)});c.closePath();c.stroke();c.setLineDash([]);
    pts.forEach(function(p,i){if(p.d){c.fillStyle=RED;c.fillRect(p.x*w-7,p.y*h-7,14,14);c.fillStyle=INK;c.font='600 10px Inter,sans-serif';c.textAlign='center';c.fillText('DEPOT',p.x*w,p.y*h-12)}else{c.fillStyle='#fff';c.strokeStyle=INK;c.lineWidth=1.5;c.beginPath();c.arc(p.x*w,p.y*h,5,0,7);c.fill();c.stroke()}});
    if(phase==='drive'){var total=len(route),tgt=van*total,acc=0;for(var i=0;i<route.length;i++){var a=pts[route[i]],b=pts[route[(i+1)%route.length]],d=dist(route[i],route[(i+1)%route.length]);if(acc+d>=tgt){var f=(tgt-acc)/d;var x=(a.x+(b.x-a.x)*f)*w,y=(a.y+(b.y-a.y)*f)*h;c.fillStyle=RED;c.beginPath();c.arc(x,y,6,0,7);c.fill();c.strokeStyle='rgba(213,43,30,.25)';c.lineWidth=6;c.beginPath();c.arc(x,y,11,0,7);c.stroke();break}acc+=d}}
  });
  S.onResize=function(){if(pts.length)show()};
  gen();
}

/* 5 ─ Telefon-Agent: Anruf, Intent-Erkennung, Termin gebucht */
function voice(root){
  var cv=$('canvas',root),tr=$('.vc-tr',root),tags=$('.vc-tags',root),cal=$('.vc-cal',root),btn=$('[data-act=call]',root),speaker=0,amp=0,busy=false,timers=[];
  var script=[[1,'Grüezi, Sie sind mit dem digitalen Assistenten der Muster Garage verbunden. Wie kann ich helfen?'],[2,'Ich bräuchte einen Termin für den Reifenwechsel.',['Intent: Termin','Service: Reifenwechsel']],[1,'Gerne. Ich habe Dienstag um 8.30 Uhr oder Mittwoch um 14 Uhr frei.',['Kalender: 2 freie Slots']],[2,'Mittwoch passt mir.',['Slot: Mi 14:00']],[1,'Erledigt: Mittwoch, 14 Uhr, Reifenwechsel. Sie erhalten gleich eine SMS-Bestätigung.',['Gebucht ✓','SMS gesendet ✓']]];
  function reset(){timers.forEach(clearTimeout);timers=[];tr.innerHTML='';tags.innerHTML='';cal.classList.remove('booked');speaker=0}
  function play(){if(busy)return;busy=true;reset();btn.textContent='Anruf läuft …';var t=300;
    script.forEach(function(l){timers.push(setTimeout(function(){speaker=l[0];var p=document.createElement('p');p.className=l[0]===1?'ag':'cu';p.innerHTML='<b>'+(l[0]===1?'Agent':'Anrufer')+'</b>'+l[1];tr.appendChild(p);tr.scrollTop=tr.scrollHeight;(l[2]||[]).forEach(function(x){var s=document.createElement('span');s.textContent=x;tags.appendChild(s)});if(/Erledigt/.test(l[1]))cal.classList.add('booked')},RM?50:t));t+=RM?50:Math.max(1500,l[1].length*42)});
    timers.push(setTimeout(function(){speaker=0;busy=false;btn.textContent='Nochmals anrufen'},RM?400:t))}
  btn.addEventListener('click',play);whenVisible(root,function(){setTimeout(play,400)});
  var S=Stage(cv,function(dt,tm){var c=S.ctx,w=S.w,h=S.h;amp+=((speaker?1:0.06)-amp)*Math.min(1,dt*6);c.clearRect(0,0,w,h);
    var n=Math.floor(w/6),col=speaker===2?INK:speaker===1?RED:'#b9b3a8';c.fillStyle=col;
    for(var i=0;i<n;i++){var x=i*6+2,e=Math.sin(i*.35+tm/140)*.5+Math.sin(i*.9-tm/90)*.35+Math.sin(i*.13+tm/400)*.4;var bh=Math.max(2,Math.abs(e)*amp*(h*.8)*(0.6+0.4*Math.sin(i/n*Math.PI)));c.fillRect(x,h/2-bh/2,3,bh)}});
}

/* 6 ─ Security & Backup: blockierte Angriffe, Backups, Log */
function security(root){
  var cv=$('canvas',root),log=$('.lab-log',root),cnt=$('.sec-n',root),bars=[].slice.call(root.querySelectorAll('.bk i')),n=0,arcs=[],dots=[],acc=0,burst=0;
  var kinds=['SSH Brute-Force','Port-Scan','WordPress-Login','SQL-Injection','Bot-Traffic'],tools=['fail2ban','Firewall','WAF','Rate-Limit'];
  for(var i=0;i<160;i++)dots.push({x:Math.random(),y:Math.random()});
  function L(t){var li=document.createElement('li');li.innerHTML='<span>'+clock()+'</span> '+t;log.prepend(li);while(log.children.length>4)log.lastChild.remove()}
  $('[data-act=attack]',root).addEventListener('click',function(){burst=24;L('<b>Angriffswelle erkannt</b> – Regeln verschärft')});
  var bp=[.2,.55,.85];
  var S=Stage(cv,function(dt){var c=S.ctx,w=S.w,h=S.h,cx=w*.5,cy=h*.55;
    acc+=dt*(burst>0?14:1.6);while(acc>1){acc--;if(burst>0)burst--;var d,tries=0;do{d=dots[Math.floor(Math.random()*dots.length)];tries++}while(Math.hypot(d.x*w-cx,d.y*h-cy)<Math.min(w,h)*.3&&tries<20);arcs.push({x:d.x*w,y:d.y*h,p:0,sp:rnd(.6,1.1)})}
    c.clearRect(0,0,w,h);c.fillStyle='#d9d4ca';dots.forEach(function(d){c.fillRect(d.x*w,d.y*h,2,2)});
    for(var i=arcs.length-1;i>=0;i--){var A=arcs[i];A.p+=dt*A.sp;var mx=(A.x+cx)/2,my=Math.min(A.y,cy)-Math.min(60,h*.2);var t=Math.min(A.p,1),x=(1-t)*(1-t)*A.x+2*(1-t)*t*mx+t*t*cx,y=(1-t)*(1-t)*A.y+2*(1-t)*t*my+t*t*cy;
      c.strokeStyle='rgba(213,43,30,'+(0.5*(1-Math.max(0,A.p-1)*2))+')';c.lineWidth=1.2;c.beginPath();c.moveTo(A.x,A.y);c.quadraticCurveTo(mx,my,x,y);c.stroke();c.fillStyle=RED;c.fillRect(A.x-2,A.y-2,4,4);if(A.p<1){c.beginPath();c.arc(x,y,2.6,0,7);c.fill()}else{c.strokeStyle='rgba(213,43,30,'+Math.max(0,.8-(A.p-1)*1.6)+')';c.beginPath();c.arc(cx,cy,30+(A.p-1)*30,0,7);c.stroke()}
      if(A.p>=1&&!A.hit){A.hit=1;n++;cnt.textContent=n;if(Math.random()<.35||burst>0&&Math.random()<.2)L(kinds[Math.floor(Math.random()*kinds.length)]+' von 203.0.113.'+Math.floor(rnd(2,250))+' → <b>blockiert</b> ('+tools[Math.floor(Math.random()*tools.length)]+')')}
      if(A.p>1.5)arcs.splice(i,1)}
    var pr=Math.sin(Date.now()/300)*3;c.strokeStyle='rgba(47,191,102,.45)';c.lineWidth=2;c.beginPath();c.arc(cx,cy,34+pr,0,7);c.stroke();
    c.fillStyle=INK;rr(c,cx-20,cy-24,40,48,5);c.fill();c.fillStyle=GREEN;for(var k=0;k<3;k++){c.fillRect(cx-12,cy-15+k*13,5,5)}c.fillStyle='#555';for(k=0;k<3;k++)c.fillRect(cx-3,cy-14+k*13,15,3);
    bp=bp.map(function(v,i){v+=dt*(0.04+i*0.015);return v>1.15?0:v});bars.forEach(function(b,i){b.style.transform='scaleX('+Math.min(1,bp[i])+')';b.parentNode.classList.toggle('ok',bp[i]>=1)})});
  L('Überwachung aktiv · Firewall, fail2ban, WAF');
}

/* 0 ─ Webseite entsteht live: Code links, Ergebnis rechts */
function sitebuild(root){
  var code=$('.sb-code',root),view=$('.sb-view',root),btn=$('[data-act=build]',root),timer=0,run=0;
  var steps=[
    ['<header class="nav">','',function(){return '<div class="p-nav"><b>Bäckerei Muster</b><span>Sortiment</span><span>Kontakt</span></div>'}],
    ['  <h1>Frisch aus dem Ofen.</h1>','',function(){return '<h4 class="p-h1">Frisch aus dem Ofen.</h4>'}],
    ['  <p>Jeden Morgen ab 6 Uhr.</p>','',function(){return '<p class="p-p">Jeden Morgen ab 6 Uhr – online vorbestellen und abholen.</p>'}],
    ['  <a class="btn">Vorbestellen</a>','',function(){return '<span class="p-btn">Vorbestellen</span>'}],
    ['<section class="grid">','',function(){return '<div class="p-grid"><i style="--c:#d9b98c"><em>Zopf</em></i><i style="--c:#b98a5a"><em>Brot</em></i><i style="--c:#e7cfa8"><em>Gipfeli</em></i></div>'}],
    ['.btn { background: #d52b1e; }','css',function(){view.classList.add('p-red')}],
    ['@media (max-width: 600px) {…}','css',function(){view.classList.add('p-ok')}]
  ];
  function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;')}
  function hl(t,css){
    var re=css?/([.@][\w-]+)|(#[0-9a-f]{3,6})|([^.@#]+|[.@#])/g:/(<\/?)(\w+)|(class)(=)|("[^"]*"?)|([^<c"]+|[<c"])/g,o='',m;
    while((m=re.exec(t))){
      if(css)o+=m[1]?'<i class="c-sel">'+esc(m[1])+'</i>':m[2]?'<i class="c-val">'+m[2]+'</i>':esc(m[3]);
      else o+=m[2]?esc(m[1])+'<i class="c-tag">'+m[2]+'</i>':m[3]?'<i class="c-att">class</i>=':m[5]?'<i class="c-val">'+esc(m[5])+'</i>':esc(m[6]);
    }
    return o}
  function build(){clearTimeout(timer);var my=++run;code.innerHTML='';view.innerHTML='<div class="p-url">baeckerei-muster.ch</div>';view.className='sb-view';var si=0,ci=0,line=null;
    function tick(){if(my!==run)return;var st=steps[si];if(!st){code.insertAdjacentHTML('beforeend','<span class="c-ok">✓ online – mobil geprüft</span>');btn.textContent='Neu bauen';return}
      if(!line){line=document.createElement('div');code.appendChild(line)}
      ci+=RM?99:2;line.innerHTML=hl(st[0].slice(0,ci),st[1])+'<b class="c-cur"></b>';
      if(ci>=st[0].length){line.innerHTML=hl(st[0],st[1]);var r=st[2]();if(r)view.insertAdjacentHTML('beforeend',r);var el=view.lastElementChild;if(el)el.classList.add('p-in');si++;ci=0;line=null;timer=setTimeout(tick,RM?20:260)}
      else timer=setTimeout(tick,RM?5:38)}
    tick()}
  btn.addEventListener('click',build);whenVisible(root,build);
}

var map={sitebuild:sitebuild,cluster:cluster,assistant:assistant,invoices:invoices,routes:routes,voice:voice,security:security};
document.querySelectorAll('[data-lab]').forEach(function(el){try{map[el.getAttribute('data-lab')](el)}catch(e){if(window.console)console.error(e)}});
})();
