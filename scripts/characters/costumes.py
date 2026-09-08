"""Explorer clothing and Valencian festival dress from the Fallas design sheet."""
import math
from mesh import Mesh,tint,rgb
from design import PALETTES,head,shirt,leg,arm,accessories

HEROES=[
 dict(PALETTES[0],name='hero_male',hero=True,vest='#286488',scarf=True),
 dict(PALETTES[0],name='hero_female',hero=True,female=True,hat=False,hair='#68412c',skin='#c7946c',vest='#286488',scarf=True),
]
FESTIVAL=[
 dict(PALETTES[1],name='fallera_blue',fallera=True,shirt='#297d91',skirt='#286d86',pants='#ded6bb',shoe='#38596a',hair='#352820',major=True),
 dict(PALETTES[4],name='fallera_rose',fallera=True,shirt='#a96376',skirt='#a96376',pants='#ded6bb',shoe='#6e4151',hair='#3e2a20',major=False),
 dict(PALETTES[2],name='fallero',fallero=True,shirt='#ece2c9',pants='#35414b',shoe='#292d2b',skin='#c58b60',vest='#763c46'),
]
BAND=[dict(PALETTES[i%5],name='band_'+role,band=role,shirt='#273b55',pants='#273b55',shoe='#262b2d',bag=None,hat=False,female=i%3==1)
      for i,role in enumerate(['trumpet','trombone','tuba','clarinet','snare','bass','cymbals'])]
from diversity import residents, body_shape, outfit_details, resident_top
RESIDENTS=residents(PALETTES[1])
HEROES[0].update(hairstyle='wave',face_width=1.03,jaw=1.09)
HEROES[1].update(hairstyle='wave',face_width=.96,jaw=.86)
for i,p in enumerate(FESTIVAL+BAND):
    p.update(face_width=.94+(i%4)*.05,jaw=.88+(i%3)*.10,nose=.9+(i%4)*.1,hairstyle='crop' if p.get('band') else 'wave')
VARIANTS=HEROES+RESIDENTS+FESTIVAL+BAND


def flower(m,center,radius,color,normal=(0,0,1),petals=5):
    from mathutils import Vector
    n=Vector(normal);n.normalize()
    u=n.cross(Vector((0,1,0))).normalized();v=n.cross(u).normalized();c=Vector(center)
    for j in range(petals):
        a=j*math.tau/petals;direction=u*math.cos(a)+v*math.sin(a);side=n.cross(direction)
        points=[c+n*.001,c+direction*radius*.43+side*radius*.26+n*.002,
                c+direction*radius*.92+side*radius*.15+n*.003,
                c+direction*radius,c+direction*radius*.92-side*radius*.15+n*.003,
                c+direction*radius*.43-side*radius*.26+n*.002]
        m.poly([tuple(p) for p in points],[(0,1,2),(0,2,3),(0,3,4),(0,4,5)],color)
    m.ellipsoid(center,(radius*.14,radius*.14,radius*.14),'#d1b477',8,4)


