"""Individual resident identities and sculpted details from the ImageGen sheets."""
import math
from mesh import tint, rgb

# name, skin, hair, shirt, trousers, hair style, face width, jaw, nose, build, height, age
SPECS=[
 ('teal','#c48a61','#302720','#4c8178','#c0aa80','curly',.94,.86,1.0,.94,.96,28),
 ('coral','#855338','#24201e','#b96549','#4b5a67','crop',1.10,1.16,1.24,1.18,1.05,42),
 ('blue','#d9ab83','#a29b8d','#728aa7','#675d50','bald',1.04,1.02,1.10,1.22,.98,66),
 ('rose','#ac7554','#402b26','#ae7f87','#444f5b','bob',.93,.83,.84,1.06,.93,34),
 ('ochre','#68432e','#211e1b','#c19343','#e0ccb0','curly',1.04,.91,1.22,1.08,1.02,24),
 ('sage','#e1b495','#b9b2a2','#66836a','#8d7964','crop',.96,.94,.94,1.14,.92,72),
 ('navy','#b97e56','#34231d','#364d66','#a48d68','wave',1.03,1.13,1.06,1.10,1.08,38),
 ('ivory','#d2a27b','#65432a','#ded2b5','#927052','braid',.91,.84,.91,.88,1.03,27),
 ('plum','#77533d','#262126','#795e73','#c2b394','bob',1.11,1.03,1.19,1.25,.94,51),
 ('olive','#c18a65','#79716a','#6e7655','#4d5350','bald',.92,1.11,1.15,.91,1.04,68),
 ('terracotta','#e0ae85','#965d39','#af7057','#d2bfa1','wave',.95,.88,.88,.92,.97,23),
 ('slate','#916347','#30271e','#62787e','#524b42','crop',1.13,1.22,1.30,1.28,1.01,46),
]

def residents(base):
 result=[]
 for i,(name,skin,hair,shirt,pants,style,face,jaw,nose,build,height,age) in enumerate(SPECS):
  result.append(dict(base,name='resident_'+name,skin=skin,hair=hair,shirt=shirt,pants=pants,
   female=i in [0,3,4,5,7,8,10],hat=False,bag=None,hairstyle=style,
   face_width=face,jaw=jaw,nose=nose,eye_spacing=.044+(i%5)*.0025,build=build,height=height,age=age,
   glasses=i in [2,5,9],beard=i in [1,6,11],outfit=['blouse','jacket','vest','dress','knit','cardigan','jacket','blouse','dress','vest','cardigan','knit'][i],
   shoe=['#95613d','#5c4537','#453e34','#9b5d46'][i%4]))
 return result

def sculpt_face(mesh,p,start=0):
 fw=p.get('face_width',.96 if p.get('female') else 1.03)
 jaw=p.get('jaw',.86 if p.get('female') else 1.09)
 for i in range(start,len(mesh.vertices)):
  x,y,z=mesh.vertices[i]
  if y<1.515:continue
  lower=max(0,min(1,(1.62-y)/.105))
  # Preserve the neck join, then shape cheek and chin independently.
  blend=max(0,min(1,(y-1.50)/.05));blend=blend*blend*(3-2*blend)
  width=1+(fw*(1+(jaw-1)*lower)-1)*blend
  mesh.vertices[i]=(x*width,y,z)
  if p.get('beard') and 1.52<y<1.606 and z>.015 and (y<1.569 or abs(x)>.039):
   strength=.54*min(1,(1.606-y)/.045)
   c=mesh.colors[i];h=rgb(p['hair']);mesh.colors[i]=tuple(a*(1-strength)+b*strength for a,b in zip(c,h))

