"""Original civic furniture, ceramic work and cafe objects."""
import math
import random
from craft_mesh import Builder, join, text_mesh
from craft_coast import leaf_blade

def bench():
    b=Builder('park_bench')
    for j in range(5):b.box(0,-.27+j*.127,.43,2,.103,.066,5)
    for j in range(4):
        z=.63+j*.12
        b.box(0,.37+(z-.6)*.10,z,2,.065,.09,5)
    for side in [-1,1]:
        x=side*.80
        b.tube([(x,-.31,.04),(x,-.24,.33),(x,-.24,.39),(x,.32,.39),(x,.34,.90)],.033,2)
        b.tube([(x,.31,.04),(x,.26,.26),(x,.21,.39)],.033,2)
        b.tube([(x,-.23,.41),(x,-.23,.65),(x,-.13,.69),(x,.36,.69)],.026,2)
        b.box(x,-.29,.03,.18,.16,.05,2)
        b.box(x,.29,.03,.18,.16,.05,2)
        for yy in [-.27,.238]:b.sphere(x,yy,.468,.014,14,n=8,rings=4)
        for zz in [.64,.88]:b.beam((x,.405,zz),(x,.42,zz),.017,14,10)
    b.beam((-.80,.19,.23),(.80,.19,.23),.024,2)
    return b.finish(.012)

def lantern():
    b=Builder('city_lantern')
    b.lathe([(0,0),(.17,0),(.17,.12),(.14,.18),(.115,.31),(.10,.46),(.065,.52),(.052,3.88),(.13,3.96),(.16,4.02),(.0,4.02)],2,n=40)
    for z,r in [(.14,.165),(.44,.11),(3.55,.068),(3.93,.11)]:b.ring(0,0,z,r,.012,14,32)
    b.box(0,0,4.04,.37,.37,.08,2)
    for x in [-.18,.18]:
        for y in [-.18,.18]:b.beam((x*.80,y*.80,4.06),(x,y,4.61),.018,2,10)
    for z in [4.08,4.60]:
        b.box(0,-.18,z,.38,.026,.025,2)
        b.box(0,.18,z,.38,.026,.025,2)
        b.box(-.18,0,z,.026,.38,.025,2)
        b.box(.18,0,z,.026,.38,.025,2)
    b.box(0,0,4.66,.48,.48,.08,2)
    # Pyramidal copper roof with a rolled edge, hip seams and a finial.
    b.poly([(-.27,-.27,4.69),(.27,-.27,4.69),(.27,.27,4.69),(-.27,.27,4.69),(0,0,4.91)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],2)
    for x in [-.27,.27]:
        for y in [-.27,.27]:b.beam((x,y,4.70),(0,0,4.91),.01,3,6)
    b.sphere(0,0,4.96,.045,14,n=16,rings=8)
    return b.finish(.007)

def flower_box():
    b=Builder('flower_planter')
    b.box(0,0,.25,.65,2.8,.48,15)
    b.box(0,0,.51,.71,2.9,.085,15)
    b.box(0,0,.557,.57,2.72,.015,21)
    for y in [-1.39,1.39]:b.box(0,y,.29,.66,.025,.32,12)
    for side in [-1,1]:
        for j in range(9):
            y=-1.2+j*.3
            b.box(side*.338,y,.29,.015,.22,.20,13)
            b.sphere(side*.35,y,.29,.044,12,sx=.15,sy=1,sz=1,n=12,rings=6)
    container=b.finish(.011)
    b=Builder('planter_flowers')
    rng=random.Random(72)
    for j in range(31):
        x,y=rng.uniform(-.24,.24),rng.uniform(-1.26,1.26)
        h=rng.uniform(.14,.36)
        b.beam((x,y,.55),(x,y,.55+h),.008,16,6)
        for k in range(3):leaf_blade(b,(x,y,.6),k*2.2+j,.19,.035,16+k%2,.9)
        for k in range(5):
            a=k*math.tau/5
            b.sphere(x+.037*math.cos(a),y+.037*math.sin(a),.55+h,.034,27,sx=1,sy=1,sz=.6,n=10,rings=6)
        b.sphere(x,y,.57+h,.019,14,n=8,rings=4)
    return join('flower_planter',[container,b.finish(0)])

def pot():
    b=Builder('terracotta_pot')
    b.lathe([(0,.015),(.19,.015),(.20,.07),(.275,.5),(.295,.52),(.316,.54),(.316,.61),(.265,.61),(.256,.52),(.17,.11),(0,.11)],15,n=48)
    b.ring(0,0,.57,.312,.009,13)
    b.lathe([(0,.525),(.25,.525)],21,n=40)
    root=b.finish(.004)
    b=Builder('pot_plant')
    for j in range(22):
        a=j*2.4
        leaf_blade(b,(.045*math.cos(a),.045*math.sin(a),.53),a,.29+(j%5)*.056,.033,16+j%2,.65)
    return [root,b.finish(0)]

