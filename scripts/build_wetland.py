"""Editable Albufera boat and wildlife. Run with Blender --background --python."""
import bpy, math, random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models/wetland';OUT.mkdir(parents=True,exist_ok=True)
REF=ROOT/'output/art/wetland';REF.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
random.seed(71)
def xyz(p):return (p[0],-p[2],p[1])
def mat(name,color,rough=.6,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;return m
wood=mat('Honey oak',(.29,.13,.045));dark=mat('Tarred hull',(.035,.065,.055));trim=mat('Weathered ivory',(.72,.68,.49));red=mat('Oxide red',(.34,.075,.035));brass=mat('Brass fittings',(.39,.27,.08),.32,.7)
green=mat('Mallard emerald',(.014,.12,.075),.28);brown=mat('Chestnut breast',(.18,.058,.027));grey=mat('Warm grey feathers',(.38,.37,.31));cream=mat('Cream feathers',(.83,.78,.60));black=mat('Eyes and tail',(.008,.012,.01),.2);yellow=mat('Ochre bill',(.62,.36,.04));blue=mat('Blue wing speculum',(.026,.11,.3),.3);fishmat=mat('Silver mullet',(.18,.32,.28),.23,.4);finmat=mat('Translucent olive fins',(.14,.22,.14));reedmat=mat('Reed olive',(.23,.31,.08));seedmat=mat('Reed seed heads',(.3,.17,.055));rope=mat('Hemp rope',(.48,.37,.20))
root=None

def register(o,name,m):
 o.name=name;o.parent=root;o.data.materials.append(m);return o

def ball(name,p,scale,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=xyz(p));o=register(bpy.context.object,name,m);o.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for f in o.data.polygons:f.use_smooth=True
 return o

def box(name,p,scale,m,bevel=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=register(bpy.context.object,name,m);o.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:mod=o.modifiers.new('Soft worn edges','BEVEL');mod.width=bevel;mod.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def tube(name,points,r,m):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2
 sp=c.splines.new('POLY');sp.points.add(len(points)-1)
 for q,p in zip(sp.points,points):q.co=(*xyz(p),1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);register(o,name,m);return o

def mesh(name,verts,faces,m):
 data=bpy.data.meshes.new(name);data.from_pydata([xyz(p) for p in verts],[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);register(o,name,m);return o

def start(name):
 global root
 root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root)

def export(name,position):
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in root.children_recursive:o.select_set(True)
 bpy.context.view_layer.objects.active=root
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),use_selection=True,export_format='GLB',export_apply=True)
 root.location=xyz(position)

start('Albuferenc')
# Open hull: four strakes on each side, rising to pointed stem and stern.
N=48
for side in [-1,1]:
 for strake in range(4):
  vs=[]
  for i in range(N+1):
   z=-2.9+5.8*i/N;u=z/2.9;w=.94*max(0,1-u*u)**.58
   for k in [strake/4,(strake+1)/4]:vs.append((side*w*(.66+.34*k),.03+k*.56+.26*abs(u)**5,z))
  fs=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(N)]
  o=mesh('Hull strake',vs,fs,dark if strake%2==0 else wood);mod=o.modifiers.new('Plank thickness','SOLIDIFY');mod.thickness=.045
 for h,widen in [(.60,1),(.48,.94)]:
  tube('Ivory gunwale' if h>.5 else 'Red sheer line',[(side*.94*max(0,1-(z/2.9)**2)**.58*widen,h+.26*abs(z/2.9)**5,z) for z in [-2.9+5.8*i/N for i in range(N+1)]],.045 if h>.5 else .025,trim if h>.5 else red)
for i in range(9):
 x=(i-4)*.145;box('Floor plank',(x,.08,0),(.137,.065,4.4),wood,.009)
for z in [-1.7,-.7,.65,1.65]:
 w=.94*(1-(z/2.9)**2)**.58
 box('Cross thwart',(0,.48,z),(w*1.9,.10,.34),trim,.028)
 tube('Hull rib',[(-w*.94,.5,z),(-w*.72,.08,z),(w*.72,.08,z),(w*.94,.5,z)],.035,wood)
for z in [-2.55,2.55]:box('Pointed deck',(0,.58,z),(.5,.09,.45),wood)
for side in [-1,1]:
 tube('Oar shaft '+str(side),[(side*.3,1.0,.10),(side*.95,.69,.6),(side*2.15,.118,1.523)],.037,wood)
 o=ball('Oar blade '+str(side),(side*2.32,.037,1.654),(.16,.045,.43),trim);o.rotation_euler[2]=side*.65
 tube('Oarlock',[(side*.95,.58,.6),(side*.95,.78,.6),(side*1.1,.78,.6)],.025,brass)
