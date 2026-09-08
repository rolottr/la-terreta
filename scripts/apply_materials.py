"""Apply the original painted atlas with explicit UVs to the game assets.

The Mix Multiply nodes export as glTF base-color texture plus color factor.
The UV map selects one atlas region, so no extra image files are needed.
"""
import bpy, os, sys
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
texture=os.path.join(ROOT,'public/textures/valencia-painted-atlas.png')

def region(name):
 name=name.lower()
 if any(w in name for w in ['glass','ceramic','leaf','flower','orange','lemon','brass','iron','blue','gold','awning']) or name=='valencia red':return None
 if 'arena sand' in name:return (0,.5)
 if 'plaster' in name or 'white' in name or 'ivory' in name or 'trim' in name:return (0,.5)
 if 'clay' in name or 'tile' in name:return (.5,0)
 if any(w in name for w in ['wood','walnut','grain','thatch','shutter']):return (0,0)
 if 'block' in name:return (0,.5) # Geometry already supplies the masonry joints.
 if any(w in name for w in ['stone','limestone']):return (.5,.5)
 return None

for kind,file in [('landmarks','valencia-landmarks.blend'),('village','valencia-village.blend')]:
 if '--landmarks-only' in sys.argv and kind != 'landmarks':continue
 bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'assets',file))
 image=bpy.data.images.load(texture,check_existing=True);image.pack()
 for m in bpy.data.materials:
  if region(m.name) is None:continue
  m.use_nodes=True;nodes=m.node_tree.nodes;links=m.node_tree.links;bs=nodes.get('Principled BSDF')
  if not bs:continue
  tint=tuple(bs.inputs['Base Color'].default_value)
  tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='EXTEND';tex.interpolation='Linear';tex.label='Original painted Valencia atlas'
  uvnode=nodes.new('ShaderNodeUVMap');uvnode.uv_map='UVMap';links.new(uvnode.outputs['UV'],tex.inputs['Vector'])
  multiply=nodes.new('ShaderNodeMix');multiply.data_type='RGBA';multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1.;multiply.inputs[6].default_value=tint
  links.new(tex.outputs['Color'],multiply.inputs[7]);links.new(multiply.outputs[2],bs.inputs['Base Color'])
  for link in list(bs.inputs['Normal'].links):links.remove(link)
 for o in bpy.data.objects:
  if o.type!='MESH':continue
  me=o.data;uv=me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap');uv.active_render=True;me.uv_layers.active=uv
  points=[v.co for v in me.vertices];lo=[min(v[i]for v in points)for i in range(3)];hi=[max(v[i]for v in points)for i in range(3)]
  for poly in me.polygons:
   m=me.materials[poly.material_index] if poly.material_index<len(me.materials)else None
   r=region(m.name)if m else None
   if r is None:continue
   n=poly.normal;axis=max(range(3),key=lambda i:abs(n[i]));axes=[i for i in range(3)if i!=axis]
   for loop in poly.loop_indices:
    v=me.vertices[me.loops[loop].vertex_index].co
    coords=[(v[a]-lo[a])/max(.01,hi[a]-lo[a])for a in axes]
    uv.data[loop].uv=(r[0]+.003+coords[0]*.494,r[1]+.003+coords[1]*.494)
 bpy.ops.object.select_all(action='SELECT')
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets',file))
 bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models',kind+'.glb'),export_format='GLB',use_selection=True,export_apply=True)
 print('PAINTED',kind,flush=True)
