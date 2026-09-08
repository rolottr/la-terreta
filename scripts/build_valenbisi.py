"""Build the classic Valenbisi from the operator's marina photograph.

Run in Blender: exec(compile(open(PATH).read(), PATH, 'exec')).
Coordinates below use the game's X-right, Y-up, Z-forward convention.
Dimensions keep the existing rider and dock attachment contract.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/art/valenbisi'
OUT.mkdir(parents=True, exist_ok=True)
# Use a new scene. The caller must preserve any other open work first.
scene = bpy.data.scenes.new('Valenbisi studio')
bpy.context.window.scene = scene
parts = bpy.data.collections.new('Valenbisi - editable parts')
scene.collection.children.link(parts)

def pos(p):
    return Vector((p[0], -p[2], p[1]))

def material(name, color, metal=0, rough=.4):
    m = bpy.data.materials.new('Valenbisi / ' + name)
    rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
    rgb = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = m.diffuse_color
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    return m

silver = material('cast aluminium', 'b8bfc4', .68, .31)
chrome = material('polished steel', 'd4dde1', .8, .24)
blue = material('deep blue body', '252984', .12, .32)
rubber = material('tyres and grips', '202326', 0, .78)
black = material('saddle and fittings', '33373c', .05, .49)
white = material('cream white markings', 'f4f1de', 0, .5)
amber = material('amber reflectors', 'ffb72e', .1, .3)
red = material('rear reflector', 'bd2835', .1, .3)
lens = material('front lamp lens', 'e5f0e7', .25, .18)

def register(o, name, mat):
    o.name = name
    for c in list(o.users_collection):
        c.objects.unlink(o)
    parts.objects.link(o)
    o.data.materials.append(mat)
    return o

def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata([pos(p) for p in vertices], [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    parts.objects.link(o)
    data.materials.append(mat)
    return o

def tube(name, points, radius, mat, sides=10):
    points = [pos(p) for p in points]
    vs, faces = [], []
    for i, p in enumerate(points):
        tangent = (points[min(i+1, len(points)-1)]-points[max(i-1, 0)]).normalized()
        side = tangent.cross(Vector((1, 0, 0)))
        if side.length < .01:
            side = tangent.cross(Vector((0, 0, 1)))
        side.normalize()
        up = tangent.cross(side).normalized()
        vs.extend(p + radius*(math.cos(j*math.tau/sides)*side + math.sin(j*math.tau/sides)*up) for j in range(sides))
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))), tuple(range((len(points)-1)*sides,len(points)*sides))])
    data=bpy.data.meshes.new(name); data.from_pydata(vs,[],faces); data.update()
    o=bpy.data.objects.new(name,data); parts.objects.link(o); data.materials.append(mat)
    for f in data.polygons: f.use_smooth=len(f.vertices)==4
    return o

def box(name, p, size, mat, bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos(p))
    o=register(bpy.context.object,name,mat)
    o.scale=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        m=o.modifiers.new('Rounded edges','BEVEL');m.width=bevel;m.segments=3
        bpy.ops.object.modifier_apply(modifier=m.name)
        m=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=m.name)
    return o

def ellipsoid(name, p, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=pos(p))
    o=register(bpy.context.object,name,mat);o.scale=(size[0],size[2],size[1])
    for f in o.data.polygons:f.use_smooth=True
    return o

def ring(name, center, radius, minor, mat, segments=64, sides=8):
    x,y,z=center
    return tube(name,[(x,y+radius*math.sin(a*math.tau/segments),z+radius*math.cos(a*math.tau/segments)) for a in range(segments+1)],minor,mat,sides)

def arc(name, center, radius, width, start, end, mat, count=40):
    # Curved metal sheet around a wheel, with a small thickness.
    vs=[]
    for i in range(count+1):
        a=math.radians(start+(end-start)*i/count)
        for r,x in [(radius,-width/2),(radius,width/2),(radius-.009,width/2),(radius-.009,-width/2)]:
            vs.append((x,center[0]+r*math.sin(a),center[1]+r*math.cos(a)))
    fs=[]
    for i in range(count):
        for j in range(4):fs.append((4*i+j,4*i+(j+1)%4,4*(i+1)+(j+1)%4,4*(i+1)+j))
    fs.extend([(3,2,1,0),tuple(range(count*4,count*4+4))])
    o=mesh(name,vs,fs,mat)
    for f in o.data.polygons:f.use_smooth=True
    return o

# Tyres sit on Y=0. Front remains +Z, matching createBike and cycleRig.
wheel_parts = {}
for label,z in [('rear',-.65),('front',.65)]:
    existing = set(parts.objects)
    ring(label+' tyre',(0,.44,z),.399,.041,rubber)
    for x in [-.026,.026]:
        ring(label+' silver rim',(x,.44,z),.357,.012,chrome,64,6)
        ring(label+' sidewall bead',(x,.44,z),.384,.0035,black,64,5)
    tube(label+' hub',[(-.078,.44,z),(.078,.44,z)],.054,silver,20)
    for side in [-1,1]:
        for i in range(18):
            a=(i/18+side*.012)*math.tau
            tube(label+' spoke',[(side*.044,.44+.035*math.sin(a+.35),z+.035*math.cos(a+.35)),(side*.018,.44+.353*math.sin(a),z+.353*math.cos(a))],.0025,chrome,5)
        for a in [.35,math.pi+.35]:
            o=box(label+' wheel reflector',(side*.031,.44+.265*math.sin(a),z+.265*math.cos(a)),(.013,.033,.10),amber,.009)
            o.rotation_euler.x=-a
        tube(label+' axle nut',[(side*.072,.44,z),(side*.090,.44,z)],.025,chrome,6)
    wheel_parts[label] = set(parts.objects) - existing

# Low, broad aluminium frame and paired rear stays.
tube('cast low step frame',[(0,.98,.43),(0,.87,.43),(0,.69,.35),(0,.54,.15),(0,.45,-.08),(0,.48,-.22),(0,.67,-.29),(0,.90,-.31)],.054,silver,16)
tube('low cross brace',[(0,.72,-.31),(0,.65,-.05),(0,.68,.29)],.028,silver,12)
tube('seat tube',[(0,.45,-.08),(0,.99,-.31)],.037,silver,14)
for x in [-.061,.061]:
    tube('chain stay',[(x,.45,-.08),(x,.44,-.65)],.023,silver)
    tube('seat stay',[(x,.91,-.31),(x,.44,-.65)],.019,silver)
    tube('front fork',[(x,.98,.43),(x,.73,.49),(x,.48,.62),(x,.44,.65)],.028,silver,12)
tube('seat post',[(0,.94,-.31),(0,1.05,-.31)],.025,chrome,14)
box('seat clamp',(0,1.005,-.31),(.087,.042,.074),black)
tube('seat clamp bolt',[(-.06,1.005,-.31),(.06,1.005,-.31)],.012,chrome,8)
ellipsoid('comfort saddle rear',(0,1.075,-.37),(.147,.045,.108),black)
ellipsoid('comfort saddle nose',(0,1.075,-.245),(.062,.034,.10),black)
for x in [-.049,.049]:tube('saddle rail',[(x,1.03,-.42),(x,1.035,-.22)],.008,chrome,8)

# Signature blue rear skirt: upper wheel guard, not a full wheel disk.
for side in [-1,1]:
    x=side*.056
    outline=[(x,.46,-.65)]+[(x,.44+.427*math.sin(math.radians(a)),-.65+.427*math.cos(math.radians(a))) for a in range(7,175,6)]
    outline.append((x,.47,-1.073))
    o=mesh('blue rear skirt '+str(side),outline,[tuple(range(len(outline)))],blue)
    mod=o.modifiers.new('Moulded shell','SOLIDIFY');mod.thickness=.009
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
    tube('skirt lower trim',[(x,.46,-.65),(x,.62,-.28)],.009,silver,8)
arc('blue rear mudguard',(.44,-.65),.447,.14,3,198,blue)
arc('front aluminium mudguard',(.44,.65),.448,.10,5,195,silver)
for side in [-1,1]:
    tube('front mudguard stay',[(side*.07,.44,.65),(side*.056,.53,.22)],.006,chrome,6)
box('rear lamp mount',(0,.725,-.982),(.09,.063,.052),black,.014)
box('rear red lamp',(0,.729,-1.013),(.073,.045,.015),red,.008)
box('rear mud flap',(0,.29,-1.085),(.096,.11,.016),rubber,.006)

# Enclosed chain drive and pedals.
outline=[(.097,.405,-.70),(.097,.399,-.09),(.097,.412,-.02),(.097,.45,.022),(.097,.51,.022),(.097,.556,-.022),(.097,.571,-.075),(.097,.523,-.70)]
o=mesh('enclosed chain case',outline,[tuple(range(len(outline)))],silver)
mod=o.modifiers.new('Chain case thickness','SOLIDIFY');mod.thickness=.032
bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
tube('crank housing',[(-.09,.48,-.08),(.14,.48,-.08)],.094,silver,32)
ring('crank face',(.146,.48,-.08),.072,.008,black,32,6)
crank_parts=set()
pedal_parts={}
for side,label in [(-1,'Left'),(1,'Right')]:
    # Phase zero: left crank points forward, right crank points rearward.
    end=(side*.145,.48,-.08-side*.145)
    existing=set(parts.objects)
    tube('crank arm '+label,[(side*.145,.48,-.08),end],.016,chrome,10)
    crank_parts.update(set(parts.objects)-existing)
    existing=set(parts.objects)
    tube('pedal axle '+label,[end,(side*.22,end[1],end[2])],.010,chrome,8)
    box('rubber pedal '+label,(side*.22,end[1],end[2]),(.11,.038,.085),rubber,.006)
    for z in [-.041,.041]:box('pedal amber strip '+label,(side*.22,end[1],end[2]+z),(.074,.015,.003),amber,.002)
    pedal_parts[label]=set(parts.objects)-existing
stand=tube('centre stand',[(0,.43,-.12),(-.055,.12,-.26),(-.12,.03,-.29)],.015,silver,10)

# Tall protected stem and moulded blue handlebar console.
tube('steering mast',[(0,.93,.43),(0,1.13,.42),(0,1.36,.37)],.047,silver,16)
ellipsoid('blue stem shroud',(0,1.235,.396),(.061,.153,.057),blue)
ellipsoid('handlebar console',(0,1.367,.39),(.205,.048,.080),blue)
for side in [-1,1]:
    # +Z faces the basket. The grips sweep back toward the saddle (-Z).
    tube('swept handlebar',[(0,1.37,.38),(side*.18,1.40,.37),(side*.24,1.39,.30),(side*.32,1.37,.25)],.017,chrome,12)
    tube('black grip',[(side*.245,1.385,.297),(side*.335,1.367,.259)],.026,rubber,14)
    # Brake blades sit in front of the grips, within reach of the fingers.
    tube('brake lever',[(side*.19,1.365,.385),(side*.225,1.345,.365),(side*.30,1.335,.335)],.008,chrome,8)
ellipsoid('bell',(-.185,1.416,.37),(.032,.018,.031),chrome)
box('console information plate',(0,1.410,.391),(.096,.004,.065),white,.006)

# Tapered open basket. Individual wires remain editable in the .blend.
def basket_loop(y,w,back,front):
    return [(-w/2,y,back),(w/2,y,back),(w/2,y,front),(-w/2,y,front),(-w/2,y,back)]
for j in range(6):
    t=j/5;y=1.035+t*.27;w=.325+.13*t;back=.52-.025*t;front=.84+.05*t
    tube('basket horizontal wire',basket_loop(y,w,back,front),.004 if j<5 else .008,chrome,6)
for i in range(11):
    t=i/10
    for side in [-1,1]:
        tube('basket side wire',[(side*.1625,1.035,.52+t*.32),(side*.2275,1.305,.495+t*.395)],.003,chrome,5)
    for front in [False,True]:
        tube('basket end wire',[(-.1625+t*.325,1.035,.84 if front else .52),(-.2275+t*.455,1.305,.89 if front else .495)],.003,chrome,5)
    tube('basket floor wire',[(-.1625+t*.325,1.035,.52),(-.1625+t*.325,1.035,.84)],.003,chrome,5)
for x in [-.11,.11]:tube('basket mounting arm',[(x,.96,.43),(x,1.026,.58),(x,1.026,.78)],.012,silver,8)
box('headlamp shell',(0,1.025,.845),(.102,.075,.080),black,.022)
box('headlamp lens',(0,1.028,.887),(.076,.046,.008),lens,.010)
box('dock coupling',(0,.85,.36),(.22,.07,.16),silver,.012)
box('dock lock insert',(-.114,.85,.36),(.009,.04,.07),black,.004)

# Original vector lettering and badges, authored here without image textures.
def text_on_side(body,p,size,side,mat):
    curve=bpy.data.curves.new(body,'FONT');curve.body=body;curve.size=size
    curve.align_x='CENTER';curve.align_y='CENTER';curve.extrude=.00035;curve.resolution_u=4
    o=bpy.data.objects.new(body,curve);parts.objects.link(o);o.location=pos(p)
    # Text baseline follows the bike; its face points out from the skirt.
    right=Vector((0,side,0));up=Vector((0,0,1));normal=right.cross(up)
    o.rotation_euler=Matrix((right,up,normal)).transposed().to_euler();curve.materials.append(mat)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
for side in [-1,1]:
    ellipsoid('oval brand badge',(side*.067,.731,-.69),(.006,.072,.156),white)
    text_on_side('valenbisi',(side*.075,.733,-.69),.047,side,blue)
    text_on_side('3850',(side*.067,.512,-.40),.036,side,white)

# Keep wheels separate with origins at their hubs so the game can roll them.
# Each assembly still batches its geometry by material.
static_parts = set(parts.objects) - wheel_parts['rear'] - wheel_parts['front'] - crank_parts - pedal_parts['Left'] - pedal_parts['Right'] - {stand}
exports = []
for name, objects, pivot in [
    ('Valenbisi_Bike', static_parts, (0,0,0)),
    ('Valenbisi_RearWheel', wheel_parts['rear'], (0,.44,-.65)),
    ('Valenbisi_FrontWheel', wheel_parts['front'], (0,.44,.65)),
    ('Valenbisi_Crank', crank_parts, (0,.48,-.08)),
    ('Valenbisi_LeftPedal', pedal_parts['Left'], (-.22,.48,.065)),
    ('Valenbisi_RightPedal', pedal_parts['Right'], (.22,.48,-.225)),
    ('Valenbisi_Stand', {stand}, (0,.43,-.12)),
]:
    bpy.ops.object.select_all(action='DESELECT')
    copies=[]
    for o in sorted(objects, key=lambda obj: obj.name):
        cp=o.copy();cp.data=o.data.copy();scene.collection.objects.link(cp);cp.select_set(True);copies.append(cp)
    bpy.context.view_layer.objects.active=copies[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    export=bpy.context.object;export.name=name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    export.data.transform(Matrix.Translation(-pos(pivot)))
    export.location=pos(pivot)
    exports.append(export)
bpy.ops.object.select_all(action='DESELECT')
for export in exports: export.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/valenbisi.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True)
triangles=sum(len(p.vertices)-2 for export in exports for p in export.data.polygons)
for export in exports: bpy.data.objects.remove(export,do_unlink=True)

# A separate studio collection does not enter the game export.
studio=bpy.data.collections.new('Studio - excluded from game export');scene.collection.children.link(studio)
bpy.ops.mesh.primitive_plane_add(size=200)
floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(material('studio floor','dfe3e4',0,.85))
for c in list(floor.users_collection):c.objects.unlink(floor)
studio.objects.link(floor)
world=bpy.data.worlds.new('Valenbisi soft daylight');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.5,.6,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.45
for name,location,energy,size in [('Key',(3,-4,6),550,5),('Fill',(-4,-1,3),360,4),('Rim',(1,4,4),600,3)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);studio.objects.link(o);o.location=location;o.rotation_euler=(Vector((0,0,.7))-o.location).to_track_quat('-Z','Y').to_euler()
cam_data=bpy.data.cameras.new('Valenbisi camera');cam=bpy.data.objects.new('Valenbisi camera',cam_data);studio.objects.link(cam);scene.camera=cam
cam_data.type='ORTHO';cam_data.ortho_scale=2.9
def camera_at(location):
    cam.location=location;cam.rotation_euler=(Vector((0,0,.71))-cam.location).to_track_quat('-Z','Y').to_euler()
camera_at((3.5,-2.3,2.0))
scene.render.engine='CYCLES';scene.cycles.samples=40
scene.cycles.use_denoising=True
scene.render.resolution_x=1500;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene['Reference']='JCDecaux Valenbisi marina photograph, SMHC3696 copia.jpg'
scene['Scale']='Game fit; visual reconstruction from photographs, not measured engineering dimensions.'
scene['Export triangles']=triangles
scene.render.image_settings.file_format='PNG'
if '--skip-renders' not in sys.argv:
    scene.render.filepath=str(OUT/'valenbisi-hero.png');bpy.ops.render.render(write_still=True)
    camera_at((4,0,1.05));scene.render.filepath=str(OUT/'valenbisi-side.png');bpy.ops.render.render(write_still=True)
camera_at((3.5,-2.3,2.0))
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
# Background runs save a complete file with a workspace. Interactive runs write
# only this scene, so other open Blender work stays in memory and out of the asset.
if bpy.app.background:
    for other in list(bpy.data.scenes):
        if other != scene:
            bpy.data.scenes.remove(other)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/valenbisi.blend'))
else:
    bpy.data.libraries.write(str(ROOT/'assets/valenbisi.blend'),{scene},fake_user=True)
(OUT/'model-stats.txt').write_text(f'Editable parts: {len(parts.objects)}\nTriangles: {triangles}\nGLB bytes: {(ROOT/"public/models/valenbisi.glb").stat().st_size}\n')
print('VALENBISI COMPLETE',triangles)
