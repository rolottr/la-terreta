"""Original character forms, modeled from the saved ImageGen sheet."""
import math
from mesh import Mesh, tint
from diversity import smooth_profile

PALETTES = [
    dict(name='traveler', skin='#c68e64', hair='#39281e', shirt='#e9dfc8', pants='#425f60', shoe='#765037', bag='#ac7845', female=False, hat=True),
    dict(name='resident_teal', skin='#c48a61', hair='#302720', shirt='#5b8e85', pants='#344b59', shoe='#aa794d', bag=None, female=True, hat=False),
    dict(name='resident_coral', skin='#855338', hair='#24201e', shirt='#c97d61', pants='#4b5a67', shoe='#745341', bag=None, female=False, hat=False),
    dict(name='resident_blue', skin='#d9ab83', hair='#695141', shirt='#728aa7', pants='#b5a48b', shoe='#635045', bag='#6b7763', female=False, hat=False),
    dict(name='resident_rose', skin='#ac7554', hair='#402b26', shirt='#ae7f87', pants='#444f5b', shoe='#a37d5a', bag=None, female=True, hat=False),
]


def head(m, p):
    skin, hair = p['skin'], p['hair']
    face_start=len(m.vertices)
    # Chin, jaw, cheekbone, temple and forehead sections form one continuous face.
    profile=smooth_profile([(1.500,.018,.024,0,.014),(1.514,.043,.047,0,.015),(1.53,.066,.064,0,.013),
             (1.55,.091,.079,0,.007),(1.58,.105,.087,0,.004),
             (1.615,.118,.095,0,0),(1.65,.12,.10,0,-.004),
             (1.685,.117,.096,0,-.008),(1.72,.109,.092,0,-.012),
             (1.755,.096,.081,0,-.017),(1.78,.072,.062,0,-.019),
             (1.79,.024,.025,0,-.02)])
    m.rings(profile,skin,sides=56)
    for i in range(face_start,len(m.vertices)):
        x,y,z=m.vertices[i]
        if z>0:
            cheek=.005*math.exp(-((abs(x)-.066)/.033)**2-((y-1.616)/.024)**2)
            m.vertices[i]=(x,y,z+cheek)
    m.rings([(1.39,.06,.053,0,-.003),(1.47,.055,.051,0,0),
             (1.53,.062,.055,0,.002)], tint(skin,.94), sides=24)
    def surface(x,y):
        k=max(0,min(len(profile)-2,next((i-1 for i,row in enumerate(profile) if row[0]>y),len(profile)-2)))
        a,b=profile[k:k+2];t=max(0,min(1,(y-a[0])/(b[0]-a[0])))
        rx=a[1]+(b[1]-a[1])*t;rz=a[2]+(b[2]-a[2])*t;zc=a[4]+(b[4]-a[4])*t
        cheek=.005*math.exp(-((abs(x)-.066)/.033)**2-((y-1.616)/.024)**2)
        return zc+rz*math.sqrt(max(0,1-(x/rx)**2))+cheek
    for side in (-1,1):
        # Ear rim, concha and tragus.
        m.ellipsoid((side*.121,1.628,-.009),(.022,.040,.016),skin,16,10)
        m.ellipsoid((side*.132,1.632,.004),(.005,.021,.004),tint(skin,.86),12,8)
        # Small almond eyes set into skin lids. Catchlights are actual geometry.
        x=side*p.get('eye_spacing',.049)
        eye_start=len(m.vertices);center_z=surface(x,1.654)
        m.ellipsoid((x,1.654,center_z-.006),(.027,.013,.012),'#eee6d8',32,16)
        m.ellipsoid((x,1.654,center_z+.0063),(.0105,.0105,.0007),'#644b31',24,12)
        m.ellipsoid((x,1.654,center_z+.007),(.0055,.0075,.0005),'#201e1b',20,10)
        m.ellipsoid((x-.003,1.658,center_z+.0076),(.0018,.0018,.0002),'#fff4db',12,8)
        # Wrap the complete eye surface around the cheek rather than placing it on a flat plane.
        for i in range(eye_start,len(m.vertices)):
            xx,yy,zz=m.vertices[i];m.vertices[i]=(xx,yy,zz+surface(xx,yy)-center_z)
        if not hasattr(m,'blink_indices'):m.blink_indices=[]
        m.blink_indices.extend(range(eye_start,len(m.vertices)))
        verts=[];faces=[];count=48
        for j in range(count):
            a=j*math.tau/count;sn=math.sin(a)
            inner=(x+.027*math.cos(a),1.654+sn*(.0115 if sn>=0 else .0095))
            outer=(x+.033*math.cos(a),1.654+sn*(.018 if sn>=0 else .016))
            verts.append((*inner,surface(*inner)+.001+.002*sn*sn))
            verts.append((*outer,surface(*outer)+.00025))
            k=j*2;n=(j+1)%count*2;faces.append((k,k+1,n+1,n))
        start=len(m.vertices);m.poly(verts,faces,tint(skin,.97))
        # The outer lid stays attached to the face while its inner edge closes.
        m.blink_indices.extend(start+j*2 for j in range(count))
        brow=[]
        for j in range(13):
            t=j/12;xx=x+side*(-.027+.054*t);yy=1.681+.007*math.sin(t*math.pi)+.002*(1-2*t)
            brow.append((xx,yy,surface(xx,yy)+.001))
        m.tube(brow,[.0005+.0018*math.sin(j*math.pi/12) for j in range(13)],hair,12)
        # Soft cheek blush in the vertex color, not separate red circles.
    # A small soft nose stays close to the face; no separate nostril beads.
    nose_start=len(m.vertices)
    m.rings(smooth_profile([(1.610,.009,.005,0,.101),(1.616,.014,.010,0,.105),
             (1.627,.012,.013,0,.104),(1.646,.008,.006,0,.096),
             (1.668,.004,.002,0,.088)]),skin,32)
    for i in range(nose_start,len(m.vertices)):
        x,y,z=m.vertices[i];n=p.get('nose',1)
        m.vertices[i]=(x*n,y,.088+(z-.088)*n)
    from diversity import sculpt_face, hair as sculpt_hair, face_details
    # The face and hair are authored separately so bald and bob styles are real silhouettes.
    sculpt_face(m,p,face_start)
    face_details(m,p)
    sculpt_hair(m,p)