def fountain(name='civic_fountain',radius=2.4,top=1.7,water=False):
    b=Builder(name)
    # The basin is an actual bowl: rolled coping, glazed inner wall and floor.
    r=radius
    bottom=.14 if radius<2 else .03
    b.lathe([(0,bottom),(r-.12,bottom),(r,bottom+.06),(r,bottom+.15),(r-.04,.41),(r,.44),(r,.52),(r-.10,.57),(r-.25,.57),(r-.29,.48),(r-.25,.32),(r-.32,.25),(0,.25)],10,n=80)
    b.lathe([(r-.28,.29),(r-.25,.45),(r-.26,.48)],12,n=80)
    b.ring(0,0,.52,r-.015,.026,13,80)
    for i in range(48):
        a=i*math.tau/48
        x,y=(r-.012)*math.cos(a),(r-.012)*math.sin(a)
        b.box(x,y,.34,.034,.14,.115,11,a)
    # Carved baluster: multiple changes of profile and a scalloped upper dish.
    ztop=.98 if radius<2 else 1.52
    b.lathe([(0,.25),(.36,.25),(.36,.32),(.26,.37),(.23,.44),(.18,.54),(.23,ztop-.27),(.34,ztop-.20),(.34,ztop-.13),(.23,ztop-.10)],10,n=48)
    bowl=.90 if radius<2 else 1.04
    b.lathe([(.23,ztop-.12),(.48,ztop-.09),(bowl,ztop-.03),(bowl+.025,ztop+.025),(bowl-.03,ztop+.08),(bowl-.13,ztop+.07),(.42,ztop-.01),(.23,ztop-.01)],13,n=64)
    b.lathe([(0,ztop-.01),(.17,ztop-.01),(.17,top-.09),(.11,top-.025),(0,top+.045)],10,n=40)
    for i in range(16):
        a=i*math.tau/16
        b.sphere((bowl-.02)*math.cos(a),(bowl-.02)*math.sin(a),ztop+.015,.06,12,sx=1,sy=1,sz=.68,n=12,rings=6)
    if water:
        b.lathe([(0,.40),(r-.3,.40)],29,n=80)
        b.lathe([(.19,ztop+.018),(bowl-.16,ztop+.018)],29,n=64)
        b.beam((0,0,top+.04),(0,0,top+.10),.032,14,16)
        for i in range(12):
            a=i*math.tau/12
            b.tube([(math.cos(a)*1.68*t,math.sin(a)*1.68*t,top+.1+2*t-3.39*t*t) for t in [j/20 for j in range(21)]],.012,29,8)
    return b.finish(.008)

def bistro():
    b=Builder('bistro_table')
    b.lathe([(0,.05),(.40,.05),(.43,.085),(.25,.12),(.055,.19),(.045,.71),(.14,.74),(.67,.75),(.68,.82),(.63,.84),(0,.84)],2,n=48)
    # Radial ceramic inlay with a small rosette at the centre.
    b.lathe([(0,.845),(.61,.845)],13,n=64)
    for j in range(24):
        a=j*math.tau/24
        b.box(.49*math.cos(a),.49*math.sin(a),.85,.115,.07,.012,12,a)
    for j in range(8):
        a=j*math.tau/8
        b.sphere(.15*math.cos(a),.15*math.sin(a),.85,.07,12,sx=1,sy=.5,sz=.05,n=12,rings=6)
    # Two bentwood chairs preserve the original seat positions and table envelope.
    for x in [-.85,.85]:
        for dx in [-.18,.18]:
            for y in [-.18,.18]:b.beam((x+dx*1.12,y*1.15,.025),(x+dx,y,.46),.023,5)
        b.box(x,0,.48,.49,.48,.065,5)
        b.tube([(x-.23,.20,.43),(x-.23,.23,.86),(x-.16,.24,1.0),(x+.16,.24,1.0),(x+.23,.23,.86),(x+.23,.20,.43)],.026,5)
        for dx in [-.13,0,.13]:b.beam((x+dx,.22,.54),(x+dx,.24,.96),.019,5)
        b.beam((x-.18,-.16,.19),(x+.18,-.16,.19),.014,5)
    # Porcelain cups, coffee and an orange in a shallow saucer.
    for x,y in [(-.23,-.17),(.26,.12)]:
        b.lathe([(0,.857),(.11,.857),(.12,.873),(.06,.887),(0,.887)],20,x,y,24)
        b.lathe([(.045,.882),(.055,.896),(.062,1.0),(.054,1.007),(.050,.91)],20,x,y,24)
        b.lathe([(0,.987),(.052,.987)],21,x,y,24)
        b.tube([(x+.053,y,.91),(x+.097,y,.91),(x+.10,y,.976),(x+.058,y,.98)],.009,20,8)
    b.box(.10,-.31,.86,.17,.22,.008,7,.14)
    return b.finish(.006)

