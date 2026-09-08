"""Replace weak landmark components with finished original geometry."""
import sys
sys.path.insert(0,os.path.join(ROOT,'scripts'))
from model_geometry import Builder as B, window as win, roof as tile_roof, M, cottage_builder

def moved_roof(b,x,y,z,w,d):
 start=len(b.v);tile_roof(b,w,d,z)
 for i in range(start,len(b.v)):
  xx,yy,zz=b.v[i];b.v[i]=(xx+x,yy+y,zz)

def text_part(b,text,x,y,z,size=.30):
 bpy.ops.object.text_add(location=(x,y,z),rotation=(math.pi/2,0,0));o=bpy.context.object;o.data.body=text;o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.size=size;o.data.extrude=.008;o.data.materials.append(M[4]);bpy.ops.object.convert(target='MESH')
 return o

def replace(name,b,texts=[]):
 old=next(o for o in roots if o.name==name);i=roots.index(old);bpy.data.objects.remove(old,do_unlink=True)
 obj=b.finish();obj.name=name
 if texts:
  bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
  for o in texts:o.select_set(True)
  bpy.context.view_layer.objects.active=obj;bpy.ops.object.join()
 roots[i]=obj

b=B('station')
# Three pavilions, with separate roof bays and a continuous civic facade.
b.box(0,0,3.2,25,5,6.4,2)
for x in [-11.2,0,11.2]:
 h=9 if x==0 else 8.2;b.box(x,0,h/2,3.2,5.6,h,0)
 for z in [.25,2.7,5.65,h-.25]:b.box(x,0,z,3.4,5.78,.16,4)
 for side in [-1,1]:
  for z in [1,2,3.4,4.4,5.4,6.9]:b.box(x+side*1.43,-2.87,z,.22,.18,.5,4)
 moved_roof(b,x,0,h,3.7,6.1)
for side in [-1,1]:moved_roof(b,side*5.6,0,6.5,7.65,5.7)
for z in [.22,.6,3.2,6.2]:b.box(0,-2.59,z,25.3,.26,.18,4)
for x in [-8.7,-6.2,-3.7,3.7,6.2,8.7]:
 # Recessed tall portal glazing, carved arch heads and ceramic panels.
 b.box(x,-2.62,1.45,1.35,.10,2.9,13);b.box(x,-2.71,1.47,1.13,.06,2.62,16)
 for side in [-1,1]:b.box(x+side*.79,-2.75,1.5,.18,.20,3,4)
 for j in range(18):
  a=j*math.pi/18;aa=(j+1)*math.pi/18;b.beam((x+math.cos(a)*.8,-2.77,2.78+math.sin(a)*.8),(x+math.cos(aa)*.8,-2.77,2.78+math.sin(aa)*.8),.11,4,7)
 win(b,x,-2.66,4.7,0,w=1.3,h=1.6)
 b.box(x,-2.78,6.02,1.55,.08,.35,10)
 for k in range(7):b.sphere(x-.57+k*.19,-2.87,6.04,.063,29 if k%2 else 24,n=6,rings=3)
# Side elevations have finished lower and upper windows, plinths, and ceramic bands.
for side in [-1,1]:
 for yy in [-1.55,1.55]:
  for z in [2.0,4.75,6.8]:win(b,side*12.85,yy,z,side*math.pi/2,w=.95,h=1.35)
 for z in [.4,3.1,6.1]:b.box(side*12.91,0,z,.15,5.75,.14,10 if z==3.1 else 4)
# Clock and orange-tree ceramic medallions replace the blank plaques.
for x in [-11.2,11.2]:
 b.beam((x,-2.81,6.7),(x,-2.96,6.7),.60,10,32)
 b.beam((x,-3.00,6.32),(x,-3.00,6.94),.035,19,6)
 for j in range(9):
  a=j*2.4;b.sphere(x+math.cos(a)*.28,-3.02,6.78+math.sin(a)*.28,.11,24,n=7,rings=3)
 for j in range(4):b.sphere(x+math.sin(j*2.4)*.28,-3.11,6.76+math.cos(j*2.4)*.25,.075,29,n=7,rings=4)