def _hair(mesh,p):
 color=p['hair'];style=p.get('hairstyle','wave')
 if style=='bald':
  for side in [-1,1]:
   for j in range(9):
    a=side*(1.5+j*.14)
    mesh.tube([(.122*math.sin(a),1.697,-.016+.104*math.cos(a)),(.121*math.sin(a),1.64,-.016+.101*math.cos(a))],.003,tint(color,1.13),5)
  return
 # A continuous cap holds the silhouette under every lock.
 verts=[];faces=[];sides=64;rows=18
 for k in range(rows+1):
  for j in range(sides):
   a=j*math.tau/sides
   end=1.12-.16*math.sin(a)+.78*(1-math.cos(a))/2+.05*math.sin(a*2)
   theta=.008+(end-.008)*k/rows
   verts.append((.128*math.sin(theta)*math.sin(a),1.670+.147*math.cos(theta),-.018+.113*math.sin(theta)*math.cos(a)))
 for k in range(rows):
  for j in range(sides):
   a=k*sides+j;b=k*sides+(j+1)%sides;faces.append((a,a+sides,b+sides,b))
 mesh.poly(verts,faces,color)
 if style=='bob':
  for j in range(14):
   a=-1.2+j*2.4/13
   pts=[]
   for k in range(9):
    t=k/8;th=.18+t*(1.15+.15*math.sin(a));ph=a+.35*(1-t)
    pts.append((.134*math.sin(th)*math.sin(ph),1.672+.149*math.cos(th),-.018+.119*math.sin(th)*math.cos(ph)))
   mesh.tube(pts,[.002,.01,.016,.018,.019,.018,.014,.008,.001],tint(color,1.08+j%3*.06),8)
 if style=='curly':
  for row in range(5):
   theta=.15+row*.29
   for j in range(max(5,int(22*math.sin(theta)))):
    a=j*math.tau/max(5,int(22*math.sin(theta)))+row*.32
    c=(.131*math.sin(theta)*math.sin(a),1.671+.150*math.cos(theta),-.02+.118*math.sin(theta)*math.cos(a))
    mesh.ellipsoid(c,(.029,.026,.028),tint(color,1.0+(j%4)*.08),10,6)
    mesh.tube([(c[0]+.014*math.cos(t),c[1]+.013*math.sin(t),c[2]+.018) for t in [k*.5 for k in range(10)]],.002,tint(color,1.32),5)
 elif style=='bob':
  for j in range(30):
   a=.75+j*(math.tau-1.5)/29
   mesh.tube([(.115*math.sin(a),1.754,-.018+.104*math.cos(a)),(.143*math.sin(a),1.67,-.018+.125*math.cos(a)),(.146*math.sin(a),1.55,-.018+.124*math.cos(a)),(.121*math.sin(a),1.515,-.018+.099*math.cos(a))],[.010,.018,.022,.008],tint(color,1.02+j%3*.07),8)
 else:
  count=34 if style=='wave' else 23
  for j in range(count):
   a=-1.5+j*math.tau/count
   pts=[]
   steps=16 if style=='wave' else 10
   for k in range(steps):
    t=k/(steps-1);theta=.16+t*(1.10-.18*math.sin(a) if math.cos(a)>0 else 1.9)
    phi=a+(1.12 if style=='wave' else .48)*(1-t)
    pts.append((.130*math.sin(theta)*math.sin(phi),1.668+.148*math.cos(theta),-.018+.116*math.sin(theta)*math.cos(phi)))
   r=.010 if style=='crop' else .014
   mesh.tube(pts,[.001]+[r*math.sin(math.pi*k/(steps-1))**.5 for k in range(1,steps-1)]+[.0006],tint(color,1+(j%4)*.04),12 if style=='wave' else 8)
   mesh.tube([(x,y+.002,z+.003) for x,y,z in pts],.0013,tint(color,1.28),5)
 if style=='braid':
  for strand in range(3):
   pts=[]
   for j in range(40):
    t=j/39;a=t*math.tau*5+strand*math.tau/3
    pts.append((.019*math.sin(a)*(1-t*.55),1.65-t*.22,-.14-.017*math.cos(a)))
   mesh.tube(pts,[.012*(1-j/60) for j in range(40)],tint(color,1+strand*.10),8)

