"""Export only activity props and editable IK guide animation using the village palette.
Blender --background --python scripts/build_activity_assets.py
"""
import bpy,math,random,sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from model_geometry import Builder
random.seed(7092026)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
out=ROOT/'public/models/activities';out.mkdir(parents=True,exist_ok=True)
def group(name):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o
def export(root,name):
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in root.children_recursive:o.select_set(True)
 bpy.context.view_layer.objects.active=root
 bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),use_selection=True,export_format='GLB',export_animations=True,export_extras=True)
tree=group('Picking_tree')
b=Builder('Low_trunk_and_leaves');b.beam((0,0,0),(.03,0,1.7),.12,13,9,.065)
for k in range(7):
 a=k*2.4;c=(math.cos(a)*.57,math.sin(a)*.57,1.95+(k%3)*.15)
 b.beam((0,0,1.1),c,.045,13,6,.02);b.sphere(*c,.47,23+k%2,sx=1.1,sy=1.1,sz=.8,n=12,rings=6)
 for j in range(40):
  phi=random.random()*math.tau;v=random.uniform(-1,1);r=random.random()**.33*.6
  b.leaf((c[0]+math.cos(phi)*r,c[1]+math.sin(phi)*r,c[2]+v*r*.6),.13+random.random()*.08,22+(j+k)%4,phi,.2)
b.finish().parent=tree
# Fruit is a separate node. It sits at 1.42 m at the front of each low tree.
b=Builder('Removable_orange');b.sphere(0,0,0,.105,29,n=12,rings=8);b.beam((0,0,.085),(0,0,.13),.015,13,6);b.leaf((.045,0,.13),.07,23,.3,.2)
fruit=b.finish();fruit.parent=tree;fruit.location=(0,-.81,1.42);fruit['removable']=True
export(tree,'picking-tree')
basket=group('Harvest_basket');b=Builder('Woven_basket')
for level in range(8):
 h=.045+level*.035;r=.26+level*.009
 for k in range(32):
  a=k*math.tau/32;c=(k+1)*math.tau/32;b.beam((math.cos(a)*r,math.sin(a)*r,h),(math.cos(c)*r,math.sin(c)*r,h),.018,14 if level%2 else 13,5)
for k in range(16):
 a=k*math.tau/16;b.beam((math.cos(a)*.25,math.sin(a)*.25,.02),(math.cos(a)*.33,math.sin(a)*.33,.32),.018,14,5)
b.box(0,0,.025,.48,.48,.04,14);b.finish().parent=basket;export(basket,'basket')
station=group('Festival_box');b=Builder('Painted_festival_box');b.box(0,0,.28,.65,.5,.56,11);b.box(0,0,.58,.72,.57,.07,21)
for x in [-.18,0,.18]:b.beam((x,0,.62),(x,0,.78),.035,20,8)
b.finish().parent=station;export(station,'festival-box')
cracker=group('Player_firecracker');b=Builder('Red_paper');b.beam((0,0,-.065),(0,0,.065),.035,20,8);b.beam((0,0,.065),(.01,0,.10),.009,14,6);b.finish().parent=cracker;export(cracker,'firecracker')
# A Blender-authored hand target in explorer local space, shared by both rigs.
guide=group('Throw_guide');hand=group('Throw_hand');hand.parent=guide
for frame,p in [(0,(.30,-.2,1.03)),(18,(.30,.33,1.51)),(30,(.30,-.61,1.16)),(45,(.30,-.22,.94))]:
 hand.location=p;hand.keyframe_insert(data_path='location',frame=frame)
hand.animation_data.action.name='Player_throw_hand';bpy.context.scene.render.fps=30;bpy.context.scene.frame_start=0;bpy.context.scene.frame_end=45
export(guide,'throw-guide')
bpy.context.scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/valencian-activities.blend'))
print('Exported five affected activity assets; kept separate orange and editable throw target.')
