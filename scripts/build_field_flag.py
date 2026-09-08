"""Build the field Senyera with a seamless eight-second cloth animation.
Run Blender --background --python scripts/build_field_flag.py.
The texture is rasterized from the local public/flags/va.svg with project Sharp.
"""
import bpy
import math
import subprocess
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
(ROOT/'output/art').mkdir(parents=True, exist_ok=True)
subprocess.run(['node', '--input-type=module', '-e',
    "import sharp from 'sharp'; await sharp('public/flags/va.svg',{density:160})"
    ".resize(1536,1020).png().toFile('output/art/senyera-cloth.png')"], cwd=ROOT, check=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.name = 'Field Senyera'
scene.render.fps = 30
scene.frame_start, scene.frame_end = 0, 240

def material(name, color, metallic=0, roughness=.7):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    return mat

stone = material('Warm limestone', (.64,.56,.41), roughness=.92)
cap = material('Cut limestone', (.82,.74,.59), roughness=.87)
bronze = material('Aged bronze', (.20,.15,.085), .7, .4)
gold = material('Brushed gold', (.74,.47,.12), .72, .32)
polemat = material('Ivory enamel', (.83,.80,.69), .28, .34)
rope = material('Halyard linen', (.46,.39,.25), 0, .9)
root = bpy.data.objects.new('Field_Senyera', None)
scene.collection.objects.link(root)

def cylinder(name, radius, depth, z, mat, top=None, vertices=48, x=0, y=0):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if top is None else top, depth=depth, location=(x,y,z))
    obj=bpy.context.object; obj.name=name; obj.data.materials.append(mat); obj.parent=root
    bevel=obj.modifiers.new('Soft crafted edges','BEVEL'); bevel.width=min(.045,depth/5,radius/4); bevel.segments=3
    bpy.context.view_layer.objects.active=obj; bpy.ops.object.modifier_apply(modifier=bevel.name)
    for face in obj.data.polygons: face.use_smooth=abs(face.normal.z)<.95
    return obj

cylinder('Stone_foundation',1.55,.32,.12,stone,vertices=64)
cylinder('Stone_upper_plinth',1.28,.24,.39,cap,vertices=64)
cylinder('Bronze_foot',.48,.34,.68,bronze)
cylinder('Gold_base_collar',.40,.07,.88,gold)
cylinder('Tapered_mast',.23,26.7,14.23,polemat,top=.125)
for z in [.95,9.7,18.5,27.55]: cylinder('Mast_collar',.245 if z<10 else .17,.09,z,gold)
for i in range(8):
    a=i*math.tau/8
    cylinder('Anchor_bolt',.055,.09,.56,bronze,vertices=8,x=.87*math.cos(a),y=.87*math.sin(a))
cylinder('Finial_neck',.115,.40,27.8,gold)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12,radius=.33,location=(0,0,28.15))
finial=bpy.context.object;finial.name='Gold_finial';finial.parent=root;finial.data.materials.append(gold)
for p in finial.data.polygons:p.use_smooth=True
for x in [-.27,.27]:cylinder('Halyard',.015,25.65,14,rope,x=x,y=.13,vertices=8)

# A dense, single cloth surface. The hoist is fixed; displacement grows towards the fly.
nx,ny=64,40
verts=[]; faces=[]
for j in range(ny+1):
    v=j/ny
    for i in range(nx+1):
        u=i/nx
        verts.append((.28+18*u-.38*u*u, .08*math.sin(math.pi*v)*u, 27.25-12*v-.55*u*u))
for j in range(ny):
    for i in range(nx):
        a=j*(nx+1)+i
        faces.append((a,a+1,a+nx+2,a+nx+1))
mesh=bpy.data.meshes.new('Senyera_cloth_grid');mesh.from_pydata(verts,[],faces);mesh.update()
cloth=bpy.data.objects.new('Senyera_cloth',mesh);scene.collection.objects.link(cloth);cloth.parent=root
uv=mesh.uv_layers.new(name='Flag_UV')
for face in mesh.polygons:
    face.use_smooth=True
    for loop in face.loop_indices:
        index=mesh.loops[loop].vertex_index
        uv.data[loop].uv=(index%(nx+1)/nx,1-index//(nx+1)/ny)
clothmat=material('Woven Valencian Senyera',(1,1,1),roughness=.92)
clothmat.use_backface_culling=False
shader=clothmat.node_tree.nodes.get('Principled BSDF')
shader.inputs['Sheen Weight'].default_value=.22
image=bpy.data.images.load(str(ROOT/'output/art/senyera-cloth.png'));image.pack()
tex=clothmat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
clothmat.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
mesh.materials.append(clothmat)
cloth.shape_key_add(name='Basis')
for mode in range(4):
    key=cloth.shape_key_add(name=['Broad_sine','Broad_cosine','Ripple_sine','Ripple_cosine'][mode])
    key.slider_min=-1
    for index,coord in enumerate(verts):
        u=index%(nx+1)/nx;v=index//(nx+1)/ny
        phase=(math.tau*1.15*u+.7*v) if mode<2 else (math.tau*2.6*u-1.3*v)
        amplitude=1.18*u**.85 if mode<2 else .24*u**1.4
        wave=amplitude*(math.sin(phase) if mode%2==0 else math.cos(phase))
        key.data[index].co.y+=wave
        key.data[index].co.z+=wave*.13*math.sin(math.pi*v)
    for frame in range(0,241,4):
        phase=frame/240*math.tau*(1 if mode<2 else 2)
        key.value=math.cos(phase) if mode%2==0 else -math.sin(phase)
        key.keyframe_insert(data_path='value',frame=frame)
cloth.data.shape_keys.animation_data.action.name='Senyera_wind'
# Exact equal endpoint values give a seamless wrap. Sample smooth motion in GLB.
scene.frame_set(0)
root['pole_height']=28.48
root['flag_width']=18.0
root['flag_height']=12.0
root['wind_period']=8.0

out=ROOT/'public/models/field-senyera.glb'
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
for obj in root.children_recursive:obj.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(out),use_selection=True,export_format='GLB',
    export_animations=True,export_morph=True,export_extras=True,export_force_sampling=True)

# Studio camera and lighting stay in the editable Blender source only.
world=bpy.data.worlds.new('Warm sky');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.38,.48,.53,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.55
bpy.ops.object.light_add(type='AREA',location=(6,-14,34));key=bpy.context.object;key.name='Soft sunlight';key.data.energy=2600;key.data.shape='DISK';key.data.size=18
key.rotation_euler=(Vector((5,0,17))-key.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='SUN',location=(10,-8,30));bpy.context.object.data.energy=2.2;bpy.context.object.rotation_euler=(.4,-.5,-.5)
bpy.ops.object.camera_add(location=(38,-62,32));camera=bpy.context.object;camera.rotation_euler=(Vector((7,0,15))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=36;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.frame_set(35)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/field-senyera.blend'))
scene.render.filepath=str(ROOT/'output/art/field-senyera.png');scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
bpy.ops.render.render(write_still=True)
print('FIELD_SENYERA_READY',out)