b.beam((0,-2.83,7.65),(0,-2.99,7.65),.75,4,40)
for j in range(12):
 a=j*math.tau/12;b.beam((math.sin(a)*.57,-3.02,7.65+math.cos(a)*.57),(math.sin(a)*.66,-3.02,7.65+math.cos(a)*.66),.025,15,5)
b.beam((0,-3.05,7.65),(0,-3.05,8.13),.032,15,6);b.beam((0,-3.05,7.65),(.34,-3.05,7.5),.032,15,6)
b.box(0,-2.9,5.65,3.0,.13,.52,10)
text=text_part(b,'ESTACIÓ DEL NORD',0,-3.0,5.65,.205)
# The rear train shed has a barrel roof, steel ribs, glazed bays and masonry piers.
b.box(0,7.15,2.85,21.5,9.3,5.7,16)
for z in [.3,.7,3.0,5.5]:b.box(0,7.15,z,21.85,9.6,.18,5 if z<1 else 4)
for x in range(-10,11,2):
 b.box(x,11.87,2.8,.18,.2,5.4,4)
 b.box(x,11.90,1.15,.58,.12,2.2,5)
 for z in [1.7,4.3]:
  b.box(x+.7,11.95,z,.075,.12,2.15,4)
for side in [-1,1]:
 for yy in [3.3,5.3,7.3,9.3,11.3]:
  b.box(side*10.83,yy,2.8,.18,.20,5.4,4)
  b.box(side*10.89,yy,1.15,.12,.65,2.2,5)
 # Tall side windows and clerestory bands.
 for yy in [4.3,6.3,8.3,10.3]:win(b,side*10.90,yy,3.2,side*math.pi/2,w=1.0,h=2.4)
for row in range(12):
 y=2.4+row*.88
 for i in range(24):
  x=-11+i*22/24;xx=-11+(i+1)*22/24;z=5.75+2.2*math.sin((x+11)/22*math.pi);zz=5.75+2.2*math.sin((xx+11)/22*math.pi)
  if row<11:b.poly([(x,y,z),(xx,y,zz),(xx,y+.88,zz),(x,y+.88,z)],[(0,1,2,3)],10 if (row+i)%4 else 17)
  b.beam((x,y,z+.04),(xx,y,zz+.04),.055,4,6)
for x in [-11,-7.3,-3.7,0,3.7,7.3,11]:
 z=5.8+2.2*math.sin((x+11)/22*math.pi);b.beam((x,2.4,z),(x,12.08,z),.04,15,6)
# Rear end of the barrel roof is closed with a fan of glazing bars.
for i in range(20):
 x=-10.8+i*21.6/19;z=5.75+2.2*math.sin((x+11)/22*math.pi);b.beam((x,12.09,5.5),(x,12.09,z),.045,4,6)
b.box(0,12.02,2.85,2.8,.15,4.8,13);b.box(0,12.12,2.85,2.4,.08,4.35,16)
for y in [2.4,12.09]:
 for i in range(24):
  x=-11+i*22/24;xx=-11+(i+1)*22/24;z=5.75+2.2*math.sin((x+11)/22*math.pi);zz=5.75+2.2*math.sin((xx+11)/22*math.pi)
  b.poly([(x,y,5.7),(xx,y,5.7),(xx,y,zz),(x,y,z)],[(3,2,1,0)] if y>3 else [(0,1,2,3)],16)
replace('station',b,[text])

replace('barraca',cottage_builder('barraca',6,8))

def attach_detail(name,b,texts=[]):
 obj=next(o for o in roots if o.name==name);detail=b.finish();bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);detail.select_set(True)
 for o in texts:o.select_set(True)
 bpy.context.view_layer.objects.active=obj;bpy.ops.object.join()

# Serranos terraces have paved floors, access hatches, and matching flag faces.
b=B('serranos_terraces')
for cx in [-5,5]:
 for i in range(-4,5):
  for j in range(-4,5):
   if math.hypot(i*.5,j*.5)>2.25:continue
   b.box(cx+i*.5,j*.5,10.49,.48,.48,.055,4 if (i+j)%3 else 5)
 b.box(cx,.8,10.54,1.1,.95,.08,14);b.box(cx,.8,10.585,.86,.72,.035,13);b.beam((cx-.2,.8,10.62),(cx+.2,.8,10.62),.025,19)
