"""Build a separate, editable Blender inspection scene using the export geometry."""
import bpy
from mathutils import Vector

def make_gallery(families):
    source=bpy.context.scene
    source.name='Asset sources - local origins'
    scene=bpy.data.scenes.new('Model craft gallery')
    gallery=bpy.data.collections.new('Gallery display copies')
    scene.collection.children.link(gallery)
    for i,(family,roots) in enumerate(families.items()):
        shift=Vector(((i%4)*17,-(i//4)*8,0))
        copies={}
        for root in roots:
            for original in [root,*root.children_recursive]:
                copy=original.copy()
                copy.name='Display '+original.name
                gallery.objects.link(copy)
                copies[original]=copy
        for original,copy in copies.items():
            if original.parent in copies:copy.parent=copies[original.parent]
            else:copy.location+=shift
        data=bpy.data.curves.new(family+' label','FONT')
        data.body=family.replace('_',' ').upper()
        data.size=.35
        data.align_x='CENTER'
        text=bpy.data.objects.new(family+' label',data)
        text.location=shift+Vector((0,-2.6,.02))
        gallery.objects.link(text)
    scene.world=source.world
    bpy.context.window.scene=scene
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.region_3d.view_distance=62
            area.spaces.active.region_3d.view_location=(24,-15,0)
            area.spaces.active.region_3d.view_rotation=Vector((1,-1,1.1)).to_track_quat('Z','Y')
    return scene
