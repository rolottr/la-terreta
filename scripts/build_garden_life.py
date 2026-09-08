"""Build editable Blender animals and flowers. Game axes: X right, Y up, Z forward.
Run: Blender --background --python scripts/build_garden_life.py [-- --skip-renders]
"""
import bpy
import math
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/garden'
REF = ROOT / 'output/art/garden'
OUT.mkdir(parents=True, exist_ok=True)
REF.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def xyz(p): return Vector((p[0], -p[2], p[1]))
def linear(v): return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
def color(h): return tuple(linear(int(h[i:i+2], 16) / 255) for i in (1, 3, 5)) + (1,)

material = bpy.data.materials.new('Painted fur, feathers and petals')
material.use_nodes = True
bs = material.node_tree.nodes.get('Principled BSDF')
bs.inputs['Roughness'].default_value = .76
vc = material.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'
material.node_tree.links.new(vc.outputs['Color'], bs.inputs['Base Color'])

class Mesh:
    def __init__(self, name, parent, pivot=(0,0,0)):
        self.name, self.parent, self.pivot = name, parent, Vector(pivot)
        self.v, self.f, self.c = [], [], []
    def surface(self, vertices, faces, tint):
        start = len(self.v)
        self.v.extend([tuple(xyz(Vector(p) - self.pivot)) for p in vertices])
        self.f.extend([tuple(start + i for i in f) for f in faces])
        self.c.extend([color(tint)] * len(faces))
    def ball(self, p, r, tint, n=16, rings=10):
        vs = []
        for j in range(rings + 1):
            theta = math.pi * j / rings
            for k in range(n):
                a = math.tau * k / n
                vs.append((p[0] + r[0]*math.sin(theta)*math.cos(a), p[1] + r[1]*math.cos(theta), p[2] + r[2]*math.sin(theta)*math.sin(a)))
        self.surface(vs, [(j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k) for j in range(rings) for k in range(n)], tint)
    def tube(self, points, radii, tint, n=8):
        pts = [Vector(p) for p in points]; vs=[]
        if isinstance(radii, (int,float)): radii=[radii]*len(pts)
        for i,p in enumerate(pts):
            tangent=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
            a=tangent.cross(Vector((0,1,0)))
            if a.length < .001: a=tangent.cross(Vector((1,0,0)))
            a.normalize(); b=tangent.cross(a).normalized()
            for k in range(n):
                q=p+(a*math.cos(k*math.tau/n)+b*math.sin(k*math.tau/n))*radii[i]
                vs.append(q)
        faces=[(j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k) for j in range(len(pts)-1) for k in range(n)]
        faces += [tuple(reversed(range(n))),tuple((len(pts)-1)*n+k for k in range(n))]
        self.surface(vs,faces,tint)
    def leaf(self, base, tip, width, tint, bend=.025):
        a,b=Vector(base),Vector(tip); d=b-a
        side=d.cross(Vector((0,1,0)))
        if side.length<.001:side=Vector((1,0,0))
        side.normalize(); vs=[]
        for i in range(7):
            u=i/6; center=a+d*u+Vector((0,bend*math.sin(math.pi*u),0))
            w=width*math.sin(math.pi*u)**.8
            vs.extend([center-side*w,center+Vector((0,.008*math.sin(math.pi*u),0)),center+side*w])
        self.surface(vs,[(i*3+k,i*3+k+1,(i+1)*3+k+1,(i+1)*3+k) for i in range(6) for k in range(2)],tint)
    def finish(self):
        data=bpy.data.meshes.new(self.name);data.from_pydata(self.v,[],self.f);data.update()
        col=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for poly,tint in zip(data.polygons,self.c):
            poly.use_smooth=True
            for loop in poly.loop_indices:col.data[loop].color=tint
        o=bpy.data.objects.new(self.name,data);bpy.context.collection.objects.link(o)
        o.parent=self.parent;o.location=xyz(self.pivot);o.data.materials.append(material)
        return o

def root(name):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o

def part(name,parent,pivot):
    o=root(name);o.parent=parent;o.location=xyz(pivot);return o

stats={}
def export(obj,filename,stage):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    for child in obj.children_recursive:child.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.export_scene.gltf(filepath=str(OUT/(filename+'.glb')),use_selection=True,export_format='GLB',export_apply=True)
    stats[filename]={'vertices':sum(len(o.data.vertices) for o in obj.children_recursive if o.type=='MESH'),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in obj.children_recursive if o.type=='MESH'),'meshes':sum(o.type=='MESH' for o in obj.children_recursive),'bytes':(OUT/(filename+'.glb')).stat().st_size}
    obj.location=xyz(stage)

