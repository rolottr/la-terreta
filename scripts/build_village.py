"""Original detailed Valencia street and plant assets, built and exported in Blender."""
import bpy, math, os, random
from mathutils import Vector, Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(3602026)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

import sys
sys.path.insert(0,os.path.join(ROOT,'scripts'))
from model_geometry import Builder, building, window, roof, M, cottage_builder

roots=[building('cafe',0),building('townhouse',1),building('apartment',2)]
roots.append(cottage_builder().finish())

b=Builder('orange_tree');b.beam((0,0,0),(.1,.03,3.0),.20,13,9,.10)
for k in range(12):
 a=k*2.4;radius=1.25 if k>2 else .55;center=(math.cos(a)*radius,math.sin(a)*radius,3.2+(k%4)*.40)
 b.beam((.1,0,1.8),center,.075,13,6,.028)
 b.sphere(*center,.76,23+k%2,sx=1.1,sy=1.1,sz=.8,n=12,rings=6)
 for j in range(75):
  phi=random.random()*math.tau;v=random.uniform(-1,1);r=random.random()**.33*1.1
  p=(center[0]+math.cos(phi)*math.sqrt(1-v*v)*r,center[1]+math.sin(phi)*math.sqrt(1-v*v)*r,center[2]+v*r*.75)
  b.leaf(p,.23+random.random()*.12,22+(j+k)%4,random.random()*math.tau,random.uniform(-.65,.65))
 for j in range(4):
  a=j*2.4+k;b.sphere(center[0]+math.sin(a)*.78,center[1]+math.cos(a)*.78,center[2]-.20,.13,29,n=7,rings=4)
roots.append(b.finish())
b=Builder('cypress');b.beam((0,0,0),(0,0,6.6),.17,13,8,.035)
for j in range(720):
 z=random.uniform(1.1,6.9);rad=(1-(z-1.1)/6)*.85+.1;a=j*2.39996;r=rad*math.sqrt(random.random())
 b.leaf((math.cos(a)*r,math.sin(a)*r,z),.19,22+j%3,a,1.4)
roots.append(b.finish())
b=Builder('palm')
for j in range(20):b.beam((.05*math.sin(j*.1),0,j*.29),(.05*math.sin((j+1)*.1),0,(j+1)*.29),.19-j*.002,13 if j%2 else 14,9)
for k in range(13):
 a=k*2.39996
 for j in range(9):
  r=j*.38;rr=(j+1)*.38;z=5.8+math.sin(j/9*math.pi)*.8-j*.12;zz=5.8+math.sin((j+1)/9*math.pi)*.8-(j+1)*.12
  b.beam((math.cos(a)*r,math.sin(a)*r,z),(math.cos(a)*rr,math.sin(a)*rr,zz),.032,23,5)
  for side in [-1,1]:
   px=math.cos(a)*rr+math.cos(a+side*math.pi/2)*(.6-j*.05);py=math.sin(a)*rr+math.sin(a+side*math.pi/2)*(.6-j*.05)
   b.poly([(math.cos(a)*r,math.sin(a)*r,z),(px,py,zz-.2),(math.cos(a)*rr,math.sin(a)*rr,zz)],[(0,1,2)],23+k%3)
roots.append(b.finish())
# Fixed named meshes at local origin; the game positions them on the sphere.
bpy.ops.object.select_all(action='DESELECT')
for o in roots:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models/village.glb'),export_format='GLB',use_selection=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets/valencia-village.blend'))
print('VILLAGE',[(o.name,len(o.data.polygons))for o in roots])
