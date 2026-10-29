// Motore di riconoscimento e misura di Lenza, copiato da pesca/index.html.
// Usa i modelli e onnxruntime di ../pesca/ con le stesse chiavi di cache: chi li ha già scaricati nell'app non li riscarica.
const BASE='../pesca/';
const LS = {
  get(k,d){try{const v=localStorage.getItem('lenza.'+k);return v?JSON.parse(v):d;}catch(e){return d;}},
  set(k,v){try{localStorage.setItem('lenza.'+k,JSON.stringify(v));return true;}catch(e){toast('Memoria piena: impossibile salvare');return false;}}
};
const LW={'Spigola':[.0089,3.07],'Orata':[.0129,3.0],'Sarago maggiore':[.0138,3.05],'Sarago fasciato':[.0136,3.03],'Sarago pizzuto':[.0135,3.02],'Mormora':[.0098,3.08],'Ombrina':[.0094,3.07],'Leccia amia':[.0118,2.98],'Serra':[.0109,3.02],'Cefalo':[.0107,2.98],'Triglia di scoglio':[.0098,3.1],'Pagello fragolino':[.011,3.07],'Pagro':[.0157,2.97],'Dentice':[.0141,2.97],'Ricciola':[.015,2.93],'Tonno rosso':[.0158,3.0],'Lampuga':[.008,3.0],'Sgombro':[.0055,3.2],'Sugarello':[.0083,3.05],'Carpa':[.0182,3.0],'Persico reale':[.0102,3.13],'Persico trota (Black bass)':[.0118,3.1],'Luccio':[.0047,3.1],'Trota fario':[.0098,3.06],'Cavedano':[.01,3.06],'Siluro':[.006,3.06],'Anguilla':[.00085,3.2],
  'Sparaglione':[.0137,3.04],'Occhiata':[.0112,3.0],'Salpa':[.0129,3.0],'Boga':[.0081,3.1],'Tanuta':[.0147,3.0],'Corvina':[.0116,3.05],'Leccia stella':[.0151,2.95],'Palamita':[.0083,3.1],'Alletterato':[.0129,3.07],'Aguglia':[.001,3.2],'Barracuda':[.0046,3.03],'Cernia bruna':[.0124,3.05],'Sciarrano':[.0109,3.1],'Perchia':[.0094,3.12],'Donzella':[.0083,3.1],'Tordo':[.0123,3.05],'Scorfano nero':[.0174,3.0],'Scorfano rosso':[.0159,3.05],'Tracina':[.0064,3.1],'Pesce prete':[.013,3.1],'Murena':[.0008,3.2],'Grongo':[.0007,3.2],'Sogliola':[.0066,3.12],'Rombo chiodato':[.0123,3.13],'Gattuccio':[.0021,3.2],'Razza chiodata':[.0045,3.15],'Tinca':[.0128,3.07],'Carassio':[.0172,3.05],'Scardola':[.0112,3.1],'Abramide':[.009,3.15],'Barbo':[.0087,3.05],'Alborella':[.0062,3.15],'Lucioperca':[.0068,3.1],'Persico sole':[.015,3.1],'Trota iridea':[.0114,3.03],'Temolo':[.0074,3.1],'Pesce gatto':[.012,3.05]};