for side in [-1,1]:
 for j in range(9):b.box(5.8,side*.055,13.5+(j+.5)/9,1.6,.014,1/9,19 if j%2 else 20)
 b.box(5.12,side*.068,14,.23,.012,1,10)
b.box(0,1.58,7.3,1.8,.12,1.1,5)
for i in range(5):b.box(-.60+i*.3,1.66,7.3,.13,.045,.83,19 if i%2 else 20)
attach_detail('serranos',b)

# Continuous mouldings resolve the city hall's unfinished side projections.
b=B('townhall_mouldings')
for z in [1,3.3,6.5,8.1]:
 b.box(0,3.22,z,22,.42,.25,4)
 for side in [-1,1]:b.box(side*10.75,0,z,.5,6.8,.25,4)
for side in [-1,1]:
 for y in [-2.2,0,2.2]:
  b.box(side*10.68,y,4.4,.26,.28,6.8,4);b.box(side*10.72,y,.87,.34,.55,.25,5);b.box(side*10.72,y,7.88,.36,.55,.25,4)
for x in [-9,-6,-3,0,3,6,9]:b.box(x,3.26,4.35,.30,.26,6.6,4)
b.beam((0,-2.99,11.7),(0,-3.12,11.7),.86,4,40)
for j in range(12):
 a=j*math.tau/12;b.beam((math.sin(a)*.64,-3.15,11.7+math.cos(a)*.64),(math.sin(a)*.75,-3.15,11.7+math.cos(a)*.75),.025,15,5)
b.beam((0,-3.18,11.7),(0,-3.18,12.26),.05,15);b.beam((0,-3.18,11.7),(.43,-3.18,11.7),.05,15)
attach_detail('townhall',b)

# A full arcade and stepped seating make the arena legible from every direction.
b=B('bullring')
def ring(b,r0,r1,z0,z1,mat,n=96):
 for j in range(n):
  a=j*math.tau/n;aa=(j+1)*math.tau/n
  b.poly([(r0*math.cos(a),r0*math.sin(a),z1),(r1*math.cos(a),r1*math.sin(a),z1),(r1*math.cos(aa),r1*math.sin(aa),z1),(r0*math.cos(aa),r0*math.sin(aa),z1),(r0*math.cos(a),r0*math.sin(a),z0),(r0*math.cos(aa),r0*math.sin(aa),z0)],[(0,1,2,3),(0,3,5,4)],mat)
b.beam((0,0,.03),(0,0,.18),6.2,5,96)
for j in range(8):ring(b,6.15+j*.28,6.43+j*.28,.15+j*.22,.37+j*.22,4 if j%2 else 5)
for level in range(4):
 base=.3+level*1.48
 for j in range(48):
  a=j*math.tau/48;cx=8.85*math.cos(a);cy=8.85*math.sin(a)
  b.box(cx,cy,base+.62,.24,.64,1.25,7,a+math.pi/2)
  # Arch voussoirs span the actual space between piers.
  middle=a+math.pi/48;mx=8.85*math.cos(middle);my=8.85*math.sin(middle)
  tangent=Vector((-math.sin(middle),math.cos(middle),0))
  for k in range(10):
   q=k*math.pi/10;qq=(k+1)*math.pi/10
   p=Vector((mx,my,base+.91))+tangent*(.47*math.cos(q))+Vector((0,0,.47*math.sin(q)))
   pp=Vector((mx,my,base+.91))+tangent*(.47*math.cos(qq))+Vector((0,0,.47*math.sin(qq)))
   b.beam(p,pp,.095,4,6)
 ring(b,8.45,9.25,base-.03,base+.16,4)
ring(b,8.4,9.3,6.21,6.48,7);ring(b,8.45,9.35,.06,.29,5)
for j in range(48):
 a=j*math.tau/48;b.box(8.9*math.cos(a),8.9*math.sin(a),6.63,.56,.56,.30,4,a)
replace('bullring',b)