def vest(m,p):
    color=p['vest']
    for side in [-1,1]:
        rows=[(.898,.146,.106),(.96,.147,.106),(1.08,.155,.113),(1.2,.173,.129),(1.31,.18,.115),(1.375,.124,.075)]
        if p.get('hero'):rows=rows[:-1]+[(1.35,.181,.105),(1.375,.158,.087)]
        rows=[(y,rx+.008,rz+.012) for y,rx,rz in rows]
        verts=[];n=9
        for y,rx,rz in rows:
            for j in range(n):
                a=side*(.14+j*(math.pi-.28)/(n-1));verts.append((rx*math.sin(a),y,rz*math.cos(a)))
        faces=[]
        for k in range(len(rows)-1):
            for j in range(n-1):
                a=k*n+j;f=(a,a+1,a+n+1,a+n);faces.append(f if side>0 else tuple(reversed(f)))
        m.poly(verts,faces,color)
        m.tube([(side*rx*.14,y,rz+.004)for y,rx,rz in rows],.0035,'#d8ba79',6)
        m.tube([(side*.021,.901,.11),(side*.07,.898,.10),(side*.13,.9,.066)],.0035,'#d8ba79',6)
        for j in range(3):
            y=.962+j*.076;x=side*(.085+j*.008)
            lower=max(k for k,row in enumerate(rows) if row[0]<=y);upper=min(lower+1,len(rows)-1)
            t=(y-rows[lower][0])/(rows[upper][0]-rows[lower][0])
            rx=rows[lower][1]*(1-t)+rows[upper][1]*t;rz=rows[lower][2]*(1-t)+rows[upper][2]*t
            z=rz*math.sqrt(1-(x/rx)**2)+.004
            flower(m,(x,y,z),.016,'#d7c79a')
            m.tube([(x,y-.025,z),(x+side*.008,y-.002,z),(x+side*.004,y+.023,z)],.0015,'#c8bd88',5)
    if p.get('hero'):
        # Ceramic orange-blossom badge, camera, map roll and pack embroidery.
        m.ellipsoid((-.075,1.27,.125),(.023,.026,.008),'#e8dfc6',16,8)
        flower(m,(-.075,1.27,.136),.021,'#427ead',normal=(0,0,1),petals=8)
        m.rings([(1.035,.052,.021,0,.152),(1.10,.056,.024,0,.154),(1.11,.045,.02,0,.154)],'#34454a',16)
        m.ellipsoid((0,1.072,.18),(.027,.026,.014),'#c7c7b5',16,8)
        m.ellipsoid((0,1.072,.19),(.019,.019,.008),'#29424d',16,8)
        m.ellipsoid((0,1.075,.197),(.008,.008,.002),'#789cad',12,6)
        for s in [-1,1]:m.tube([(s*.043,1.10,.17),(s*.084,1.295,.11),(s*.061,1.42,.025)],.004,'#544337',6)
        m.tube([(.142,1.11,-.18),(.18,1.43,-.18)],.027,'#dfd3af',16)
        for j in range(3):m.tube([(.154,1.35+j*.022,-.153),(.19,1.354+j*.022,-.153)],.0013,'#a8936d',5)
        flower(m,(0,1.055,-.294),.032,'#e7d9ac',normal=(0,0,-1))
        for side in [-1,1]:
            for j in range(7):
                y=.935+j*.050;x=side*(.047+.008*math.sin(j*.8));z=.128 if y<1.1 else .142
                m.tube([(x,y,z),(x+side*.008,y+.016,z),(x+side*.005,y+.029,z)],.0009,'#c5b185',5)
                m.ellipsoid((x+side*.009,y+.013,z+.001),(.005,.009,.0017),'#b8b189',10,6)
            # Closely spaced seams follow the shoulder and lower waistcoat edge.
            for j in range(16):
                x=side*(.033+j*.0065)
                m.tube([(x,.913,.125-abs(x)*.31),(x+side*.002,.915,.125-abs(x)*.31)],.0008,'#d0bd91',5)
        if p['hat']:
            flower(m,(-.105,1.82,.099),.028,'#f4ead2')
            m.ellipsoid((-.126,1.81,.112),(.026,.009,.006),'#577654',12,6)
        if p['female']:
            # A long braid changes the silhouette, even from the follow camera.
            for strand in range(3):
                pts=[]
                for j in range(64):
                    t=j/63;a=t*math.tau*7+strand*math.tau/3
                    pts.append((-.105+.012*math.sin(a)*(1-.55*t),1.60-t*.39,.036+t*.066+.009*math.sin(2*a)*(1-.55*t)))
                m.tube(pts,[.011*(1-j/100) for j in range(64)],tint(p['hair'],1+strand*.10),10)
                m.tube([(x-.002,y,z+.006)for x,y,z in pts],.0008,tint(p['hair'],1.35),5)
            m.rings([(1.197,.016,.014,-.106,.104),(1.217,.017,.016,-.106,.104)],'#c58547',12)


