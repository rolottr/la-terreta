"""Update only science models, preserve every other landmark, and export the game GLB."""
import bpy, sys, json, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'scripts'))
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/valencia-landmarks.blend'))
from science_architecture import install_science
roots=[o for o in bpy.context.scene.objects if o.type=='MESH']
def signature(o):
    return hashlib.sha256(repr(([tuple(v.co) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons])).encode()).hexdigest()
science={'hemisferic','museum','palau_arts','agora','umbracle','oceanografic'}
before={o.name:signature(o) for o in roots if o.name not in science}
install_science(roots)
after={o.name:signature(o) for o in roots if o.name not in science}
assert before==after,'An unrelated landmark changed'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/science-campus-v2.blend'))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/valencia-landmarks.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/landmarks.glb'),export_format='GLB',use_selection=True,export_apply=True)
proof={'preserved_landmarks':before,'science_models':{o.name:{'vertices':len(o.data.vertices),'faces':len(o.data.polygons),'dimensions':list(o.dimensions)} for o in roots if o.name in science}}
(ROOT/'output/art/science-campus').mkdir(parents=True,exist_ok=True)
(ROOT/'output/art/science-campus/export-proof.json').write_text(json.dumps(proof,indent=2))
print('SCIENCE_CAMPUS_EXPORTED',json.dumps(proof),flush=True)
