"""Build a two-material park bench. Run with Blender --background --python."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/art/bench'; OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
parts=[]
def linear(h):
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)
def material(name,metal,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    col=m.node_tree.nodes.new('ShaderNodeVertexColor');col.layer_name='Color'
    m.node_tree.links.new(col.outputs['Color'],bs.inputs['Base Color']);return m
wood=material('Oiled chestnut',0,.52);iron=material('Painted cast iron and brass',.55,.36)
def pos(p):return Vector((p[0],-p[2],p[1]))
def finish(o,name,mat,color):
    o.name=name;o.data.materials.clear();o.data.materials.append(mat)
    c=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for d in c.data:d.color=linear(color)
    parts.append(o);return o
def box(name,p,size,mat,color,bevel=.009):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos(p));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('Face normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,mat,color)
def tube(name,points,r,mat,color,sides=8):
    points=[pos(p) for p in points];vs=[];fs=[]
    for i,p in enumerate(points):
        tangent=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized();axis=tangent.cross(Vector((1,0,0)))
        if axis.length<.01:axis=tangent.cross(Vector((0,0,1)))
        axis.normalize();up=tangent.cross(axis).normalized()
        vs.extend(p+r*(math.cos(j*math.tau/sides)*axis+math.sin(j*math.tau/sides)*up) for j in range(sides))
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides;fs.append((a,b,b+sides,a+sides))
    fs.extend([tuple(reversed(range(sides))),tuple(range((len(points)-1)*sides,len(points)*sides))])
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o)
    for f in me.polygons:f.use_smooth=len(f.vertices)==4
    return finish(o,name,mat,color)
# Keep the old 2 m width, 0.47 m seat top, and 0.9 m collision depth.
for i in range(4):
    z=-.25+i*.17
    box('Seat slat %02d'%i,(0,.43,z),(2,.08,.13),wood,['a97043','bb8452','b17a48','c08b58'][i])
    for x in [-.78,.78]:tube('Flush seat bolt',[(x,.47,z),(x,.474,z)],.012,iron,'ae9864',8)
    # Shallow, tapered grain ribbons on the upper face, not extra texture samples.
    for k in range(2):
        pts=[(-.87+j*.145,.471,z+(k-.5)*.038+.005*math.sin(j*.8+i)) for j in range(13)]
        tube('Fine wood grain',pts,.0018,wood,'95613b',4)
for i in range(3):
    y=.68+i*.14;z=-.36-i*.025
    box('Back slat %02d'%i,(0,y,z),(2,.105,.075),wood,['b7804d','be8954','ad7547'][i])
    for x in [-.78,.78]:tube('Back bolt',[(x,y,z+.038),(x,y,z+.042)],.012,iron,'ae9864',8)
    for k in range(2):tube('Back wood grain',[(x,y+(k-.5)*.028+.003*math.sin(j),z+.0385) for j,x in enumerate([-.88,-.6,-.3,0,.3,.6,.88])],.0015,wood,'95613b',4)
for x in [-.8,.8]:
    for z in [-.30,.27]:
        box('Cast foot',(x,.025,z),(.17,.05,.15),iron,'324c45',.014)
        tube('Splayed leg',[(x,.05,z),(x,.16,z*.85),(x,.33,z*.65),(x,.40,z*.7)],.035,iron,'324c45')
        tube('Foot anchor',[(x,.05,z),(x,.055,z)],.016,iron,'718477')
    tube('Seat bearer',[(x,.39,-.34),(x,.39,.31)],.034,iron,'324c45')
    tube('Back upright',[(x,.35,-.27),(x,.55,-.38),(x,.80,-.44),(x,1.01,-.47)],.03,iron,'324c45')
    # Sweep each arm from the front post to the rear upright.
    tube('Rolled armrest',[(x,.40,.26),(x,.61,.29),(x,.70,.24),(x,.73,.12),(x,.735,-.07),(x,.75,-.25),(x,.82,-.40)],.029,iron,'3d5c51',10)
    # Visible cast scroll under each arm.
    pts=[]
    for i in range(25):
        a=i*math.tau/24;r=.102*(1-i/32)
        pts.append((x,.58+r*math.sin(a),-.04+r*math.cos(a)))
    tube('Cast scroll',pts,.014,iron,'47685a',6)
    tube('Scroll lower attachment',[(x,.39,.062),(x,.58,.062)],.015,iron,'47685a',6)
    tube('Scroll upper attachment',[(x,.66,-.04),(x,.735,-.04)],.015,iron,'47685a',6)
tube('Lower cross brace',[(-.8,.23,-.17),(.8,.23,-.17)],.025,iron,'324c45')
# Small brass maker plate: geometric relief avoids tiny text and texture overhead.
box('Maker plate',(0,.82,-.343),(.20,.055,.009),iron,'b59b60',.004)
for x in [-.075,.075]:tube('Plate pin',[(x,.82,-.337),(x,.82,-.332)],.006,iron,'5e6450',6)
# Export joined geometry with exactly two material primitives.
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();bench=bpy.context.object;bench.name='Valencia_Park_Bench'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Joining creates duplicate slots in some Blender versions; remap them.
slots=list(bench.data.materials);indices=[0 if slots[p.material_index]==wood else 1 for p in bench.data.polygons]
bench.data.materials.clear();bench.data.materials.append(wood);bench.data.materials.append(iron)
for p,i in zip(bench.data.polygons,indices):p.material_index=i
bench.data.calc_loop_triangles();stats={'triangles':len(bench.data.loop_triangles),'materials':2,'textures':0,'oldTriangles':108,'oldDrawCallsPerBench':1,'drawCallsPerBench':2,'dimensionsBlender':list(bench.dimensions),'detailFeatures':['beveled varied slats','wood grain','flush bolts','splayed feet','foot anchors','back uprights','swept arms','cast scrolls','cross brace','maker plate']}
model=ROOT/'public/models/park-bench.glb'
bpy.ops.export_scene.gltf(filepath=str(model),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT')
stats['glbBytes']=model.stat().st_size
(OUT/'stats.json').write_text(json.dumps(stats,indent=2))
# Studio and six complete views remain in the editable Blender file.
world=bpy.data.worlds.new('Soft studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.23,.26,.25,1)
box('Studio floor',(0,-.055,0),(200,.05,200),wood,'d6d2c3',0)
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=2.9
for location,power,size in [((2,-3,5),500,4),((-3,-1,2),300,3),((1,3,4),450,3)]:
    bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,.5))-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=760;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
for name,p in [('front',(0,1.6,4)),('back',(0,1.6,-4)),('left',(-4,1.6,0)),('right',(4,1.6,0)),('top',(0,5,.01)),('hero',(3,2.2,3.7))]:
    camera.location=pos(p);camera.rotation_euler=(pos((0,.48,0))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/park-bench.blend'))
print(json.dumps(stats))