def face_details(m,p):
 skin=p['skin'];fw=p.get('face_width',.96 if p.get('female') else 1.03)
 # Shallow lip volumes blend into the muzzle; the smile is one fine crease.
 lip=tint(skin,.94)
 m.rings(smooth_profile([(1.571,.009*fw,.001,0,.091),(1.574,.020*fw,.002,0,.091),
    (1.577,.024*fw,.0025,0,.090),(1.580,.017*fw,.0018,0,.090),
    (1.582,.004*fw,.0006,0,.089)],3),lip,32)
 m.tube([(-.023*fw,1.580,.090),(-.012*fw,1.577,.093),(0,1.576,.0935),(.012*fw,1.577,.093),(.023*fw,1.580,.090)],[.0003,.0005,.0006,.0005,.0003],tint(skin,.64),8)
 for s in [-1,1]:
  m.ellipsoid((s*.010,1.615,.109),(.0025,.0012,.0007),tint(skin,.62),10,6)
  if p.get('age',25)>55:
   for j in range(2):m.tube([(s*.077*fw,1.651-j*.008,.080),(s*.09*fw,1.65-j*.010,.071)],[.0008,.0002],tint(skin,.81),5)
  if p.get('glasses'):
   pts=[(s*.050*fw+.034*math.cos(a),1.654+.024*math.sin(a),.110) for a in [j*math.tau/32 for j in range(33)]]
   m.tube(pts,.0025,'#66513c',8)
   m.tube([(s*.081*fw,1.66,.109),(s*.13*fw,1.663,.013)],.0025,'#66513c',6)
 if p.get('glasses'):m.tube([(-.017,1.66,.112),(0,1.666,.116),(.017,1.66,.112)],.002,'#66513c',6)
 if p.get('female'):
  for side in [-1,1]:
   center=(side*.136*fw,1.589,.011)
   m.tube([(center[0]+.009*math.cos(a),center[1]+.013*math.sin(a),center[2]) for a in [j*math.tau/24 for j in range(25)]],.0018,'#b99552',8)
   if p.get('hero'):
    m.ellipsoid((center[0],1.571,.012),(.004,.007,.003),'#cba962',12,8)

def body_shape(mesh,p,part):
 build=p.get('build',1)
 if build==1:return
 for i,(x,y,z) in enumerate(mesh.vertices):
  if part=='body' and .80<y<1.39:
   u=max(0,min(1,(y-.87)/.52))
   volume=(.5+.5*math.sin(u*math.pi))*min(1,(1.39-y)/.07)
   mesh.vertices[i]=(x*(1+(build-1)*volume),y,z*(1+(build-1)*volume*1.2))
  elif part.startswith('leg') and y>.20:
   center=(1 if x>0 else -1)*.087
   blend=max(0,min(1,(y-.65)/.16));blend=blend*blend*(3-2*blend)
   local=center+(x-center)*(1+(build-1)*.30)
   shared=x*(1+(build-1)*.5)
   mesh.vertices[i]=(local*(1-blend)+shared*blend,y,z*(1+(build-1)*(.3+.2*blend)))
  elif part.startswith('arm') and y>.79:
   # Add sleeve volume around the existing joint axis; preserve wrists and IK.
   center=(1 if x>0 else -1)*(.302-(y-.76)*.24)
   amount=(build-1)*.28*min(1,(y-.79)/.25)
   mesh.vertices[i]=(center+(x-center)*(1+amount),y,z*(1+amount))


def hair(mesh,p):
 start=len(mesh.vertices);_hair(mesh,p)
 fw=p.get('face_width',.96 if p.get('female') else 1.03)
 for i in range(start,len(mesh.vertices)):
  x,y,z=mesh.vertices[i];mesh.vertices[i]=(x*fw,y,z)


def outfit_details(m,p):
 return


