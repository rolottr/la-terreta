"""Distinct civic silhouettes, an open Gothic gate, and a walk-in arena.
Executed by build_models.py in its existing material/export pipeline.
"""
from model_geometry import Builder as B

def install(name,b):
 old=next((o for o in roots if o.name==name),None)
 if old: roots.remove(old);bpy.data.objects.remove(old,do_unlink=True)
 roots.append(b.finish())

def pointed(b,x,y,z,w,h,mat=4,depth=.13):
 # Two bowed sides meet at a pointed Gothic crown.
 for side in [-1,1]:
  pts=[(x+side*w*.5*(1-t),y,z+h*(2*t-t*t)) for t in [j/12 for j in range(13)]]
  for a,c in zip(pts,pts[1:]):b.beam(a,c,depth,mat,7)

b=B('serranos')
# Five-sided tower shells face the approach; rear galleries remain open.
for cx in [-5,5]:
 outline=[(-2.7,2.1),(-2.7,-1.2),(-1.65,-2.8),(1.65,-2.8),(2.7,-1.2),(2.7,2.1)]
 for (x,y),(xx,yy) in zip(outline,outline[1:]):
  length=math.hypot(xx-x,yy-y);a=math.atan2(yy-y,xx-x)
  b.box(cx+(x+xx)/2,(y+yy)/2,5.2,length,.65,10.4,0,a)
  for h in [.35,3.9,7.7,10.35]: b.box(cx+(x+xx)/2,(y+yy)/2,h,length+.12,.85,.22,4,a)
  for j in range(max(2,round(length/.7))):
   t=(j+.5)/max(2,round(length/.7));b.box(cx+x+(xx-x)*t,y+(yy-y)*t,10.9,.40,.70,.82,4,a)
  # Small staggered blocks give the stone a clear scale.
  for row in range(12):
   for j in range(max(1,int(length/.85))):
    t=(j+.5+(row%2)*.25)/max(1,int(length/.85))
    if t>1:continue
    b.box(cx+x+(xx-x)*t+math.sin(a)*.34,y+(yy-y)*t-math.cos(a)*.34,.8+row*.76,.55,.035,.025,5,a)
 # Open rear galleries with floor slabs, piers and pointed arches.
 for h in [3.85,7.65,10.3]:b.box(cx,0,h,5.1,4.2,.18,4)
 for h in [.2,4.1,7.9]:
  for side in [-1,1]:b.box(cx+side*2.35,2.05,h+1.12,.40,.65,2.25,4)
  pointed(b,cx,2.12,h+1.35,4.25,1.6,4,.17)
  b.box(cx,2.15,h+.30,4.4,.25,.35,5)
 # Slit windows on the front facets.
 for h in [2.4,6.0,9.0]:
  b.box(cx,-2.835,h,.20,.025,.9,6)
  pointed(b,cx,-2.89,h+.25,.46,.7,4,.065)
# The central passage has no wall or floor across the walking path.
for side in [-1,1]:b.box(side*2.2,0,3.9,1.15,3.1,7.8,0)
b.box(0,0,7.75,4.8,3.1,1.5,0)
# Solid spandrels and a curved underside turn the central arch into an opening.
for i in range(32):
 x=-1.65+i*3.3/32;xx=-1.65+(i+1)*3.3/32
 z=2.4+3.4*(1-(x/1.65)**2);zz=2.4+3.4*(1-(xx/1.65)**2)
 b.poly([(x,-1.55,z),(xx,-1.55,zz),(xx,-1.55,7.1),(x,-1.55,7.1),(x,1.55,z),(xx,1.55,zz),(xx,1.55,7.1),(x,1.55,7.1)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)],0)

for y in [-1.65,1.65]:
 pointed(b,0,y,2.4,3.3,3.4,4,.22)
 for x in [-1.65,1.65]:b.box(x,y,1.5,.27,.28,3.0,4)
 b.box(0,y,7.4,4.8,.28,.23,4)
 for x in [-1.8,-.9,0,.9,1.8]:b.box(x,y,8.85,.43,.5,.72,4)
b.box(0,-1.66,6.65,1.12,.22,.85,5)
for j in range(5):b.box(-.4+j*.20,-1.79,6.65,.09,.025,.63,19 if j%2 else 20)
install('serranos',b)

