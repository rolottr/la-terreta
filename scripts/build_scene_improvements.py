"""Editable Blender bull, Metrovalencia tram and baked water surface."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models/city';OUT.mkdir(parents=True,exist_ok=True)
ART=ROOT/'public/textures';ART.mkdir(parents=True,exist_ok=True)
REF=ROOT/'output/blender-improvements';REF.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def mat(name,color,rough=.5,metal=0,alpha=1):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,alpha)
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,alpha);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;bs.inputs['Alpha'].default_value=alpha
 if alpha<1:m.surface_render_method='DITHERED'
 return m
ivory=mat('Warm white enamel',(.77,.78,.72),.28,.25);red=mat('Metrovalencia crimson',(.55,.023,.039),.32,.3)
black=mat('Rubber and window seals',(.014,.021,.025),.52);glass=mat('Smoked blue cab glass',(.035,.10,.13),.16,.3,.55)
steel=mat('Brushed steel',(.32,.38,.39),.3,.75);lamp=mat('Headlamp ivory',(.98,.86,.51),.2)
bs=lamp.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(1,.74,.3,1);bs.inputs['Emission Strength'].default_value=.7
seatmat=mat('Passenger seat teal',(.035,.20,.18),.72);floor=mat('Cabin floor',(.16,.18,.17),.85)
brown=mat('Bull chestnut coat',(.07,.038,.021),.87);dark=mat('Bull nose and hooves',(.018,.019,.017),.52);horn=mat('Horn ivory',(.70,.59,.38),.4);inner=mat('Warm ear lining',(.26,.12,.074),.85);eye=mat('Eyes',(.009,.012,.009),.12)

def group(name,parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o

def xyz(p):return (p[0],-p[2],p[1])
def finish(o,name,p,m,parent):
 o.name=name;o.location=xyz(p);o.parent=parent;o.data.materials.append(m);return o

def box(name,p,size,m,parent,bevel=.03):
 bpy.ops.mesh.primitive_cube_add(size=1);o=finish(bpy.context.object,name,p,m,parent);o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  b=o.modifiers.new('Rounded manufactured edges','BEVEL');b.width=bevel;b.segments=3;o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 return o

def ball(name,p,size,m,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16);o=finish(bpy.context.object,name,p,m,parent);o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for f in o.data.polygons:f.use_smooth=True
 return o

def tube(name,points,r,m,parent):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3
 sp=c.splines.new('POLY');sp.points.add(len(points)-1)
 for q,p in zip(sp.points,points):q.co=(*xyz(p),1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(m);return o

def text(name,body,p,size,m,parent,rotation=(math.pi/2,0,math.pi/2)):
 c=bpy.data.curves.new(name,'FONT');c.body=body;c.size=size;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.002
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.parent=parent;o.location=xyz(p);o.rotation_euler=rotation;o.data.materials.append(m);return o

def export(root,name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in [root]+list(root.children_recursive):o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),use_selection=True,export_format='GLB',export_apply=True,export_extras=True)

bull=group('Valencian bull')
ball('Body',(0,.93,-.08),(.46,.49,.78),brown,bull)
ball('Shoulders',(0,1.18,.40),(.47,.43,.43),brown,bull)
ball('Haunches',(0,1.02,-.58),(.42,.40,.34),brown,bull)
ball('Dewlap',(0,.83,.67),(.23,.36,.22),brown,bull)
head=group('Bull_Head',bull);head.location=xyz((0,1.17,.62))
ball('Forehead',(0,.13,.17),(.31,.34,.29),brown,head)
ball('Cheeks',(0,-.12,.32),(.29,.24,.31),brown,head)
ball('Velvet muzzle',(0,-.30,.57),(.28,.15,.16),dark,head)
for side in [-1,1]:
 ball('Nostril',(side*.13,-.28,.713),(.055,.033,.015),eye,head)
 ball('Calm eye',(side*.25,.09,.32),(.047,.043,.040),eye,head)
 ball('Eye shine',(side*.276,.104,.348),(.009,.010,.009),ivory,head)
 ear=ball('Ear',(side*.39,.17,.07),(.21,.074,.115),brown,head);ear.rotation_euler[1]=side*.23
 ball('Ear inner',(side*.43,.183,.12),(.12,.036,.064),inner,head)
 points=[(side*(.23+.35*math.sin(t*1.45)),.35+.39*t*t,.01+.14*t*t) for t in [i/18 for i in range(19)]]
 # Each horn tapers smoothly to its tip.
 o=tube('Tapered horn',points,.063,horn,head)
 for i,p in enumerate(o.data.splines[0].points):p.radius=1-i/18*.96
 for front in [False,True]:
  leg=group(f'Bull_Leg_{"Front" if front else "Rear"}_{"L" if side<0 else "R"}',bull);leg.location=xyz((side*.29,.78,.46 if front else -.57))
  ball('Upper leg',(0,-.15,0),(.135,.30,.15),brown,leg)
  ball('Knee',(0,-.36,.02),(.093,.105,.11),brown,leg)
  tube('Lower leg',[(0,-.33,.02),(0,-.62,.035)],.073,brown,leg)
  box('Cloven hoof',(0,-.69,.06),(.19,.16,.23),dark,leg,.045)
  box('Hoof cleft',(0,-.70,.177),(.014,.10,.008),brown,leg,.003)
tail=group('Bull_Tail',bull);tail.location=xyz((0,1.04,-.77))
tube('Tail',[(0,0,0),(.08,-.18,-.13),(.10,-.51,-.17)],.026,brown,tail)
ball('Tail tuft',(.10,-.55,-.17),(.066,.13,.065),dark,tail)
export(bull,'bull')

tram=group('Metrovalencia articulated tram')
box('Chassis',(0,.38,0),(13.4,.24,2.18),black,tram,.10)
box('Floor',(0,.56,0),(13.2,.12,2.10),floor,tram)
box('Roof',(0,2.83,0),(13.4,.24,2.20),ivory,tram,.14)
# Dark articulated bellows divide the long body into three car sections.
for x in [-2.4,2.4]:
 for i in range(9):
  xx=x-.30+i*.075
  for z in [-1.08,1.08]:box('Bellows rib',(xx,1.57,z),(.042,2.23,.055),black,tram,.014)
  box('Bellows roof rib',(xx,2.73,0),(.042,.10,2.14),black,tram,.014)
for z in [-1.085,1.085]:
 for left,right in [(-6.12,-4.11),(-3.,-2.74),(-2.06,2.06),(2.74,3.),(4.11,6.12)]:
  center=(left+right)/2;width=right-left
  box('Red lower body',(center,.88,z),(width,.58,.095),red,tram,.035)
  box('White waist stripe',(center,1.22,z),(width,.11,.10),ivory,tram,.01)
  for y in [1.34,2.53]:box('Window frame horizontal',(center,y,z),(width,.065,.08),black,tram,.018)
  if width>.4:
   count=max(1,round(width/1.04))
   for i in range(count):
    mid=left+(i+.5)*width/count
    box('Window glass',(mid,1.935,z),(width/count-.07,1.13,.025),glass,tram,.035)
   for i in range(count+1):box('Window frame vertical',(left+i*width/count,1.935,z),(.065,1.23,.08),black,tram,.018)
 for x in [-3.55,3.55]:
  door=group(f'Tram_Door_{x}_{z}',tram);door.location=xyz((x,0,z*1.028))
  box('Door leaf',(0,1.60,0),(1.02,2.04,.045),ivory,door,.055)
  box('Door glass',(0,1.93,z*.025),(.82,1.13,.028),glass,door,.065)
  box('Door red panel',(0,.91,z*.027),(.94,.55,.032),red,door,.015)
  box('Door seam',(0,1.60,z*.042),(.018,1.85,.015),black,door,.003)
  ball('Door request button',(.37,1.35,z*.065),(.04,.04,.014),lamp,door)
for side in [-1,1]:
 x=side*6.63
 # A rounded curved cab face, recessed windscreen and light clusters.
 box('Cab nose',(x,.95,0),(.43,.84,2.1),ivory,tram,.20)
 box('Cab crimson bumper',(x+side*.1,.64,0),(.35,.21,1.95),red,tram,.09)
 wind=box('Curved cab windscreen',(x,1.96,0),(.11,1.32,1.92),glass,tram,.095);wind.rotation_euler[1]=side*.12
 box('Cab header',(x,2.63,0),(.17,.22,1.97),black,tram,.055)
 text('Route destination','4  LA MARINA',(x+side*.12,2.61,0),.145,lamp,tram, (math.pi/2,0,side*math.pi/2))
 for z in [-.73,.73]:
  box('Light housing',(x+side*.22,.93,z),(.06,.22,.37),black,tram,.07)
  box('Headlight',(x+side*.26,.93,z),(.03,.105,.23),lamp,tram,.04)
 tube('Windscreen wiper',[(x+side*.09,1.40,-.13),(x+side*.10,1.97,.28)],.018,black,tram)
 for z in [-.7,.7]:
  tube('Mirror arm',[(x-side*.15,2.17,z),(x+side*.09,2.18,z*1.68)],.025,steel,tram)
  box('Mirror',(x+side*.10,2.14,z*1.76),(.18,.24,.09),black,tram,.045)
for x in [-4.8,0,4.8]:
 box('Bogie',(x,.27,0),(1.55,.33,1.66),steel,tram,.08)
 for xx in [x-.5,x+.5]:
  for z in [-.91,.91]:
   wheel=ball('Wheel',(xx,.26,z),(.29,.29,.09),black,tram)
   ball('Wheel hub',(xx,.26,z*1.07),(.12,.12,.025),steel,tram)
for x in [-5,-3,-1,1,3,5]:
 for z in [-.72,.72]:
  box('Seat cushion',(x,.98,z),(.69,.12,.55),seatmat,tram,.065)
  box('Seat back',(x,1.29,z*1.3),(.69,.62,.10),seatmat,tram,.06)
  tube('Seat leg',[(x,.60,z),(x,.92,z)],.035,steel,tram)
for x in [-4,0,4]:
 for z in [-.65,.65]:tube('Grab pole',[(x,.61,z),(x,2.68,z)],.024,steel,tram)
for x in [-4,4]:
 box('Roof ventilation',(x,3.02,0),(1.65,.26,1.33),steel,tram,.08)
 for i in range(9):box('Vent grille',(x-.65+i*.16,3.16,0),(.035,.025,1.10),black,tram,.005)
# Folded diamond pantograph.
for z in [-.34,.34]:
 tube('Pantograph',[(.7,2.97,z),(-.1,3.37,z),(.7,3.72,z),(1.5,3.37,z),(.7,2.97,z)],.035,steel,tram)
box('Contact strip',(.7,3.76,0),(.10,.06,1.32),black,tram)
for z in [-1.148,1.148]:
 text('Metrovalencia name','metrovalencia',(0,.89,z),.22,ivory,tram,(math.pi/2,0,0 if z>0 else math.pi))
export(tram,'tram')
# A real Blender water material supplies the fine surface normals used in WebGL.
bpy.ops.mesh.primitive_plane_add(size=2);water=bpy.context.object;water.name='Water surface bake'
watermat=mat('Albufera water',(.025,.16,.13),.18);water.data.materials.append(watermat)
nodes=watermat.node_tree.nodes;links=watermat.node_tree.links;bs=nodes.get('Principled BSDF');bs.inputs['IOR'].default_value=1.333
noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=10;noise.inputs['Detail'].default_value=3;noise.inputs['Roughness'].default_value=.65
bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.28;bump.inputs['Distance'].default_value=.075;links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bs.inputs['Normal'])
texture=bpy.data.images.new('Water surface normals',512,512);texture.colorspace_settings.name='Non-Color'
node=nodes.new('ShaderNodeTexImage');node.image=texture;nodes.active=node
bpy.ops.object.select_all(action='DESELECT');water.select_set(True);bpy.context.view_layer.objects.active=water
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.render.bake.use_clear=True
bpy.ops.object.bake(type='NORMAL');texture.filepath_raw=str(ART/'water-normal.png');texture.file_format='PNG';texture.save();texture.pack()
water.hide_render=True
bull.location=xyz((0,0,-4));tram.location=xyz((0,0,2))
# Shared editable studio and a quick visual check.
bpy.ops.mesh.primitive_plane_add(size=200);ground=bpy.context.object;ground.data.materials.append(mat('Studio floor',(.19,.24,.21),.9));ground.location.z=-.015
world=scene.world;world.use_nodes=True;world.node_tree.nodes.get('Background').inputs[0].default_value=(.45,.55,.60,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.6
for p,power,size in [((2,-8,12),1800,8),((-7,2,8),1300,7)]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(14,-19,11));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.3))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=18;scene.camera=cam
scene.cycles.samples=20;scene.render.resolution_x=1500;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.filepath=str(REF/'tram-and-bull.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/city-improvements.blend'))
bpy.ops.render.render(write_still=True)
print('SCENE_IMPROVEMENTS_COMPLETE',flush=True)
