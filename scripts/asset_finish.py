"""Window variation, a clear mall entrance, rooftop plant and arena sand."""
import bpy,math
from model_geometry import Builder,M,material

def finish_assets(roots):
 def attach(name,b,texts=[]):
  root=next(o for o in roots if o.name==name);detail=b.finish();bpy.ops.object.select_all(action='DESELECT');root.select_set(True);detail.select_set(True)
  for o in texts:o.select_set(True)
  bpy.context.view_layer.objects.active=root;bpy.ops.object.join()
 sand=len(M);M.append(material('arena sand','d4b582',.95))
 b=Builder('arena_sand');b.beam((0,0,.185),(0,0,.205),6.12,sand,96);attach('bullring',b)
 shades=[]
 for i,c in enumerate(['3a7382','407b8b','447f8d','538895','396f7d']):shades.append(len(M));M.append(material('office glass '+str(i),c,.22,.12))
 b=Builder('aqua_finish')
 # Individually tinted panels follow the real oval office facade.
 ox,oy,rx,ry=3.55,.72,3.77,3.05;segments=32
 for face in range(segments):
  a=face*math.tau/segments;aa=(face+1)*math.tau/segments
  for row in range(20):
   z0=4.83+row*.84;z1=z0+.73
   points=[(ox+rx*math.cos(a),oy+ry*math.sin(a),z0),(ox+rx*math.cos(aa),oy+ry*math.sin(aa),z0),(ox+rx*math.cos(aa),oy+ry*math.sin(aa),z1),(ox+rx*math.cos(a),oy+ry*math.sin(a),z1)]
   b.poly(points,[(0,1,2,3)],shades[(row*7+face*3)%5])
 # A legible entrance with doors, handles, supported canopy and the name above.
 for x in [-.68,.68]:
  b.box(x,-5.18,1.62,1.26,.12,3.15,17);b.box(x,-5.28,1.62,1.08,.08,2.94,16)
  b.beam((x+(.32 if x<0 else -.32),-5.37,1.25),(x+(.32 if x<0 else -.32),-5.37,1.9),.025,19,8)
 b.box(0,-6.0,3.43,5.5,2.0,.18,15)
 for side in [-1,1]:b.beam((side*2.55,-6.65,.2),(side*2.55,-6.65,3.38),.085,4,10)
 b.box(0,-5.29,4.23,4.3,.17,.48,10)
 bpy.ops.object.text_add(location=(0,-5.40,4.23),rotation=(math.pi/2,0,0));t=bpy.context.object;t.data.body='AQUA';t.data.align_x='CENTER';t.data.align_y='CENTER';t.data.size=.38;t.data.extrude=.01;t.data.materials.append(M[4]);bpy.ops.object.convert(target='MESH')
 # Two guarded fans identify the office crown as working rooftop equipment.
 for cx in [2.75,4.35]:
  b.beam((cx,.72,23.20),(cx,.72,23.30),.55,4,24);b.beam((cx,.72,23.305),(cx,.72,23.33),.44,15,24)
  for j in range(6):
   a=j*math.tau/6;b.box(cx+.21*math.cos(a),.72+.21*math.sin(a),23.355,.42,.085,.026,12,a+.35)
  for a in [0,math.pi/2]:b.box(cx,.72,23.39,.93,.032,.03,4,a)
 attach('aqua',b,[t])
