"""Export the skinned explorers, residents and Fallas procession with the current main-branch animation set."""
import bpy,json,sys,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/characters'))
from costumes import VARIANTS,parts_for
from instruments import instrument_parts
from materials import make_material
from rig import make_rig,bind_part,animate,CLIPS
from hands import add_relaxed_hands
from expressions import add_smile

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
material=make_material(ROOT)
brass=bpy.data.materials.new('Band brass and percussion');brass.use_nodes=True
bsdf=brass.node_tree.nodes['Principled BSDF'];bsdf.inputs['Metallic'].default_value=.62;bsdf.inputs['Roughness'].default_value=.32
color=brass.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name='Color';brass.node_tree.links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
roots=[];report=[]
for p in VARIANTS:
    name=p['name'];root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root);roots.append(root)
    root['heightScale']=p.get('height',1);root['character']=name;root['role']=p.get('band','fallera' if p.get('fallera')else 'fallero' if p.get('fallero')else 'explorer' if p.get('hero')else 'resident')
    rig=make_rig(name,root);objects=[]
    for part,mesh in parts_for(p)+instrument_parts(p):
        o=mesh.finish(name+'_'+part,None,material=brass if part.startswith(('instrument','slide','cymbal'))else material)
        bind_part(o,part,p,rig);objects.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();mesh=objects[0];mesh.name=name+'_detail';mesh.parent=rig
    mesh.data.calc_loop_triangles();high=len(mesh.data.loop_triangles)
    lod=mesh.copy();lod.data=mesh.data.copy();bpy.context.collection.objects.link(lod);lod.name=name+'_distant'
    bpy.context.view_layer.objects.active=lod
    decimate=lod.modifiers.new('Distant animated mesh','DECIMATE');decimate.ratio=.13
    bpy.ops.object.modifier_apply(modifier=decimate.name);lod.data.validate(clean_customdata=True);lod.data.calc_loop_triangles();low=len(lod.data.loop_triangles)
    for o in [mesh,lod]:
        mod=o.modifiers.new('Character skeleton','ARMATURE');mod.object=rig
    lod.hide_render=True
    # Eyelids, iris and sclera close together, with the face held fixed.
    mesh.shape_key_add(name='Basis');blink=mesh.shape_key_add(name='Blink');blink.value=0
    blink_group=mesh.vertex_groups.get('__blink')
    for i,v in enumerate(mesh.data.vertices):
        if blink_group and any(g.group==blink_group.index for g in v.groups):
            blink.data[i].co.z=1.654+(v.co.z-1.654)*.04
    add_relaxed_hands(mesh);add_relaxed_hands(lod)
    if p.get("hero"):add_smile(mesh);add_smile(lod)
    clips={key:duration for key,duration in CLIPS.items() if key!='Row' or p.get('hero')}
    animate(rig,p,clips)
    for o in [mesh,lod]:o.modifiers['Character skeleton'].show_viewport=False
    report.append(dict(name=name,role=root['role'],triangles=high,distantTriangles=low,bones=len(rig.data.bones),clips=list(clips)))
    print('ANIMATED_CHARACTER',name,high,low,flush=True)

# Restore mesh deformation for the final export.
for obj in bpy.data.objects:
    if obj.type=='MESH':
        for modifier in obj.modifiers:
            if modifier.type=='ARMATURE':modifier.show_viewport=True
bpy.ops.object.select_all(action='DESELECT')
for root in roots:
    for o in [root]+list(root.children_recursive):o.select_set(True)
for obj in bpy.data.objects:
    if obj.type=='MESH' and obj.data.shape_keys:
        for key in obj.data.shape_keys.key_blocks:key.value=0
bpy.context.view_layer.update()
output=ROOT/'public/models/characters.glb'
bpy.ops.export_scene.gltf(filepath=str(output.with_name('characters.next.glb')),export_format='GLB',use_selection=True,export_extras=True,
    export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_nla_strips=True,
    export_skins=True,export_morph=True,export_vertex_color='NAME',export_vertex_color_name='Color',export_apply=False)
output.with_name('characters.next.glb').replace(output)
# Leave an animated, editable gallery ready for Blender's Play button.
for obj in bpy.data.objects:
    if obj.type=='MESH':
        if obj.data.shape_keys:
            for key in obj.data.shape_keys.key_blocks:key.value=0
        if '_distant' in obj.name:obj.hide_set(True)
    if obj.type=='ARMATURE' and obj.animation_data:
        active='March' if obj.name.startswith(('band_','fallera_','fallero_')) else 'Idle'
        for track in obj.animation_data.nla_tracks:
            track.mute=not track.name.endswith('_'+active)
            for strip in track.strips:strip.repeat=10
bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=240
bpy.context.scene.frame_set(0)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        from mathutils import Euler
        view=area.spaces.active.region_3d;view.view_location=(0,1.5,1);view.view_distance=8
        view.view_rotation=Euler((math.radians(65),0,math.radians(16))).to_quaternion()
        area.spaces.active.shading.type='MATERIAL'
# Editable gallery layout; animation tracks are kept in the Blender source.
for i,root in enumerate(roots):root.location=((i%5-2)*1.2,(i//5)*1.35,0)
bpy.context.scene['Art direction']='La Terreta; see PROMPT.md'
(ROOT/'output/art/fallas').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/valencia-fallas-characters.blend'))
(ROOT/'output/art/fallas/model-stats.json').write_text(json.dumps(dict(variants=report,glbBytes=output.stat().st_size),indent=2)+'\n')
print('ANIMATED_LIBRARY_COMPLETE',output.stat().st_size,flush=True)
