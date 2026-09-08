"""Create the original colour/finish atlas used by the Blender craft collection."""
import ast
import math
import random
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
tree=ast.parse((ROOT/'scripts/craft_mesh.py').read_text())
palette=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='PALETTE' for t in n.targets))
size=192
im=Image.new('RGB',(size*8,size*4))
rng=random.Random(260907)
for i,(_,hexcolor,_,_,kind) in enumerate(palette):
    rgb=tuple(int(hexcolor[j:j+2],16) for j in (0,2,4))
    for y in range(size):
        for x in range(size):
            noise=rng.uniform(-1,1)
            if kind=='wood':
                grain=math.sin(x*.29+math.sin(y*.026)*1.5+math.sin(x*.05)*2)
                shade=.96+.04*noise+.055*grain-.035*max(0,math.sin(x*.11+y*.009))**12
            elif kind=='fur':
                u,v=x/size,y/size
                phase=(v*6.1+.075*math.cos(u*14))%1
                distance=min(phase,1-phase)
                width=.115*max(0,1-abs(u-.5)/.46)
                stripe=max(0,min(1,(width-distance)/.025))
                shade=.985+.019*noise-.36*stripe
            elif kind=='cloth':shade=.97+.025*noise+.018*math.sin(x*math.pi/2)+.018*math.sin(y*math.pi/2)
            elif kind=='stone':shade=.97+.045*noise+.025*math.sin(x*.07+math.sin(y*.11))
            elif kind=='metal':shade=.98+.018*noise+.012*math.sin(y*1.9)
            elif kind=='ceramic':shade=.98+.012*noise+.022*math.sin(x*.08)*math.sin(y*.08)
            else:shade=.985+.016*noise
            im.putpixel(((i%8)*size+x,(i//8)*size+y),tuple(max(0,min(255,round(c*shade))) for c in rgb))
out=ROOT/'public/models/craft'
out.mkdir(parents=True,exist_ok=True)
im.save(out/'craft-atlas.png',optimize=True)
print(out/'craft-atlas.png')