for r in [.15,.19,.23,.27]:tube('Coiled mooring rope',[(r*math.cos(i*.2),.67,2.12+r*math.sin(i*.2)) for i in range(33)],.022,rope)
box('Stern rudder',(0,-.02,-2.94),(.07,.6,.35),wood)
tube('Tiller',[(0,.55,-2.94),(0,.7,-2.1)],.045,wood)
export('boat',(0,0,0))
for female in [False,True]:
 start('Female duck' if female else 'Mallard duck')
 bodymat=brown if female else grey
 ball('Body',(0,.27,0),(.24,.24,.43),bodymat);ball('Breast',(0,.36,.23),(.22,.24,.25),brown)
 ball('Neck',(0,.50,.29),(.105,.19,.12),brown if female else green)
 ball('Head',(0,.69,.34),(.145,.15,.17),brown if female else green)
 if not female:ball('White collar',(0,.47,.29),(.11,.035,.12),cream)
 ball('Bill',(0,.655,.53),(.085,.028,.15),yellow)
 for side in [-1,1]:
  ball('Eye',(side*.123,.724,.40),(.023,.024,.022),black)
  ball('Eye glint',(side*.135,.733,.41),(.006,.007,.007),cream)
  for i in range(7):
   o=ball('Layered wing feather',(side*(.20+i*.003),.32-i*.012,-.05-i*.025),(.048,.05,.21),bodymat if i%2 else cream);o.rotation_euler[2]=side*.12
  ball('Blue wing bar',(side*.224,.31,-.14),(.02,.07,.13),blue)
 for i in range(4):ball('Tail feather',((i-1.5)*.065,.35,-.40),(.04,.05,.15),brown if female else black)
 export('duck-female' if female else 'duck',(-2 if female else 2,0,0))
start('Mullet')
ball('Fish body',(0,0,0),(.085,.12,.40),fishmat)
ball('Fish head',(0,0,.27),(.077,.105,.15),fishmat)
for side in [-1,1]:
 ball('Fish eye',(side*.067,.04,.32),(.016,.019,.018),black)
 for i in range(6):tube('Gill and scale lines',[(side*.08,.07,-.2+i*.075),(side*.086,0,-.22+i*.075),(side*.06,-.07,-.2+i*.075)],.003,trim)
 mesh('Pectoral fin',[(side*.07,0,.12),(side*.23,-.08,-.08),(side*.07,-.04,-.07)],[(0,1,2)],finmat)
mesh('Tail',[(0,0,-.30),(0,.17,-.60),(0,0,-.53),(0,-.17,-.60)],[(0,1,2),(0,2,3)],finmat)
mesh('Dorsal fin',[(0,.07,.14),(0,.25,-.11),(0,.08,-.23)],[(0,1,2)],finmat)
export('fish',(3,0,1.6))
start('Reed clump')
for i in range(9):
 x=random.uniform(-.45,.45);z=random.uniform(-.45,.45);h=random.uniform(.8,1.9)
 tube('Reed stem',[(x,0,z),(x+.08,h*.6,z+.04),(x+.20,h,z+.1)],.016,reedmat)
 ball('Cattail',(x+.20,h,z+.1),(.055,.18,.055),seedmat)
 for sign in [-1,1]:mesh('Long reed leaf',[(x,h*.25,z),(x+sign*.35,h*.72,z+.14),(x+sign*.48,h*.66,z+.16),(x+.03,h*.22,z)],[(0,1,2,3)],reedmat)
export('reeds',(-3,0,2))
# Studio view saved with all editable assets; export files retain their local origins.
bpy.ops.mesh.primitive_plane_add(size=200);plane=bpy.context.object;plane.data.materials.append(mat('Studio sand',(.15,.20,.18)))
plane.location.z=-.18
world=bpy.context.scene.world;world.color=(.3,.3,.3)
bpy.ops.object.light_add(type='AREA',location=(2,-4,9));bpy.context.object.data.energy=1800;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=7
bpy.ops.object.light_add(type='AREA',location=(-5,3,5));bpy.context.object.data.energy=1100;bpy.context.object.data.size=6
bpy.ops.object.camera_add(location=(9,-11,10));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.2))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=12;bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.filepath=str(REF/'blender-assets.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/albufera-wildlife.blend'))
bpy.ops.render.render(write_still=True)
