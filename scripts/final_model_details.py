"""Final arena portals and commercial skylight details."""
import bpy,math
from model_geometry import Builder,M

def add_final_details(roots):
 def attach(name,b,texts=[]):
  root=next(o for o in roots if o.name==name);detail=b.finish();bpy.ops.object.select_all(action='DESELECT');root.select_set(True);detail.select_set(True)
  for o in texts:o.select_set(True)
  bpy.context.view_layer.objects.active=root;bpy.ops.object.join()
 b=Builder('bullring_access')
 for angle in [0,math.pi/2,math.pi,math.pi*1.5]:
  start=len(b.v)
  for side in [-1,1]:
   b.box(side*1.20,-9.55,1.33,.44,1.15,2.55,5);b.box(side*1.20,-9.55,.23,.65,1.35,.32,4)
  for j in range(18):
   a=j*math.pi/18;aa=(j+1)*math.pi/18;b.beam((1.20*math.cos(a),-10.05,2.4+1.20*math.sin(a)),(1.20*math.cos(aa),-10.05,2.4+1.20*math.sin(aa)),.22,4,8)
  b.box(0,-9.64,1.48,1.94,.12,2.90,13)
  for j in range(9):b.box(-.84+j*.21,-9.74,1.52,.035,.07,2.6,19)
  for z in [.45,2.60]:b.box(0,-9.8,z,1.85,.08,.065,19)
  b.box(0,-9.68,3.78,3.12,.92,.20,7);b.box(0,-10.18,3.50,2.45,.10,.48,10)
  c,s=math.cos(angle),math.sin(angle)
  for i in range(start,len(b.v)):
   x,y,z=b.v[i];b.v[i]=(x*c-y*s,x*s+y*c,z)
 # Seat blocks make the depth of the inner tiers visible in the angled view.
 for r,z in [(7.1,1.06),(7.66,1.5),(8.22,1.94)]:
  for j in range(72):
   a=j*math.tau/72;b.box(r*math.cos(a),r*math.sin(a),z+.055,.43,.22,.09,7 if j%3 else 5,a+math.pi/2)
 texts=[]
 for angle in [0,math.pi]:
  bpy.ops.object.text_add(location=(0,-10.25 if angle==0 else 10.25,3.5),rotation=(math.pi/2,0,angle));t=bpy.context.object;t.data.body='PLAÇA DE BOUS';t.data.align_x='CENTER';t.data.align_y='CENTER';t.data.size=.26;t.data.extrude=.009;t.data.materials.append(M[4]);bpy.ops.object.convert(target='MESH');texts.append(t)
 attach('bullring',b,texts)
 b=Builder('aqua_skylight')
 # A sealed glass lantern with a raised frame makes the roof recess explicit.
 for i in range(5):
  for j in range(4):
   x=-7.5+(i+.5)*1.1;y=-2.2+(j+.5)*1.1;b.box(x,y,5.03,1.06,1.06,.10,17 if (i+j)%3 else 16)
 for i in range(6):b.box(-7.5+i*1.1,0,5.13,.07,4.6,.10,4)
 for j in range(5):b.box(-4.75,-2.2+j*1.1,5.13,5.65,.07,.10,4)
 for side in [-1,1]:b.box(-4.75,side*2.4,5.13,5.8,.16,.25,4)
 for x in [-7.65,-1.85]:b.box(x,0,5.13,.16,4.95,.25,4)
 attach('aqua',b)