# Hemisferic: a closed glazed eye, an actual shell spine, seated supports and pool.
b=B('hemisferic')
for i in range(32):
 x=-11.4+i*22.8/32;xx=-11.4+(i+1)*22.8/32
 for j in range(20):
  a=j*math.pi/20;aa=(j+1)*math.pi/20
  def eye(x,t):
   v=math.sqrt(max(0,1-(x/11.5)**2));return(x,math.cos(t)*4.8*v,.48+math.sin(t)*5.5*v)
  b.poly([eye(x,a),eye(xx,a),eye(xx,aa),eye(x,aa)],[(3,2,1,0)],16 if (i+j)%6 else 17)
for i in range(25):
 x=-11.4+i*22.8/24
 for j in range(20):b.beam(eye(x,j*math.pi/20),eye(x,(j+1)*math.pi/20),.075,4,7)
# A broad, solid ribbon clears the lens and ends on concrete feet.
for i in range(40):
 x=-12.6+i*25.2/40;xx=-12.6+(i+1)*25.2/40
 z=1.15+6.5*math.sin((x+12.6)/25.2*math.pi);zz=1.15+6.5*math.sin((xx+12.6)/25.2*math.pi)
 width=.20+.46*math.sin((x+12.6)/25.2*math.pi);ww=.20+.46*math.sin((xx+12.6)/25.2*math.pi)
 b.poly([(x,-width,z),(xx,-ww,zz),(xx,ww,zz),(x,width,z),(x,-width,z-.5),(xx,-ww,zz-.5),(xx,ww,zz-.5),(x,width,z-.5)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7)],4)
for x in [-12.6,12.6]:b.box(x,0,.57,1.0,1.15,1.08,4)
# Thin water platform and a continuous stone curb.
for j in range(96):
 a=j*math.tau/96;aa=(j+1)*math.tau/96
 b.poly([(0,0,.10),(16.6*math.cos(a),9.5*math.sin(a),.10),(16.6*math.cos(aa),9.5*math.sin(aa),.10)],[(0,1,2)],17)
 b.poly([(16.6*math.cos(a),9.5*math.sin(a),.17),(17.2*math.cos(a),10.1*math.sin(a),.17),(17.2*math.cos(aa),10.1*math.sin(aa),.17),(16.6*math.cos(aa),9.5*math.sin(aa),.17)],[(0,1,2,3)],4)
 b.beam((11.8*math.cos(a),5.2*math.sin(a),.44),(11.8*math.cos(aa),5.2*math.sin(aa),.44),.15,4,8)
replace('hemisferic',b)

# Museum: closed structural bays, coherent roof ribs and finished end walls.
b=B('museum');b.box(0,0,.17,26,10,.34,5)
roof_profile=[(-3.1,7.8),(0,9.0),(3.8,7.0)]
for i in range(16):
 x=-12+i*1.5
 for k in range(2):
  y,z=roof_profile[k];yy,zz=roof_profile[k+1];b.poly([(x,y,z),(x+1.5,y,z),(x+1.5,yy,zz),(x,yy,zz)],[(0,1,2,3)],16 if i%3 else 17)
for x in [-12+i*1.5 for i in range(17)]:
 pts=[(x,-4.8,.24),(x,-3.1,7.8),(x,0,9.0),(x,3.8,7.0),(x,4.8,.24)]
 for a,bp in zip(pts,pts[1:]):b.beam(a,bp,.14,4,8)
for y,h in [(-3.05,7.75),(3.75,6.95)]:
 b.box(0,y,h/2,24,.10,h,16)
 for z in [1.8,3.6,5.4,6.8]:
  if z<h:b.box(0,y+(.10 if y>0 else -.10),z,24.3,.12,.07,4)
 for x in range(-11,12):b.box(x,y+(.12 if y>0 else -.12),h/2,.055,.12,h,4)
for side in [-1,1]:
 x=side*12.12;b.poly([(x,-3.1,.3),(x,3.8,.3),(x,3.8,7),(x,0,9),(x,-3.1,7.8)],[(0,1,2,3,4)] if side>0 else [(4,3,2,1,0)],17)
 for y in [-2.6,-1.4,-.2,1,2.2,3.4]:
  height=8.8-abs(y)*.38;b.beam((x+side*.03,y,.3),(x+side*.03,y,height),.045,4,6)
 for z in [2.2,4.2,6.2]:b.box(x+side*.05,.35,z,.11,6.7,.065,4)
