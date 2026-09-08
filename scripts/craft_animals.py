"""Small street animals, with separate parts for the existing animation handles."""
import math
from craft_mesh import Builder

def pigeon():
    b=Builder('pigeon_body')
    b.sphere(0,.02,.20,.16,23,sx=.78,sy=1.32,sz=.88,n=24,rings=14)
    b.sphere(0,-.10,.30,.095,24,sx=.83,sy=.88,sz=1.4,n=24,rings=12)
    b.sphere(0,-.125,.365,.073,23,sx=.90,sy=1.02,sz=.92,n=24,rings=12)
    b.beam((0,-.180,.346),(0,-.270,.332),.019,4,14,r2=.002)
    b.sphere(0,-.197,.357,.029,20,sx=.58,sy=1,sz=.34,n=12,rings=6)
    for side in [-1,1]:
        b.sphere(side*.061,-.157,.376,.014,15,sx=.35,sy=1,sz=1,n=16,rings=8)
        b.sphere(side*.066,-.16,.378,.009,4,sx=.4,sy=1,sz=1,n=12,rings=6)
        b.sphere(side*.069,-.164,.381,.0027,20,n=8,rings=4)
        b.beam((side*.044,-.018,.12),(side*.044,-.015,.025),.009,31,10)
        for toe in [-1,0,1]:
            b.tube([(side*.044,-.015,.025),(side*.044+toe*.019,-.061,.013),(side*.044+toe*.024,-.082,.011)],.005,31,6)
        b.beam((side*.044,-.012,.02),(side*.044,.036,.012),.006,31,8)
    for j in range(7):
        x=(j-3)*.023
        b.sphere(x,.192,.165,.065,23,sx=.21,sy=1.9,sz=.13,n=12,rings=6)
        b.sphere(x,.272,.161,.025,4,sx=.50,sy=1,sz=.22,n=10,rings=6)
    roots=[b.finish(0)]
    for side in [-1,1]:
        b=Builder('pigeon_wing_'+str(side))
        b.sphere(side*.045,0,0,.14,23,sx=.66,sy=1.34,sz=.21,n=20,rings=10)
        for j in range(9):
            b.sphere(side*(.04+j*.008),.06+j*.013,-.006,.088,23,sx=.15,sy=1.38,sz=.105,n=16,rings=8)
        for y in [-.015,.047]:
            b.tube([(side*.02,y,.026),(side*.085,y+.025,.018),(side*.125,y+.06,.002)],.012,4,6)
        b.v=[(x-side*.006,y,z) for x,y,z in b.v]
        o=b.finish(0)
        o.location=(side*.095,.04,.21)
        roots.append(o)
    return roots

def cat():
    b=Builder('cat_body')
    first=len(b.f)
    b.sphere(0,.03,.33,.23,26,sx=.72,sy=1.65,sz=.76,n=48,rings=24)
    # Continuous cylindrical UVs keep the soft coat markings on the skin.
    for i in range(first,len(b.f)):
        uv=[]
        for vertex in b.f[i]:
            x,y,z=b.v[vertex]
            uv.append(((math.atan2(x/.1656,(z-.33)/.1748)+math.pi)/math.tau,(y-.03)/.759+.5))
        if max(u for u,v in uv)-min(u for u,v in uv)>.5:
            uv=[(0 if u<.5 else 1,v) for u,v in uv]
        b.face_uv[i]=uv
    b.sphere(0,-.25,.405,.17,25,sx=.79,sy=1.1,sz=1.03,n=24,rings=14)
    b.sphere(0,-.38,.54,.16,25,sx=1,sy=.92,sz=.92,n=32,rings=16)
    b.sphere(0,-.478,.475,.068,7,sx=1.10,sy=.6,sz=.55,n=20,rings=10)
    for side in [-1,1]:
        b.poly([(side*.04,-.40,.66),(side*.175,-.38,.62),(side*.13,-.365,.79),
                (side*.06,-.33,.65),(side*.17,-.33,.64)],[(0,1,2),(1,4,2),(4,3,2),(3,0,2),(0,3,4,1)],25)
        b.poly([(side*.069,-.408,.663),(side*.147,-.389,.651),(side*.127,-.373,.752)],[(0,1,2),(2,1,0)],31)
        b.sphere(side*.082,-.502,.55,.032,4,sx=1.05,sy=.29,sz=.68,n=20,rings=10)
        b.sphere(side*.082,-.511,.552,.025,17,sx=1.02,sy=.26,sz=.66,n=20,rings=10)
        b.sphere(side*.083,-.518,.552,.015,4,sx=.29,sy=.26,sz=1,n=16,rings=8)
        b.sphere(side*.074,-.522,.562,.005,20,n=8,rings=4)
        b.sphere(side*.042,-.518,.48,.048,7,sx=.91,sy=.38,sz=.58,n=16,rings=8)
        for j in range(3):b.tube([(side*.050,-.538,.49-j*.013),(side*.13,-.551,.50-j*.02),(side*.23,-.54,.51-j*.027)],.0024,7,6)
    b.sphere(0,-.546,.494,.022,31,sx=1,sy=.4,sz=.7,n=12,rings=6)
    b.beam((0,-.544,.48),(0,-.539,.461),.004,6,6)
    roots=[b.finish(0)]
    for x in [-.11,.11]:
        for z in [-.26,.24]:
            b=Builder('cat_leg_'+str(len(roots)))
            b.sphere(0,0,.055,.069,25,sx=.8,sy=.84,sz=1.8,n=20,rings=10)
            b.beam((0,0,.025),(0,-.012,-.115),.039,25,16,r2=.032)
            b.sphere(0,-.033,-.128,.043,7,sx=1,sy=1.45,sz=.52,n=16,rings=8)
            for dx in [-.019,0,.019]:b.beam((dx,-.071,-.116),(dx,-.080,-.13),.003,6,6)
            o=b.finish(0)
            o.location=(x,-z,.16)
            roots.append(o)
    b=Builder('cat_tail')
    ts=[j/20 for j in range(21)]
    pts=[(0,.16*t*t,.64*t-.20*t*t-.23) for t in ts]
    first=len(b.f)
    b.tube(pts,[.043*(1-.70*t) for t in ts],25,12)
    for j in range(20):
        if j%5<2:
            for face in range(first+2+j*12,first+2+(j+1)*12):b.mi[face]=6
    b.sphere(*pts[-1],.013,25,n=12,rings=6)
    o=b.finish(0)
    o.location=(0,.44,.58)
    roots.append(o)
    return roots
