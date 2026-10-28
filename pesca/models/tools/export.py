import torch, open_clip, numpy as np, json
from labels import L, NEG, prompts
model, _, preprocess = open_clip.create_model_and_transforms('hf-hub:imageomics/bioclip')
tok = open_clip.get_tokenizer('hf-hub:imageomics/bioclip')
model.eval()
print(preprocess)
class Img(torch.nn.Module):
    def __init__(s,m): super().__init__(); s.m=m
    def forward(s,x):
        e=s.m.encode_image(x); return e/e.norm(dim=-1,keepdim=True)
x=torch.randn(1,3,224,224)
torch.onnx.export(Img(model),x,'img_fp32.onnx',input_names=['pixels'],output_names=['embedding'],opset_version=17,dynamo=False)
with torch.no_grad():
    T=[]
    for r in L:
        e=model.encode_text(tok(prompts(r))); e=e/e.norm(dim=-1,keepdim=True); e=e.mean(0); T.append((e/e.norm()).numpy())
    N=model.encode_text(tok(NEG)); N=(N/N.norm(dim=-1,keepdim=True)).numpy()
np.save('text.npy',np.array(T)); np.save('neg.npy',N)
print('scale',model.logit_scale.exp().item())
