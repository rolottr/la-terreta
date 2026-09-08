"""Export lighter distant meshes without changing the reviewed source assets."""
import bpy,bmesh,os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'assets/valencia-village.blend'))
for obj in list(bpy.data.objects):
 if obj.type!='MESH':continue
 if obj.name=='orange_tree':
  # Individual leaves are below one pixel in globe view. Keep the canopy
  # volumes, fruit, trunk and branches instead of thousands of loose faces.
  mesh=bmesh.new();mesh.from_mesh(obj.data);seen=set();remove=[]
  for vertex in mesh.verts:
   if vertex in seen:continue
   component=[];pending=[vertex];seen.add(vertex)
   while pending:
    current=pending.pop();component.append(current)
    for edge in current.link_edges:
     other=edge.other_vert(current)
     if other not in seen:seen.add(other);pending.append(other)
   if len(component)==5:remove.extend(component)
  bmesh.ops.delete(mesh,geom=remove,context='VERTS')
  bmesh.ops.remove_doubles(mesh,verts=list(mesh.verts),dist=.00001)
  bmesh.ops.dissolve_degenerate(mesh,edges=list(mesh.edges),dist=.00001)
  mesh.normal_update();mesh.to_mesh(obj.data);mesh.free();obj.data.validate();obj.data.update();obj.update_tag();bpy.context.view_layer.update()
 bpy.context.view_layer.objects.active=obj;bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
 mod=obj.modifiers.new('Globe distance detail','DECIMATE');mod.ratio=.12 if obj.name=='orange_tree'else .20 if obj.name in ['cypress','palm']else .28;mod.use_collapse_triangulate=True;bpy.context.view_layer.update();print('LOD_INPUT',repr(obj.name),mod.ratio,len(obj.data.polygons));bpy.ops.object.modifier_apply(modifier=mod.name);print('LOD_OUTPUT',obj.name,len(obj.data.polygons))
 if obj.name=='orange_tree':obj.data.validate();obj.data.update()
 obj.name+='_lod'
 obj.data.name=obj.name
for m in bpy.data.materials:
 if not m.use_nodes:continue
 bs=m.node_tree.nodes.get('Principled BSDF')
 if bs:
  for link in list(bs.inputs['Base Color'].links):m.node_tree.links.remove(link)
  bs.inputs['Base Color'].default_value=m.diffuse_color
  for link in list(bs.inputs['Normal'].links):m.node_tree.links.remove(link)
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models/village-lod.glb'),export_format='GLB',use_selection=True,export_apply=True)
print('LOD_EXPORTED',[(o.name,len(o.data.polygons))for o in bpy.data.objects if o.type=='MESH'])
