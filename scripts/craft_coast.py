"""Sewn parasols, timber loungers and native dune planting."""
import math
import random
from craft_mesh import Builder

def parasol(b, color=9, x=0, y=0, height=2.9, radius=1.8):
    b.lathe([(.0,.015),(.12,.015),(.12,.08),(.045,.12),(.045,height+.15),(.0,height+.15)],5,x,y,24)
    b.lathe([(.06,2.08),(.105,2.08),(.105,2.19),(.06,2.23)],14,x,y,24)
    sectors=12
    radial=9
    angular=6
    def p(a,r,t=0):
        # Catenary-like drape between the ribs, with a raised central vent.
        h=height+.18-.47*r**1.25-.075*math.sin(t*math.pi)*r**1.8
        return (x+radius*r*math.cos(a),y+radius*r*math.sin(a),h)
    for s in range(sectors):
        vs=[]
        for j in range(radial+1):
            r=.07+.93*j/radial
            for k in range(angular+1):vs.append(p((s+k/angular)*math.tau/sectors,r,k/angular))
        fs=[]
        for j in range(radial):
            for k in range(angular):
                a=j*(angular+1)+k
                fs.append((a,a+1,a+angular+2,a+angular+1))
        first=len(b.f)
        b.poly(vs,fs,color if s%2 else 7)
        b.smooth_faces.update(range(first,len(b.f)))
        # The underside is a sewn second fabric skin, not a missing backface.
        b.poly([(px,py,pz-.012) for px,py,pz in vs],[tuple(reversed(f)) for f in fs],7)
        a=s*math.tau/sectors
        rib=[(px,py,pz-.035) for px,py,pz in [p(a,j/12) for j in range(1,13)]]
        b.tube(rib,.013,5,8)
        b.beam((x,y,2.15),(x+radius*.51*math.cos(a),y+radius*.51*math.sin(a),height-.05),.013,5,8)
        # Scalloped valance and a contrasting welt around each panel.
        hem=[]
        for k in range(angular+1):
            t=k/angular
            a=(s+t)*math.tau/sectors
            px,py,pz=p(a,1,t)
            drop=.095+.055*math.sin(t*math.pi)
            hem.extend([(px,py,pz),(px,py,pz-drop)])
        fs=[(k*2,k*2+2,k*2+3,k*2+1) for k in range(angular)]
        b.poly(hem,fs+[(d,c,bb,a) for a,bb,c,d in fs],color if s%2 else 7)
        b.tube([hem[k*2+1] for k in range(angular+1)],.009,7,6)
    b.lathe([(.0,height+.21),(.15,height+.21),(.19,height+.19),(.20,height+.17),(.0,height+.17)],7,x,y,36)
    b.sphere(x,y,height+.27,.065,5,sx=.7,sy=.7,sz=1.4,n=16,rings=8)

def lounger(b,x=2,y=0,color=8):
    start=len(b.v)
    # Rail paths follow the backrest; cross braces and bolts show how it folds.
    for side in [-1,1]:
        b.tube([(side*.32,.88,.28),(side*.32,-.30,.28),(side*.32,-.81,.79)],.031,5)
        b.beam((side*.28,.70,.07),(side*.28,-.24,.30),.026,5)
        b.beam((side*.28,-.60,.07),(side*.28,.43,.30),.026,5)
        b.beam((side*.27,-.65,.10),(side*.27,-.58,.55),.022,5)
        for yy,zz in [(.04,.23),(-.3,.29),(-.6,.09)]:
            b.beam((side*.315,yy,zz),(side*.347,yy,zz),.027,14,12)
    for j in range(12):
        yy=.82-j*.095
        b.box(0,yy,.29,.59,.069,.032,5 if j%3 else 6)
    for j in range(7):
        yy=-.31-j*.072
        zz=.31+j*.071
        a=len(b.v)
        b.box(0,0,0,.59,.06,.027,5)
        b.transform(a,(0,yy,zz),rx=-math.pi/4)
    # Canvas cushion, stitched edges, head roll and loosely folded towel.
    b.box(0,.23,.329,.51,1.04,.043,color)
    a=len(b.v)
    b.box(0,0,0,.51,.62,.04,color)
    b.transform(a,(0,-.53,.56),rx=-math.pi/4)
    for side in [-1,1]:
        b.tube([(side*.23,.72,.354),(side*.23,-.26,.354),(side*.23,-.75,.83)],.006,7,6)
    b.beam((-.235,-.69,.80),(.235,-.69,.80),.062,7,24)
    b.box(.015,.57,.365,.46,.27,.018,7)
    for j in range(4):b.box(-.18+j*.12,.57,.377,.028,.27,.006,color)
    b.transform(start,(x,y,0))

