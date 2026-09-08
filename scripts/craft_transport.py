"""Detailed Valencia tram, stop and bicycle dock; dimensions match the game."""
import math
from craft_mesh import Builder, join, text_mesh

def tram():
    b=Builder('tram_body')
    # Shaped cab shells. The passenger saloon remains open behind the glazing.
    b.box(0,0,.4,13.4,2.08,.18,3)
    b.box(0,0,.51,12.8,1.94,.07,6)
    # A continuous formed roof replaces stacked boxes, including both cab ends.
    outline=[]
    for cx,cy,start in [(1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)]:
        for j in range(9):outline.append((cx,cy,math.radians(start+j*90/8)))
    vs=[]
    for half_length,half_width,r,z in [(6.58,1.09,.34,2.64),(6.53,1.085,.36,2.75),(6.29,.94,.38,2.90)]:
        for cx,cy,a in outline:vs.append((cx*(half_length-r)+r*math.cos(a),cy*(half_width-r)+r*math.sin(a),z))
    n=len(outline)
    fs=[tuple(range(n-1,-1,-1)),tuple(range(2*n,3*n))]
    fs.extend((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j) for k in range(2) for j in range(n))
    first=len(b.f)
    b.poly(vs,fs,0)
    b.smooth_faces.update(range(first+2,len(b.f)))
    for side in [-1,1]:
        y=side*1.055
        b.box(-1.6,y,.82,9.75,.08,.62,1)
        b.box(5.45,y,.82,2.42,.08,.62,1)
        b.box(0,y,2.51,12.35,.085,.33,0)
        for z in [1.12,2.33]:b.box(0,y+side*.012,z,12.45,.065,.045,3)
        for x in [-6.13,-5.15,-3.95,-2.75,-1.55,-.35,.85,2.05,3.27,4.43,5.43,6.13]:
            b.box(x,y,1.74,.075,.10,1.26,0)
            b.box(x,y+side*.052,1.74,.032,.018,1.2,4)
        b.box(3.84,y,.5,1.12,.15,.075,14)
        b.box(3.84,y+side*.030,2.40,1.18,.080,.14,2)
        for x in [3.28,4.40]:b.box(x,y,1.45,.075,.13,1.93,3)
        for x in [-5.5,-4,-2.5,-1,.5,2,5.4]:
            b.box(x,y+side*.047,.8,1.34,.016,.027,0)
            for dx in [-.58,.58]:
                b.sphere(x+dx,y+side*.06,.83,.012,3,n=8,rings=4)
        # Louvered equipment bays on both sides of the skirting.
        for x in [-4.5,4.8]:
            b.box(x,y,.37,1.5,.12,.22,4)
            for j in range(12):b.box(x-.64+j*.115,y+side*.058,.37,.037,.028,.17,3)
    # Rounded end sections, with slope changes in both width and height.
    for end in [-1,1]:
        rings=[(5.98,1.055,.5,2.72),(6.34,.98,.5,2.66),(6.66,.80,.53,2.46),(6.74,.66,.59,1.03)]
        vs=[]
        for x,w,lo,hi in rings:vs.extend([(end*x,-w,lo),(end*x,w,lo),(end*x,w,hi),(end*x,-w,hi)])
        # Lower nose and roof strips leave a real front windscreen aperture.
        b.poly([(end*6.25,-.98,.5),(end*6.25,.98,.5),(end*6.74,.66,.61),(end*6.74,-.66,.61),
                (end*6.25,-.98,1.15),(end*6.25,.98,1.15),(end*6.74,.66,1.06),(end*6.74,-.66,1.06)],
               [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],1)
        b.box(end*6.68,0,.65,.16,1.48,.18,4)
        for side in [-1,1]:
            b.beam((end*6.64,side*.76,1.1),(end*6.30,side*.98,2.48),.045,0)
            b.beam((end*6.30,side*.98,2.48),(end*5.98,side*1.055,2.68),.045,0)
            b.sphere(end*6.73,side*.49,.92,.115,4,sx=.24,sy=1.2,sz=.76)
            b.sphere(end*6.758,side*.49,.935,.083,20,sx=.23,sy=1.2,sz=.64)
            b.sphere(end*6.758,side*.49,.825,.033,22,sx=.25,sy=1.3,sz=.8,n=12,rings=6)
        b.box(end*6.30,0,2.46,.065,1.86,.34,4)
        b.box(end*6.341,0,2.45,.024,1.35,.23,28)
        b.beam((end*6.60,-.05,1.20),(end*6.47,.37,1.81),.013,4)
        b.beam((end*6.47,.37,1.81),(end*6.40,-.32,2.00),.019,4)
        b.box(end*6.73,0,.48,.12,.3,.18,2)
        b.beam((end*6.60,0,.46),(end*6.79,0,.46),.065,3)
        # Cab dashboard, console and the driver seat remain visible through glass.
        b.box(end*5.83,0,1.31,.50,1.65,.14,2)
        b.box(end*5.72,-.26,1.42,.16,.36,.055,28)
        for j in range(5):b.sphere(end*5.70,.05+j*.09,1.42,.018,22,n=8,rings=4)
    # Passenger seating, backs, bases, handrails and grab loops.
    for x in [-5,-3,-1,1,3,5]:
        for side in [-1,1]:
            y=side*.70
            b.box(x,y,.91,.74,.52,.13,8)
            b.box(x,side*.94,1.22,.74,.095,.64,8)
            b.box(x,y,.65,.10,.12,.44,3)
            b.box(x,y,.46,.48,.35,.07,2)
            for xx in [x-.32,x+.32]:
                b.tube([(xx,side*.93,1.50),(xx,side*.88,1.10),(xx,side*.48,1.01)],.021,3)
    for x in [-3.5,.4,3.1]:
        for side in [-1,1]:
            b.beam((x,side*.42,.55),(x,side*.42,2.66),.026,14)
    for side in [-1,1]:
        b.beam((-5.45,side*.5,2.50),(5.45,side*.5,2.50),.025,14)
        b.box(0,side*.64,2.67,10.3,.075,.025,20)
        for x in [-4,-2,0,2,4]:
            b.tube([(x-.07,side*.5,2.48),(x-.11,side*.5,2.24),(x+.11,side*.5,2.24),(x+.07,side*.5,2.48)],.012,30)
    # Two bogies: wheel tyres, flanges, axle boxes and primary springs.
    for bogie in [-4.7,4.7]:
        b.box(bogie,0,.25,1.95,1.65,.22,2)
        for x in [bogie-.63,bogie+.63]:
            b.beam((x,-.83,.2),(x,.83,.2),.09,3)
            for side in [-1,1]:
                b.beam((x,side*.65,.23),(x,side*.85,.23),.235,4,32)
                b.beam((x,side*.85,.23),(x,side*.89,.23),.17,3,28)
                b.beam((x,side*.89,.23),(x,side*.92,.23),.06,2,16)
                b.box(x,side*.91,.38,.24,.11,.19,3)
                b.tube([(x+.22+.055*math.cos(j*math.tau/8),side*.78+.055*math.sin(j*math.tau/8),.26+j*.006) for j in range(33)],.012,3,6)
    # Roof HVAC, cable runs and a folded pantograph with a contact shoe.
    for x in [-2.7,2.1]:
        b.box(x,0,3.01,1.75,1.25,.26,3)
        b.box(x,0,3.155,1.65,1.13,.045,0)
        for dx in [-.4,.4]:
            b.ring(x+dx,0,3.19,.29,.017,2,24)
            for j in range(7):b.box(x+dx-.23+j*.075,0,3.19,.018,.48,.012,2)
    b.box(-.3,0,2.99,.95,.77,.15,2)
    for side in [-1,1]:
        b.beam((-.65,side*.3,3.1),(.65,side*.3,3.75),.026,3)
        b.beam((.65,side*.3,3.75),(-.45,side*.3,4.02),.023,3)
    b.box(-.45,0,4.03,.13,1.40,.065,4)
    b.tube([(-3.7,.75,2.98),(-.8,.75,2.98),(-.8,.35,3.10)],.017,4)
    body=b.finish(.014)
    texts=[]
    for end in [-1,1]:
        texts.append(text_mesh('4  LA MARINA',(end*6.358,0,2.45),.13,22,(math.pi/2,0,end*math.pi/2)))
    texts.append(text_mesh('metrovalencia',(0,-1.112,.91),.19,0))
    texts.append(text_mesh('metrovalencia',(0,1.112,.91),.19,0,(math.pi/2,0,math.pi)))
    body=join('tram_body',[body]+texts)
    panes=Builder('tram_glass')
    for side in [-1,1]:
        for a,c in [(-6.11,-5.19),(-5.11,-3.99),(-3.91,-2.79),(-2.71,-1.59),(-1.51,-.39),(-.31,.81),(.89,2.01),(2.09,3.23),(4.47,5.39),(5.47,6.11)]:
            panes.box((a+c)/2,side*1.059,1.73,c-a,.015,1.15,32)
    for end in [-1,1]:
        panes.poly([(end*6.62,-.72,1.14),(end*6.62,.72,1.14),(end*6.32,.91,2.29),(end*6.32,-.91,2.29)],[(0,1,2,3),(3,2,1,0)],32)
    glass=panes.finish(0)
    # Door origins stay at the existing slider anchors. The runtime moves X only.
    doors=[]
    for side in [-1,1]:
        d=Builder('tram_door_'+str(side))
        for x in [-.51,.51]:d.box(x,0,1.46,.044,.07,1.82,3)
        for z in [.57,1.07,2.35]:d.box(0,0,z,1.045,.07,.045,3)
        d.box(0,0,.82,.98,.065,.46,1)
        d.box(0,side*.02,1.7,.96,.016,1.20,32)
        d.box(.27,side*.035,1.52,.025,.030,.30,14)
        d.box(-.37,side*.045,1.26,.10,.022,.12,12)
        root=d.finish(.009)
        root.location=(3.84,side*1.071,0)
        doors.append(root)
    return [body,glass,*doors]