def skirt_profile(y):
    t=max(0,min(1,(y-.07)/.91))
    return .475-.315*t**1.45,.415-.305*t**1.45


def fallera_dress(m,p):
    color=p['skirt'];lace='#eee2bd';gold='#cbaa62'
    m.rings([(y,*skirt_profile(y),0,-.005)for y in [.07+i*.91/20 for i in range(21)]],color,64,folds=.033)
    m.rings([(.061,.47,.412,0,-.005),(.078,.48,.419,0,-.005)],gold,64)
    # Brocade bouquets follow the curved skirt instead of floating in front.
    for row in range(6):
        y=.17+row*.126;rx,rz=skirt_profile(y)
        for j in range(16):
            a=(j+.5*(row%2))*math.tau/16
            ripple=1+.033*math.sin(a*6+((y-.07)/.91*20)*1.9)
            center=(rx*math.sin(a)*ripple*1.008,y,-.005+rz*math.cos(a)*ripple*1.008)
            flower(m,center,.022 if row<4 else .017,'#d7bb86',normal=(math.sin(a),.24,math.cos(a)))
    # Embroidered apron, with a scalloped edge and a light floral pattern.
    vertices=[];steps=20;rows=14
    for k in range(rows):
        y=.13+k*.78/(rows-1);rx,rz=skirt_profile(y)
        for j in range(steps+1):
            a=-.64+j*1.28/steps;wave=.006*math.cos(j*math.pi) if k==0 else 0
            vertices.append(((rx+.012)*math.sin(a),y+wave,-.005+(rz+.014)*math.cos(a)))
    faces=[]
    for k in range(rows-1):
        for j in range(steps):
            a=k*(steps+1)+j;faces.append((a,a+1,a+steps+2,a+steps+1))
    m.poly(vertices,faces,lace)
    for edge in [vertices[:steps+1],vertices[::steps+1],vertices[steps::steps+1]]:m.tube(edge,.0035,'#d3c49e',6)
    for row in range(5):
        y=.22+row*.135;rx,rz=skirt_profile(y)
        for a in [-.39,0,.39]:flower(m,((rx+.016)*math.sin(a),y,(rz+.02)*math.cos(a)-.005),.027,'#cdbb92',normal=(math.sin(a),.2,math.cos(a)),petals=6)
    # Fitted bodice, shoulder lace, central pendant and Valencian sash.
    m.rings([(.945,.156,.109,0,0),(1.03,.137,.098,0,0),(1.15,.159,.11,0,0),
             (1.29,.177,.118,0,-.004),(1.37,.13,.079,0,-.002),(1.405,.064,.056,0,0)],p['shirt'],32)
    for s in [-1,1]:
        shawl=[(s*.05,1.421,.064),(s*.153,1.375,.068),(s*.178,1.315,.064),
               (s*.078,1.261,.13),(s*.014,1.21,.132),(s*.018,1.334,.127)]
        m.poly(shawl,[(0,1,5),(1,2,3,5),(3,4,5)],lace)
        m.tube(shawl+[shawl[0]],.003,'#d8c89f',6)
        for j in range(4):
            flower(m,(s*(.035+j*.023),1.283+j*.018,.137-j*.013),.007,'#cbb98d',petals=6)
        for j in range(4):flower(m,(s*(.053+j*.025),1.407-j*.022,.065+j*.013),.009,'#dfd0a7',petals=6)
    m.tube([(-.05,1.439,.041),(-.041,1.401,.066),(0,1.38,.082),(.041,1.401,.066),(.05,1.439,.041)],.0035,gold,6)
    m.ellipsoid((0,1.367,.086),(.013,.018,.005),gold,12,8)
    if p.get('major'):
        points=[(-.147,1.382,.081),(-.085,1.27,.145),(0,1.135,.13),(.078,1.016,.123),(.18,.868,.115)]
        m.ribbon(points,.065,'#dcba56',axis=(.8,.6,0))
        for off in [-.022,-.007,.007,.022]:m.ribbon([(x+off*.8,y+off*.6,z+.004)for x,y,z in points],.006,'#ae483c',axis=(.8,.6,0))
        m.ribbon(points[:2],.069,'#306e9f',axis=(.8,.6,0))
        flower(m,(-.112,1.314,.12),.014,gold,petals=8)
    # Three traditional hair buns, combs and pins.
    for s in [-1,1]:
        m.ellipsoid((s*.132,1.645,-.007),(.025,.047,.037),p['hair'],20,12)
        for j in range(3):
            a=j*.013
            m.tube([(s*(.15+a*.15),1.611,-.018-a),(s*(.159+a*.15),1.64,.005-a),
                    (s*(.15+a*.15),1.674,-.018-a)],.0025,gold,6)
        m.ellipsoid((s*.133,1.589,.015),(.008,.017,.006),gold,12,8)
    m.ellipsoid((0,1.632,-.128),(.066,.065,.035),p['hair'],20,12)
    # Large peineta silhouette behind the crown, with individual filigree teeth.
    m.ribbon([(-.064,1.767,-.067),(-.056,1.831,-.068),(0,1.854,-.068),(.056,1.831,-.068),(.064,1.767,-.067)],.011,gold,axis=(0,1,0))
    for j in range(9):
        x=(j-4)*.012;m.tube([(x,1.762,-.068),(x,1.823+.025*(1-abs(j-4)/4),-.068)],.002,gold,6)