for y,z in roof_profile:b.beam((-12.3,y,z+.08),(12.3,y,z+.08),.10,4,8)
replace('museum',b)

# Aqua Multiespacio: a five-level triangular podium, oval office tower and
# lower pale hotel tower.  The paired silhouettes are the real complex's most
# recognisable feature when seen from the City of Arts and Sciences.
b=B('aqua')

def aqua_prism(points,z0,z1,material):
 start=len(b.v);b.v.extend([(x,y,z0) for x,y in points]+[(x,y,z1) for x,y in points]);n=len(points)
 b.f.extend([tuple(start+i for i in range(n-1,-1,-1)),tuple(start+n+i for i in range(n))])
 b.mi.extend([material,material])
 for i in range(n):b.f.append((start+i,start+(i+1)%n,start+n+(i+1)%n,start+n+i));b.mi.append(material)

def aqua_ellipse(cx,cy,rx,ry,z0,z1,segments,material):
 points=[(cx+rx*math.cos(i*math.tau/segments),cy+ry*math.sin(i*math.tau/segments)) for i in range(segments)]
 aqua_prism(points,z0,z1,material)

def aqua_ring(cx,cy,rx,ry,z,material=4,r=.055,segments=32):
 for i in range(segments):
  a=i*math.tau/segments;aa=(i+1)*math.tau/segments
  b.beam((cx+rx*math.cos(a),cy+ry*math.sin(a),z),(cx+rx*math.cos(aa),cy+ry*math.sin(aa),z),r,material,6)

# The mall follows a tapered five-sided plan instead of a generic box.
podium=[(-9.2,-5.1),(9.2,-5.1),(8.55,2.9),(3.7,5.25),(-6.9,4.5)]
aqua_prism(podium,.08,4.72,6)
for z in [.18,1.05,1.94,2.83,3.72,4.70]:
 # Projecting floor plates make the five commercial levels readable.
 b.box(0,-5.11,z,18.65,.28,.16,4)
for level in range(5):
 z=.61+level*.89
 for x in [-8.1,-6.25,-4.4,-2.55,-.7,1.15,3.0,4.85,6.7,8.1]:
  b.box(x,-5.24,z,1.65,.08,.67,16 if (level+int(x*10))%3 else 17)
  b.box(x-.89,-5.29,z,.10,.14,.79,15)
# Podium side cladding follows the tapered footprint in landmark_repairs.py.

# Tall 20-storey office tower: a dark oval glass skin with pale aluminium fins.
office=(3.55,.72,3.75,3.03);ox,oy,orx,ory=office
aqua_ellipse(ox,oy,orx,ory,4.68,22.28,32,16)
for row in range(21):aqua_ring(ox,oy,orx+.045,ory+.045,4.76+row*.84,4,.052,32)
for i in range(12):
 a=i*math.tau/12;x=ox+(orx+.07)*math.cos(a);y=oy+(ory+.07)*math.sin(a)
 b.box(x,y,13.48,.09,.16,17.45,15,a+math.pi/2)
# The light side spines and dark central blade reproduce the alternating facade.
for a in [0,math.pi]:
 x=ox+(orx+.11)*math.cos(a);y=oy+(ory+.11)*math.sin(a)
 b.box(x,y,13.48,.78,.20,17.55,4,a+math.pi/2)
front_y=oy-ory-.10
b.box(ox,front_y,13.48,.66,.20,17.55,6)

# A faceted metal crown and inset rooftop plant complete the high-rise profile.
aqua_ellipse(ox,oy,orx+0.02,ory+0.02,22.28,22.93,32,4)
aqua_ring(ox,oy,orx+.13,ory+.13,22.32,17,.09,32)
aqua_ring(ox,oy,orx+.05,ory+.05,22.93,15,.07,32)
b.box(ox,oy,23.02,2.55,2.15,.34,15)