def shelter():
    b=Builder('tram_stop')
    for x in [-3.5,3.5]:
        b.box(x,0,1.45,.16,.17,2.9,2)
        b.box(x,0,.06,.25,.26,.12,3)
        for dx in [-.085,.085]:b.sphere(x+dx,-.09,.13,.02,14,n=8,rings=4)
        b.beam((x,0,2.63),(x,-.88,2.96),.046,3)
        b.beam((x,0,2.63),(x,.94,2.96),.046,3)
    # Rounded folded canopy with standing seams and concealed soffit lights.
    for j in range(16):
        x=-3.75+j*.5
        b.box(x,0,3.035,.495,2.58,.115,2)
        b.box(x+.247,0,3.102,.023,2.57,.018,3)
    for y in [-1.28,1.28]:b.box(0,y,3.0,8.0,.05,.19,3)
    for x in [-2,2]:b.box(x,.15,2.952,1.18,.10,.016,20)
    for x in [-3.5,-1.17,1.17,3.5]:b.box(x,-.89,1.75,.055,.065,2.24,3)
    for z in [.62,2.87]:b.box(0,-.89,z,7.1,.07,.052,3)
    for j in range(19):
        x=-3.26+j*.363
        b.box(x,-.944,1.45,.17,.015,.04,20)
    # Teak bench, metal supports and visible end grain.
    for j in range(4):b.box(0,-.03+j*.16,.78,4,.137,.065,5)
    for x in [-1.6,0,1.6]:
        b.tube([(x,-.25,.1),(x,-.32,.71),(x,.51,.71),(x,.38,.1)],.032,2)
        b.box(x,0,.09,.25,.73,.06,2)
    for x in [-1.95,1.95]:b.box(x,.21,.78,.025,.65,.06,6)
    # Route diagram is built as actual enamel inlay, readable from the waiting side.
    b.box(-2.75,-.82,1.86,.69,.095,1.18,2)
    b.box(-2.75,-.754,1.86,.61,.018,1.10,20)
    b.box(-2.90,-.739,1.89,.024,.01,.78,1)
    for i in range(6):
        b.sphere(-2.90,-.729,2.22-i*.13,.031,12,n=12,rings=6)
        b.box(-2.65,-.732,2.22-i*.13,.29,.014,.016,2)
    b.box(2.78,-.81,1.85,.57,.14,.88,3)
    b.box(2.78,-.73,2.05,.43,.025,.32,28)
    b.box(2.78,-.72,1.72,.31,.033,.13,12)
    root=b.finish(.014)
    gl=Builder('tram_stop_glass')
    for x in [-2.34,0,2.34]:gl.box(x,-.89,1.75,2.25,.018,2.18,32)
    glass=gl.finish(0)
    glass.parent=root
    return root

def bike_dock():
    b=Builder('cycle_dock')
    b.box(0,0,.14,4,1.4,.27,10)
    b.box(0,0,.284,3.91,1.30,.022,11)
    for x in [-1.3,0,1.3]:
        b.box(x,0,.59,.23,.34,.9,3)
        b.box(x,-.01,1.065,.27,.37,.105,2)
        b.box(x,-.187,.88,.12,.015,.16,28)
        b.sphere(x,-.199,.77,.027,12,n=12,rings=6)
        b.box(x,0,.30,.34,.46,.07,2)
        for dx in [-.12,.12]:b.sphere(x+dx,-.14,.346,.017,3,n=8,rings=4)
        b.box(x,.19,.67,.09,.08,.15,4)
    for x in [-1.94,1.94]:
        b.box(x,0,.29,.014,1.26,.014,13)
    return b.finish(.018)