# Ginger tabby. All moving meshes have an anatomical pivot, exported by name.
cat=root('Courtyard_Cat')
fur='#c38a53';light='#dba668';stripe='#875237';cream='#f2dfbc';pink='#c88a7e';ink='#322d2a'
body=Mesh('Cat_Body',cat)
# Continuous torso: fuller haunch, narrow waist, raised shoulders.
sections=[(-.43,.36,.01,.035),(-.36,.37,.135,.17),(-.25,.39,.164,.185),(-.08,.385,.146,.155),(.10,.40,.141,.165),(.23,.43,.157,.18),(.33,.45,.118,.16),(.38,.46,.025,.08)]
vs=[];n=40;rows=81
for j in range(rows):
    z=-.43+j*.81/(rows-1)
    k=next((k for k in range(len(sections)-1) if sections[k+1][0]>=z),len(sections)-2)
    a,b=sections[k],sections[k+1];u=(z-a[0])/(b[0]-a[0])
    y,rx,ry=[a[i]+(b[i]-a[i])*u for i in [1,2,3]]
    for i in range(n):
        angle=i*math.tau/n;vs.append((rx*math.cos(angle),y+ry*math.sin(angle),z))
faces=[(j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k) for j in range(rows-1) for k in range(n)]
body.surface(vs,faces,fur)
# Fur markings are painted into the mesh colors, with no raised cords.
for j in range(rows-1):
    z=-.43+(j+.5)*.81/(rows-1)
    for k in range(n):
        angle=(k+.5)*math.tau/n
        wave=z+.022*math.sin(angle*3)
        marked=math.sin(angle)>-.25 and min(abs(wave-band) for band in [-.32,-.21,-.09,.04,.17])<.016
        body.c[j*n+k]=color(stripe if marked else fur)
body.ball((0,.43,.305),(.112,.164,.078),cream)
body.finish()

head=part('Cat_Head',cat,(0,.61,.37));h=Mesh('Cat_Face',head)
h.ball((0,0,0),(.155,.148,.137),light,24,16)
h.ball((0,-.058,.064),(.123,.086,.107),fur,20,12)
for side in [-1,1]:
    h.ball((side*.046,-.062,.126),(.054,.035,.038),cream)
    # Almond green eyes with vertical pupils and tiny catchlights.
    h.ball((side*.071,.018,.119),(.047,.035,.013),stripe,20,10)
    h.ball((side*.071,.020,.128),(.038,.027,.009),'#9da86b',20,10)
    h.ball((side*.073,.020,.136),(.009,.024,.005),ink,12,10)
    h.ball((side*.077,.031,.141),(.006,.006,.002),'#fff7df',8,6)
    for j in range(3):
        h.ball((side*(.033+j*.012),-.055-(j%2)*.010,.162),(.0025,.0025,.0025),stripe,6,4)
    for j in range(3):
        h.tube([(side*.07,-.063,.151),(side*.14,-.053+(j-1)*.014,.177),(side*(.23-j*.008),-.054+(j-1)*.039,.175)], [.0017,.0013,.00025],cream,5)
    # Raised wedge ears, with a hollow pink inner face.
    e=part('Cat_Ear_'+('L' if side<0 else 'R'),head,(side*.103,.088,-.009))
    ear=Mesh('Ear_mesh',e)
    ear.surface([(side*-.063,-.013,.035),(side*.063,-.028,.020),(side*.038,.150,-.028),(side*-.024,.0,-.062)],[(0,1,2),(1,3,2),(3,0,2),(0,3,1)],fur)
    ear.surface([(side*-.038,.001,.037),(side*.043,-.008,.026),(side*.032,.113,-.011)],[(0,1,2)],pink)
    ear.finish()
    h.tube([(side*.035,.090,.109),(side*.054,.065,.125),(side*.085,.073,.114)],.009,stripe,6)
    h.tube([(side*.106,-.005,.094),(side*.131,-.028,.064)],.009,stripe,6)
h.surface([(-.021,-.045,.165),(.021,-.045,.165),(0,-.067,.179),(0,-.055,.155)],[(0,1,2),(0,2,3),(1,3,2)],pink)
h.tube([(0,-.064,.168),(0,-.079,.166),(-.021,-.085,.158)],.0025,stripe,6)
h.tube([(0,-.079,.166),(.021,-.085,.158)],.0025,stripe,6)
h.finish()
for front,z in [('Front',.235),('Back',-.275)]:
    for side,sign in [('L',-1),('R',1)]:
        joint=part('Cat_'+front+'_'+side,cat,(sign*.111,.355,z))
        leg=Mesh('Leg_mesh',joint)
        leg.ball((0,-.092,-.009 if front=='Back' else 0),(.057,.141,.066 if front=='Back' else .049),fur)
        leg.tube([(0,-.13,0),(0,-.236,.025),(0,-.285,.037)],[.037,.028,.029],fur,10)
        leg.ball((0,-.310,.060),(.048,.043,.077),cream,16,10)
        for toe in [-1,0,1]:
            leg.tube([(toe*.022,-.298,.117),(toe*.022,-.319,.130)],.0016,stripe,5)
        for y in [-.10,-.15]:
            leg.tube([(sign*.025,y,-.034),(sign*.041,y-.006,0),(sign*.026,y-.012,.035)],.008,stripe,6)
        leg.finish()
