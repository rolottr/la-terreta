import bpy, math, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,hex):
 m=bpy.data.materials.new(name); srgb=[int(hex[i:i+2],16)/255 for i in (0,2,4)]; m.diffuse_color=(*[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb],1); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=m.diffuse_color; m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8; return m
stone=mat('warm limestone','d8b886'); cream=mat('ivory trim','fff0ce'); terra=mat('fired clay','b85836'); dark=mat('deep teal glass','234753'); blue=mat('blue ceramic','277d9a'); gold=mat('brass','d8a13e'); white=mat('warm white','f4f1df'); red=mat('Valencia red','d24932'); wood=mat('walnut','664835')
parts=[]; roots=[]
def mesh(name,loc,scale,material,kind='cube',verts=16):
 if kind=='cube': bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
 elif kind=='sphere': bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=loc)
 elif kind=='cyl': bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=1,depth=1,location=loc)
 elif kind=='cone': bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=1,radius2=0,depth=1,location=loc)
 o=bpy.context.object; o.name=name; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(material); parts.append(o); return o

def box(x,y,z,w,d,h,m=stone):return mesh('masonry',(x,y,z),(w,d,h),m)
def cyl(x,y,z,r,h,m=stone,verts=16):return mesh('column',(x,y,z),(r,r,h),m,'cyl',verts)
def beam(a,b,r,m=white):
 mid=(Vector(a)+Vector(b))/2; o=cyl(*mid,r,(Vector(b)-Vector(a)).length,m,8); o.rotation_euler=(Vector(b)-Vector(a)).to_track_quat('Z','Y').to_euler();return o

def arch(x,y,z,w,h,m=cream,depth=.3):
 for i in range(14):
  t=i*math.pi/14; t2=(i+1)*math.pi/14
  beam((x+math.cos(t)*w/2,y,z+h+math.sin(t)*w/2),(x+math.cos(t2)*w/2,y,z+h+math.sin(t2)*w/2),depth,m)
 box(x-w/2,y,z+h/2,depth*2,depth*2,h,m);box(x+w/2,y,z+h/2,depth*2,depth*2,h,m)

def window(x,y,z,w=1,h=1.7):
 box(x,y,z,w+.22,.20,h+.24,cream);box(x,y-.13,z,w,.08,h,dark);box(x,y-.19,z,.06,.08,h,cream);box(x,y-.2,z-.1,w,.08,.06,cream)

def roof(x,y,z,w,d):
 # A pitched terracotta roof, with ridge and individually visible tile courses.
 verts=[(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x+w/2,y+d/2,z),(x-w/2,y+d/2,z),(x-w/2,y,z+1.6),(x+w/2,y,z+1.6)]
 me=bpy.data.meshes.new('pitched roof');me.from_pydata(verts,[],[(0,1,5,4),(4,5,2,3),(0,4,3),(1,2,5)]);me.materials.append(terra);o=bpy.data.objects.new('roof',me);bpy.context.collection.objects.link(o);parts.append(o)
 for i in range(int(w/.7)+1):
  xx=x-w/2+i*.7;beam((xx,y-d/2,z+.03),(xx,y,z+1.63),.035,stone)

