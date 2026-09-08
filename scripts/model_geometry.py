"""Shared original Blender mesh and facade helpers."""
import bpy, math, random
from mathutils import Vector

def material(name,hex,rough=.8,metal=0):
    color=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in color]
    m=bpy.data.materials.new(name);m.diffuse_color=(*linear,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=m.diffuse_color;bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    return m
M=[material(*v) for v in [
 ('ochre plaster','e6b97d'),('rose plaster','cb8e79'),('ivory plaster','ede1be'),('pale sage plaster','acb7a2'),('limestone trim','edd7ad'),('sandstone base','b89d76'),('shadow stone','9b8063'),('clay tile','b95736'),('sun tile','d8774b'),('dark tile','96432c'),('ceramic blue','297b8d',.35),('shutter green','4b7462'),('shutter light','719879'),('walnut','634532'),('end grain','9d744d'),('ironwork','2e4946',.55,.55),('window glass','3d7881',.25),('window light','8abdbd',.25),('curtain','e9d5a9'),('brass','c5973d',.28,.7),('awning red','c6644d'),('awning cream','f3ddb0'),('leaf deep','285c37'),('leaf mid','4c8042'),('leaf sun','82a448'),('leaf bright','a3b956'),('flower pink','c35291'),('flower magenta','9e417e'),('flower light','e296b5'),('orange','e8982e'),('lemon','ecc557'),('thatch','b4a274'),('thatch light','d0bb84')]]
class Builder:
 def __init__(self,name):self.name=name;self.v=[];self.f=[];self.mi=[]
 def poly(self,verts,faces,mat=0):
  n=len(self.v);self.v.extend(verts);self.f.extend([tuple(n+i for i in f) for f in faces]);self.mi.extend([mat]*len(faces))
 def box(self,x,y,z,w,d,h,mat=0,rz=0):
  vs=[(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)]
  c,s=math.cos(rz),math.sin(rz)
  self.poly([(x+a*w*c-b*d*s,y+a*w*s+b*d*c,z+q*h) for a,b,q in vs],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
 def beam(self,a,b,r,mat=13,n=7,r2=None):
  a,b=Vector(a),Vector(b);axis=(b-a).normalized();side=axis.cross(Vector((0,0,1)))
  if side.length<.01:side=axis.cross(Vector((0,1,0)))
  side.normalize();up=axis.cross(side);r2=r if r2 is None else r2
  vs=[]
  for p,rr in [(a,r),(b,r2)]:
   for j in range(n):vs.append(tuple(p+side*(rr*math.cos(j*math.tau/n))+up*(rr*math.sin(j*math.tau/n))))
  self.poly(vs,[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)],mat)
 def sphere(self,x,y,z,r,mat=24,sx=1,sy=1,sz=1,n=8,rings=4):
  vs=[]
  for k in range(rings+1):
   p=math.pi*k/rings
   for j in range(n):a=j*math.tau/n;vs.append((x+r*sx*math.sin(p)*math.cos(a),y+r*sy*math.sin(p)*math.sin(a),z+r*sz*math.cos(p)))
  self.poly(vs,[(k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j)for k in range(rings)for j in range(n)],mat)
 def leaf(self,p,size,mat=24,angle=0,tilt=0):
  c,s=math.cos(angle),math.sin(angle);vs=[(-size,0,0),(0,size*.35,.055),(size,0,0),(0,-size*.35,.055),(0,0,.10)]
  self.poly([(p[0]+x*c-y*s,p[1]+x*s+y*c,p[2]+z+x*tilt)for x,y,z in vs],[(0,4,1),(1,4,2),(2,4,3),(3,4,0)],mat)
 def finish(self,bevel=False):
  me=bpy.data.meshes.new(self.name);me.from_pydata(self.v,[],self.f);me.update();o=bpy.data.objects.new(self.name,me);bpy.context.collection.objects.link(o)
  for m in M:me.materials.append(m)
  for p,i in zip(me.polygons,self.mi):p.material_index=i
  if bevel:
   mod=o.modifiers.new('Small edges catch sunlight','BEVEL');mod.width=.025;mod.segments=2;mod.limit_method='ANGLE'
   bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
  return o

def window(b,x,y,z,wall_angle=0,w=1.12,h=1.7,balcony=False):
 # Window is authored on the -Y facade, then transformed as a complete group.
 start=len(b.v)
 b.box(0,0,0,w+.32,.18,h+.35,4);b.box(0,-.12,0,w,.07,h,16);b.box(-w*.21,-.17,.03,w*.34,.02,h*.93,18)
 b.box(0,-.19,0,.055,.08,h,4);b.box(0,-.19,.12,w,.08,.055,4)
 b.box(0,-.26,-h/2-.08,w+.5,.5,.12,4)
 for side in [-1,1]:
  b.box(side*(w/2+.26),-.15,0,.43,.1,h,11)
  for j in range(9):b.box(side*(w/2+.26),-.22,-h*.43+j*h*.105,.38,.065,.065,12)
 if balcony:
  b.box(0,-.48,-h/2-.22,w+.65,1,.16,4)
  b.beam((-w*.7,-.95,-h/2+.48),(w*.7,-.95,-h/2+.48),.025,15)
  for j in range(8):
   xx=-w*.7+j*w*1.4/7;b.beam((xx,-.95,-h/2-.1),(xx,-.95,-h/2+.48),.019,15)
  for side in [-1,1]:b.beam((side*w*.7,-.95,-h/2+.48),(side*w*.7,-.1,-h/2+.48),.025,15)
  b.box(.2,-.65,-h/2+.02,.75,.35,.24,7)
  for j in range(18):b.leaf((random.uniform(-.15,.55),random.uniform(-.87,-.46),-h/2+.22+random.random()*.20),.20,22+j%4,random.random()*6.28,.1)
  for j in range(9):b.sphere(random.uniform(-.10,.5),random.uniform(-.8,-.5),-h/2+.32,.055,26+j%3,n=5,rings=2)
 c,s=math.cos(wall_angle),math.sin(wall_angle)
 for k in range(start,len(b.v)):
  xx,yy,zz=b.v[k];b.v[k]=(x+xx*c-yy*s,y+xx*s+yy*c,z+zz)

def roof(b,w,d,h,chimney=True):
 ridge=h+2.05
 b.poly([(-w/2,-d/2,h),(w/2,-d/2,h),(w/2,d/2,h),(-w/2,d/2,h),(-w/2,0,ridge),(w/2,0,ridge)],[(0,1,5,4),(4,5,2,3),(0,4,3),(1,2,5)],7)
 for side in [-1,1]:
  b.box(0,side*d/2,h-.08,w+.12,.15,.28,14)
  for row in range(10):
   y=side*d*.5*(1-row/10);z=h+2.05*row/10
   for col in range(int(w/.38)):
    x=-w/2+.2+col*.38
    b.beam((x,y,z+.055),(x,y-side*d/20,z+.26),.105,[7,8,9][(row+col)%3],6)
 for i in range(int(w/.45)):
  xx=-w/2+i*.45;b.beam((xx,0,ridge+.09),(xx+.42,0,ridge+.09),.17,8,8)
 if chimney:
  b.box(w*.27,d*.18,h+2,.6,.7,2.2,5);b.box(w*.27,d*.18,h+3.16,.82,.90,.20,4);b.box(w*.27,d*.18,h+3.275,.48,.56,.025,15)

def building(name,variant):
 b=Builder(name);w=8.8;d=7.2;h=[8.5,10.9,13.2][variant%3];plaster=variant%4
 b.box(0,0,h/2,w,d,h,plaster)
 for z in [.18,.55]:b.box(0,0,z,w+.14,d+.14,.28,5)
 for level in [3.2,6.1,9.0,h-.20]:
  if level>h:continue
  b.box(0,0,level,w+.30,d+.30,.16,4)
 for side in [-1,1]:
  for xx in [-w/2+.13,w/2-.13]:
   for z in [1.1+j for j in range(int(h)-1)]:
    if z<h:b.box(xx,side*d/2,z,.33,.24,.48,4)
 for z in [4.6,7.5,10.4]:
  if z+1>h:continue
  for xx in [-2.8,0,2.8]:
   window(b,xx,-d/2-.02,z,0,balcony=True);window(b,-xx,d/2+.02,z,math.pi,balcony=(z<8))
  for yy in [-2.15,1.65]:
   window(b,w/2+.02,yy,z,math.pi/2,w=.95,balcony=z<8);window(b,-w/2-.02,-yy,z,-math.pi/2,w=.95)
 # Visible side/rear service entrances and lamps.
 for side in [-1,1]:
  b.box(0,side*(d/2+.04),1.4,1.6,.12,2.8,13)
  for x in [-.53,0,.53]:b.box(x,side*(d/2+.12),1.5,.045,.05,2.45,14)
  b.sphere(.48,side*(d/2+.20),1.32,.065,19,n=8,rings=3)
 for xx in [-2.75,2.75]:
  b.box(xx,-d/2-.12,1.45,2.35,.2,2.8,15);b.box(xx,-d/2-.24,1.45,2.1,.06,2.45,16)
  b.box(xx,-d/2-.28,1.15,2.1,.035,.045,4)
  b.box(xx,-d/2-.32,.5,1.9,.18,.6,14)
 # Striped canvas canopy, visible scalloped edge.
 for j in range(20):
  xx=-4.35+j*.435;b.box(xx,-d/2-.85,3.0,.44,1.9,.18,20 if j%2 else 21)
  b.box(xx,-d/2-1.78,2.83,.44,.08,.32,20 if j%2 else 21)
 for xx in [-4.1,4.1]:b.beam((xx,-d/2,2.5),(xx,-d/2-1.7,2.93),.075,15)
 # Ceramic sign with border and separate letters.
 b.box(0,-d/2-.13,3.55,4.6,.13,.59,10);b.box(0,-d/2-.22,3.84,4.7,.08,.045,4);b.box(0,-d/2-.22,3.26,4.7,.08,.045,4)
 # Green vines and bougainvillea climb one edge and wrap the side.
 for j in range(95):
  z=1.3+(j/95)*(h-1.8);x=-4.3+math.sin(j*.45)*.4;y=-d/2-.36
  b.leaf((x,y,z),.25,22+j%4,random.random()*6.28,random.uniform(-1,1))
  if j%3==0:b.sphere(x+.12,y-.1,z,.13,26+j%3,n=5,rings=3)
 roof(b,w+1,d+1,h)
 # Finished rear and side elevations, vents, rain pipes and ceramic number tiles.
 local_rng=random.Random(980+variant)
 for side in [-1,1]:
  for xx in [-2.8,2.8]:window(b,xx,side*d/2+.025*side,1.8,math.pi if side>0 else 0,w=.85,h=1.35)
  b.beam((side*(w/2+.12),d/2+.1,.3),(side*(w/2+.12),d/2+.1,h-.3),.055,15)
  b.box(side*(w/2+.16),d*.25,1.1,.08,.7,.8,10)
  for q in [-1,1]:b.beam((side*(w/2+.22),d*.25-.2,1.1-q*.2),(side*(w/2+.22),d*.25+.2,1.1+q*.2),.025,4,6)
  b.beam((side*(w/2+.50),0,h+.90),(side*(w/2+.60),0,h+.90),.40,4,24)
  b.beam((side*(w/2+.61),0,h+.90),(side*(w/2+.64),0,h+.90),.29,16,24)
  for z in [h+.76,h+.90,h+1.04]:b.box(side*(w/2+.66),0,z,.04,.5,.045,4)
 for row in range(3):
  for col in range(12):b.box(-w/2+.38+col*.73,d/2+.055,.25+row*.31,.70,.06,.285,5+(row+col)%2)
 for j in range(70):
  z=1.2+j/70*(h-1.7);xx=w/2-.08+math.sin(j*.4)*.35;yy=d/2+.20
  b.leaf((xx,yy,z),.22,22+j%4,local_rng.random()*6.28,.2)
  if j%4==0:b.sphere(xx-.10,yy+.08,z,.10,26+j%3,n=5,rings=3)
 b.box(0,-d/2-1.865,2.81,4.8,.05,.38,10)
 o=b.finish(False)
 # Text is real Blender geometry and survives GLB export.
 bpy.ops.object.text_add(location=(0,-d/2-1.905,2.81),rotation=(math.pi/2,0,0));text=bpy.context.object;text.data.body=['CAFÈ DE LA LLUM','CASA VALÈNCIA','MERCAT DE FLORS'][variant%3];text.data.align_x='CENTER';text.data.align_y='CENTER';text.data.size=.32;text.data.extrude=.014;text.data.materials.append(M[4]);bpy.ops.object.convert(target='MESH');text.select_set(True);o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.join();o.select_set(False)
 return o


def cottage_builder(name='cottage',w=5.5,d=7):
 b=Builder(name);h=3.4;peak=7.4;local_rng=random.Random(324)
 b.box(0,0,h/2,w,d,h,2)
 # White gables sit inside a thick, layered reed roof.
 b.poly([(-w/2,-d/2,h),(w/2,-d/2,h),(w/2,d/2,h),(-w/2,d/2,h),(0,-d/2,peak-.15),(0,d/2,peak-.15)],[(0,1,4),(3,5,2)],2)
 for side in [-1,1]:
  x=side*(w/2+.45);yy=d/2+.50
  b.poly([(x,-yy,h-.15),(x,yy,h-.15),(0,yy,peak),(0,-yy,peak),(x,-yy,h-.52),(x,yy,h-.52),(0,yy,peak-.25),(0,-yy,peak-.25)],[(0,1,2,3),(4,7,6,5),(0,4,5,1),(0,3,7,4),(1,5,6,2)],31)
  # Bundles overlap in three courses and end at slightly different lengths.
  for col in range(65):
   y=-yy+.10+col*(2*yy-.2)/64
   for course in range(3):
    t0=course/3;t1=min(1,(course+1)/3+.10);jitter=local_rng.uniform(-.06,.06)
    a=(x*(1-t0),y,h-.12+(peak-h+.12)*t0+jitter);end=(x*(1-t1),y, h-.12+(peak-h+.12)*t1+.05)
    b.beam(a,end,.055,31+(col+course)%2,5,.045)
  for t in [.24,.57,.86]:
   xx=x*(1-t);zz=h+(peak-h)*t+.1;b.beam((xx,-yy-.02,zz),(xx,yy+.02,zz),.065,14,7)
  b.box(0,side*(d/2+.03),.28,w+.10,.14,.5,10)
  b.box(0,side*(d/2+.08),1.32,1.25,.15,2.64,13)
  for xx in [-.42,-.14,.14,.42]:b.box(xx,side*(d/2+.18),1.32,.055,.045,2.45,14)
  b.sphere(.4,side*(d/2+.22),1.24,.06,19,n=8,rings=4)
  for xx in [-w*.32,w*.32]:window(b,xx,side*(d/2+.02),1.92,math.pi if side>0 else 0,w=.65,h=1.05)
  for y in [-d*.24,d*.24]:window(b,side*(w/2+.02),y,1.92,side*math.pi/2,w=.70,h=1.1)
 for j in range(30):
  y=-d/2-.5+j*(d+1)/29;b.beam((0,y,peak+.08),(0,y+.21,peak+.08),.16,14,8)
 # A seated chimney and small cross give the roof a finished silhouette.
 b.box(w*.20,d*.27,6.55,.64,.64,1.8,2);b.box(w*.20,d*.27,7.5,.85,.85,.18,4);b.box(w*.20,d*.27,7.603,.43,.43,.025,15)
 b.beam((0,-d/2-.60,peak-.1),(0,-d/2-.60,peak+.72),.047,13);b.beam((-.25,-d/2-.60,peak+.48),(.25,-d/2-.60,peak+.48),.047,13)
 return b