tail=part('Cat_Tail',cat,(0,.445,-.373));tailmesh=Mesh('Tail_mesh',tail)
pts=[]
for i in range(33):
    u=i/32
    pts.append((.08*math.sin(u*math.pi),.62*u-.13*u**5,-.29*math.sin(u*math.pi*.78)))
radii=[.037*(1-i/38)+.006 for i in range(33)]
tailmesh.tube(pts,radii,fur,12)
for j in [5,10,15,20,25,29]:tailmesh.tube(pts[j:j+3],[r+.001 for r in radii[j:j+3]],stripe,12)
tailmesh.ball(pts[-1],(.012,.016,.012),stripe,12,8);tailmesh.finish()
export(cat,'cat',(-1.35,0,0))

# Rock dove: iridescent neck, two wing bars, tapered flight feathers and feet.
pigeon=root('City_Pigeon');b=Mesh('Pigeon_Body',pigeon)
b.ball((0,.208,-.02),(.108,.14,.195),'#919aab',20,12)
b.ball((0,.29,.072),(.082,.13,.088),'#7c8896',20,12)
b.ball((0,.385,.105),(.071,.079,.085),'#62747c',20,12)
b.ball((0,.316,.111),(.067,.084,.062),'#648a79',18,12)
for side in [-1,1]:
    b.ball((side*.047,.302,.077),(.024,.048,.039),'#82708d',12,8)
    b.ball((side*.062,.403,.145),(.010,.013,.011),'#c18b4c',12,8)
    b.ball((side*.066,.404,.150),(.006,.008,.007),'#252c30',10,8)
    b.ball((side*.069,.408,.153),(.002,.0025,.002),'#f5e8cf',6,4)
    b.tube([(side*.043,.13,0),(side*.040,.035,.022)],[.010,.008],'#a77471',8)
    for toe in [-1,0,1]:
        b.tube([(side*.04,.033,.022),(side*.04+toe*.018,.014,.075-abs(toe)*.013)],[.006,.0035],'#b7827a',6)
b.tube([(0,.382,.168),(0,.371,.230)],[.016,.002],'#59606a',10)
b.ball((0,.390,.177),(.021,.013,.022),'#d6d5cb',12,8)
for i in range(5):b.leaf(((i-2)*.022,.20,-.15),((i-2)*.027,.16,-.32),.019,'#606d7e',.008)
b.finish()
for side in [-1,1]:
    wing=part('Pigeon_Wing_'+('L' if side<0 else 'R'),pigeon,(side*.084,.26,.025))
    w=Mesh('Wing_mesh',wing)
    w.ball((side*.055,-.003,-.018),(.090,.028,.092),'#8d98a7',18,10)
    for j in range(8):
        w.leaf((side*.048,0,.038-j*.018),(side*(.30-j*.015),-.008,-.004-j*.029),.024,'#6d7b8d' if j%2 else '#79879a',.009)
    for j in range(2):
        w.tube([(side*(.085+j*.035),.023,.05),(side*(.09+j*.035),.025,-.025),(side*(.095+j*.035),.016,-.09)],.008,'#46515e',7)
    w.finish()
    wing.rotation_euler[2]=side*1.37
export(pigeon,'pigeon',(0,0,.05))

# Flowers have a ribbed petal surface and curved stems. Each clump is one mesh.
def stem(b,x,z,height,lean):
    pts=[(x+lean*(u/8)**2,height*u/8,z+.035*math.sin(u/8*math.pi)) for u in range(9)]
    b.tube(pts,[.010-.005*u/8 for u in range(9)],'#5e7850',7)
    for j in range(3):
        sign=-1 if j%2 else 1; y=height*(.23+j*.15);a=(x+lean*(y/height)**2,y,z)
        b.leaf(a,(a[0]+sign*.15,y+.09,z+.07*(j-1)),.044,'#718950' if j%2 else '#4f7048')
    return Vector(pts[-1])

def petal(b,center,angle,length,width,tint,cup):
    vs=[]
    for j in range(8):
        u=j/7;r=.022+length*u;w=width*math.sin(math.pi*u)**.6
        for k in [-1,0,1]:
            vs.append((center.x+math.cos(angle)*r-math.sin(angle)*w*k,center.y+cup*u*u+.014*(1-k*k)*math.sin(math.pi*u),center.z+math.sin(angle)*r+math.cos(angle)*w*k))
    b.surface(vs,[(j*3+k,j*3+k+1,(j+1)*3+k+1,(j+1)*3+k) for j in range(7) for k in range(2)],tint)

