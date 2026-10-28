import numpy as np, json, base64, sys, os, glob
from labels import L, NEG
# uso: python build.py <modello.onnx> <crop|pad|both> <w> <scale>  (richiede text.npy, neg.npy e gli embedding dei prototipi)
model,prep,w,scale=sys.argv[1],sys.argv[2],float(sys.argv[3]),float(sys.argv[4])
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
os.makedirs(OUT,exist_ok=True)
T=np.load('text.npy');N=np.load('neg.npy')
pr=sorted(glob.glob('protoimg/*.jpg'));sci=lambda f:os.path.basename(f).split('__')[0].replace('_',' ')
nrm=lambda x:x/np.linalg.norm(x,axis=-1,keepdims=True)
if prep=='both': PE=nrm(np.load(f'pr_{model}_crop.npy')+np.load(f'pr_{model}_pad.npy'))
else: PE=np.load(f'pr_{model}_{prep}.npy')
P=np.array([nrm(PE[idx].mean(0)) if (idx:=[i for i,f in enumerate(pr) if sci(f)==r[1]]) else T[k] for k,r in enumerate(L)])
def q(M):
    sc=np.abs(M).max(1)/127;Q=np.round(M/sc[:,None]).astype(np.int8)
    return {'q':base64.b64encode(Q.tobytes()).decode(),'scale':[round(float(x),7) for x in sc]}
# modello diviso in parti < 40 MB
data=open(model,'rb').read();n=3;sz=-(-len(data)//n);parts=[]
for i in range(n):
    fn=f'bioclip-int8.part{i+1}';open(f'{OUT}/{fn}','wb').write(data[i*sz:(i+1)*sz]);parts.append('models/'+fn)
J={'v':1,'source':'imageomics/bioclip (MIT), esportato in ONNX e quantizzato int8','dim':512,'scale':scale,'w':w,'myk':0.75,'outside':0.15,
 'prep':['crop','pad'] if prep=='both' else [prep],'mean':[0.48145466,0.4578275,0.40821073],'std':[0.26862954,0.26130258,0.27577711],
 'model':{'parts':parts,'size':len(data)},
 'labels':[{'n':r[0],'s':r[1],'m':r[6].split(),'sz':r[7]} for r in L],'T':q(T),'P':q(P),'N':q(N)}
json.dump(J,open(f'{OUT}/fish.json','w'),separators=(',',':'),ensure_ascii=False)
print('fish.json',os.path.getsize(f'{OUT}/fish.json')//1024,'KB; parts',[os.path.getsize(f'{OUT}/'+p.split('/')[1])//1e6 for p in parts])