# The hotel is a separate lower stone tower with a gently bowed street facade.
hx,hy=-3.35,.10;hotel=[(hx-2.45,hy+2.55),(hx+2.45,hy+2.55)]
hotel += [(hx+2.45*math.cos(-i*math.pi/16),hy+2.62*math.sin(-i*math.pi/16)) for i in range(17)]
aqua_prism(hotel,4.70,14.55,4)
for z in [5.0+i*.79 for i in range(12)]:b.box(hx,hy+2.61,z,5.15,.13,.08,5)
for row in range(11):
 z=5.38+row*.81
 for i in range(7):
  a=-math.pi+(i+1)*math.pi/8;x=hx+(2.49)*math.cos(a);y=hy+(2.67)*math.sin(a)
  b.box(x,y,z,.40,.075,.44,16,a+math.pi/2)
for side in [-1,1]:
 for row in range(11):
  z=5.38+row*.81
  for yy in [.85,1.65,2.35]:b.box(hx+side*2.48,yy,z,.08,.43,.44,16)
b.box(hx,hy,14.65,4.55,4.65,.24,5)
for side in [-1,1]:b.box(hx+side*2.18,hy,14.98,.18,4.2,.62,15)

# A glazed atrium joins both towers. Roof terraces soften the mall mass.
for i in range(9):
 x=-.9+i*.48;h=5.35+1.05*math.sin(i*math.pi/8)
 b.beam((x,-.9,4.8),(x,-.9,h),.07,4,7);b.beam((x,-.9,h),(x,2.2,h+.12),.07,4,7)
 if i<8:b.poly([(x,-.9,h),(x+.48,-.9,5.35+1.05*math.sin((i+1)*math.pi/8)),(x+.48,2.2,5.47+1.05*math.sin((i+1)*math.pi/8)),(x,2.2,h+.12)],[(0,1,2,3)],17)
for px,py,pw,pd in [(-7.2,2.8,2.8,1.0),(6.9,3.4,2.4,.8)]:
 b.box(px,py,4.98,pw,pd,.35,5)
 for j in range(18):b.sphere(px-pw*.4+j*pw*.8/17,py,5.35,.27,22+j%4,sx=1,sy=.8,sz=.7,n=6,rings=3)

entrance_text=text_part(b,'AQUA',0,-5.36,4.28,.34)
crown_text=text_part(b,'AQUA',ox,front_y-.08,22.60,.42)
replace('aqua',b,[entrance_text,crown_text])

# The university dome rests on a drum; its side elevations are fully framed.
b=B('university_detail');b.beam((0,5,8.2),(0,5,9.0),3.2,4,32)
for side in [-1,1]:
 for y in [-5,-2,1,4]:
  win(b,side*10.23,y,3.8,side*math.pi/2,w=1.0,h=2.1)
 for z in [.6,6.5]:b.box(side*10.24,0,z,.25,15.2,.23,4)
 for y in [-6,-3,0,3,6]:b.box(side*10.22,y,3.5,.23,.26,6.1,4)
attach_detail('university',b)

# Tile courses, eaves and an open bell cage finish the cathedral roofline.
b=B('cathedral_detail')
start=len(b.v);tile_roof(b,11.4,12.4,7.05,False)
for i in range(start,len(b.v)):
 x,y,z=b.v[i];b.v[i]=(x+7,y+2,z)
b.beam((7,2,8.8),(7,2,9.45),3.15,4,32)
b.beam((0,0,18.05),(0,0,18.25),1.8,4,8)
for j in range(8):
 a=j*math.tau/8;b.beam((1.45*math.cos(a),1.45*math.sin(a),18.25),(1.45*math.cos(a),1.45*math.sin(a),20.3),.13,4,8)
b.beam((0,0,20.3),(0,0,20.54),1.8,4,8)
b.beam((0,0,20.54),(0,0,21.32),.11,19,12)
b.sphere(0,0,19.0,.65,19,sx=.7,sy=.7,sz=1,n=12,rings=6)
for side in [-1,1]:
 for x in [2,4.5,7,9.5,12]:b.box(x,2+side*5.72,3.5,.35,.32,6.4,4)
attach_detail('cathedral',b)

b=B('townhall_roof_finish');tile_roof(b,14.3,6.25,8.25,False);attach_detail('townhall',b)

from final_model_details import add_final_details
add_final_details(roots)

from cathedral_model import replace_cathedral
replace_cathedral(roots)

from asset_finish import finish_assets
finish_assets(roots)

from aqua_supports import add_aqua_supports
add_aqua_supports(roots)
