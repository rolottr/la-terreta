"""Create a separate editable gallery from the exact exported game models."""
import bpy,math,os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for name in ['landmarks','village']:bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'public/models',name+'.glb'))
names=['serranos','cathedral','townhall','station','bullring','hemisferic','museum','aqua','university','barraca','cafe','townhouse','apartment','cottage','orange_tree','cypress','palm']
for i,name in enumerate(names):
 o=bpy.data.objects[name];o.location=((i%5)*38,(i//5)*34,0)
 bpy.ops.object.text_add(location=(o.location.x,o.location.y-12,.05));t=bpy.context.object;t.data.body=name.replace('_',' ').upper();t.data.align_x='CENTER';t.data.size=.9
bpy.ops.mesh.primitive_plane_add(size=240,location=(76,50,-.15));floor=bpy.context.object;floor.name='Gallery floor'
m=bpy.data.materials.new('Gallery floor');m.diffuse_color=(.32,.39,.34,1);floor.data.materials.append(m)
bpy.ops.object.light_add(type='AREA',location=(40,-30,120));bpy.context.object.data.energy=140000;bpy.context.object.data.size=80
bpy.ops.object.camera_add(location=(150,-150,165));camera=bpy.context.object;camera.rotation_euler=(Vector((72,42,3))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=215;bpy.context.scene.camera=camera
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
for image in bpy.data.images:
 if image.source=='FILE':image.pack()
bpy.ops.object.select_all(action='DESELECT');bpy.data.objects['serranos'].select_set(True);bpy.context.view_layer.objects.active=bpy.data.objects['serranos']
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/valencia-model-gallery.blend'))
print('GALLERY_SAVED',len(names))
