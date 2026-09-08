"""Rebuild the city additions without rebuilding the unchanged landmark library.
Run apply_materials.py -- --landmarks-only after this script.
"""
import bpy,math,os,sys
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.join(ROOT,'scripts'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'assets/valencia-landmarks.blend'))
roots=[o for o in bpy.context.scene.objects if o.type=='MESH']
exec(compile(open(os.path.join(ROOT,'scripts/city_expansion.py')).read(),'city_expansion.py','exec'))
from science_architecture import install_science
install_science(roots)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/valencia-landmarks.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models/landmarks.glb'),export_format='GLB',use_selection=True,export_apply=True)
print('CITY_EXPANSION_COMPLETE',flush=True)