function estW(sp,l){const k=LW[Object.keys(LW).find(x=>x.toLowerCase()===String(sp||'').trim().toLowerCase())];return k&&l>0?k[0]*Math.pow(+l,k[1])/1000:null;}
const ORT_URL=BASE+'vendor/ort-1.30.0/';
const MODEL_CACHE='lenza-model-v1',MODEL_KEY='models/bioclip-int8.onnx';
let FISH=null,SESS=null,MODEL_DL=null;
function decI8(o){
  const bin=atob(o.q),rows=o.scale.length,dim=bin.length/rows,out=new Float32Array(bin.length);
  for(let i=0;i<bin.length;i++){let v=bin.charCodeAt(i);if(v>127)v-=256;out[i]=v*o.scale[(i/dim)|0];}
  return {d:out,rows,dim};
}
async function fishData(){
  if(FISH)return FISH;
  const j=await (await fetch(BASE+'models/fish.json')).json();
  FISH={...j,T:decI8(j.T),P:decI8(j.P),N:decI8(j.N),O:decI8(j.O),S:j.S?decI8(j.S):null};if(j.O2)FISH.O2=decI8(j.O2);if(j.F2)FISH.F=decI8(j.F2);return FISH;
}
async function modelItems(){const F=await fishData();return [{key:MODEL_KEY,parts:F.model.parts,size:F.model.size},...(F.sam||[]).map(s=>({key:s.path,parts:[s.path],size:s.size})),...(F.tc?[{key:F.tc.path,parts:[F.tc.path],size:F.tc.size}]:[])];}
async function modelReady(){try{const c=await caches.open(MODEL_CACHE);for(const it of await modelItems())if(!(await c.match(it.key)))return false;return true;}catch(e){return false;}}
async function downloadModel(){
  if(MODEL_DL)return MODEL_DL.p;
  const st={pct:0};MODEL_DL={st};
  MODEL_DL.p=(async()=>{
    const c=await caches.open(MODEL_CACHE),todo=[];
    for(const it of await modelItems())if(!(await c.match(it.key)))todo.push(it);
    const total=todo.reduce((a,it)=>a+it.size,0)||1;let got=0;
    for(const it of todo){
      const bufs=[];
      for(const part of it.parts){
        const r=await fetch(BASE+part);if(!r.ok)throw new Error('download');
        const rd=r.body.getReader();
        for(;;){const {done,value}=await rd.read();if(done)break;bufs.push(value);got+=value.length;st.pct=got/total;drawDl();}
      }
      await c.put(it.key,new Response(new Blob(bufs)));
    }
    try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist();}catch(e){}
  })().finally(()=>{MODEL_DL=null;render();});
  render();return MODEL_DL.p;
}
function drawDl(){const el=document.getElementById('dlbar');if(el&&MODEL_DL)el.style.width=(MODEL_DL.st.pct*100).toFixed(1)+'%';const t=document.getElementById('dlpct');if(t&&MODEL_DL)t.textContent=Math.round(MODEL_DL.st.pct*100)+'%';}
async function deleteModel(){if(!confirm('Eliminare i modelli dal dispositivo? Potrai riscaricarli quando vuoi.'))return;try{await caches.delete(MODEL_CACHE);}catch(e){}SESS=null;SAMS=null;SEG=null;TCS=null;toast('Modelli eliminati');render();}
function loadScript(u){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=u;s.onload=res;s.onerror=()=>rej(new Error('ort'));document.head.appendChild(s);});}
async function ensureOrt(){if(!window.ort){await loadScript(ORT_URL+'ort.wasm.min.js');ort.env.wasm.wasmPaths=new URL(ORT_URL,location.href).href;ort.env.wasm.numThreads=1;}}
async function cachedSession(key){
  const c=await caches.open(MODEL_CACHE),r=await c.match(key);if(!r)throw new Error('nomodel');
  return ort.InferenceSession.create(new Uint8Array(await r.arrayBuffer()),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
}
async function session(){if(SESS)return SESS;await ensureOrt();SESS=await cachedSession(MODEL_KEY);return SESS;}
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
/* Ridimensionamento bicubico con antialias, identico a quello usato per tarare il modello (PIL) */
function resampleRGBA(src,sw,sh,dw,dh){
  const cub=x=>{x=Math.abs(x);const a=-.5;return x<1?((a+2)*x-(a+3))*x*x+1:x<2?(((x-5)*x+8)*x-4)*a:0;};
  const coeffs=(inS,outS)=>{const sc=inS/outS,fs=Math.max(sc,1),sup=2*fs,ss=1/fs,out=[];
    for(let i=0;i<outS;i++){const c=(i+.5)*sc;let x0=Math.max(Math.floor(c-sup+.5),0),x1=Math.min(Math.floor(c+sup+.5),inS);const w=[];let t=0;
      for(let x=x0;x<x1;x++){const v=cub((x-c+.5)*ss);w.push(v);t+=v;}out.push([x0,w.map(v=>t?v/t:0)]);}return out;};
  const pass=(inp,iw,ih,ow,horiz)=>{const oh=horiz?ih:ow,owid=horiz?ow:iw,cf=coeffs(horiz?iw:ih,horiz?ow:ow),out=new Uint8ClampedArray(owid*(horiz?ih:ow)*4);
    if(horiz){for(let y=0;y<ih;y++)for(let x=0;x<ow;x++){const [x0,w]=cf[x];let r=0,g=0,b=0;for(let k=0;k<w.length;k++){const o=(y*iw+x0+k)*4;r+=inp[o]*w[k];g+=inp[o+1]*w[k];b+=inp[o+2]*w[k];}const q=(y*ow+x)*4;out[q]=Math.round(r);out[q+1]=Math.round(g);out[q+2]=Math.round(b);out[q+3]=255;}}
    else{for(let y=0;y<ow;y++){const [y0,w]=cf[y];for(let x=0;x<iw;x++){let r=0,g=0,b=0;for(let k=0;k<w.length;k++){const o=((y0+k)*iw+x)*4;r+=inp[o]*w[k];g+=inp[o+1]*w[k];b+=inp[o+2]*w[k];}const q=(y*iw+x)*4;out[q]=Math.round(r);out[q+1]=Math.round(g);out[q+2]=Math.round(b);out[q+3]=255;}}}
    return out;};
  const h=pass(src,sw,sh,dw,true);return pass(h,dw,sh,dh,false);
}
function imgPixels(img){const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);return g.getImageData(0,0,c.width,c.height).data;}
function toTensor(img,how,mean,std,px0){
  const w=img.naturalWidth,h=img.naturalHeight,src=px0||imgPixels(img),out=new Float32Array(3*224*224);
  let buf,bw,bh,ox=0,oy=0;
  if(how==='pad'){const k=224/Math.max(w,h);bw=Math.max(1,Math.round(w*k));bh=Math.max(1,Math.round(h*k));buf=resampleRGBA(src,w,h,bw,bh);ox=(224-bw)>>1;oy=(224-bh)>>1;}
  else{const k=224/Math.min(w,h);bw=Math.max(224,Math.round(w*k));bh=Math.max(224,Math.round(h*k));buf=resampleRGBA(src,w,h,bw,bh);ox=-((bw-224)>>1);oy=-((bh-224)>>1);}
  const fill=mean.map(x=>Math.floor(x*255));
  for(let y=0;y<224;y++)for(let x=0;x<224;x++){
    const sx=x-ox,sy=y-oy,inside=sx>=0&&sy>=0&&sx<bw&&sy<bh,o=(sy*bw+sx)*4,i=y*224+x;
    for(let ch=0;ch<3;ch++){const v=inside?buf[o+ch]:fill[ch];out[ch*50176+i]=(v/255-mean[ch])/std[ch];}
  }
  return out;
}
async function embedPhoto(src){
  const F=await fishData(),s=await session(),img=await loadImg(src),e=new Float32Array(F.dim),px=imgPixels(img);
  for(const how of F.prep){
    const x=toTensor(img,how,F.mean,F.std,px),o=await s.run({pixels:new ort.Tensor('float32',x,[1,3,224,224])});
    const v=o.embedding.data;for(let i=0;i<F.dim;i++)e[i]+=v[i];
  }
  let n=0;for(let i=0;i<F.dim;i++)n+=e[i]*e[i];n=Math.sqrt(n);for(let i=0;i<F.dim;i++)e[i]/=n;
  return e;
}
const dotRow=(M,r,e)=>{let s=0;const o=r*M.dim;for(let i=0;i<M.dim;i++)s+=M.d[o+i]*e[i];return s;};
const myFish=()=>LS.get('myfish',[]);
function embToB64(e){let s='';for(let i=0;i<e.length;i++)s+=String.fromCharCode(Math.max(-127,Math.min(127,Math.round(e[i]*400)))&255);return btoa(s);}
function b64ToEmb(b){const bin=atob(b),e=new Float32Array(bin.length);for(let i=0;i<bin.length;i++){let v=bin.charCodeAt(i);if(v>127)v-=256;e[i]=v/400;}return e;}
function learnFish(sp,emb){
  if(!emb||!sp)return;const l=myFish();l.push({sp:String(sp).trim(),e:emb});while(l.length>200)l.shift();LS.set('myfish',l);
}
async function classifyFish(src,mode){return classifyEmb(await embedPhoto(src),mode);}
async function classifyEmb(e,mode){
  const F=await fishData(),L=F.labels;
  // somiglianza testo e foto di esempio, più le tue catture confermate (stesso nome)
  const mine={};for(const m of myFish()){const v=b64ToEmb(m.e);let s=0;for(let i=0;i<v.length;i++)s+=v[i]*e[i];const k=m.sp.toLowerCase();if(!(k in mine)||s>mine[k])mine[k]=s;}
  const lg=L.map((l,i)=>{let sp=dotRow(F.P,i,e);const my=mine[l.n.toLowerCase()];if(my!=null)sp=Math.max(sp,my);return F.scale*(dotRow(F.T,i,e)+F.w*sp);});
  // specie confermate da te che non sono in elenco
  const extra=Object.keys(mine).filter(k=>!L.some(l=>l.n.toLowerCase()===k));
  const exNames=extra.map(k=>myFish().find(m=>m.sp.toLowerCase()===k).sp);
  extra.forEach(k=>lg.push(F.scale*(F.w+1)*mine[k]*F.myk));
  const mx=Math.max(...lg);let p=lg.map(x=>Math.exp(x-mx));
  p=p.map((x,i)=>i<L.length&&!L[i].m.includes(mode)?x*F.outside:x);
  const agg={};p.forEach((x,i)=>{const n=i<L.length?L[i].n:exNames[i-L.length];agg[n]=(agg[n]||0)+x;});
  const tot=Object.values(agg).reduce((a,b)=>a+b,0),rk=Object.entries(agg).map(([n,x])=>[n,x/tot]).sort((a,b)=>b[1]-a[1]);
  // pesce o no: confronto solo testuale con descrizioni di oggetti comuni
  const tl=L.map((l,i)=>F.scale*dotRow(F.T,i,e)),nl=[];for(let r=0;r<F.N.rows;r++)nl.push(F.scale*dotRow(F.N,r,e));
  const m2=Math.max(...tl,...nl),fm=tl.reduce((a,x)=>a+Math.exp(x-m2),0),nm=nl.reduce((a,x)=>a+Math.exp(x-m2),0);
  const lab=L.find(l=>l.n===rk[0][0]);
  return {is_fish:fm>=nm,species:rk[0][0],scientific_name:lab?.s||'',confidence:rk[0][1],alternatives:rk.slice(1,4).map(([n,c])=>({species:n,confidence:c})),emb:embToB64(e),dist:Object.fromEntries(rk)};
}
function aiErrMsg(e){
  if(e.message==='nomodel')return 'Scarica il modello di riconoscimento (una volta sola)';
  if(e.message==='download'||e.message==='ort')return navigator.onLine?'Download non riuscito: riprova':'Sei offline: serve internet solo per il primo download';
  return 'Riconoscimento non riuscito';
}

