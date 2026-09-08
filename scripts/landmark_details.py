# Additional all-around architectural detail. Executed inside build_models.py.
import random
random.seed(8026)
base_roots=roots[:]

def around_window(cx,cy,z,r,angle,w=1,h=1.7):
 start=len(parts);window(0,-r,z,w,h)
 c,s=math.cos(angle),math.sin(angle)
 for o in parts[start:]:
  x,y=o.location.x,o.location.y;o.location.x=cx+x*c-y*s;o.location.y=cy+x*s+y*c;o.rotation_euler.z+=angle

def attach(root):
 parts.append(root);bpy.ops.object.select_all(action='DESELECT')
 for p in parts:p.select_set(True)
 bpy.context.view_layer.objects.active=root;bpy.ops.object.join();parts.clear()

for root in base_roots:
 name=root.name
 if name=='serranos':
  # Deep Gothic rear galleries, narrow embrasures, raised terraces and stone steps.
  shades=[mat('limestone block '+str(i),c)for i,c in enumerate(['c9aa7b','cdb080','d6b886','c5a678'])]
  for cx in [-5,5]:
   for face in range(6):
    a=math.pi/2+(face+.5)*math.tau/6
    for row in range(21):
     for col in range(4):
      tangent=(col-1.5)*.76
      xx=cx+math.cos(a)*2.694-math.sin(a)*tangent;yy=math.sin(a)*2.694+math.cos(a)*tangent
      ob=box(xx,yy,.42+row*.445,.74,.035,.425,shades[(row+col+face)%4]);ob.rotation_euler.z=a+math.pi/2
  for x in [-5,5]:
   for angle in [0,math.pi/3,-math.pi/3,math.pi,math.pi*2/3,-math.pi*2/3]:
    for z in [3.3,6.6]:around_window(x,0,z,3.12,angle,.48,1.2)
   for z in [2.4,5.5,8.5]:
    box(x,2.70,z,3.3,.10,2.25,dark)
    for xx in [-1.4,0,1.4]:box(x+xx,2.79,z,.15,.21,2.3,cream)
    box(x,2.84,z-1.05,3.6,.45,.22,cream)
   cyl(x,0,10.37,2.65,.15,stone,6)
   for j in range(6):
    a=j*math.tau/6;box(x+2.8*math.cos(a),2.8*math.sin(a),10.55,.4,.4,.45,cream)
  # A filled spandrel above the arch leaves only the actual gateway open.
  for side in [-1,1]:box(side*2.08,0,3.1,.75,3.0,6.2,stone)
  verts=[];faces=[]
  for y in [-1.48,1.48]:
   for i in range(21):
    x=-1.7+i*3.4/20;z=3.25+math.sqrt(max(0,1.7**2-x*x));verts.extend([(x,y,z),(x,y,6.08)])
  for layer in [0,42]:
   for i in range(20):a=layer+i*2;faces.append((a,a+1,a+3,a+2))
  me=bpy.data.meshes.new('vault masonry');me.from_pydata(verts,[],faces);me.materials.append(stone);o=bpy.data.objects.new('vault masonry',me);bpy.context.collection.objects.link(o);parts.append(o)
  arch(0,1.58,0,3.35,3.25,cream,.17)
 elif name=='townhall':
  for xx in range(-9,10,2):
   for z in [2,4.9,7]:around_window(xx,0,z,3.1,math.pi,.9,1.45)
  for side in [-1,1]:
   for y in [-1.8,0,1.8]:
    for z in [2,4.9,7]:around_window(0,y,z,10.55,side*math.pi/2,.8,1.5)
  for xx in [-8,8]:
   for a in range(12):
    t=a*math.tau/12;beam((xx+1.85*math.cos(t),1.85*math.sin(t),11),(xx+.16*math.cos(t),.16*math.sin(t),13),.04,gold)
  for x in range(-10,11):box(x,-3.58,3.0,.08,.28,.78,cream)
  for x in [-10,-6,-3,3,6,10]:box(x,-3.25,4.9,.28,.35,3.5,cream)
 elif name=='station':
  for xx in range(-8,9,2):
   for z in [1.6,4.4]:around_window(xx,6,z,4.55,math.pi,1.2,2)
  for side in [-1,1]:
   for y in [0,3,6,9]:
    for z in [1.6,4.4]:around_window(0,y,z,9.55,side*math.pi/2,1.3,2)
  for x in range(-10,11):
   for y in [-2.83,-2.88]:
    o=cyl(x,y,5.6,.12,.06,gold,12);o.rotation_euler.x=math.pi/2
  for x in [-8,-4,4,8]:
   box(x,-2.88,6.05,1.5,.12,.35,blue)
 elif name=='bullring':
  # Repeated round arch heads between the structural piers; open central arena.
  for j in range(48):
   angle=j*math.tau/48+math.tau/96
   start=len(parts)
   for z in [.25,1.85,3.45,5.05]:
    for k in range(8):
     a=k*math.pi/8;aa=(k+1)*math.pi/8
     beam((math.cos(a)*.45,8.54,z+.86+math.sin(a)*.45),(math.cos(aa)*.45,8.54,z+.86+math.sin(aa)*.45),.075,cream)
   for o in parts[start:]:
    x,y=o.location.x,o.location.y;o.location.x=x*math.cos(angle)-y*math.sin(angle);o.location.y=x*math.sin(angle)+y*math.cos(angle);o.rotation_euler.z+=angle
  cyl(0,0,.23,6.25,.12,gold,96)
  for j in range(64):
   a=j*math.tau/64;aa=(j+1)*math.tau/64;beam((8.7*math.cos(a),8.7*math.sin(a),6.55),(8.7*math.cos(aa),8.7*math.sin(aa),6.55),.16,cream)
 elif name=='hemisferic':
  for side in [-1,1]:
   for j in range(40):
    a=j*math.pi/40;aa=(j+1)*math.pi/40
    beam((12.3*math.cos(a),side*5.2*math.sin(a),.3),(12.3*math.cos(aa),side*5.2*math.sin(aa),.3),.13,cream)
  for x in range(-10,11):
   v=max(0,1-(x/12)**2)**.5
   for y in [-1,1]:box(x,y*4.8*v,.38,.1,.15,.6,white)
 elif name=='museum':
  for x in [-11.55,11.55]:
   for yy in [-2.5,0,2.5]:
    around_window(0,yy,3.2,abs(x),math.pi/2 if x>0 else -math.pi/2,2,5)
  for xx in range(-10,11,2):
   for side in [-1,1]:box(xx,side*3.6,3.4,1.6,.09,5.7,blue)
  for xx in range(-12,13,2):
   beam((xx,-2,8),(xx,1,9.4),.12,white);beam((xx,1,9.4),(xx,4,6),.12,white)
 elif name=='aqua':
  for side in [-1,1]:
   for z in range(4,21):
    box(3,1+side*3.57,z,7.2,.12,.10,white);box(3+side*3.57,1,z,.12,7.2,.10,white)
   for q in [-2,-.5,1,2.5]:
    box(3+q,4.58,12,.075,.1,16,white);box(6.58,1+q,12,.1,.075,16,white);box(-.58,1+q,12,.1,.075,16,white)
  box(3,1,20.35,7.3,7.3,.25,white);box(3,1,20.6,4.5,4.5,.45,dark)
  for x in [-7,-4,-1,2,5,8]:around_window(x,0,2.3,5.15,math.pi,1.7,3)
 elif name=='university':
  for side in [-1,1]:
   for y in [-5,-2,1,4]:
    around_window(0,y,3.8,10.1,side*math.pi/2,1.0,2)
    around_window(0,y,3.8,5.9,-side*math.pi/2,1.0,2)
  for x in range(-8,9,2):around_window(x,0,3.8,7.75,math.pi,1,2)
  for x in [-6,-4,-2,0,2,4,6]:arch(x,2.72,.1,1.5,3.8,cream,.08)
 elif name=='cathedral':
  for x in [4,7,10]:
   for side in [-1,1]:around_window(x,2,3.8,5.6,0 if side<0 else math.pi,1,3)
  for yy in [-2,2,6]:around_window(0,yy,3.8,12.05,math.pi/2,.9,3)
  for x in [2,5,9,12]:
   for y in [-3.7,7.7]:box(x,y,2.9,.45,.75,5.8,stone)
  for a in range(8):
   t=a*math.tau/8;around_window(0,0,10,3.03,t,.65,1.8)
  for a in range(12):
   t=a*math.tau/12
   for k in range(8):
    f=k*math.pi/16;ff=(k+1)*math.pi/16
    beam((7+3.04*math.cos(t)*math.cos(f),2+3.04*math.sin(t)*math.cos(f),10+3.04*math.sin(f)),(7+3.04*math.cos(t)*math.cos(ff),2+3.04*math.sin(t)*math.cos(ff),10+3.04*math.sin(ff)),.035,cream)
 elif name=='barraca':
  for side in [-1,1]:
   for yy in [-2,1.5]:around_window(0,yy,1.9,3.1,side*math.pi/2,.75,1.1)
  for xx in [-1.8,1.8]:around_window(xx,0,1.9,4.12,math.pi,.7,1)
  for j in range(90):
   y=-4.5+j*.1
   for side in [-1,1]:beam((side*3.5,y,3.55),(0,y,8.04),.025,wood if j%4==0 else cream)
  beam((0,-4.6,7.8),(0,-4.6,8.8),.06,wood);beam((-.3,-4.6,8.5),(.3,-4.6,8.5),.06,wood)
 if parts:attach(root)
 # Bevel only the coarse wall edges; roofs and fine parts remain within the game budget.
 for p in root.data.polygons:
  if p.loop_total>6:p.use_smooth=True
