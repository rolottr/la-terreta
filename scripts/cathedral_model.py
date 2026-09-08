"""Original Valencia cathedral and Micalet model with complete exterior elevations."""
import bpy,math
from model_geometry import Builder,roof,M,material

def build_cathedral():
 b=Builder('cathedral')
 def arch(cx,cy,base,w,straight,angle=0,door=False):
  start=len(b.v)
  # Dark recessed opening with a curved head and stepped stone frame.
  shape=[(-w/2,0,base),(w/2,0,base)]
  for k in range(17):
   a=k*math.pi/16;shape.append((math.cos(a)*w/2,0,base+straight+math.sin(a)*w/2))
  b.poly(shape,[tuple(range(len(shape)))],13 if door else 16)
  for side in [-1,1]:
   b.box(side*(w/2+.095),-.03,base+straight/2,.19,.23,straight,4)
   b.box(side*(w/2+.11),-.05,base+.12,.28,.30,.24,5)
  for k in range(16):
   a=k*math.pi/16;aa=(k+1)*math.pi/16;b.beam((math.cos(a)*(w/2+.095),-.05,base+straight+math.sin(a)*(w/2+.095)),(math.cos(aa)*(w/2+.095),-.05,base+straight+math.sin(aa)*(w/2+.095)),.095,4,7)
  if door:
   for xx in [-w*.33,-w*.11,w*.11,w*.33]:b.box(xx,-.08,base+straight*.48,.055,.08,straight*.85,14)
   for xx in [-.13,.13]:b.sphere(xx,-.14,base+1.0,.06,19,n=8,rings=4)
  else:
   b.box(0,-.07,base+straight*.53,.065,.10,straight,4)
   b.box(0,-.08,base+straight*.35,w,.10,.07,4)
  c,s=math.cos(angle),math.sin(angle)
  for i in range(start,len(b.v)):
   x,y,z=b.v[i];b.v[i]=(cx+x*c-y*s,cy+x*s+y*c,z)
 # Octagonal Micalet, with complete stone courses and bell openings.
 b.beam((0,0,.15),(0,0,18.0),3.2,5,8)
 block=len(M);M.append(material('cathedral masonry block','cfb184'))
 for face in range(8):
  a=math.pi/8+face*math.tau/8
  for row in range(31):
   for col in range(4):
    t=(col-1.5)*.60;x=math.cos(a)*2.978-math.sin(a)*t;y=math.sin(a)*2.978+math.cos(a)*t
    b.box(x,y,.64+row*.55,.58,.035,.52,block,a+math.pi/2)
 for z,r,h in [(.3,3.48,.5),(1.0,3.30,.18),(7,3.34,.28),(13.2,3.40,.32),(17.5,3.45,.45)]:b.beam((0,0,z),(0,0,z+h),r,4,8)
 for j in range(8):
  a=math.pi/8+j*math.tau/8;cx=math.cos(a)*3.055;cy=math.sin(a)*3.055
  arch(cx,cy,13.95,1.3,1.75,a+math.pi/2)
  arch(cx,cy,9.1,.68,1.45,a+math.pi/2)
 # The Micalet has a stone bell gable above an open octagonal terrace.
 b.beam((0,0,18.0),(0,0,18.22),3.3,4,8)
 for j in range(16):
  a=j*math.tau/16;aa=(j+1)*math.tau/16
  b.beam((3.05*math.cos(a),3.05*math.sin(a),18.24),(3.05*math.cos(a),3.05*math.sin(a),18.78),.028,15,6)
  b.beam((3.05*math.cos(a),3.05*math.sin(a),18.78),(3.05*math.cos(aa),3.05*math.sin(aa),18.78),.03,15,6)
 for x in [-1.10,1.10]:
  b.box(x,0,19.65,.42,.90,2.9,5);b.box(x,0,18.40,.70,1.10,.28,4);b.box(x,0,20.92,.66,1.1,.25,4)
 for k in range(20):
  a=k*math.pi/20;aa=(k+1)*math.pi/20;b.beam((1.12*math.cos(a),0,20.9+1.12*math.sin(a)),(1.12*math.cos(aa),0,20.9+1.12*math.sin(aa)),.23,4,10)
 b.box(0,0,22.10,1.4,1.05,.28,5)
 for x in [-.40,.40]:b.box(x,0,22.5,.20,.70,.70,4)
 for k in range(12):
  a=k*math.pi/12;aa=(k+1)*math.pi/12;b.beam((.4*math.cos(a),0,22.80+.4*math.sin(a)),(.4*math.cos(aa),0,22.80+.4*math.sin(aa)),.13,4,8)
 b.beam((0,0,20.45),(0,0,21.02),.055,15,8);b.sphere(0,0,19.88,.66,19,sx=.85,sy=.65,sz=1,n=12,rings=6);b.beam((0,0,19.25),(0,0,19.4),.62,19,16)
 b.beam((0,0,23.10),(0,0,23.80),.06,15,8);b.beam((-.23,0,23.55),(.23,0,23.55),.05,15,8)
 # Nave mass, plinth and continuous eaves.
 b.box(7,2,3.5,10,11,7,2)
 for z,h in [(.3,.55),(.82,.18),(6.7,.22),(7.02,.25)]:b.box(7,2,z,10.45,11.4,h,4 if z>1 else 5)
 # A clear front portal and rose window.
 arch(7,-3.63,.1,2.4,2.4,0,True)
 for side in [-1,1]:b.box(7+side*1.65,-3.75,1.8,.28,.5,3.5,5)
 for k in range(18):
  a=k*math.pi/18;aa=(k+1)*math.pi/18;b.beam((7+1.68*math.cos(a),-3.82,2.5+1.68*math.sin(a)),(7+1.68*math.cos(aa),-3.82,2.5+1.68*math.sin(aa)),.14,5,8)
 b.beam((7,-3.67,5.55),(7,-3.84,5.55),.97,4,40);b.beam((7,-3.85,5.55),(7,-3.89,5.55),.77,16,40)
 for j in range(12):
  a=j*math.tau/12;aa=(j+1)*math.tau/12
  b.poly([(7,-3.915,5.55),(7+.69*math.sin(a),-3.915,5.55+.69*math.cos(a)),(7+.69*math.sin(aa),-3.915,5.55+.69*math.cos(aa))],[(0,2,1)],10 if j%3 else 20)
  b.beam((7,-3.94,5.55),(7+.75*math.sin(a),-3.94,5.55+.75*math.cos(a)),.028,4,6)
 b.beam((7,-3.97,5.55),(7,-4.02,5.55),.18,4,16)
 for x in [3.45,10.55]:arch(x,-3.60,1.5,1.1,2.45)
 # Both flanks have framed arched windows and three-dimensional stepped buttresses.
 for side in [-1,1]:
  xx=7+side*5.08
  for y in [-1.8,1.8,5.4]:arch(xx,y,1.5,1.15,2.8,side*math.pi/2)
  for y in [-3.0,.1,3.3,6.9]:
   b.box(7+side*5.48,y,1.05,1.15,.70,2.1,5)
   b.box(7+side*5.32,y,3.0,.80,.61,2.0,4)
   b.box(7+side*5.16,y,5.0,.49,.48,2.0,5)
   b.box(7+side*5.15,y,6.12,.72,.65,.23,4)
 for x in [3.5,7,10.5]:arch(x,7.61,1.4,1.35,3.0,math.pi)
 # The tower/nave seam is a deliberate joined stone pier, with matching bands.
 for y in [-2.2,2.2]:
  b.box(2.6,y,3.45,.75,.7,6.7,5)
  for z in [.65,3.1,6.55]:b.box(2.6,y,z,1.05,1.0,.23,4)
 # Low transept chapels make the crossing explicit in the plan.
 for side in [-1,1]:
  cx=7+side*6
  b.box(cx,4.5,2.45,4,4,4.9,2);b.box(cx,4.5,.35,4.3,4.3,.45,5);b.box(cx,4.5,4.78,4.3,4.3,.24,4)
  arch(cx+side*2.08,4.5,1.05,1.4,2.0,side*math.pi/2)
  for y in [2.65,6.35]:b.box(cx+side*2.1,y,2.3,.30,.34,4.45,5)
  start=len(b.v);roof(b,4.65,4.65,4.94,False)
  for i in range(start,len(b.v)):
   x,y,z=b.v[i];b.v[i]=(x+cx,y+4.5,z)
 # Tiled roof; the full drum is visible above the roof, with a true upper dome.
 start=len(b.v);roof(b,11.4,12.4,7.16,False)
 for i in range(start,len(b.v)):
  x,y,z=b.v[i];b.v[i]=(x+7,y+2,z)
 b.beam((7,4.5,7.55),(7,4.5,10.25),2.72,4,24)
 for j in range(12):
  a=j*math.tau/12
  b.box(7+2.74*math.cos(a),4.5+2.74*math.sin(a),9.66,.30,.20,.8,5,a)
 b.beam((7,4.5,10.14),(7,4.5,10.35),2.85,4,32)
 def dome(a,p):return(7+2.6*math.cos(p)*math.cos(a),4.5+2.6*math.cos(p)*math.sin(a),10.35+2.6*math.sin(p))
 for j in range(32):
  a=j*math.tau/32;aa=(j+1)*math.tau/32
  for k in range(10):
   p=k*math.pi/20;pp=(k+1)*math.pi/20;b.poly([dome(a,p),dome(aa,p),dome(aa,pp),dome(a,pp)],[(0,1,2,3)],10)
 for j in range(12):
  a=j*math.tau/12
  for k in range(10):
   p=k*math.pi/20;pp=(k+1)*math.pi/20;b.beam(dome(a,p),dome(a,pp),.045,4,7)
 b.beam((7,4.5,12.9),(7,4.5,13.65),.1,19,10);b.sphere(7,4.5,13.7,.15,19,n=10,rings=5)
 return b

def replace_cathedral(roots):
 old=next(o for o in roots if o.name=='cathedral');index=roots.index(old);bpy.data.objects.remove(old,do_unlink=True);o=build_cathedral().finish();o.name='cathedral';roots[index]=o