b=B('bullring')
def sector(r0,r1,z0,z1,mat,gate=False):
 for j in range(96):
  a=j*math.tau/96;aa=(j+1)*math.tau/96;mid=(a+aa)/2
  if gate and abs(math.cos(mid))*r0<1.65:continue
  b.poly([(r0*math.cos(a),r0*math.sin(a),z1),(r1*math.cos(a),r1*math.sin(a),z1),(r1*math.cos(aa),r1*math.sin(aa),z1),(r0*math.cos(aa),r0*math.sin(aa),z1),(r0*math.cos(a),r0*math.sin(a),z0),(r0*math.cos(aa),r0*math.sin(aa),z0),(r1*math.cos(a),r1*math.sin(a),z0),(r1*math.cos(aa),r1*math.sin(aa),z0)],[(0,1,2,3),(0,3,5,4),(1,6,7,2),(4,5,7,6),(0,4,6,1),(3,2,7,5)],mat)
b.beam((0,0,.025),(0,0,.05),6.15,5,96)
for j in range(10):sector(6.0+j*.25,6.27+j*.25,.12+j*.23,.34+j*.23,4 if j%2 else 8,True)
sector(5.95,6.12,.03,.82,20,True)
for level in range(4):
 base=.25+level*1.48
 for j in range(48):
  a=j*math.tau/48;mid=a+math.pi/48
  if level<2 and abs(math.cos(mid))*8.85<1.7:continue
  b.box(8.85*math.cos(a),8.85*math.sin(a),base+.62,.24,.64,1.25,7,a+math.pi/2)
  for k in range(10):
   q=k*math.pi/10;qq=(k+1)*math.pi/10
   def p(q):return (8.85*math.cos(mid)-math.sin(mid)*.47*math.cos(q),8.85*math.sin(mid)+math.cos(mid)*.47*math.cos(q),base+.91+.47*math.sin(q))
   b.beam(p(q),p(qq),.095,4,6)
   # Brick spandrels close the wall above each arch, on both elevations.
   lo,hi=p(q),p(qq)
   for depth in [-.24,.24]:
    def face(v):return(v[0]+depth*math.cos(mid),v[1]+depth*math.sin(mid),v[2])
    v0,v1=face(lo),face(hi)
    b.poly([v0,v1,(v1[0],v1[1],base+1.48),(v0[0],v0[1],base+1.48)],[(3,2,1,0)] if depth>0 else [(0,1,2,3)],7)

 sector(8.45,9.25,base-.03,base+.16,4,level<2)
sector(8.4,9.3,6.21,6.48,7)
for j in range(48):
 a=j*math.tau/48;b.box(8.9*math.cos(a),8.9*math.sin(a),6.63,.56,.56,.30,4,a)
for side in [-1,1]:
 for x in [-1.8,1.8]:b.box(x,side*8.8,1.6,.4,.9,3.2,4)
 b.box(0,side*8.8,3.2,3.8,.9,.30,4)
 b.box(0,side*9.28,3.65,3.5,.08,.45,10)
install('bullring',b)
for side in [-1,1]:
 bpy.ops.object.text_add(location=(0,side*9.34,3.65),rotation=(math.pi/2,0,0 if side<0 else math.pi))
 text=bpy.context.object;text.data.body='PLAÇA DE BOUS';text.data.align_x='CENTER';text.data.align_y='CENTER';text.data.size=.28;text.data.extrude=.004
 from model_geometry import M
 text.data.materials.append(M[4]);bpy.ops.object.convert(target='MESH')
 arena=next(o for o in roots if o.name=='bullring');bpy.ops.object.select_all(action='DESELECT');text.select_set(True);arena.select_set(True);bpy.context.view_layer.objects.active=arena;bpy.ops.object.join()


# Palau de les Arts: a glazed auditorium under one continuous white roof blade.
b=B('palau_arts');b.box(0,0,.18,22,13,.36,4)
# Continuous elliptical glass foyer, seated on the podium.
for j in range(64):
 a=j*math.tau/64;aa=(j+1)*math.tau/64
 p=(7.6*math.cos(a),4.5*math.sin(a));q=(7.6*math.cos(aa),4.5*math.sin(aa))
 b.poly([(p[0],p[1],.35),(q[0],q[1],.35),(q[0],q[1],4.2),(p[0],p[1],4.2)],[(0,1,2,3)],16)
 b.beam((p[0],p[1],.35),(p[0],p[1],4.25),.045,4,6)
 for h in [.45,2.05,4.15]:b.beam((p[0],p[1],h),(q[0],q[1],h),.08,4,7)
# Upper auditorium shell: a half dome with a clean horizontal lower edge.
for j in range(48):
 a=j*math.tau/48;aa=(j+1)*math.tau/48
 for k in range(16):
  t=k*math.pi/32;tt=(k+1)*math.pi/32
  def dome(a,t):return(7.6*math.cos(a)*math.cos(t),4.6*math.sin(a)*math.cos(t),4.12+3.5*math.sin(t))
  b.poly([dome(a,t),dome(aa,t),dome(aa,tt),dome(a,tt)],[(0,1,2,3)],2)