for kind in ['daisy','cosmos','lavender']:
    obj=root('Flower_'+kind);b=Mesh('Flower_mesh',obj)
    for j in range(3):
        x=(j-1)*.13;z=math.sin(j*2.4)*.105;height=[.46,.62,.51][j]
        c=stem(b,x,z,height,(j-1)*.045)
        if kind=='lavender':
            for tier in range(6):
                r=.033*(1-tier*.095)
                for k in range(3):
                    a=k*math.tau/3+tier*.65
                    b.ball((c.x+math.cos(a)*r,c.y+tier*.023,c.z+math.sin(a)*r),(.023-tier*.0016,.023,.026-tier*.0016),['#8d80b5','#a394c5','#706794'][(tier+k)%3],6,4)
        else:
            count=12 if kind=='daisy' else 8
            for k in range(count):
                petal(b,c,k*math.tau/count+j*.3,.14 if kind=='cosmos' else .115,.051 if kind=='cosmos' else .022,['#d580a0','#ec9fb1','#c96c91'][k%3] if kind=='cosmos' else ['#f3e7c7','#fff4de','#e9dabb'][k%3],.022 if kind=='cosmos' else -.018)
            b.ball(c+Vector((0,.012,0)),(.039,.022,.039),'#b88432',14,8)
            for k in range(13):
                a=k*2.4;r=.028*math.sqrt(k/13)
                b.ball(c+Vector((r*math.cos(a),.029,r*math.sin(a))),(.006,.005,.006),'#edc55d',5,3)
    b.finish();export(obj,kind,(.62+['daisy','cosmos','lavender'].index(kind)*.63,0,.02))

# Open terracotta pot: separate outer wall, rolled lip, inner wall and soil.
# The game places each flower clump inside this cavity, at the soil surface.
planter=root('Terracotta_Planter');pot=Mesh('Planter_mesh',planter)
profile=[(.215,.014),(.228,.022),(.235,.065),(.300,.345),(.320,.373),(.350,.380),(.362,.397),(.361,.424),(.345,.442),(.323,.442),(.309,.426),(.306,.399),(.285,.365),(.218,.080),(.205,.058)]
vs=[];segments=48
for radius,height in profile:
    for k in range(segments):
        a=k*math.tau/segments;vs.append((radius*math.cos(a),height,radius*math.sin(a)))
faces=[(j*segments+k,(j+1)*segments+k,(j+1)*segments+(k+1)%segments,j*segments+(k+1)%segments) for j in range(len(profile)-1) for k in range(segments)]
pot.surface(vs,faces,'#b9744f')
for j in range(len(profile)-1):
    for k in range(segments):
        tint='#c88b61' if 4<=j<=9 else '#965a40' if j>=11 else '#b9744f'
        pot.c[j*segments+k]=color(tint)
# Fine hand-thrown rings on the outer wall, below the rolled rim.
for height,radius in [(.12,.249),(.15,.256),(.29,.287)]:
    pot.tube([(radius*math.cos(k*math.tau/64),height,radius*math.sin(k*math.tau/64)) for k in range(65)],.0025,'#ca8c62',5)
# Uneven soil is below the open lip. No solid cap fills the rim.
pot.ball((0,.394,0),(.299,.012,.299),'#50412f',32,8)
for k in range(19):
    a=k*2.39996;r=.27*math.sqrt((k+1)/20)
    pot.ball((r*math.cos(a),.405,r*math.sin(a)),(.012,.006,.009),['#796149','#967958','#645037'][k%3],6,4)
pot.finish();export(planter,'planter',(2.60,0,.05))

# Store the editable scene and render a close view of the assets.
scene=bpy.context.scene
world=scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.28,.24,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5
floor=bpy.data.materials.new('Warm sage studio');floor.diffuse_color=(.22,.27,.21,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.003));bpy.context.object.name='Studio floor';bpy.context.object.data.materials.append(floor)
for loc,power,size in [((0,-3,5),450,4),((-4,1,3),250,3),((3,3,4),350,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3.4,-6,3.4));cam=bpy.context.object;scene.camera=cam
cam.rotation_euler=(Vector((.55,0,.33))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=5.30
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
# Make the saved scene easy to inspect in Blender.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/garden-life.blend'))
(REF/'model-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
print('GARDEN_ASSETS',json.dumps(stats))
if '--skip-renders' not in sys.argv:
    scene.render.filepath=str(REF/'garden-life.png');bpy.ops.render.render(write_still=True)
    cam.location=(-.05,-2.5,1.28);cam.rotation_euler=(xyz((-1.35,.43,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=1.65
    scene.render.resolution_x=1100;scene.render.resolution_y=1000;scene.render.filepath=str(REF/'cat.png');bpy.ops.render.render(write_still=True)