def shirt(m,p):
    cloth=p['shirt'];female=p['female']
    m.rings([(.865,.148,.100,0,0),(.882,.154,.106,0,.002),
             (.94,.151,.105,0,.001),(1.02,.139 if female else .15,.101,0,0),
             (1.10,.148 if female else .166,.107,0,0),
             (1.19,.168,.12,0,.002),(1.29,.178,.116,0,-.003),
             (1.35,.18,.1,0,-.007),(1.39,.139,.072,0,-.002),
             (1.425,.066,.057,0,0)],cloth,32,folds=.014)
    # Open collar with two shaped points and a raised rim.
    collar_start=len(m.vertices)
    for s in (-1,1):
        m.poly([(s*.016,1.408,.059),(s*.065,1.438,.046),
                (s*.119,1.359,.093),(s*.080,1.331,.116),
                (s*.036,1.382,.099)],[(0,1,2,3,4)],tint(cloth,1.04))
        m.tube([(s*.018,1.41,.063),(s*.066,1.435,.051),
                (s*.117,1.36,.097),(s*.080,1.334,.12)],.003,tint(cloth,.82),6)
    if p.get('hero'):
        for i in range(collar_start,len(m.vertices)):
            x,y,z=m.vertices[i];m.vertices[i]=(x,y,z+.012)
    m.ribbon([(0,.885,.110),(0,1.07,.111),(0,1.25,.127),(0,1.37,.089)],.021,tint(cloth,.91))
    for y in (.94,1.04,1.14,1.245,1.342):
        z=.12 if y<1.14 else .13 if y<1.30 else .106
        m.ellipsoid((.004,y,z),(.005,.005,.0025),'#a18b61',10,6)
    if not p.get('vest'):
        # Patch pocket with a curved bottom, welt and stitched border.
        pts=[(.067,1.24,.126),(.13,1.235,.105),(.127,1.171,.111),(.10,1.159,.121),(.067,1.174,.129)]
        m.poly(pts,[(0,1,2,3,4)],tint(cloth,.94))
        m.tube(pts+[pts[0]],.0022,tint(cloth,.79),5)
        m.tube([(.068,1.234,.13),(.10,1.23,.121),(.13,1.23,.11)],.003,tint(cloth,1.04),6)
    for s in (-1,1):
        # Fine seam and short folds, with much less contrast than trim.
        m.tube([(s*.148,.89,.035),(s*.154,1.02,.035),(s*.177,1.25,.026)],.002,tint(cloth,.80),5)
        if not p.get('vest'):
            for j in range(3):
                y=.926+j*.054
                m.tube([(s*.047,y,.107),(s*.082,y+.006,.10),(s*.127,y+.017,.069)],
                       [.001,.0025,.001],tint(cloth,.9),5)
    m.rings([(.868,.150,.103,0,0),(.881,.155,.107,0,0)],tint(cloth,.85),32)
    # Trouser waist closes the gap between the separate leg meshes.
    m.rings([(.826,.147,.10,0,-.002),(.897,.15,.099,0,-.004)],p['pants'],28)
    m.rings([(.867,.143,.092,0,-.004),(.890,.144,.093,0,-.004)],'#705443',28)
    m.ribbon([(0,.876,.101),(0,.896,.101)],.033,'#c0a16e')