# A single thick blade rises from the west foot and projects beyond the foyer.
# Its complete underside and edge faces prevent disconnected paper sheets.
for i in range(64):
 x=-10.5+i*23/64;xx=-10.5+(i+1)*23/64
 def blade(x,side,under=False):
  u=(x+10.5)/23;h=.50+9.6*math.sin(u*math.pi*.76)
  width=.25+2.7*math.sin(u*math.pi)**.7
  return(x,side*width,h-(.40 if under else 0))
 b.poly([blade(x,-1),blade(xx,-1),blade(xx,1),blade(x,1),blade(x,-1,True),blade(xx,-1,True),blade(xx,1,True),blade(x,1,True)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7)],4)
# Connected flanking shells carry the blade into the podium.
for side in [-1,1]:
 for j in range(30):
  u=j/30;v=(j+1)/30
  def support(t,edge):
   return(-9.6+16.0*t,side*(.9+3.8*math.sin(t*math.pi)),.40+(8.4*math.sin(t*math.pi*.76) if edge else 1.1*math.sin(t*math.pi)))
  b.poly([support(u,False),support(v,False),support(v,True),support(u,True)],[(0,1,2,3)] if side<0 else [(3,2,1,0)],2)
 # Foyer entrance is recessed between two concrete cheeks.
 b.box(-2.5,side*4.62,1.75,2.4,.10,2.8,17)
 for x in [-3.8,-1.2]:b.box(x,side*4.68,1.8,.16,.18,3,4)
 b.box(-2.5,side*4.68,3.3,2.75,.18,.16,4)
install('palau_arts',b)
# Umbracle: a long open arcade, palms and garden walk.
b=B('umbracle')
for x in [-12+j*1.5 for j in range(17)]:
 for k in range(24):
  a=k*math.pi/24;aa=(k+1)*math.pi/24
  b.beam((x,4*math.cos(a),.1+6.5*math.sin(a)),(x,4*math.cos(aa),.1+6.5*math.sin(aa)),.075,4,7)
for x in [-9,-5,0,5,9]:
 b.beam((x,0,.1),(x,0,3.6),.11,13)
 for j in range(8):
  a=j*math.tau/8;b.beam((x,0,3.6),(x+math.cos(a)*1.7,math.sin(a)*1.7,3.4),.14,23,6,.02)
for y in [-3,3]:b.box(0,y,.26,24,1,.5,5)
install('umbracle',b)
# Agora: steep blue ribs describe a closed pointed shell.
b=B('agora')
for j in range(40):
 a=j*math.tau/40;aa=(j+1)*math.tau/40
 for k in range(12):
  t=k/12;tt=(k+1)/12
  def shell(a,t):return(6.4*math.cos(a)*(1-t)**.62,4.5*math.sin(a)*(1-t)**.75,.2+12.2*t)
  # The entrance is part of the shell surface, not a panel in front of it.
  entrance=j in [29,30] and k<3
  b.poly([shell(a,t),shell(aa,t),shell(aa,tt),shell(a,tt)],[(0,1,2,3)],17 if entrance else 10 if j%3 else 16)
  b.beam(shell(a,t),shell(a,tt),.055,17,6)
for j in [29,30]:
 a=j*math.tau/40;aa=(j+1)*math.tau/40
 for t in [0,.25]:b.beam(shell(a,t),shell(aa,t),.065,4,8)
install('agora',b)
# Oceanografic: the water-lily entrance shell over glass and a curved basin.
b=B('oceanografic');b.beam((0,0,.08),(0,0,.2),9,17,64)
b.beam((0,0,.2),(0,0,3.4),4.5,16,48)
for j in range(8):
 a=j*math.tau/8
 for k in range(12):
  t=k/12;tt=(k+1)/12
  def petal(t,s):
   r=1+7*t;ang=a+s*.30*math.sin(t*math.pi*.85)
   return(r*math.cos(ang),r*math.sin(ang),4.6-2.6*math.sin(t*math.pi)+2*t*t)
  b.poly([petal(t,-1),petal(tt,-1),petal(tt,1),petal(t,1)],[(0,1,2,3),(3,2,1,0)],2)
  b.beam(petal(t,0),petal(tt,0),.06,4,7)
 b.beam((5.6*math.cos(a),5.6*math.sin(a),.2),(6.9*math.cos(a),6.9*math.sin(a),4.3),.12,4,8)
install('oceanografic',b)
