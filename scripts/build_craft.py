"""Build editable model assets and game exports in this worktree only.

Run craft_atlas.py with Python, then this script with Blender --background.
"""
from pathlib import Path
import sys
import bpy
import bmesh
import json

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'scripts'))
from craft_mesh import setup_materials
from craft_transport import tram, shelter, bike_dock
from craft_coast import beach_set, dune, boardwalk
from craft_street import bench, lantern, flower_box, pot, fountain, bistro, cafe_counter, awning, crops
from craft_animals import pigeon, cat
from pack_craft_glb import share_atlas
from craft_gallery import make_gallery

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
setup_materials(ROOT/'public/models/craft/craft-atlas.png')
families={
    'tram':tram(),
    'tram_stop':[shelter()],
    'cycle_dock':[bike_dock()],
    'beach_set_0':[beach_set(0)],
    'beach_set_1':[beach_set(1)],
    'coastal_dune':[dune()],
    'park_bench':[bench()],
    'city_lantern':[lantern()],
    'flower_planter':[flower_box()],
    'pot':pot(),
    'civic_fountain':[fountain(water=True)],
    'courtyard_fountain':[fountain('courtyard_fountain',1.7,1.18)],
    'bistro_table':[bistro()],
    'cafe_counter':[cafe_counter()],
    'cafe_awning':[awning()],
    'jetty_board':[boardwalk('jetty_board',2.8,.43,.37)],
    'jetty_post_board':[boardwalk('jetty_post_board',2.8,.43,.37,True)],
    'bridge_board':[boardwalk('bridge_board',2.9,.46,.39)],
    'rice_clump':[crops()],
    'pigeon':pigeon(),
    'cat':cat(),
}
manifest=[]
for family,roots in families.items():
    for root in roots:
        for obj in [root,*root.children_recursive]:
            if obj.type!='MESH':continue
            bm=bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
            bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
            bm.to_mesh(obj.data)
            bm.free()
    lods=[]
    for root in roots:
        copy=root.copy()
        copy.name=root.name+'_lod'
        bpy.context.collection.objects.link(copy)
        if copy.type=='MESH':copy.data=root.data.copy()
        for child in root.children_recursive:
            child_copy=child.copy()
            child_copy.data=child.data.copy()
            child_copy.parent=copy
            bpy.context.collection.objects.link(child_copy)
        for obj in [copy,*copy.children_recursive]:
            if obj.type!='MESH' or len(obj.data.polygons)<100:continue
            modifier=obj.modifiers.new('Distant silhouette','DECIMATE')
            modifier.ratio=.22
            modifier.use_collapse_triangulate=True
            bpy.context.view_layer.objects.active=obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        lods.append(copy)
    bpy.ops.object.select_all(action='DESELECT')
    for root in roots+lods:
        root.select_set(True)
        for obj in root.children_recursive:obj.select_set(True)
    path=ROOT/'public/models/craft'/f'{family}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True)
    share_atlas(path)
    tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for r in roots for o in [r,*r.children_recursive] if o.type=='MESH')
    manifest.append({'family':family,'roots':[r.name for r in roots],'triangles':tris,'bytes':path.stat().st_size})
    print('CRAFT_EXPORTED',family,tris,flush=True)
    # Organise source objects into named collections, without moving their origins.
    col=bpy.data.collections.new(family)
    bpy.context.scene.collection.children.link(col)
    for root in roots+lods:
        for obj in [root,*root.children_recursive]:
            for current in list(obj.users_collection):current.objects.unlink(obj)
            col.objects.link(obj)
    for root in lods:
        root.hide_set(True)
        root.hide_render=True
out=ROOT/'output/art/model-craft'
out.mkdir(parents=True,exist_ok=True)
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
make_gallery(families)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/valencia-model-craft.blend'))
print('CRAFT_BUILD_COMPLETE',len(manifest),sum(m['triangles'] for m in manifest),flush=True)