def leg(p,side):
    m=Mesh();x=side*.087;pants=p['pants'];shoe=p['shoe']
    # Full thigh, kneecap, calf and tapered ankle contours. Flat sole is Y=0.
    m.rings([(.137,.044,.045,x,-.006),(.17,.047,.049,x,-.008),
             (.225,.047,.048,x,-.010),(.29,.055,.053,x,-.011),
             (.35,.06,.058,x,-.009),(.41,.055,.054,x,.004),
             (.45,.056,.06,x,.016),(.49,.062,.059,x,.006),
             (.57,.069,.064,x,-.004),(.65,.075,.073,x,-.009),
             (.76,.079,.077,x,-.007),(.85,.077,.075,x,0),
             (.895,.071,.068,x,0)],pants,24,folds=.018)
    m.rings([(.142,.047,.049,x,-.006),(.148,.051,.052,x,-.006),
             (.177,.052,.053,x,-.008),(.181,.048,.05,x,-.008)],tint(pants,1.18),24)
    m.tube([(x+side*.049,.184,-.006),(x+side*.062,.43,.012),
            (x+side*.079,.73,-.005),(x+side*.077,.85,.008)],.002,tint(pants,.68),5)
    for y,z in ((.215,.039),(.402,.049),(.472,.061),(.66,.06)):
        m.tube([(x-.027,y-.007,z),(x,y,z+.003),(x+.032,y+.006,z-.006)],
               [.001,.0025,.001],tint(pants,.86),5)
    m.rings([(.10,.039,.04,x,0),(.15,.043,.042,x,0)],p['skin'],20)
    # A thin outsole follows the leather upper. The old rounded rectangle
    # projected far beyond its oval toe and formed a 5.2 cm platform.
    outline=[(.061*math.sin(j*math.tau/28),.040+.124*math.cos(j*math.tau/28))
             for j in range(28)]
    verts=[]
    layers=[(0,.992),(.003,1),(.014,.995)]
    for y,scale in layers:
        for xx,zz in outline:verts.append((x+xx*scale,y,zz*scale))
    faces=[];n=len(outline)
    for k in range(len(layers)-1):
        for j in range(n):faces.append((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j))
    faces.append(tuple(reversed(range(n))))
    faces.append(tuple((len(layers)-1)*n+j for j in range(n)))
    m.poly(verts,faces,'#cdbf9d')
    m.rings([(.013,.06,.122,x,.040),(.040,.061,.118,x,.039),
             (.066,.056,.108,x,.033),(.092,.051,.084,x,.014),
             (.116,.044,.065,x,-.010),(.136,.043,.046,x,-.013)],shoe,28)
    for j in range(4):
        z=.015+j*.023;y=.137-j*.014
        for s in (-1,1):
            m.ellipsoid((x+s*.025,y-.003,z),(.004,.0025,.004),'#b69c6a',8,6)
        m.tube([(x-.025,y,z),(x,y+.006,z+.007),(x+.025,y,z+.012)],.0025,'#ddd0aa',6)
    m.tube([(x+xx*.995,.014,zz*.995)for xx,zz in outline+[outline[0]]],.001,'#eee0b8',6)
    return m


def arm(p,side):
    m=Mesh();skin=p['skin'];shirt=p['shirt'];s=side
    # A natural relaxed arm. Upper arm and wrist are not straight cylinders.
    m.rings([(1.10,.055,.055,s*.242,0),(1.165,.063,.061,s*.224,-.002),
             (1.255,.071,.072,s*.20,-.004),(1.325,.066,.075,s*.166,-.008),
             (1.351,.041,.052,s*.151,-.008)],shirt,24,folds=.014)
    m.rings([(1.103,.058,.058,s*.242,0),(1.126,.061,.060,s*.236,0)],tint(shirt,.84),24)
    m.rings([(.701,.027,.017,s*.309,.031),(.72,.034,.022,s*.308,.031),(.745,.031,.023,s*.305,.03),(.762,.028,.027,s*.302,.028),(.82,.033,.035,s*.294,.016),
             (.875,.038,.039,s*.283,.007),(.947,.045,.044,s*.27,-.004),
             (.982,.042,.044,s*.263,-.003),(1.03,.049,.051,s*.255,0),
             (1.105,.054,.054,s*.241,0)],skin,24)
    # Palm with a separate thumb and four shaped fingers.
    for j in range(4):
        xx=s*(.284+j*.014)
        length=[.060,.074,.070,.053][j]
        y=.708
        m.tube([(xx,y,.029),(xx+s*.002,y-.025,.029),
                (xx+s*.004,y-length+.01,.04),(xx+s*.003,y-length,.047)],
               [.008,.008,.007,.003],skin,8)
    m.tube([(s*.282,.736,.042),(s*.27,.715,.053),(s*.266,.686,.056)],
           [.013,.011,.006],skin,10)
    m.tube([(s*.282,.757,.047),(s*.309,.754,.052),(s*.329,.755,.046)],.0016,tint(skin,.72),5)
    return m


