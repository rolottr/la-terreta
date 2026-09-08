"""Visible structural connections for the Aqua entrance canopy."""
import bpy
from model_geometry import Builder

def add_aqua_supports(roots):
 b=Builder('aqua_canopy_supports')
 for x in [-2.48,2.48]:
  for y in [-6.72,-5.18]:
   b.box(x,y,1.75,.30,.30,3.42,4);b.box(x,y,.25,.46,.46,.25,5)
  b.box(x,-5.96,3.33,.24,1.8,.24,4)
  b.beam((x,-5.12,2.85),(x,-6.82,3.34),.10,4,8)
 for y in [-6.85,-5.12]:b.box(0,y,3.33,5.35,.26,.25,4)
 root=next(o for o in roots if o.name=='aqua');detail=b.finish();bpy.ops.object.select_all(action='DESELECT');root.select_set(True);detail.select_set(True);bpy.context.view_layer.objects.active=root;bpy.ops.object.join()