def finish(name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');roots.append(o);parts.clear();return o

# Polygonal medieval gate. The centre remains open and traversable.
for x in (-5,5):
 cyl(x,0,5,3.1,10,stone,6);cyl(x,0,10,3.4,.7,cream,6);cyl(x,0,.3,3.4,.6,cream,6)
 for j in range(12):
  t=j*math.tau/12; box(x+3*math.cos(t),3*math.sin(t),10.8,.72,.72,1.2,stone)
 for z in (3.4,6.8):window(x,-3.12,z,.55,1.6)
 for z in (2,4,6,8):cyl(x,0,z,3.13,.06,cream,6)
box(0,0,7.5,5,3,3);arch(0,-1.65,0,3.2,3.3,cream,.22);box(0,-1.61,7,1,.2,1.5,gold)
for x in (-1.8,-.6,.6,1.8):box(x,0,9.5,.6,3,1)
beam((5,0,11),(5,0,15),.055,gold);box(5.8,0,14,1.6,.04,1,red);box(5.8,-.025,14,1.6,.04,.35,gold)
finish('serranos')
# City Hall: central clock, symmetric wings, columns and domed corner towers.
box(0,0,4.1,21,6,8.2,cream);box(0,0,.35,22,7,.7,stone)
for z in (1,3.3,6.5,8.1):box(0,-3.2,z,22,.5,.24,stone)
for x in range(-9,10,2):
 for z in (2,4.9,7):window(x,-3.35,z,.9,1.45)
for x in (-8,8):
 box(x,0,9,3.8,5,2,stone);cyl(x,0,10.6,1.85,1.2,cream);mesh('blue dome',(x,0,11.4),(1.9,1.9,1.8),blue,'sphere');cyl(x,0,13.3,.18,.6,gold)
box(0,-.5,10.3,4,4,4.8,cream);window(0,-2.7,9.3,1.2,1.4)
clock=cyl(0,-2.8,11.7,.9,.12,white,32);clock.rotation_euler[0]=math.pi/2
beam((0,-2.9,11.7),(0,-2.9,12.3),.045,dark);beam((0,-2.9,11.7),(.48,-2.9,11.45),.045,dark)
mesh('spire',(0,-.5,14),(2.5,2,2.6),stone,'cone',4)
for x in (-2,-1,1,2):cyl(x,-3.8,3.1,.2,3,cream)
box(0,-4,4.7,5,2,.4,stone);roof(0,0,8.2,14,6)
finish('townhall')
# Art Nouveau station: yellow facade, orange decoration, central clock and train shed.
box(0,0,3.1,24,5,6.2,cream);roof(0,0,6.4,24,5.8)
for x in range(-10,11,2):
 window(x,-2.61,4.5,1.1,1.6);box(x,-2.65,1.65,1.25,.13,2.8,dark);arch(x,-2.85,0,1.3,2.4,stone,.10)
 cyl(x,-2.83,5.9,.22,.1,gold)
for x in (-11,0,11):
 box(x,-.3,5,2.8,5.5,10,stone);box(x,-3.2,8,2.5,.3,1.7,cream);roof(x,-.3,10,3.5,5.8)
clock=cyl(0,-3.42,8.1,.65,.1,white,24);clock.rotation_euler[0]=math.pi/2
beam((0,-3.5,8.1),(0,-3.5,8.55),.035,dark);beam((0,-3.5,8.1),(.4,-3.5,8),.035,dark)
box(0,6,2.8,19,9,5.5,dark);roof(0,6,5.7,20,10)
finish('station')
# Bullring: open centre with four tiers of arches and a sand arena.
cyl(0,0,.1,9,.2,stone,64)
for j in range(48):
 a=j*math.tau/48;x=8.5*math.cos(a);y=8.5*math.sin(a)
 o=box(x,y,3.2,.8,.9,6.4,terra);o.rotation_euler[2]=a
 for z in (1.2,2.8,4.4,6):
  o=box(x,y,z,1.4,1.05,.2,cream);o.rotation_euler[2]=a
  beam((8.25*math.cos(a),8.25*math.sin(a),z),(8.8*math.cos(a),8.8*math.sin(a),z),.1,stone)
for z,r in ((.8,7.8),(1.3,7.4),(1.8,7)):
 for j in range(64):
  a=j*math.tau/64; o=box(r*math.cos(a),r*math.sin(a),z,.8,.7,.45,stone);o.rotation_euler[2]=a
finish('bullring')
# Hemisferic: eye silhouette, glazed dome, sculptural ribs.
mesh('eye glass',(0,0,.1),(12,5,5.6),dark,'sphere')
for i in range(25):
 x=-12+i; width=5*math.sqrt(max(0,1-(x/12)**2));height=5.7*math.sqrt(max(0,1-(x/12)**2))
 for j in range(18):
  t=j*math.pi/18;t2=(j+1)*math.pi/18
  beam((x,math.cos(t)*width,.15+math.sin(t)*height),(x,math.cos(t2)*width,.15+math.sin(t2)*height),.10,white)
for side in (-1,1):
 for j in range(32):
  x=-13+j*26/32;xx=-13+(j+1)*26/32
  beam((x,side*5.4*math.sin(math.acos(x/13)),.4),(xx,side*5.4*math.sin(math.acos(xx/13)),.4),.22,white)
# Raised sweeping shell running lengthwise over the eye
for j in range(28):
 x=-14+j;xx=x+1
 beam((x,0,1+7*math.sin((x+14)/28*math.pi)),(xx,0,1+7*math.sin((xx+14)/28*math.pi)),.36,white)
finish('hemisferic')
# Science museum, separate ribbed hall.
box(0,0,3.5,23,7,7,dark)
for x in range(-12,13,2):
 beam((x,-5,0),(x,-2,8),.23,white);beam((x,-2,8),(x,4,6),.23,white);beam((x,4,6),(x,5,0),.23,white)
box(0,0,7.1,25,2,.4,white);finish('museum')
# Aqua: turquoise tower and broad retail podium with a curved facade.
box(0,0,2.3,18,10,4.6,cream);box(0,-5.1,2.4,17,.1,3.7,dark)
box(3,1,11,7,7,18,blue)
for z in range(4,21):box(3,-2.6,z,7.2,.15,.12,white)
for x in (.5,2,3.5,5.5):box(x,-2.65,12,.09,.1,16,white)
for x in range(-8,9,2):cyl(x,-5.5,2.2,.18,4.4,white)
box(-4,0,5,8,9,.45,white);finish('aqua')
# University courtyard and blue dome; university is separate from Albufera.
for x in (-8,8):box(x,0,3.4,4,15,6.8,cream);roof(x,0,7,4.8,16)
box(0,5.6,3.4,18,4,6.8,stone);roof(0,5.6,7,19,4.8)
for x in (-9,-7,7,9):window(x,-7.65,3.8,1,2)
for x in (-4,-2,0,2,4):window(x,3.45,3.8,1,2)
for x in range(-6,7,2):cyl(x,2.7,2.4,.22,4.8,cream)
mesh('ceramic dome',(0,5,9.25),(3,3,3),blue,'sphere');cyl(0,5,12.55,.18,.8,gold);finish('university')
# Cathedral tower and old-city dome.
cyl(0,0,9,3.2,18,stone,8)
for z in (1,7,13,17):cyl(0,0,z,3.35,.35,cream,8)
for a in range(8):
 t=a*math.tau/8;o=box(math.cos(t)*3,math.sin(t)*3,15,.9,.12,2.5,dark);o.rotation_euler[2]=t-math.pi/2
# Bell cage is supplied by hero_landmarks.py.
box(7,2,3.5,10,11,7,cream);roof(7,2,7,11,12);mesh('cathedral dome',(7,2,10),(3,3,3),blue,'sphere');finish('cathedral')
# Albufera barraca cottage: white walls and steep reed roof.
box(0,0,1.8,6,8,3.6,white)
verts=[(-3.5,-4.5,3.5),(3.5,-4.5,3.5),(3.5,4.5,3.5),(-3.5,4.5,3.5),(0,-4.5,8),(0,4.5,8)]
me=bpy.data.meshes.new('reed roof');me.from_pydata(verts,[],[(0,4,5,3),(4,1,2,5),(0,1,4),(3,5,2)]);me.materials.append(stone);o=bpy.data.objects.new('reed roof',me);bpy.context.collection.objects.link(o);parts.append(o)
box(0,-4.1,1.5,1.6,.15,3,wood);window(-2,-4.13,2,.7,1);window(2,-4.13,2,.7,1)
for x in (-1,1):beam((x,-4.5,4.3),(0,-4.5,5.5),.04,wood)
finish('barraca')
exec(compile(open(os.path.join(ROOT,'scripts/landmark_details.py')).read(),'landmark_details.py','exec'))
exec(compile(open(os.path.join(ROOT,'scripts/hero_landmarks.py')).read(),'hero_landmarks.py','exec'))
exec(compile(open(os.path.join(ROOT,'scripts/city_expansion.py')).read(),'city_expansion.py','exec'))
from science_architecture import install_science
install_science(roots)
from landmark_repairs import repair_landmarks
repair_landmarks(roots)
# Export each mesh at its origin; glTF converts Z-up to Y-up.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/valencia-landmarks.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models/landmarks.glb'),export_format='GLB',use_selection=True,export_apply=True)

print('EXPORTED',[(o.name,len(o.data.polygons)) for o in roots])