def accessories(m,p):
    if p['hat']:
        straw='#c7a269';band='#6e4a31'
        m.rings([(1.774,.24,.216,0,-.01),(1.783,.247,.22,0,-.01),
                 (1.795,.237,.213,0,-.01),(1.803,.143,.13,0,-.012)],straw,64)
        m.rings([(1.796,.138,.125,0,-.012),(1.82,.134,.12,0,-.012),
                 (1.91,.108,.099,0,-.009),(1.941,.087,.08,0,-.009),
                 (1.953,.051,.061,0,-.009),(1.943,.016,.035,0,-.009)],straw,48)
        m.rings([(1.807,.14,.125,0,-.012),(1.836,.132,.119,0,-.012)],band,48)
        for j in range(5):
            rx=.148+j*.021;rz=.135+j*.019
            m.tube([(rx*math.sin(a),1.796,-.01+rz*math.cos(a))for a in [k*math.tau/64 for k in range(65)]],.0017,tint(straw,.77),5)
        for j in range(28):
            a=j*math.tau/28
            m.tube([(.136*math.sin(a),1.842,-.012+.123*math.cos(a)),
                    (.11*math.sin(a+.06),1.913,-.009+.100*math.cos(a+.06)),
                    (.089*math.sin(a+.1),1.94,-.009+.083*math.cos(a+.1))],.0016,tint(straw,1.16),5)
        scarf='#b65f43'
        m.rings([(1.411,.068,.057,0,0),(1.437,.068,.057,0,0),(1.457,.06,.053,0,0)],scarf,24)
        m.ellipsoid((0,1.408,.073),(.018,.024,.014),tint(scarf,.93),16,8)
        for s in (-1,1):
            m.poly([(s*.003,1.41,.079),(s*.022,1.391,.089),
                    (s*.04,1.305,.129),(s*.01,1.327,.126),
                    (s*.003,1.365,.111)],[(0,1,2,3,4)],scarf)
            m.tube([(s*.005,1.40,.085),(s*.017,1.355,.12),(s*.035,1.31,.131)],.002,tint(scarf,.78),5)
    if p['bag']:
        bag=p['bag'];leather='#815330';thread='#d7b584'
        # Domed canvas pack, bottom reinforcement and a front gusset pocket.
        m.rings([(.957,.117,.058,0,-.158),(.975,.142,.073,0,-.165),
                 (1.09,.15,.082,0,-.169),(1.23,.143,.078,0,-.163),
                 (1.315,.12,.063,0,-.154),(1.345,.069,.043,0,-.147)],bag,32)
        m.rings([(.958,.119,.06,0,-.161),(.977,.145,.074,0,-.165),
                 (1.005,.147,.078,0,-.166)],leather,32)
        m.rings([(1.004,.078,.029,0,-.254),(1.015,.092,.035,0,-.258),
                 (1.103,.095,.036,0,-.255),(1.123,.072,.029,0,-.253)],tint(bag,.94),24)
        for s in (-1,1):
            points=[(s*.122,1.04,-.192),(s*.13,1.25,-.153),(s*.12,1.374,-.075),
                    (s*.13,1.39,.018),(s*.144,1.29,.09),(s*.145,1.10,.081),
                    (s*.132,1.01,.012),(s*.122,1.04,-.152)]
            m.ribbon(points,.031,leather)
            for dx in (-.011,.011):
                m.tube([(x+dx,y,z+.002)for x,y,z in points[:6]],.0015,thread,5)
            # Metal buckle frame on each shoulder strap.
            x=s*.145
            m.tube([(x-.017,1.135,.088),(x+.017,1.135,.088),(x+.017,1.168,.092),
                    (x-.017,1.168,.092),(x-.017,1.135,.088)],.003,'#b6a073',6)
        # Flap piping and closure straps make the back readable in follow view.
        m.ribbon([(-.108,1.298,-.218),(-.12,1.25,-.239),(-.095,1.204,-.253),
                  (0,1.188,-.255),(.095,1.204,-.253),(.12,1.25,-.239),(.108,1.298,-.218)],.008,tint(bag,.62),axis=(0,1,0))
        m.ribbon([(0,1.292,-.23),(0,1.185,-.26),(0,1.157,-.261)],.021,leather)
        m.tube([(-.016,1.21,-.265),(.016,1.21,-.265),(.016,1.24,-.265),
                (-.016,1.24,-.265),(-.016,1.21,-.265)],.003,'#baa278',6)
        m.tube([(-.039,1.32,-.15),(-.032,1.379,-.15),(0,1.395,-.15),
                (.032,1.379,-.15),(.039,1.32,-.15)],.008,leather,8)