def resident_top(m,p):
 """Tailored alternatives with distinct necklines, hems and layer thickness."""
 c=p['shirt'];style=p['outfit'];skin=p['skin']
 rows=[(.866,.146,.100,0,0),(.89,.15,.105,0,0),(.98,.147,.103,0,0),
       (1.08,.155,.108,0,0),(1.20,.173,.12,0,0),(1.30,.18,.114,0,-.003),
       (1.36,.154,.087,0,-.004),(1.405,.064,.055,0,0)]
 if style in ['blouse','dress']:
  rows[-1]=(1.400,.079,.063,0,.003)
  rows[2]=(.98,.13,.093,0,0)
  rows[3]=(1.08,.143,.104,0,0)
 base='#e6dac1' if style in ['jacket','vest','cardigan'] else c
 m.rings(rows,base,48,folds=.006 if style=='knit' else .014)
 # Neckline has a finished round edge, free of the repeated shirt collar.
 rx,rz=rows[-1][1:3];yy=rows[-1][0]
 m.tube([(rx*math.sin(a),yy,.003+rz*math.cos(a)) for a in [j*math.tau/48 for j in range(49)]],.005,tint(base,.87),8)
 # Trouser rise is one continuous pelvis below the top.
 if style!='dress':m.rings([(.823,.147,.100,0,0),(.885,.15,.101,0,0)],p['pants'],32)
 if style in ['jacket','vest','cardigan']:
  outer=[(.87,.155,.113),(.99,.155,.113),(1.10,.164,.12),(1.22,.183,.134),(1.31,.187,.124),(1.365,.146,.09)]
  for side in [-1,1]:
   verts=[];faces=[];n=25
   for y,rx,rz in outer:
    for j in range(n):
     a=side*(.24+j*(math.pi-.24)/(n-1));verts.append((rx*math.sin(a),y,rz*math.cos(a)))
   for k in range(len(outer)-1):
    for j in range(n-1):
     a=k*n+j;face=(a,a+1,a+n+1,a+n);faces.append(face if side>0 else tuple(reversed(face)))
   m.poly(verts,faces,c)
   edge=[(side*rx*math.sin(.24),y,rz*math.cos(.24)+.001) for y,rx,rz in outer]
   m.tube(edge,.004,tint(c,.79),8)
   if style=='jacket':
    m.ribbon([(side*.065,1.392,.078),(side*.092,1.31,.13),(side*.045,1.20,.138)],.05,tint(c,1.12),axis=(1,0,0))
   for y in [1.01,1.20]:
    m.ribbon([(side*.068,y,.125),(side*.142,y,.087)],.013,tint(c,.76),axis=(0,1,0))
   for y in [1.00,1.10,1.20]:m.ellipsoid((side*.043,y,.127),(.004,.004,.002),'#c3a679',10,6)
 elif style=='knit':
  for j in range(25):
   y=.93+j*.016
   m.tube([(-.125,y,.069),(-.065,y,.10),(0,y,.113),(.065,y,.10),(.125,y,.069)],.0008,tint(c,.92),5)
  for x in [-.09,-.045,0,.045,.09]:
   m.tube([(x+.004*math.sin(j*.9),.94+j*.009,.118-abs(x)*.18) for j in range(38)],.0014,tint(c,1.08),5)
 else:
  # Fine pintucks and paired buttons on soft linen.
  for x in [-.025,.025]:m.tube([(x,.93,.11),(x,1.12,.116),(x,1.31,.117)],.0015,tint(c,.83),6)
  for y in [1.02,1.14,1.26,1.34]:m.ellipsoid((0,y,.125 if y<1.3 else .10),(.004,.004,.002),'#b0956c',10,6)
  for side in [-1,1]:
   m.ribbon([(side*.038,1.38,.071),(side*.028,1.31,.117)],.022,tint(c,1.10))
 # Finished garment hem, with stitch line.
 m.rings([(.869,.151,.107,0,0),(.881,.152,.108,0,0)],tint(c,.9),48)
 if style=='dress':
  # Calf-length pleated skirt, flared from the same waist.
  skirt=[(.43,.265,.205,0,-.003),(.45,.27,.209,0,-.003),(.54,.244,.190,0,-.003),(.61,.214,.155,0,-.003),(.80,.17,.12,0,0),(.94,.14,.101,0,0)]
  m.rings(skirt,c,64,folds=.025)
  m.rings([(.436,.268,.208,0,-.003),(.448,.271,.211,0,-.003)],tint(c,.79),64)
  m.rings([(.895,.151,.111,0,0),(.923,.148,.108,0,0)],'#78533e',40)
  for j in range(18):
   a=j*math.tau/18
   m.tube([(rx*math.sin(a)*1.006,y,-.003+rz*math.cos(a)*1.006) for y,rx,rz,_,_ in skirt[:4]],.0013,tint(c,1.11),5)


def smooth_profile(rows,steps=4):
 """Interpolate the sculpt profile without hard bands between face sections."""
 out=[]
 for k in range(len(rows)-1):
  a=rows[max(0,k-1)];b=rows[k];c=rows[k+1];d=rows[min(len(rows)-1,k+2)]
  for j in range(steps):
   t=j/steps
   values=[b[0]+(c[0]-b[0])*t]
   for q in range(1,5):
    values.append(.5*((2*b[q])+(-a[q]+c[q])*t+(2*a[q]-5*b[q]+4*c[q]-d[q])*t*t+(-a[q]+3*b[q]-3*c[q]+d[q])*t*t*t))
   out.append(tuple(values))
 return out+[rows[-1]]