/* ===================== Misura sulla foto ===================== */
const REFS=[['Moneta da 2 €',2.575,{t:'coin'}],['Moneta da 1 €',2.325,{t:'coin'}],['Bancomat / carta',8.56,{t:'card'}],['Scarpa',null,{t:'shoe'}],['Mano (palmo)',8.5,{t:'hand'}],['Accendino',8,null],['Lattina 33 cl (altezza)',11.5,null],['Smartphone',15,null],['Metro: 10 cm',10,null],['Piede nudo',null,{t:'foot'}]];
const FOOT=REFS.length-1;
// scarpa: lunghezza esterna indicativa dal numero europeo (numero × 2/3 + 1 cm)
const shoeSize=()=>LS.get('shoesize',44);
// piede nudo: 2 cm meno della scarpa dello stesso numero
const refCm=i=>i===3?Math.round((shoeSize()*2/3+1)*10)/10:i===FOOT?Math.round((shoeSize()*2/3-1)*10)/10:REFS[i]?.[1];
const refName=i=>i===3?`Scarpa n. ${shoeSize()}`:i===FOOT?`Piede nudo n. ${shoeSize()}`:REFS[i]?.[0]||'';
let SAMS=null,SEG=null;
async function samSessions(){if(SAMS)return SAMS;await ensureOrt();const F=await fishData();SAMS={enc:await cachedSession(F.sam[0].path),dec:await cachedSession(F.sam[1].path)};return SAMS;}
async function samEncode(img){
  const W=img.naturalWidth,H=img.naturalHeight,k=1024/Math.max(W,H),w=Math.round(W*k),h=Math.round(H*k);
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,0,0,w,h);
  const d=g.getImageData(0,0,w,h).data,x=new Float32Array(3*1048576),M=[.485,.456,.406],SD=[.229,.224,.225];
  for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){const i=(y*w+xx)*4,o=y*1024+xx;for(let ch=0;ch<3;ch++)x[ch*1048576+o]=(d[i+ch]/255-M[ch])/SD[ch];}
  const S=await samSessions(),r=await S.enc.run({pixel_values:new ort.Tensor('float32',x,[1,3,1024,1024])});
  return {e:r.image_embeddings,p:r.image_positional_embeddings,w,h,k,ww:Math.ceil(w/4),hh:Math.ceil(h/4)};
}
async function samDecode(enc,points,perPrompt){
  // points: array di prompt; ogni prompt è un array di [x,y] in coordinate 1024
  const S=await samSessions(),n=points.length,np=perPrompt,ip=new Float32Array(n*np*2);
  points.forEach((P,i)=>P.forEach((p,j)=>{ip[(i*np+j)*2]=p[0];ip[(i*np+j)*2+1]=p[1];}));
  const r=await S.dec.run({input_points:new ort.Tensor('float32',ip,[1,n,np,2]),input_labels:new ort.Tensor('int64',new BigInt64Array(n*np).fill(1n),[1,n,np]),image_embeddings:enc.e,image_positional_embeddings:enc.p});
  const iou=r.iou_scores.data,m=r.pred_masks.data,out=[];
  for(let j=0;j<n;j++)for(let q=0;q<3;q++){
    const off=(j*3+q)*65536,b=new Uint8Array(enc.ww*enc.hh);let x0=enc.ww,y0=enc.hh,x1=-1,y1=-1,cnt=0;
    for(let y=0;y<enc.hh;y++)for(let x=0;x<enc.ww;x++)if(m[off+y*256+x]>0){b[y*enc.ww+x]=1;cnt++;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    out.push({s:iou[j*3+q],b,n:cnt,bb:[x0,y0,x1,y1],prompt:j});
  }
  return out;
}
function mShape(m,ww,hh){
  const b=m.b,[x0,y0,x1,y1]=m.bb;let sx=0,sy=0,n=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(b[y*ww+x]){sx+=x;sy+=y;n++;}
  const cx=sx/n,cy=sy/n;let a=0,c=0,d=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(b[y*ww+x]){const dx=x-cx,dy=y-cy;a+=dx*dx;c+=dx*dy;d+=dy*dy;}
  const th=.5*Math.atan2(2*c,a-d),ax=[Math.cos(th),Math.sin(th)],ay=[-ax[1],ax[0]];
  let p1n=1e9,p1x=-1e9,p2n=1e9,p2x=-1e9,e1=null,e2=null,rmax=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(b[y*ww+x]){const dx=x-cx,dy=y-cy,p=dx*ax[0]+dy*ax[1],q=dx*ay[0]+dy*ay[1];
    if(p<p1n){p1n=p;e1=[x,y];}if(p>p1x){p1x=p;e2=[x,y];}if(q<p2n)p2n=q;if(q>p2x)p2x=q;const r=dx*dx+dy*dy;if(r>rmax)rmax=r;}
  const L=p1x-p1n+1,W=p2x-p2n+1;
  return {A:n,frac:n/(ww*hh),L,W,asp:L/W,rect:n/(L*W),circ:n/(Math.PI*(Math.sqrt(rmax)+.5)**2),border:(x0===0)+(y0===0)+(x1===ww-1)+(y1===hh-1),c:[cx,cy],ax,e1,e2,p1n,p1x};
}
function maskIoU(a,b,ww){
  const x0=Math.max(a.bb[0],b.bb[0]),x1=Math.min(a.bb[2],b.bb[2]),y0=Math.max(a.bb[1],b.bb[1]),y1=Math.min(a.bb[3],b.bb[3]);
  if(x0>x1||y0>y1)return 0;let inter=0;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(a.b[y*ww+x]&&b.b[y*ww+x])inter++;
  return inter/(a.n+b.n-inter);
}
// Griglia rada (5×5) per pesce e sfondo; poi punti mirati sulle zone rimaste scoperte,
// dove di solito stanno gli oggetti piccoli come monete e carte.
async function samSegment(enc,onp){
  const {ww,hh}=enc,n=5,all=[];const add=ms=>ms.forEach(m=>{if(m.s>0.8&&m.n>=12)all.push(m);});
  const grid=[];for(let j=0;j<n;j++)for(let i=0;i<n;i++)grid.push([[(i+.5)/n*enc.w,(j+.5)/n*enc.h]]);
  for(let b=0;b<grid.length;b+=9){add(await samDecode(enc,grid.slice(b,b+9),1));onp&&onp(.15+.45*(b+9)/grid.length);}
  const cov=new Uint8Array(ww*hh);for(const m of all)if(m.n>0.02*ww*hh)for(let i=0;i<cov.length;i++)if(m.b[i])cov[i]=1;
  // componenti connesse delle zone scoperte
  const lab=new Int32Array(ww*hh),comps=[];let id=0;
  for(let i=0;i<cov.length;i++){if(cov[i]||lab[i])continue;id++;const st=[i];lab[i]=id;let a=0,sx=0,sy=0;
    while(st.length){const q=st.pop(),x=q%ww,y=(q/ww)|0;a++;sx+=x;sy+=y;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=ww||Y>=hh)continue;const k=Y*ww+X;if(!cov[k]&&!lab[k]){lab[k]=id;st.push(k);}}}
    if(a>=6&&a<=0.08*ww*hh)comps.push({a,pt:[[sx/a*4+2,sy/a*4+2]]});}
  const extra=comps.sort((p,q)=>q.a-p.a).slice(0,12).map(c=>c.pt);
  for(let b=0;b<extra.length;b+=6){add(await samDecode(enc,extra.slice(b,b+6),1));onp&&onp(.6+.25*(b+6)/Math.max(1,extra.length));}
  all.sort((a,b)=>b.s-a.s);const keep=[];
  for(const m of all)if(!keep.some(k=>maskIoU(m,k,ww)>=0.7))keep.push(m);
  keep.forEach(m=>m.f=mShape(m,ww,hh));
  return keep;
}
// ritaglio del solo oggetto (sfondo coperto di grigio) per farlo giudicare a BioCLIP
function maskedCrop(seg,m){
  const {img,enc}=seg,W=img.naturalWidth,H=img.naturalHeight,k=enc.k;
  let X0=m.bb[0]*4/k,X1=(m.bb[2]+1)*4/k,Y0=m.bb[1]*4/k,Y1=(m.bb[3]+1)*4/k;const mx=(X1-X0)*.08,my=(Y1-Y0)*.08;
  X0=Math.max(0,Math.floor(X0-mx));Y0=Math.max(0,Math.floor(Y0-my));X1=Math.min(W,Math.ceil(X1+mx));Y1=Math.min(H,Math.ceil(Y1+my));
  const cw=X1-X0,ch=Y1-Y0,c=document.createElement('canvas');c.width=cw;c.height=ch;const g=c.getContext('2d');g.drawImage(img,X0,Y0,cw,ch,0,0,cw,ch);
  const id=g.getImageData(0,0,cw,ch),d=id.data,F=FISH,fill=F.mean.map(x=>Math.floor(x*255));
  for(let y=0;y<ch;y++){const my2=Math.min(enc.hh-1,Math.floor((Y0+y)*k/4));for(let x=0;x<cw;x++){const mx2=Math.min(enc.ww-1,Math.floor((X0+x)*k/4));if(!m.b[my2*enc.ww+mx2]){const o=(y*cw+x)*4;d[o]=fill[0];d[o+1]=fill[1];d[o+2]=fill[2];}}}
  return {w:cw,h:ch,px:d};
}
// Classifica un oggetto ritagliato (mano, scarpa, moneta, carta, pesce, altro) con TinyCLIP:
// un modello generico per gli oggetti di tutti i giorni, più adatto di BioCLIP per scarpe e mani.
let TCS=null;
async function tcSession(){if(TCS)return TCS;await ensureOrt();const F=await fishData();TCS=await cachedSession(F.tc.path);return TCS;}
// tutta la foto: pesce in mano a una persona oppure appoggiato a terra o sul tavolo
async function sceneTrophy(seg){
  if(seg.trophy!=null)return seg.trophy;const F=await fishData();if(!F.S)return seg.trophy=0;
  if(!seg.px)seg.px=imgPixels(seg.img);const s=await tcSession();
  const o=await s.run({pixels:new ort.Tensor('float32',toTensor(seg.img,'pad',F.mean,F.std,seg.px),[1,3,224,224])}),e=o.embedding.data;
  const lg=[];for(let r=0;r<F.S.rows;r++)lg.push(100*dotRow(F.S,r,e));
  const mx=Math.max(...lg),ex=lg.map(x=>Math.exp(x-mx));return seg.trophy=ex[0]/(ex[0]+ex[1]);
}
function shoe2(m){
  const O=FISH.O2,lg=[];for(let r=0;r<O.rows;r++)lg.push(100*dotRow(O,r,m.tce));
  const mx=Math.max(...lg),ex=lg.map(x=>Math.exp(x-mx)),t=ex.reduce((a,b)=>a+b,0),i=FISH.ON2.indexOf('shoe');
  return ex[i]===Math.max(...ex)?ex[i]/t:0;
}
function bareProb(m){
  const F=FISH;if(!F?.F||!m.tce)return 0;const a=100*dotRow(F.F,0,m.tce),b=100*dotRow(F.F,1,m.tce),mx=Math.max(a,b);
  return Math.exp(b-mx)/(Math.exp(a-mx)+Math.exp(b-mx));
}
async function classifyMask(seg,m){
  if(m.cls)return m.cls;
  const F=await fishData(),s=await tcSession(),cr=maskedCrop(seg,m),fake={naturalWidth:cr.w,naturalHeight:cr.h};
  const o=await s.run({pixels:new ort.Tensor('float32',toTensor(fake,'pad',F.mean,F.std,cr.px),[1,3,224,224])}),e=o.embedding.data;
  const lg=[];for(let r=0;r<F.O.rows;r++)lg.push(100*dotRow(F.O,r,e));
  const mx=Math.max(...lg),ex=lg.map(x=>Math.exp(x-mx)),t=ex.reduce((a,b)=>a+b,0);
  m.tce=Float32Array.from(e);m.cls={};F.ON.forEach((n,i)=>m.cls[n]=ex[i]/t);return m.cls;
}
// probabilità che un ritaglio sia un pesce secondo BioCLIP (specie ittiche contro oggetti comuni)
async function embedMask(seg,m){
  if(m.emb)return m.emb;
  const F=await fishData(),s=await session(),cr=maskedCrop(seg,m),fake={naturalWidth:cr.w,naturalHeight:cr.h},e=new Float32Array(F.dim);
  for(const how of F.prep){const o=await s.run({pixels:new ort.Tensor('float32',toTensor(fake,how,F.mean,F.std,cr.px),[1,3,224,224])});const v=o.embedding.data;for(let i=0;i<F.dim;i++)e[i]+=v[i];}
  let nn=0;for(let i=0;i<F.dim;i++)nn+=e[i]*e[i];nn=Math.sqrt(nn);for(let i=0;i<F.dim;i++)e[i]/=nn;
  return m.emb=e;
}
async function fishProbOf(seg,m){
  if(m.fp!=null)return m.fp;
  const F=await fishData(),e=await embedMask(seg,m);
  const tl=[],nl=[];for(let r=0;r<F.T.rows;r++)tl.push(100*dotRow(F.T,r,e));for(let r=0;r<F.N.rows;r++)nl.push(100*dotRow(F.N,r,e));
  const mx=Math.max(...tl,...nl),fm=tl.reduce((a,x)=>a+Math.exp(x-mx),0),nm=nl.reduce((a,x)=>a+Math.exp(x-mx),0);
  return m.fp=fm/(fm+nm);
}
const isFishShape=(f,maxb)=>f.asp>1.6&&f.asp<10&&f.rect>.35&&f.rect<.88&&f.frac>.015&&f.frac<.7&&f.border<=maxb;
function overlapFrac(m,ref){if(!ref)return 0;let k=0;for(let i=0;i<m.b.length;i++)if(m.b[i]&&ref.b[i])k++;return k/ref.n;}
function insideMask(m,x,y,ww){return !!m.b[Math.round(y)*ww+Math.round(x)];}
// Moneta da 1 € o da 2 €: la 2 € ha il centro dorato e l'anello argentato, la 1 € il contrario
function coinType(seg,m){
  if(!seg.px)seg.px=imgPixels(seg.img);
  const {img,enc}=seg,W=img.naturalWidth,k=enc.k,cx=(m.f.c[0]*4+2)/k,cy=(m.f.c[1]*4+2)/k,R=Math.sqrt(m.f.A/Math.PI)*4/k;
  let gi=0,ni=0,go=0,no=0;
  for(let y=Math.max(0,Math.floor(cy-R));y<Math.min(img.naturalHeight,cy+R);y++)for(let x=Math.max(0,Math.floor(cx-R));x<Math.min(W,cx+R);x++){
    const d=Math.hypot(x-cx,y-cy)/R,o=(y*W+x)*4,g=(seg.px[o]+seg.px[o+1])/2-seg.px[o+2];
    if(d<.4){gi+=g;ni++;}else if(d>.72&&d<.93){go+=g;no++;}
  }
  const diff=(ni?gi/ni:0)-(no?go/no:0);
  return diff<-20?1:0; // 1 = moneta da 1 € solo se i colori sono netti, altrimenti 2 €
}
async function growCoin(seg,m){
  if(m.grown)return;m.grown=true;const f=m.f,r0=Math.sqrt(f.A/Math.PI);
  for(const c of await samDecode(seg.enc,[[[f.c[0]*4+2,f.c[1]*4+2]]],1)){
    if(c.n<12||c.s<.6)continue;c.f=mShape(c,seg.enc.ww,seg.enc.hh);const r2=Math.sqrt(c.f.A/Math.PI);
    if(c.f.asp<1.2&&c.f.circ>.78&&c.f.border===0&&r2>r0*1.05&&r2<2.2*r0&&Math.hypot(c.f.c[0]-f.c[0],c.f.c[1]-f.c[1])<.3*r0&&r2>Math.sqrt(m.f.A/Math.PI))
      Object.assign(m,{b:c.b,n:c.n,bb:c.bb,f:c.f});
  }
}
// Cerca da solo il riferimento: moneta, bancomat/carta, scarpa o mano (in quest'ordine di precisione).
// force: indice di REFS scelto a mano dall'utente.
async function detectRefs(seg,force,onp){
  const {enc}=seg,M=seg.masks,ww=enc.ww;
  // oggetti grandi: una sola classificazione serve sia per il pesce sia per scarpa e mano
  const big=M.filter(m=>m.f.frac>.005&&m.f.frac<.7&&m.f.border<=3&&!(m.f.asp<1.25&&m.f.circ>.75)).sort((a,b)=>Math.sqrt(b.f.A)*b.s-Math.sqrt(a.f.A)*a.s)
    .reduce((k,m)=>{if(k.length<16&&!k.some(o=>maskIoU(m,o,ww)>.6))k.push(m);return k;},[]);  // sagome diverse tra loro: anche gli oggetti piccoli (la scarpa accanto a pesci e secchio)
  let i=0;for(const m of big){await classifyMask(seg,m);onp&&onp(.86+.08*(++i)/big.length);}
  const want=t=>force==null||REFS[force]?.[2]?.t===t;
  // foto trofeo (pesce in mano a una persona): le scarpe sono lontane dal pesce e il busto si scambia per una scarpa
  const person=(await sceneTrophy(seg))>.7;
  let ref=null;
  if(want('coin')){
    const C=M.filter(m=>m.f.asp<1.25&&m.f.circ>.75&&m.f.frac<.06&&m.f.border===0&&!big.some(b=>isFishShape(b.f,1)&&b.cls?.fish>.5&&b.cls.fish===Math.max(...Object.values(b.cls))&&insideMask(b,m.f.c[0],m.f.c[1],ww))).sort((a,b)=>b.f.circ*b.s-a.f.circ*a.s).slice(0,2);
    for(const m of C){const c=await classifyMask(seg,m);if(force!=null?c.coin>.1:(c.coin>.4||(m.f.frac<.02&&c.coin>.1&&c.coin>c.hand&&c.coin>c.shoe&&c.coin>c.card))){await growCoin(seg,m);ref={m,idx:force??coinType(seg,m),kind:'coin'};break;}}
  }
  if(!ref&&want('card')){
    const C=M.filter(m=>m.f.asp>1.4&&m.f.asp<1.8&&m.f.rect>.85&&m.f.frac<.25&&m.f.border===0).sort((a,b)=>b.f.rect*b.s-a.f.rect*a.s).slice(0,2);
    for(const m of C){const c=await classifyMask(seg,m);if(c.card>(force!=null?.15:.35)){ref={m,idx:2,kind:'card'};break;}}
  }
  for(const t of ['hand','shoe']){  // prima la mano: il modello la riconosce con sicurezza, la sabbia invece si scambia per scarpa
    if(ref||!want(t))continue;
    // scarpa trovata da sola solo se intera nella foto, non enorme e senza persone in posa
    if(t!=='hand'&&force==null&&person)continue;
    let C=big.filter(m=>m.cls&&(force!=null?m.cls[t]>.15:(m.cls[t]>.5&&m.cls[t]===Math.max(...Object.values(m.cls))&&(t==='hand'||(m.f.border<=1&&m.f.frac<.2&&m.f.rect>.45)))));
    if(C.length){const top=Math.max(...C.map(m=>m.cls[t]));C=C.filter(m=>m.cls[t]>=top-.15);
      ref={m:C.reduce((a,m)=>m.f.A<a.f.A?m:a),idx:t==='shoe'?3:4,kind:t};}  // a parità, la sagoma più piccola: la scarpa senza la gamba
  }
  // piede nudo: solo se non c'è altro. Classi con "piede nudo" dentro la scarpa, ma non deve sembrare una mano.
  if(!ref&&want('foot')&&(force!=null||!person)){
    const sc=m=>m.tce&&FISH.O2?shoe2(m):0;
    const C=big.filter(m=>m.cls&&(force!=null?sc(m)>.15:(sc(m)>.5&&m.cls.hand<.2&&m.f.border<=1&&m.f.frac<.2&&m.f.rect>.4)));
    if(C.length){const top=Math.max(...C.map(sc));const D=C.filter(m=>sc(m)>=top-.15);ref={m:D.reduce((a,m)=>m.f.A<a.f.A?m:a),idx:FOOT,kind:'foot'};}
  }
  return {ref,big,person};
}
// testa o coda sul bordo della foto: il pesce non è intero e la lunghezza non si può misurare
function fishCut(f,ww,hh){return [f.e1,f.e2].some(([x,y])=>x<=1||y<=1||x>=ww-2||y>=hh-2);}
async function findFish2(seg,big,ref){
  const {enc}=seg,ww=enc.ww,avoid=ref&&ref.kind!=='hand'?ref.m:null;
  // non è un pesce ciò che TinyCLIP ha già riconosciuto come mano, scarpa, moneta o carta
  const notObj=m=>!m.cls||!['hand','shoe','coin','card'].some(t=>m.cls[t]>.5);
  const ok=m=>notObj(m)&&(!avoid||overlapFrac(m,avoid)<=.05);
  const M=seg.masks,cands=maxb=>M.filter(m=>isFishShape(m.f,maxb)&&m!==ref?.m&&ok(m))
    .map(m=>{const cen=Math.hypot(m.f.c[0]/enc.ww-.5,m.f.c[1]/enc.hh-.5);return {m,sc:Math.sqrt(m.f.A)*m.s*(1.2-cen)};}).sort((a,b)=>b.sc-a.sc).slice(0,3);
  let C=cands(0);if(!C.length)C=cands(1);
  let bb=null;
  for(const {m} of C){const fp=await fishProbOf(seg,m);const sc=fp*Math.pow(m.f.A,.25);if(fp>.5&&(!bb||sc>bb.sc))bb={m,sc};if(fp>.97&&bb?.m===m)break;}
  // pesce molto alto (orata, sarago) o tagliato dal bordo: forma meno allungata, ma riconosciuto come pesce dai modelli
  if(!bb)for(const m of big.filter(m=>m!==ref?.m&&ok(m)&&m.f.asp>1.15&&m.cls&&m.cls.fish>.5&&m.cls.fish===Math.max(...Object.values(m.cls)))){
    const fp=await fishProbOf(seg,m);if(fp>.6&&(!bb||m.f.A>bb.m.f.A))bb={m};}
  if(!bb)return null;
  const best=bb.m;
  // rifinitura: 5 punti lungo il corpo per includere testa e coda
  const f=best.f,pts=[];
  for(const q of [.12,.3,.5,.7,.88]){
    const t=f.p1n+(f.p1x-f.p1n)*q;let px=Math.round(f.c[0]+t*f.ax[0]),py=Math.round(f.c[1]+t*f.ax[1]),found=false;
    for(let r=0;r<=6&&!found;r++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r&&!found;dx++){const x=px+dx,y=py+dy;if(x>=0&&y>=0&&x<ww&&y<enc.hh&&best.b[y*ww+x]){px=x;py=y;found=true;}}
    pts.push([px*4+2,py*4+2]);
  }
  let fin=best;
  for(const r of await samDecode(enc,[pts],5)){
    if(r.n<12||r.s<=.75)continue;r.f=mShape(r,ww,enc.hh);
    let inter=0;for(let i=0;i<r.b.length;i++)if(r.b[i]&&best.b[i])inter++;
    if(r.f.border===0&&ok(r)&&r.n>=best.n&&r.n<=2.5*best.n&&r.n>fin.n&&inter>.8*best.n)fin=r;
  }
  if(fin!==best&&(await fishProbOf(seg,fin))<.5)fin=best;
  return fin;
}
// Larghezza del palmo: mediana della larghezza della sagoma nella parte centrale della mano
function palmWidth(m,ww){
  const f=m.f,ay=[-f.ax[1],f.ax[0]],bins=20,mn=new Array(bins).fill(1e9),mx=new Array(bins).fill(-1e9),[x0,y0,x1,y1]=m.bb;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(m.b[y*ww+x]){const dx=x-f.c[0],dy=y-f.c[1],p=dx*f.ax[0]+dy*f.ax[1],q=dx*ay[0]+dy*ay[1];
    const b=Math.min(bins-1,Math.max(0,Math.floor((p-f.p1n)/(f.p1x-f.p1n+1e-9)*bins)));if(q<mn[b])mn[b]=q;if(q>mx[b])mx[b]=q;}
  const w=[];for(let b=Math.floor(bins*.3);b<Math.ceil(bins*.7);b++)if(mx[b]>mn[b])w.push(mx[b]-mn[b]+1);
  w.sort((a,b)=>a-b);return w.length?w[w.length>>1]:f.W;
}
// Mano che regge il pesce: interroga SlimSAM appena fuori dal contorno del pesce e cerca un ritaglio
// classificato "mano" che tocca il pesce (sta alla sua stessa distanza dalla fotocamera: buon riferimento).
async function handNearFish(seg,fish){
  const {enc}=seg,ww=enc.ww,hh=enc.hh,f=fish.f,ay=[-f.ax[1],f.ax[0]],L=f.p1x-f.p1n,pts=[];
  for(const q of [-.06,.12,.3,.5,.7,.88,1.06])for(const side of (q<0||q>1)?[0]:[-1,1]){
    const t=f.p1n+L*q,off=side*(f.W/2+3),x=f.c[0]+t*f.ax[0]+off*ay[0],y=f.c[1]+t*f.ax[1]+off*ay[1];
    if(x>=0&&y>=0&&x<ww&&y<hh&&!fish.b[Math.round(y)*ww+Math.round(x)])pts.push([[x*4+2,y*4+2]]);
  }
  if(!pts.length)return null;
  const near=new Uint8Array(ww*hh);  // pesce allargato di 3 pixel: "tocca il pesce"
  for(let y=0;y<hh;y++)for(let x=0;x<ww;x++)if(fish.b[y*ww+x])for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<ww&&Y<hh)near[Y*ww+X]=1;}
  let ms=[];for(let b=0;b<pts.length;b+=6)ms=ms.concat(await samDecode(enc,pts.slice(b,b+6),1));
  ms=ms.filter(m=>m.s>.75&&m.n>=12&&m.n<.06*ww*hh&&m.n<1.2*fish.n).sort((a,b)=>b.s-a.s);  // una mano non è più grande del pesce
  const uniq=[];for(const m of ms)if(!uniq.some(k=>maskIoU(m,k,ww)>=.7))uniq.push(m);
  let best=null;
  for(const m of uniq.slice(0,6)){
    let touch=0,inFish=0;for(let i=0;i<m.b.length;i++)if(m.b[i]){if(near[i])touch++;if(fish.b[i])inFish++;}
    if(!touch||inFish>.5*m.n)continue;
    m.f=mShape(m,ww,hh);const c=await classifyMask(seg,m);
    if(c.hand>.4&&(!best||c.hand>best.cls.hand))best=m;
  }
  return best;
}
// pesce meno un'altra sagoma, tenendo solo il pezzo connesso più grande
function minusMask(m,o,ww,hh){
  const b=new Uint8Array(m.b.length);for(let i=0;i<b.length;i++)b[i]=m.b[i]&&!o.b[i]?1:0;
  const lab=new Int32Array(b.length);let best=0,bestN=0,id=0;
  for(let i=0;i<b.length;i++)if(b[i]&&!lab[i]){id++;let n=0;const st=[i];lab[i]=id;
    while(st.length){const j=st.pop();n++;const x=j%ww,y=(j/ww)|0;for(const k of [x>0?j-1:-1,x<ww-1?j+1:-1,y>0?j-ww:-1,y<hh-1?j+ww:-1])if(k>=0&&b[k]&&!lab[k]){lab[k]=id;st.push(k);}}
    if(n>bestN){bestN=n;best=id;}}
  if(bestN<12||bestN===m.n)return null;
  let x0=ww,y0=hh,x1=0,y1=0;for(let i=0;i<b.length;i++){b[i]=lab[i]===best?1:0;if(b[i]){const x=i%ww,y=(i/ww)|0;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
  const r={...m,b,n:bestN,bb:[x0,y0,x1,y1]};r.f=mShape(r,ww,hh);return r;
}
async function autoMeasure(src,force,onp){
  if(!SEG||SEG.src!==src){
    onp&&onp(.02);const img=await loadImg(src);const enc=await samEncode(img);onp&&onp(.15);
    SEG={src,img,enc,masks:await samSegment(enc,onp)};
  }
  const seg=SEG,key='r_'+(force??'auto');
  if(!seg[key]){
    let {ref,big,person}=await detectRefs(seg,force,onp);let fish=await findFish2(seg,big,ref);
    // se una mano regge il pesce è il riferimento più affidabile dopo moneta e carta
    if(fish&&(force==null?(!ref||ref.kind==='shoe'||ref.kind==='hand'):force===4)){const h=await handNearFish(seg,fish);if(h)ref={m:h,idx:4,kind:'hand'};}
    // la mano tocca spesso il pesce: SlimSAM può unirli e il "muso" finisce sulle dita. Tolgo la mano dal pesce.
    if(fish&&ref?.kind==='hand')fish=minusMask(fish,ref.m,seg.enc.ww,seg.enc.hh)||fish;
    seg[key]={ref,fish,person};
  }
  const {ref,fish,person}=seg[key];onp&&onp(1);
  const {img,enc}=seg,W=img.naturalWidth,H=img.naturalHeight,k=enc.k,P=([x,y])=>[((x*4+2)/k)/W,((y*4+2)/k)/H];
  const out={ref:ref?.idx??null,fishOk:!!fish,refOk:!!ref,kind:ref?.kind||null,forced:force!=null,fishMask:fish||null,person:!!person,fishCut:!!fish&&fishCut(fish.f,enc.ww,enc.hh),refCut:!!ref&&(ref.kind==='shoe'||ref.kind==='foot')&&fishCut(ref.m.f,enc.ww,enc.hh)};
  const ends=fish?[P(fish.f.e1),P(fish.f.e2)]:null;
  if(ref){
    const f=ref.m.f,cx=(f.c[0]*4+2)/k,cy=(f.c[1]*4+2)/k;let half,ax;
    if(ref.kind==='coin'){half=Math.sqrt(f.A/Math.PI)*4/k;ax=[1,0];}
    else if(ref.kind==='hand'){half=palmWidth(ref.m,enc.ww)/2*4/k;ax=[-f.ax[1],f.ax[0]];}
    else{half=f.L/2*4/k;ax=f.ax;}
    out.refPts=[[(cx-ax[0]*half)/W,(cy-ax[1]*half)/H],[(cx+ax[0]*half)/W,(cy+ax[1]*half)/H]];
  }
  if(ends&&ref){
    out.pts=[...ends,...out.refPts];
    const d=(a,b)=>Math.hypot((a[0]-b[0])*W,(a[1]-b[1])*H);
    out.len=Math.round(d(ends[0],ends[1])/d(out.refPts[0],out.refPts[1])*refCm(ref.idx)*10)/10;
  }else out.pts=ends?[...ends]:null;
  return out;
}
async function measPreview(src,pts){
  if(!pts||pts.length<2)return null;
  const img=await loadImg(src),k=Math.min(1,520/Math.max(img.naturalWidth,img.naturalHeight)),W=Math.round(img.naturalWidth*k),H=Math.round(img.naturalHeight*k);
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.drawImage(img,0,0,W,H);
  const P=pts.map(p=>[p[0]*W,p[1]*H]),line=(a,b,col)=>{g.lineCap='round';g.strokeStyle='rgba(0,0,0,.65)';g.lineWidth=7;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();g.strokeStyle=col;g.lineWidth=4;g.stroke();[a,b].forEach(q=>{g.fillStyle=col;g.beginPath();g.arc(q[0],q[1],6,0,7);g.fill();});};
  line(P[0],P[1],'#2fe0cf');if(P.length>=4)line(P[2],P[3],'#ffb547');
  return c.toDataURL('image/jpeg',.8);
}