def uniform(m,p):
    # Long tailored uniform coat with epaulettes, brass buttons and red piping.
    for s in [-1,1]:
        m.tube([(s*.144,.881,.06),(s*.158,1.05,.054),(s*.18,1.31,.025)],.003,'#a25756',6)
        m.ribbon([(s*.12,1.375,-.04),(s*.19,1.34,-.04)],.024,'#c1a66b',axis=(0,0,1))
    for y in [.97,1.05,1.13,1.21,1.29]:
        m.ellipsoid((0,y,.128 if y>1.13 else .114),(.005,.005,.003),'#ccaf64',10,6)
    m.rings([(1.38,.064,.056,0,0),(1.43,.061,.054,0,0)],p['shirt'],24)
    m.rings([(1.426,.063,.055,0,0),(1.436,.062,.054,0,0)],'#b48b51',24)
    m.rings([(1.752,.128,.11,0,-.017),(1.781,.141,.127,0,-.017),
             (1.818,.129,.115,0,-.017),(1.838,.091,.077,0,-.017)],p['shirt'],40)
    m.rings([(1.753,.129,.112,0,-.017),(1.771,.137,.122,0,-.017)],'#ba9e62',32)
    m.ellipsoid((0,1.755,.09),(.135,.012,.077),'#252c31',32,8)
    flower(m,(0,1.798,.105),.016,'#d3b35e',petals=8)


