"""Editable, reference-led civic landmarks. Run with a separate Blender process.
Game axes: X east, Y up, Z facade front. Export roots stay at the origin.
See PROMPT.md for the art direction.
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/art/civic-plaza'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}; current=None; roots=[]
def pos(p): return Vector((p[0],-p[2],p[1]))
def mat(name,h,metal=0):
 rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]; rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
 m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=m.diffuse_color;bs.inputs['Roughness'].default_value=.7;bs.inputs['Metallic'].default_value=metal;M[name]=m;return name
for name,h in [('stone','dfd3b9'),('trim','f4ead2'),('shade','b7a88b'),('glass','304e56'),('wood','71503c'),('iron','374b4c'),('gold','dcb663'),('tile','ae6860'),('zinc','708a87'),('white','fff2d8'),('red','d94e50'),('blue','3a75a9'),('pink','ee7faf'),('violet','9561b3'),('teal','42ada4'),('leaf','74a848'),('leaflight','a7c653'),('orange','ee913d'),('black','34363b')]:mat(name,h,.35 if name in ('iron','gold','zinc') else 0)
def root(name):
 global current
 current=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(current);roots.append(current);return current
def reg(o,name,m):
 o.name=name;o.parent=current;o.data.materials.append(M[m]);return o
def box(name,p,s,m,bev=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos(p));o=reg(bpy.context.object,name,m);o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bev:
  mod=o.modifiers.new('Soft carved corners','BEVEL');mod.width=bev;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def ball(name,p,s,m,n=16):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=n,ring_count=8,location=pos(p));o=reg(bpy.context.object,name,m);o.scale=(s[0],s[2],s[1]);
 for f in o.data.polygons:f.use_smooth=True
 return o
def beam(name,a,b,r,m,n=10,r2=None):
 a=pos(a);b=pos(b);bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=(b-a).length,location=(a+b)/2);o=reg(bpy.context.object,name,m);o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');return o
def tube(name,pts,r,m,n=8):
 # One mesh for a shaped pipe rather than separate cylinders at every sample.
 pp=[pos(p) for p in pts];vs=[];fs=[]
 for i,p in enumerate(pp):
  t=(pp[min(i+1,len(pp)-1)]-pp[max(0,i-1)]).normalized();u=t.cross(Vector((1,0,0)))
  if u.length<.01:u=t.cross(Vector((0,0,1)))
  u.normalize();v=t.cross(u).normalized()
  vs += [p+r*(math.cos(j*math.tau/n)*u+math.sin(j*math.tau/n)*v) for j in range(n)]
 for i in range(len(pp)-1):
  for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
 data=bpy.data.meshes.new(name);data.from_pydata(vs,[],fs);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);return reg(o,name,m)
def arc(name,x,y,z,r,m,width=.1,start=0,end=math.pi):
 return tube(name,[(x+r*math.cos(start+(end-start)*i/24),y+r*math.sin(start+(end-start)*i/24),z) for i in range(25)],width,m)
def text(name,content,p,size,m):
 bpy.ops.object.text_add(location=pos(p),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=name;o.data.body=content;o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.size=size;o.data.extrude=.012;o.parent=current;o.data.materials.append(M[m]);bpy.ops.object.convert(target='MESH');return bpy.context.object
def column(x,z,bottom,height,r=.19):
 beam('Fluted column',(x,bottom,z),(x,bottom+height,z),r,'trim',16,r*.88)
 for y,rr,hh in [(bottom,r*1.42,.15),(bottom+.18,r*1.15,.13),(bottom+height-.15,r*1.4,.18),(bottom+height,r*1.6,.14)]:beam('Capital and base',(x,y,z),(x,y+hh,z),rr,'trim',12)
 for s in (-1,1):ball('Ionic capital scroll',(x+s*r*.85,bottom+height-.02,z+.06),(r*.45,r*.38,r*.45),'trim',10)
def balustrade(x,y,z,w):
 box('Balcony sill',(x,y,z),(w,.16,.38),'trim')
 box('Balcony handrail',(x,y+.57,z),(w+.08,.11,.33),'trim')
 for i in range(max(2,int(w/.25))):
  xx=x-w/2+.12+i*(w-.24)/(max(2,int(w/.25))-1)
  beam('Baluster stem',(xx,y+.12,z),(xx,y+.51,z),.045,'trim',8);ball('Baluster pear',(xx,y+.3,z),(.074,.12,.074),'trim',8)
def window(x,y,z,w,h,arched=False,balcony=False):
 box('Deep window recess',(x,y,z),(w+.2,h+.18,.1),'shade');box('Blue window glass',(x,y,z+.065),(w,h,.08),'glass')
 for s in (-1,1):box('Window jamb',(x+s*(w/2+.09),y,z+.16),(.14,h+.27,.24),'trim')
 for yy in (y-h/2,y+h/2):box('Window lintel',(x,yy,z+.19),(w+.42,.14,.3),'trim')
 box('Timber window mullion',(x,y,z+.13),(.065,h,.09),'wood');box('Window transom',(x,y+.1,z+.14),(w,.065,.09),'wood')
 if arched:arc('Arched window crown',x,y+h/2,z+.19,w/2+.09,'trim',.105)
 if balcony:balustrade(x,y-h/2,z+.39,w+.5)
def statue(x,y,z,s=1,wing=False):
 ball('Allegorical sculpture head',(x,y+1.32*s,z),(.18*s,.23*s,.18*s),'trim',10)
 beam('Draped stone robe',(x,y,z),(x,y+1.08*s,z),.31*s,'trim',10,.19*s)
 for side in (-1,1):
  tube('Sculpture arm',[(x+side*.14*s,y+.95*s,z),(x+side*.43*s,y+.65*s,z+.09*s),(x+side*.52*s,y+.93*s,z+.1*s)],.09*s,'trim')
  if wing:ball('Winged allegory',(x+side*.4*s,y+1*s,z-.08*s),(.47*s,.15*s,.13*s),'trim',10)
def clock(x,y,z,r):
 beam('Clock stone rim',(x,y,z),(x,y,z+.11),r,'trim',48)
 beam('Clock enamel face',(x,y,z+.12),(x,y,z+.15),r*.84,'white',48)
 for i in range(12):
  a=i*math.tau/12;tube('Clock hour',[(x+math.sin(a)*r*.64,y+math.cos(a)*r*.64,z+.18),(x+math.sin(a)*r*.75,y+math.cos(a)*r*.75,z+.18)],.025,'iron',6)
 beam('Clock minute hand',(x,y,z+.2),(x,y+r*.62,z+.2),.035,'iron',8)
 beam('Clock hour hand',(x,y,z+.21),(x+r*.38,y-r*.2,z+.21),.044,'iron',8)
def dome(x,y,z,r,h,m):
 # Hemispherical profile with visible carved ribs and a lantern.
 pts=[];vs=[];fs=[];N=32;K=10
 for j in range(K+1):
  a=j*math.pi/2/K
  for i in range(N):t=i*math.tau/N;vs.append(pos((x+r*math.cos(a)*math.cos(t),y+h*math.sin(a),z+r*math.cos(a)*math.sin(t))))
 for j in range(K):
  for i in range(N):a=j*N+i;b=j*N+(i+1)%N;fs.append((a,b,b+N,a+N))
 data=bpy.data.meshes.new('Dome');data.from_pydata(vs,[],fs);data.update();o=bpy.data.objects.new('Glazed ribbed dome',data);bpy.context.collection.objects.link(o);reg(o,o.name,m)
 for i in range(12):
  t=i*math.tau/12;tube('Dome carved rib',[(x+r*math.cos(j*math.pi/20)*math.cos(t),y+h*math.sin(j*math.pi/20),z+r*math.cos(j*math.pi/20)*math.sin(t)) for j in range(11)],.047,'trim')
 beam('Lantern base ring',(x,y+h,z),(x,y+h+.12,z),.38,'trim',16)
 for i in range(6):
  a=i*math.tau/6;beam('Open pale lantern column',(x+.3*math.cos(a),y+h+.1,z+.3*math.sin(a)),(x+.3*math.cos(a),y+h+.78,z+.3*math.sin(a)),.055,'trim',8)
 beam('Lantern roof cornice',(x,y+h+.76,z),(x,y+h+.89,z),.4,'trim',16)
 beam('Dome finial',(x,y+h+.88,z),(x,y+h+1.32,z),.21,'gold',10,0)

root('Ayuntamiento')
box('Town hall cream stone wings',(0,4.7,0),(28,9.4,7.2),'stone')
for y in (.25,.7,3.0,6.6,9.1,9.5):box('Continuous carved cornice',(0,y,0),(28.35,.16,7.5),'trim')
# Rustic stone courses and framed doors retain scale at pedestrian height.
for y in (.45,1.05,1.65,2.25,2.85):box('Rusticated ground-floor course',(0,y,3.65),(28,.065,.1),'shade')
for x in (-12.3,-9.7,-7.1,7.1,9.7,12.3):
 window(x,1.58,3.69,1.15,2.5,True)
 window(x,4.73,3.69,1.12,2.45,False,True)
 window(x,7.63,3.69,1.1,1.7)
 for y in (5.98,8.61):
  beam('Triangular window pediment',(x-.8,y,3.98),(x,y+.38,3.98),.08,'trim');beam('Triangular window pediment',(x,y+.38,3.98),(x+.8,y,3.98),.08,'trim')
for x in (-13.85,-8.4,8.4,13.85):column(x,3.84,3.15,5.64,.21)
# Projecting central towers flank the civic balcony, with a taller clock behind.
for x in (-4.1,4.1):
 box('Projecting central pavilion',(x,6.25,1.02),(3.2,12.5,6.5),'stone')
 for y in (3.15,9.35,12.25):box('Pavilion entablature',(x,y,1.05),(3.55,.25,6.7),'trim')
 window(x,6.32,4.32,1.4,4.2,True,True);window(x,10.7,4.32,1.08,2.08,False,True)
 for side in (-1,1):column(x+side*1.3,4.51,3.28,5.8,.25);statue(x+side*1.13,9.68,4.62,.76)
 arc('Broken baroque pediment',x,12.43,4.4,1.52,'trim',.12)
 for s in (-1,1):beam('Pavilion urn',(x+s*1.5,12.5,4.2),(x+s*1.5,13.24,4.2),.14,'trim',10,.05)
 ball('Pediment cartouche',(x,12.8,4.48),(.43,.49,.16),'trim')
box('Central clock tower',(0,10.0,-.2),(2.95,20,3),'stone')
for y in (10.8,14.8,15.1,18.1,19.9):box('Clock tower cornice',(0,y,-.2),(3.35,.21,3.4),'trim')
window(0,13.37,1.33,1.04,2.0,False,True);clock(0,16.65,1.36,1.0)
for side in (-1,1):column(side*1.3,1.43,15.35,2.53,.13)
arc('Clock tower broken arch',0,19.87,1.52,1.32,'trim',.14)
for x in (-.9,.9):beam('Open iron bell crown',(x,20.35,-.2),(x*.65,22,-.2),.064,'iron')
for y in (20.5,21.15,21.8):
 tube('Iron crown hoop',[(math.cos(i*math.tau/24)*(.85-(y-20.5)*.15),y,-.2+math.sin(i*math.tau/24)*(.85-(y-20.5)*.15)) for i in range(25)],.065,'iron')
beam('Clock tower spire',(0,21.7,-.2),(0,22.8,-.2),.1,'iron',8,0)
# Four actual support columns under an open balcony canopy.
box('Recessed central portal',(0,1.57,3.72),(3.8,3.05,.12),'iron')
for x in (-1.75,-.73,.73,1.75):column(x,4.9,.08,3.1,.22)
# Broad capsule balcony with rounded ends, visible from the square.
outline=[]
for cx,start in [(2.2,-math.pi/2),(-2.2,math.pi/2)]:
 for i in range(17):
  a=start+i*math.pi/16;outline.append((cx+1.2*math.cos(a),4.32+1.2*math.sin(a)))
vs=[pos((x,y,z)) for y in (3.18,3.49) for x,z in outline];N=len(outline)
fs=[tuple(reversed(range(N))),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
data=bpy.data.meshes.new('Rounded civic balcony');data.from_pydata(vs,[],fs);data.update();o=bpy.data.objects.new('Rounded stone civic balcony',data);bpy.context.collection.objects.link(o);reg(o,o.name,'trim')
rail=[]
for i in range(9):
 a=math.pi-i*math.pi/16;rail.append((-2.2+1.18*math.cos(a),4.32+1.18*math.sin(a)))
rail += [(-2.2+i*4.4/18,5.5) for i in range(1,19)]
for i in range(1,9):
 a=math.pi/2-i*math.pi/16;rail.append((2.2+1.18*math.cos(a),4.32+1.18*math.sin(a)))
for yy,r in [(3.55,.065),(4.12,.065)]:tube('Curved balcony stone rail',[(x,yy,z) for x,z in rail],r,'trim')
for x,z in rail:
 beam('Curved balcony baluster',(x,3.61,z),(x,4.07,z),.047,'trim',8);ball('Curved balcony pear',(x,3.83,z),(.075,.13,.075),'trim',8)
window(0,6.2,3.68,3.55,4.0,True)
box('Civic name stone',(0,10.0,3.72),(5.15,.65,.3),'trim');text('Ajuntament name','AJUNTAMENT',(0,10.02,3.9),.38,'shade')
for x in (-2.1,2.1):statue(x,10.45,3.5,.8)
ball('City coat of arms',(0,11.1,3.68),(.42,.65,.19),'gold')
for x in (-13.25,13.25):
 beam('Corner dome drum',(x,9.46,.05),(x,10.18,.05),1.16,'stone',16)
 dome(x,10.17,.05,1.35,2.7,'tile')
for x in range(-13,14):
 if abs(x)>6:balustrade(x,9.63,3.48,.92)
# Flags are cloth-shaped meshes, left in the saved asset for editing.
for ix,(xx,colors) in enumerate([(-.8,['red','gold','red']),(0,['gold','red','gold','red','gold']),( .8,['blue'])]):
 beam('Balcony flagpole',(xx,7.4,4.5),(xx,5,5.22),.038,'gold')
 for j,color in enumerate(colors):box('Hanging civic flag',(xx+(j-(len(colors)-1)/2)*.6/len(colors),5.86,5.01),(.61/len(colors),1.65,.04),color)
# Rear and side elevations remain finished when walking around the building.
for x in range(-12,13,3):
 for y in (1.7,4.7,7.6):
  box('Rear window',(x,y,-3.64),(1.1,1.8,.1),'glass');box('Rear lintel',(x,y+1,-3.7),(1.35,.14,.18),'trim')
for side in (-1,1):
 for z in (-2,0,2):
  for y in (1.7,4.7,7.6):box('Side window',(side*14.04,y,z),(.12,1.8,1.05),'glass')

root('Correos')
box('Postal palace main body',(0,4.3,0),(24,8.6,6),'stone')
for y in (.4,3.4,7.9,8.5):box('Palace horizontal moulding',(0,y,0),(24.3,.19,6.3),'trim')
for x in (-10.8,-8.45,-6.1,6.1,8.45,10.8):
 window(x,1.9,3.07,1.2,2.6,True)
 window(x,5.77,3.07,1.23,2.55,False,True)
 column(x-1.0,3.3,3.55,4.25,.18)
for x in (-11.5,11.5):
 box('Postal corner pavilion',(x,5.1,.1),(2.75,10.2,6.25),'stone')
 beam('Rounded projecting postal corner',(x,.12,2.3),(x,10.2,2.3),1.6,'stone',32)
 window(x,6.6,3.94,1.14,2.75,True,True);window(x,1.9,3.94,1.1,2.6,True)
 for side in (-1,1):column(x+side*1.18,3.44,3.6,5.8,.16)
 for yy in (.4,3.4,9.9):beam('Rounded corner cornice',(x,yy,2.3),(x,yy+.18,2.3),1.68,'trim',32)
 beam('Zinc dome drum',(x,10.2,2.3),(x,10.75,2.3),1.57,'trim',32);dome(x,10.75,2.3,1.64,1.8,'zinc')
 ball('Oval dormer dark glass',(x,11.25,3.78),(.43,.57,.075),'glass')
 tube('Oval carved dormer frame',[(x+.48*math.cos(i*math.tau/32),11.25+.65*math.sin(i*math.tau/32),3.82) for i in range(33)],.10,'trim')
 box('Oval dormer mullion',(x,11.25,3.9),(.055,1.05,.055),'trim');box('Oval dormer crossbar',(x,11.25,3.9),(.78,.055,.055),'trim')
 for y in (3.35,9.85):box('Corner pavilion ledge',(x,y,.1),(3.0,.24,6.5),'trim')
box('Postal central entrance pavilion',(0,5.2,.38),(7.1,10.4,6.65),'stone')
box('Postal arch glass',(0,3.98,3.77),(4.5,6.6,.13),'glass')
for x in (-2.85,-2.2,2.2,2.85):column(x,3.99,.15,6.15,.25)
arc('Grand postal entrance arch',0,5.8,4.07,2.95,'trim',.25)
arc('Postal arch inner moulding',0,5.8,4.1,2.58,'shade',.08)
for i in range(7):
 a=i*math.pi/6;beam('Arched fanlight mullion',(0,5.8,3.9),(2.2*math.cos(a),5.8+2.2*math.sin(a),3.9),.05,'gold',8)
box('Post office front door mullion',(0,2.8,3.9),(.13,5.5,.11),'wood')
box('Postal inscription',(0,9.05,3.9),(6.4,.63,.3),'trim');text('Correos name','CORREOS Y TELÉGRAFOS',(0,9.08,4.07),.29,'shade')
clock(0,10.34,3.73,.48)
for x in (-2.1,0,2.1):statue(x,10.7,2.75,.95,True)
# Open steel communications mast with visible cross braces and armillary sphere.
for h in (10.6,12.3,14.0,15.7,17.4):
 w=1.0-(h-10.6)*.035
 for a,b in [((-w,h,-w),(w,h,-w)),((w,h,-w),(w,h,w)),((w,h,w),(-w,h,w)),((-w,h,w),(-w,h,-w))]:beam('Mast ring girder',a,b,.068,'iron')
 if h<17:
  ww=w-.06
  for s in (-1,1):
   beam('Mast vertical',(s*w,h,-w),(s*ww,h+1.7,-ww),.082,'iron');beam('Mast vertical',(s*w,h,w),(s*ww,h+1.7,ww),.082,'iron')
   beam('Mast crossed brace',(-w,h,s*w),(ww,h+1.7,s*ww),.045,'iron');beam('Mast crossed brace',(w,h,s*w),(-ww,h+1.7,s*ww),.045,'iron')
   beam('Mast side cross brace',(s*w,h,-w),(s*ww,h+1.7,ww),.045,'iron')
box('Mast viewing platform',(0,17.5,0),(2.25,.16,2.25),'iron')
for s in (-1,1):
 for j in range(9):beam('Open viewing baluster',(-1+j*.25,17.57,s*1),(-1+j*.25,18.28,s*1),.024,'iron',6)
 beam('Viewing rail',(-1,18.3,s*1),(1,18.3,s*1),.053,'iron')
for x in (-.8,.8):beam('Mast crown support',(x,17.5,0),(x*.7,19.1,0),.062,'iron')
ball('Armillary globe',(0,19.72,0),(.46,.46,.46),'gold')
for rot in (0,math.pi/2):tube('Armillary sphere ring',[(math.cos(i*math.tau/40)*.73*math.cos(rot),19.72+math.sin(i*math.tau/40)*.73,math.cos(i*math.tau/40)*.73*math.sin(rot)) for i in range(41)],.045,'iron')
beam('Communications finial',(0,20.4,0),(0,21.0,0),.06,'gold',8,0)
for x in range(-10,11,2):
 if abs(x)>4:balustrade(x,8.7,2.85,1.8)
for x in range(-10,11,3):
 for y in (2,5.6):box('Postal rear window',(x,y,-3.07),(1.1,2,.12),'glass')

root('Falla')
# Original animal-festival sculpture inspired by the real Fauna Fallera monument.
beam('Low festival plinth',(0,.04,0),(0,.35,0),3.72,'shade',64)
beam('Sculpture garden',(0,.35,0),(0,.48,0),3.55,'leaf',48)
# Curving tree trunk ties the large and small sculpted figures together.
tube('Sculpted curling tree',[(.1,.4,0),(-.7,1.5,-.1),(.45,3,-.25),(-.15,4.9,-.6),(.7,6.6,-.5),(.35,8.5,-.4)],.63,'wood',14)
for i in range(7):
 a=i*math.tau/7;tube('Curling tree root',[(0,.58,0),(math.cos(a)*1.4,.5,math.sin(a)*1.4),(math.cos(a+.3)*2.6,.55,math.sin(a+.3)*2.6)],.2,'wood')
for i in range(12):
 a=i*2.4;r=2.35;ball('Leaf mound',(math.cos(a)*r,.68+(i%3)*.55,math.sin(a)*r),(.88,.39,.68),'leaflight' if i%2 else 'leaf')
 for j in range(5):
  q=j*math.tau/5;ball('Flower petal',(math.cos(a)*r+math.cos(q)*.17,.98+(i%3)*.55+math.sin(q)*.17,math.sin(a)*r+.34),(.13,.15,.09),'pink')
# Tall fallera tiger with an actual skirt, shawl, hair buns, cheeks and expressive eyes.
def animal_head(x,y,z,s,m='orange',cat=True):
 ball('Ninot head',(x,y,z),(.63*s,.65*s,.55*s),m)
 for side in (-1,1):
  ball('Animal round ear',(x+side*.48*s,y+.54*s,z-.04*s),(.23*s,.25*s,.15*s),m)
  ball('Ear pink inset',(x+side*.48*s,y+.54*s,z+.10*s),(.12*s,.14*s,.05*s),'pink')
  ball('Ivory muzzle',(x+side*.2*s,y-.22*s,z+.46*s),(.29*s,.21*s,.2*s),'white')
  ball('Large expressive eye',(x+side*.25*s,y+.15*s,z+.49*s),(.21*s,.27*s,.095*s),'white')
  ball('Eye pupil',(x+side*.24*s,y+.15*s,z+.575*s),(.095*s,.16*s,.052*s),'black')
  ball('Eye catchlight',(x+side*.24*s-.03*s,y+.21*s,z+.625*s),(.027*s,.045*s,.019*s),'white')
  tube('Raised brow',[(x+side*.1*s,y+.47*s,z+.49*s),(x+side*.27*s,y+.51*s,z+.48*s),(x+side*.43*s,y+.40*s,z+.42*s)],.047*s,'black')
  if cat:
   for i in range(3):tube('Tiger face stripe',[(x+side*.57*s,y+(.3-i*.19)*s,z+.2*s),(x+side*.44*s,y+(.23-i*.19)*s,z+.43*s)],.07*s,'wood')
 ball('Ninot nose',(x,y-.15*s,z+.65*s),(.14*s,.1*s,.09*s),'red');arc('Ninot smile',x,y-.24*s,z+.635*s,.22*s,'wood',.028*s,math.pi,2*math.pi)
# Skirt profile uses ripples instead of a plain cone.
vs=[];fs=[];N=48
for k,(y,r) in enumerate([(1,2),(1.35,2.1),(2.4,1.7),(3.5,1.22),(4.55,.57)]):
 for i in range(N):a=i*math.tau/N;rr=r*(1+.055*math.cos(a*12));vs.append(pos((-.55+rr*math.cos(a),y,.3+rr*.82*math.sin(a))))
for k in range(4):
 for i in range(N):a=k*N+i;b=k*N+(i+1)%N;fs.append((a,b,b+N,a+N))
data=bpy.data.meshes.new('Flowing festival skirt');data.from_pydata(vs,[],fs);data.update();o=bpy.data.objects.new('Turquoise fallera skirt',data);bpy.context.collection.objects.link(o);reg(o,o.name,'teal')
for i in range(12):
 a=i*math.tau/12;tube('Skirt gold embroidery',[(-.55+r*math.cos(a),y,.3+r*.82*math.sin(a)) for y,r in [(1.09,2.035),(1.45,2.04),(2.5,1.64),(3.5,1.24),(4.5,.6)]],.031,'gold')
 for yy,rr in [(1.75,1.95),(2.9,1.5)]:ball('Embroidered skirt flower',(-.55+rr*math.cos(a),yy,.3+rr*.84*math.sin(a)),(.13,.13,.095),'pink')
ball('Fallera fitted bodice',(-.55,4.74,.3),(.62,.89,.44),'pink')
for side in (-1,1):
 tube('Fallera gesturing arm',[(-.55+side*.45,5.04,.3),(-.55+side*.97,4.63,.55),(-.55+side*1.32,5.08,.78)],.19,'orange')
 ball('Fallera sculpted hand',(-.55+side*1.32,5.1,.78),(.23,.25,.19),'orange')
 tube('Lace shawl',[(-.55+side*.59,5.32,.33),(-.55+side*.41,4.91,.73),(-.55,4.55,.8)],.12,'white')
animal_head(-.55,6.05,.35,1.22)
for side in (-1,1):
 ball('Traditional fallera hair bun',(-.55+side*.78,6.12,.25),(.27,.31,.2),'gold')
arc('Golden fallera comb',-.55,6.62,.12,.64,'gold',.08)
for i in range(6):ball('Floral crown',(-1.03+i*.19,6.77+.18*math.sin(i*.6),.36),(.15,.14,.11),'pink' if i%2 else 'white')
# Musician hippo on the right, with a drum and sticks.
ball('Hippo musician body',(2.1,2.37,-.75),(.78,1.3,.66),'violet');animal_head(2.1,3.72,-.64,1.0,'violet',False)
ball('Hippo broad muzzle',(2.1,3.47,-.05),(.67,.37,.33),'violet')
for s in (-1,1):ball('Hippo nostril',(2.1+s*.3,3.63,.23),(.10,.09,.07),'pink')
beam('Festival drum',(2.15,1.5,.12),(2.15,2.38,.12),.61,'wood',24)
for yy in (1.5,2.35):beam('Drum ivory skin',(2.15,yy,.12),(2.15,yy+.07,.12),.64,'white',24)
for s in (-1,1):
 tube('Hippo arm',[(2.1+s*.55,2.7,-.75),(2.1+s*.9,2.25,-.05),(2.1+s*.45,2.6,.3)],.15,'violet');beam('Drumstick',(2.1+s*.45,2.6,.3),(2.1+s*.19,2.82,.03),.036,'gold')
# Curled branches and small birds fill the middle tier with a wide festival silhouette.
for side in (-1,1):
 tube('High curling branch',[(.1,6.8,-.6),(side*1.35,7.5,-.55),(side*2.4,7.15,-.3),(side*2.65,7.75,-.2)],.22,'wood')
 for j in range(3):ball('High tree foliage',(side*(1.1+j*.58),7.35+(j%2)*.18,-.35),(.72,.24,.57),'leaflight' if j%2 else 'leaf')
 ball('Little festival bird body',(side*2.18,7.85,-.24),(.32,.43,.28),'pink' if side<0 else 'teal')
 ball('Little festival bird head',(side*2.18,8.35,-.20),(.32,.32,.29),'orange' if side<0 else 'blue')
 beam('Little bird beak',(side*2.18,8.31,.01),(side*2.18,8.2,.62),.18,'gold',10,.025)
 for eye in (-1,1):
  ball('Little bird eye',(side*2.18+eye*.13,8.43,.035),(.09,.12,.055),'white')
  ball('Little bird pupil',(side*2.18+eye*.13,8.43,.09),(.045,.07,.03),'black')
 for j in range(3):beam('Festival bird crest',(side*2.18+(j-1)*.12,8.6,-.23),(side*2.18+(j-1)*.19,8.95-abs(j-1)*.13,-.23),.047,'red')
# A large bird painter sits high on the tree, with hat, palette and pennant.
ball('Bird painter coat',(.55,8.63,-.55),(.68,1.32,.56),'blue')
ball('Bird painter head',(.55,10.05,-.43),(.69,.74,.59),'white')
for s in (-1,1):
 ball('Bird eye',(.55+s*.22,10.18,.09),(.17,.23,.08),'white');ball('Bird pupil',(.55+s*.22,10.18,.164),(.075,.13,.045),'black')
beam('Long orange bird beak',(.55,9.94,.04),(.55,9.70,1.0),.26,'orange',12,.07)
ball('Painter beret',(.55,10.65,-.43),(.8,.19,.65),'red');beam('Beret tip',(.55,10.7,-.43),(.63,10.99,-.43),.07,'gold')
for s in (-1,1):tube('Painter wing',[(.55+s*.53,9.3,-.55),(.55+s*1.15,9.0,-.3),(.55+s*1.5,9.73,0)],.16,'white')
ball('Oval painters palette',(-1.1,9.56,.13),(.52,.33,.1),'wood')
for i,m in enumerate(['red','blue','gold','teal']):ball('Palette paint',(-1.39+i*.2,9.63,.23),(.08,.08,.03),m)
beam('Paintbrush',(-1.12,9.58,.24),(-1.62,10.6,.18),.039,'gold');beam('Paintbrush bristles',(-1.62,10.6,.18),(-1.73,10.84,.17),.065,'red',8,.02)
beam('Prize banner pole',(2,8.9,-.13),(2,12.63,-.13),.055,'gold')
box('Red first-prize pennant',(1.1,11.67,-.11),(1.75,1.64,.075),'red')
for xx in (.22,1.98):box('Banner golden edge',(xx,11.67,-.06),(.055,1.69,.035),'gold')
text('Falla first prize','1r',(1.1,11.91,-.055),.76,'gold');text('Falla prize word','PREMI',(1.1,11.26,-.055),.22,'white')
# Smaller festival animals keep the composition detailed near the player's eye.
for x,z,s,m in [(-2.4,-.5,.60,'orange'),(.7,1.9,.5,'white'),(-1.65,2.05,.45,'orange')]:
 ball('Small ninot costume',(x,1.15,z),(.4*s,.8*s,.36*s),'red' if x<0 else 'blue');animal_head(x,1.9,z,s,m)
# Low open fence: thin rails with generous visibility, no wall panels.
for i in range(28):
 a=i*math.tau/28;x=4.12*math.cos(a);z=4.12*math.sin(a)
 beam('Open monument fence post',(x,.02,z),(x,.77,z),.043,'iron',8);ball('Fence brass finial',(x,.8,z),(.067,.067,.067),'gold',8)
for y in (.3,.64):tube('Thin open fence ring',[(4.12*math.cos(i*math.tau/84),y,4.12*math.sin(i*math.tau/84)) for i in range(85)],.027,'iron',6)

# Keep the .blend parts editable. Merge only the export copy by root/material.
scene=bpy.context.scene;scene.world.color=(.7,.75,.8)
bpy.ops.object.light_add(type='AREA',location=(6,-10,25));key=bpy.context.object;key.name='Studio softbox';key.data.energy=2400;key.data.shape='DISK';key.data.size=15;key.rotation_euler=(Vector((0,0,6))-key.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='SUN',location=(0,0,20));sun=bpy.context.object;sun.data.energy=2;sun.rotation_euler=(math.radians(28),math.radians(-22),math.radians(-30))
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1280;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
# The native source opens as an arranged plaza, with individually editable roots.
for r,east,south,yaw in [(roots[0],0,4,math.pi),(roots[1],0,-23,0),(roots[2],0,-9,math.pi)]:
 r.location=pos((east,0,south));r.rotation_euler.z=yaw
bpy.ops.mesh.primitive_cube_add(size=1,location=pos((0,-.08,-9.5)));source_floor=bpy.context.object;source_floor.name='Source plaza floor';source_floor.scale=(39,37,.15);source_floor.data.materials.append(M['stone'])
camera.location=Vector((35,42,30));camera.rotation_euler=(Vector((0,9,6))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=54
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/civic-plaza.blend'))
bpy.data.objects.remove(source_floor,do_unlink=True)
for r in roots:r.location=(0,0,0);r.rotation_euler=(0,0,0)
bpy.context.view_layer.update()
# The saved file keeps all parts editable; the shipped copy uses material batches.
for r in roots:
 batches={}
 for o in list(r.children_recursive):
  if o.type=='MESH':batches.setdefault(o.data.materials[0].name,[]).append(o)
 for material_name,objects in batches.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=r.name+' / '+material_name
# Export each root with its local origin so the game can seat it on the sphere.
bpy.ops.object.select_all(action='DESELECT')
for r in roots:
 r.select_set(True)
 for o in r.children_recursive:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/civic-plaza.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
if '--skip-renders' not in sys.argv:
 for r in roots:
  for rr in roots:
   for o in rr.children_recursive:o.hide_render=(rr!=r)
  target=Vector((0,0,9 if r.name!='Falla' else 6.1));camera.location=Vector((18,-45,23)) if r.name!='Falla' else Vector((12,-22,13));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=35 if r.name!='Falla' else 18
  scene.render.filepath=str(OUT/(r.name.lower()+'-preview.png'));bpy.ops.render.render(write_still=True)
print('CIVIC_PLAZA_COMPLETE',len([o for o in bpy.data.objects if o.type=='MESH']))