def cafe_counter():
    b=Builder('cafe_counter')
    b.box(0,0,.47,2.5,.80,.82,2)
    for x in [-1.23,1.23]:b.box(x,0,.46,.055,.83,.85,5)
    for j in range(12):
        x=-1.08+j*.196
        b.box(x,-.411,.48,.155,.027,.65,8)
        b.box(x,.411,.48,.155,.027,.65,8)
    b.box(0,0,.94,2.7,1,.12,5)
    b.box(0,-.485,.989,2.58,.045,.025,14)
    for x in [-1.2,1.2]:b.beam((x,-.36,1),(x,-.36,3.0),.044,2)
    b.box(0,-.36,2.95,2.65,.20,.16,5)
    # Espresso machine: metal body, group head, steam wand and a cup rail.
    b.box(-.62,.03,1.22,.69,.49,.45,3)
    b.box(-.62,-.234,1.20,.61,.033,.30,2)
    b.box(-.62,-.38,1.032,.73,.34,.04,3)
    for j in range(9):b.box(-.93+j*.077,-.38,1.058,.020,.27,.01,2)
    for x in [-.80,-.47]:
        b.beam((x,-.27,1.27),(x,-.36,1.27),.055,3,20)
        b.beam((x,-.34,1.24),(x,-.51,1.24),.022,4)
        b.sphere(x,-.26,1.34,.025,14,n=12,rings=6)
    b.tube([(-.29,-.22,1.29),(-.19,-.31,1.24),(-.18,-.40,1.09)],.012,3)
    b.ring(-.8,-.02,1.469,.047,.009,3,20)
    b.box(.61,.13,1.08,.78,.37,.13,5)
    for j in range(5):b.sphere(.33+j*.14,.13,1.22,.088,15,sx=.66,sy=1,sz=.56,n=16,rings=8)
    b.box(.61,-.29,1.18,.47,.042,.33,2)
    root=b.finish(.012)
    return join('cafe_counter',[root,text_mesh('CAFÉ',(.61,-.317,1.21),.14,20),text_mesh('VALÈNCIA',(0,-.431,.52),.17,7)])

def awning():
    # Origin is the existing hinge. Runtime still controls local depth and sway.
    b=Builder('cafe_awning')
    for j in range(7):
        x=(j-3)*.40
        vs=[]
        for k in range(13):
            y=-1.9*k/12
            z=-.18*k/12-.12*(k/12)**2
            vs.extend([(x-.197,y,z),(x+.197,y,z)])
        fs=[(k*2,k*2+2,k*2+3,k*2+1) for k in range(12)]
        b.poly(vs,fs+[tuple(reversed(f)) for f in fs],7 if j%2 else 9)
        points=[]
        for k in range(9):
            xx=x-.20+k*.05
            points.extend([(xx,-1.9,-.30),(xx,-1.9,-.41-.055*math.sin(k*math.pi/8))])
        fs=[(k*2,k*2+2,k*2+3,k*2+1) for k in range(8)]
        b.poly(points,fs+[tuple(reversed(f)) for f in fs],7 if j%2 else 9)
        b.tube([points[k*2+1] for k in range(9)],.006,7,6)
    b.beam((-1.37,0,.016),(1.37,0,.016),.055,5,24)
    b.beam((-1.39,-1.9,-.30),(1.39,-1.9,-.30),.021,2)
    for x in [-1.23,1.23]:b.tube([(x,0,-.08),(x,-.9,-.22),(x,-1.9,-.32)],.018,3)
    return b.finish(0)

def crops():
    b=Builder('rice_clump')
    rng=random.Random(302)
    for j in range(13):
        a=j*2.4
        x,y=rng.uniform(-.22,.22),rng.uniform(-.22,.22)
        leaf_blade(b,(x,y,.02),a,.45+rng.random()*.25,.013,17,.32)
        if j%3==0:
            b.tube([(x,y,.02),(x+.03,y,.55),(x+.17,y,.64),(x+.25,y,.59)],.007,18,6)
            for k in range(5):b.sphere(x+.12+k*.026,y,.62-(k/8)**2*.12,.017,18,sx=.7,sy=.7,sz=1.8,n=8,rings=4)
    return b.finish(0)