def parts_for(p):
    pieces=[]
    face=Mesh();head(face,p);pieces.append(('head',face))
    body=Mesh()
    if p.get('fallera'):fallera_dress(body,p)
    else:
        if p.get('outfit'):resident_top(body,p)
        else:shirt(body,p)
        if p.get('hero') or p.get('fallero'):vest(body,p)
        if p.get('band'):uniform(body,p)
        if p.get('hero'):
            accessories(body,p)
            if not p['hat']:
                # The scarf is independent of the hat for the female explorer.
                q=dict(p,hat=True,bag=None);extra=Mesh();accessories(extra,q)
                # Keep only scarf faces below the head.
                keep=[f for f in extra.faces if all(extra.vertices[i][1]<1.5 for i in f)]
                body.poly(extra.vertices,keep,'#b65f43')
        if p.get('fallero'):
            body.rings([(.863,.16,.111,0,-.004),(.924,.159,.111,0,-.004),(.95,.152,.106,0,-.004)],'#963e48',32)
            for y in [.877,.895,.913,.93]:body.rings([(y,.162,.113,0,-.004),(y+.003,.162,.113,0,-.004)],'#b06061',32)
            body.ribbon([(.126,.914,.07),(.155,.74,.043),(.162,.68,.057)],.053,'#963e48')
            body.rings([(1.746,.129,.11,0,-.017),(1.779,.132,.113,0,-.017),(1.808,.104,.087,0,-.017),(1.827,.066,.058,0,-.017),(1.831,.012,.01,0,-.017)],'#793d48',32)
            body.ellipsoid((-.126,1.746,-.018),(.025,.020,.023),'#793d48',16,8)
            body.ribbon([(-.127,1.75,-.03),(-.14,1.677,-.034),(-.16,1.60,-.045)],.033,'#793d48')
            body.ribbon([(-.13,1.744,-.042),(-.115,1.67,-.061),(-.10,1.63,-.067)],.027,'#8c4d55')
            for j in range(12):
                a=j*math.tau/12;flower(body,(.132*math.sin(a),1.768,-.017+.115*math.cos(a)),.01,'#d5b57c',normal=(math.sin(a),0,math.cos(a)))
    outfit_details(body,p)
    pieces.append(('body',body))
    for side,key in [(-1,'L'),(1,'R')]:
        limb=leg(p,side)
        if p.get('outfit')=='dress':
            limb.faces=[f for f in limb.faces if not all(limb.vertices[i][1]>.42 for i in f)]
        if p.get('band') or p.get('fallero'):
            for i,color in enumerate(limb.colors):
                if color in [rgb('#cdbf9d'),rgb('#eee0b8')]:limb.colors[i]=rgb('#303735')
                elif color==rgb('#ddd0aa'):limb.colors[i]=rgb('#4d5049')
        if p.get('fallero'):
            # A buckle replaces the laces on traditional black leather shoes.
            lace=rgb('#4d5049')
            limb.faces=[f for f in limb.faces if limb.colors[f[0]]!=lace]
            x=side*.087
            limb.tube([(x-.026,.126,.026),(x+.026,.126,.026),(x+.026,.096,.07),
                       (x-.026,.096,.07),(x-.026,.126,.026)],.003,'#c5a86d',6)

            # Knee breeches and stockings use the original formed leg surface.
            for i,(_,y,_) in enumerate(limb.vertices):
                if .14<y<.455:limb.colors[i]=rgb('#e8dfc4')
            limb.rings([(.442,.059,.063,side*.087,.014),(.466,.061,.063,side*.087,.014)],p['pants'],24)
            limb.ribbon([(side*.12,.457,.056),(side*.137,.4,.051)],.019,'#6f4641')
        pieces.append(('leg_'+key,limb))
        sleeve=dict(p,shirt='#e6dac1') if p.get('outfit')=='vest' else p
        limb=arm(sleeve,side)
        if p.get('fallera') or p.get('fallero') or p.get('band') or p.get('outfit') in ['jacket','vest','knit','cardigan']:
            # Do not retain the bare forearm inside a deforming long sleeve.
            # Different ring spacing otherwise exposes the skin at a bent elbow.
            skin=rgb(p['skin'])
            limb.faces=[face for face in limb.faces if not (
                all(limb.vertices[i][1]>.79 for i in face) and
                all(abs(a-b)<1e-7 for a,b in zip(limb.colors[face[0]],skin)))]
            limb.rings([(.79,.033,.033,side*.3,.025),(.84,.039,.041,side*.288,.014),
                        (.94,.053,.052,side*.27,-.002),(1.02,.057,.059,side*.254,0),(1.13,.059,.06,side*.233,0)],sleeve['shirt'],32,folds=.012)
            limb.rings([(.785,.035,.035,side*.3,.025),(.813,.04,.042,side*.295,.02)],'#eaddba' if p.get('fallera') else sleeve['shirt'],24)
        pieces.append(('arm_'+key,limb))
    for part,mesh in pieces:body_shape(mesh,p,part)
    return pieces
