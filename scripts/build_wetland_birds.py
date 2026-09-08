"""Additional native Albufera birds; Blender --background --python this_file.
Species reference: https://albufera.valencia.es/es/con%C3%B3cela/habitantes
"""
from pathlib import Path
# Reuse the wetland modelling primitives without rebuilding the boat or ducks.
source = Path(__file__).with_name('build_wetland.py').read_text()
exec(compile(source.split("start('Albuferenc')")[0], __file__, 'exec'))
white=mat('Egret white',(.88,.89,.84));slate=mat('Heron slate',(.30,.35,.39));soot=mat('Coot charcoal',(.025,.032,.035));legs=mat('Wading legs',(.18,.16,.08))
for species in ['coot','egret','heron']:
 start(species)
 if species=='coot':
  ball('Body',(0,.16,0),(.16,.16,.28),soot)
  ball('Neck',(0,.28,.18),(.075,.13,.08),soot)
  ball('Head',(0,.39,.23),(.09,.095,.10),soot)
  ball('White forehead',(0,.435,.306),(.042,.06,.02),white)
  ball('Ivory bill',(0,.375,.34),(.04,.025,.09),white)
  for side in [-1,1]:
   ball('Eye',(side*.08,.414,.26),(.013,.014,.013),red)
   for i in range(5):ball('Wing feather',(side*.145,.20-i*.014,-.06-i*.024),(.026,.035,.13),soot)
 else:
  m=white if species=='egret' else slate
  scale=1 if species=='egret' else 1.3
  ball('Body',(0,.48,0),(.13,.19,.27),m)
  tube('Folded neck',[(0,.57,.13),(0,.72,.02),(0,.84,.13),(0,.94,.19)],.055,white)
  ball('Head',(0,.95,.20),(.065,.08,.11),white)
  tube('Pointed bill',[(0,.946,.28),(0,.934,.48)],.016,yellow if species=='heron' else black)
  for side in [-1,1]:
   ball('Eye',(side*.055,.973,.24),(.012,.013,.012),yellow)
   for i in range(5):ball('Wing feather',(side*.11,.49-i*.014,-.06-i*.026),(.029,.05,.16),m)
   tube('Leg',[(side*.063,.39,-.03),(side*.063,.19,.01),(side*.063,.015,.06)],.013,legs)
   for toe in [-1,0,1]:tube('Toe',[(side*.063,.018,.06),(side*.063+toe*.04,.009,.15)],.007,yellow)
  for o in root.children_recursive:
   o.location*=scale;o.scale*=scale
 export(species,((['coot','egret','heron'].index(species)-1)*1.8,0,0))
# A compact studio scene makes the editable source easy to inspect.
bpy.ops.object.light_add(type='AREA',location=(1,-3,5));bpy.context.object.data.energy=500;bpy.context.object.data.size=5
bpy.ops.object.camera_add(location=(3,-6,3));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.5))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=6
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=1000;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.world.color=(.3,.3,.3);scene.render.image_settings.file_format='PNG';scene.render.filepath=str(REF/'native-birds.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/albufera-native-birds.blend'))
bpy.ops.render.render(write_still=True)