def beach_set(variant):
    b=Builder('beach_set_'+str(variant))
    parasol(b,9 if variant==0 else 8)
    lounger(b,color=8 if variant==0 else 9)
    # Woven basket and rolled mat occupy the existing furniture footprint.
    b.lathe([(.13,.015),(.19,.025),(.23,.12),(.24,.40),(.235,.45),(.205,.45),(.2,.12),(.13,.10)],30,1.50,.45,32)
    for z in [.11,.16,.21,.26,.31,.36,.41]:b.ring(1.5,.45,z,.215+(z-.12)*.065,.009,5,32)
    b.tube([(1.3,.45,.39),(1.31,.45,.62),(1.50,.45,.70),(1.69,.45,.62),(1.7,.45,.39)],.017,30)
    b.beam((1.52,.45,.39),(1.52,.45,.61),.085,7,20)
    return b.finish(.006)

def leaf_blade(b,origin,angle,length,width,mat,lean=.55):
    x,y,z=origin
    vs=[]
    for i in range(7):
        t=i/6
        center=(x+math.cos(angle)*lean*length*t*t,y+math.sin(angle)*lean*length*t*t,z+length*(t-.28*t*t))
        w=width*math.sin(math.pi*(.05+.95*t))
        for s in [-1,0,1]:vs.append((center[0]-math.sin(angle)*w*s,center[1]+math.cos(angle)*w*s,center[2]+(.012 if s==0 else 0)))
    fs=[]
    for i in range(6):
        k=i*3
        fs.extend([(k,k+3,k+4,k+1),(k+1,k+4,k+5,k+2)])
    b.poly(vs,fs+[tuple(reversed(f)) for f in fs],mat)

def dune():
    b=Builder('coastal_dune')
    rng=random.Random(195)
    n=64
    rings=12
    vs=[(0,0,.32)]
    for k in range(1,rings+1):
        t=k/rings
        for j in range(n):
            a=j*math.tau/n
            r=t*(1+.06*math.sin(a*3)+.025*math.cos(a*7))
            h=.32*(1-t*t)**1.5-.075*t**5+.013*math.sin(a*5+t*13)*math.sin(math.pi*t)
            vs.append((1.9*r*math.cos(a),1.16*r*math.sin(a),h))
    fs=[(0,1+j,1+(j+1)%n) for j in range(n)]
    fs.extend((1+k*n+j,1+(k+1)*n+j,1+(k+1)*n+(j+1)%n,1+k*n+(j+1)%n) for k in range(rings-1) for j in range(n))
    first=len(b.f)
    b.poly(vs,fs,19)
    b.smooth_faces.update(range(first,len(b.f)))
    for cx,cy in [(-.75,.25),(.25,.10),(.90,-.25),(-.18,-.5)]:
        for j in range(23):
            a=rng.random()*math.tau
            leaf_blade(b,(cx+rng.uniform(-.14,.14),cy+rng.uniform(-.12,.12),.20),a,rng.uniform(.32,.87),rng.uniform(.009,.02),[16,17,18][j%3],rng.uniform(.28,.9))
        for j in range(3):
            a=rng.random()*math.tau
            h=rng.uniform(.65,.95)
            b.tube([(cx,cy,.25),(cx+.07*math.cos(a),cy+.07*math.sin(a),h*.7),(cx+.2*math.cos(a),cy+.2*math.sin(a),h)],.009,18,6)
            b.sphere(cx+.2*math.cos(a),cy+.2*math.sin(a),h,.03,18,sx=.75,sy=.75,sz=3.5,n=10,rings=6)
    # Low salt-tolerant ground cover: paired succulent leaves, flowers and shells.
    for j in range(26):
        a=rng.random()*math.tau
        r=rng.uniform(.55,1.15)
        x,y=r*math.cos(a),r*.65*math.sin(a)
        b.sphere(x,y,.18,.085,17,sx=1.8,sy=.58,sz=.28,n=12,rings=6)
        if j%4==0:
            for k in range(5):
                b.sphere(x+.04*math.cos(k*math.tau/5),y+.04*math.sin(k*math.tau/5),.205,.025,27,sx=1,sy=1,sz=.5,n=8,rings=4)
    for x,y in [(-1.38,.20),(1.31,.22),(.8,-.65)]:
        b.sphere(x,y,.045,.063,20,sx=1,sy=.7,sz=.35,n=16,rings=6)
        for i in range(5):b.beam((x-.04+i*.018,y-.03,.053),(x-.024+i*.01,y+.03,.063),.003,11,6)
    return b.finish(0)

def boardwalk(name,width,depth,height,posts=False):
    b=Builder(name)
    # Height and footprint are identical to the old collision deck.
    b.box(0,0,height-.065,width,depth,.13,5)
    for x in [-width*.34,width*.34]:
        b.box(x,0,height-.175,.11,depth+.025,.10,6)
        for y in [-depth*.32,depth*.32]:
            b.beam((x,y,height+.001),(x,y,height+.009),.019,3,10)
    b.box(0,depth*.49,height-.02,width-.035,.012,.021,6)
    if posts:
        for side in [-1,1]:
            x=side*1.25
            b.beam((x,0,-.4),(x,0,.86),.085,6,16)
            b.lathe([(.087,.80),(.103,.80),(.103,.83),(.087,.83)],3,x,0,24)
            b.lathe([(.085,.87),(.08,.89),(.0,.90)],5,x,0,24)
            b.ring(x,0,.64,.086,.017,30,20)
            b.ring(x,0,.68,.086,.017,30,20)
    return b.finish(.008)
