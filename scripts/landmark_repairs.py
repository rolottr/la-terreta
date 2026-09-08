"""Complete La Nau and Aqua architecture. Run after the base landmark builders.
References: UV Patrimoni, Claustro Mayor; L35, Aqua Multiespacio.
The courtyard entrance stays open for the game's walking route.
"""
import bpy, bmesh, math, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model_geometry import Builder, M


def university():
    b = Builder('university')
    # Same footprint as the old building; full masonry around both galleries.
    for x in [-8, 8]:
        b.box(x, 0, 3.5, 4, 15, 7, 2)
    b.box(0, 5.6, 3.5, 18, 4, 7, 2)
    def column(x,y,z,h,ionic=False):
        b.box(x,y,z+.08,.62,.62,.16,5)
        for base,r,hh in [(z+.16,.28,.12),(z+.28,.24,.10),(z+h-.23,.29,.12)]:
            b.beam((x,y,base),(x,y,base+hh),r,4,24)
        b.beam((x,y,z+.36),(x,y,z+h-.23),.215,4,24,r2=.18)
        b.box(x,y,z+h-.06,.62,.64,.12,4)
        if ionic:
            for side in [-1,1]:
                # Volutes at the ends of each Ionic capital, bonded to its block.
                pts=[]
                for k in range(30):
                    a=k*math.pi*3/29;r=.105*(1-k/38)
                    pts.append((x+side*.21+r*math.cos(a),y-.25,z+h-.15+r*math.sin(a)))
                for a,c in zip(pts,pts[1:]):b.beam(a,c,.022,4,6)
    # Lower Doric order, upper Ionic gallery and continuous entablatures.
    for side in [-1,1]:
        for y in [-6.6,-4.7,-2.8,-.9,1,2.9]:
            column(side*5.85,y,.08,3.22)
            column(side*5.85,y,3.62,2.96,True)
        for z,h,w in [(3.39,.28,.85),(3.59,.13,1),(6.70,.28,.85),(6.91,.14,1.05)]:
            b.box(side*5.85,-1.8,z,w,11.25,h,4)
        for y in [-5.65,-3.75,-1.85,.05,1.95]:
            for j in range(7):
                b.beam((side*5.85,y-.67+j*.22,3.73),(side*5.85,y-.67+j*.22,4.38),.019,15,6)
            b.box(side*5.85,y,4.40,.10,1.84,.08,15)
    for x in [-5.85,-3.9,-1.95,0,1.95,3.9,5.85]:
        column(x,3.35,.08,3.22);column(x,3.35,3.62,2.96,True)
    for z,h,d in [(3.39,.28,.85),(3.59,.13,1),(6.70,.28,.85),(6.91,.14,1.05)]:
        b.box(0,3.35,z,12.55,d,h,4)
    for x in [-4.875,-2.925,-.975,.975,2.925,4.875]:
        for j in range(7):b.beam((x-.7+j*.23,3.35,3.73),(x-.7+j*.23,3.35,4.38),.019,15,6)
        b.box(x,3.35,4.4,1.93,.10,.08,15)
    # Framed timber windows, glazed transoms, iron grilles and carved sills.
    def window(x,y,z,angle,w=1,h=1.7):
        start=len(b.v)
        b.box(0,0,0,w+.28,.20,h+.3,4);b.box(0,-.12,0,w,.08,h,13)
        for side in [-1,1]:
            b.box(side*w*.25,-.17,.1,w*.42,.04,h*.78,16)
        b.box(0,-.2,0,.06,.07,h,4)
        for zz in [-h*.3,h*.2]:b.box(0,-.21,zz,w,.07,.045,4)
        b.box(0,-.14,-h/2-.16,w+.42,.44,.13,4)
        for j in range(7):b.beam((-w*.44+j*w*.88/6,-.27,-h*.48),(-w*.44+j*w*.88/6,-.27,-h*.13),.012,15,6)
        b.box(0,-.27,-h*.13,w,.04,.04,15)
        c,s=math.cos(angle),math.sin(angle)
        for i in range(start,len(b.v)):
            xx,yy,zz=b.v[i];b.v[i]=(x+xx*c-yy*s,y+xx*s+yy*c,z+zz)
    for side in [-1,1]:
        for y in [-5.8,-3.2,-.6,2,4.6,6.5]:
            for z in [1.75,5.2]:window(side*10.03,y,z,side*math.pi/2,.9,1.6)
        for y in [-5.6,-2.6,.4,2.6]:
            for z in [1.75,5.15]:window(side*6.02,y,z,-side*math.pi/2,.85,1.65)
        for x in [side*7,side*9]:
            for z in [1.75,5.15]:window(x,-7.53,z,0,.85,1.65)
    for x in [-4,-2,0,2,4]:
        for z in [1.75,5.15]:window(x,3.57,z,0,.85,1.65)
        for z in [1.75,5.15]:window(x,7.63,z,math.pi,.85,1.65)
    # Bonded quoins, base courses and cornices around all three wings.
    for x,y,w,d in [(-8,0,4,15),(8,0,4,15),(0,5.6,18,4)]:
        for z,hh,extra in [(.22,.35,.12),(.53,.10,.2),(3.48,.16,.15),(6.94,.20,.4)]:
            b.box(x,y,z,w+extra,d+extra,hh,4 if z>.5 else 5)
        for xx in [x-w/2+.14,x+w/2-.14]:
            for yy in [y-d/2+.03,y+d/2-.03]:
                for k in range(13):b.box(xx,yy,.85+k*.44,.38,.25,.22,4)
    # Roofs have sealed gables, soffits, tile courses and gutters.
    def roof(x,y,w,d):
        z=7.04;ridge=8.12
        b.poly([(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x+w/2,y+d/2,z),(x-w/2,y+d/2,z),(x-w/2,y,ridge),(x+w/2,y,ridge)],[(0,1,5,4),(4,5,2,3),(0,4,3),(1,2,5),(0,3,2,1)],7)
        for side in [-1,1]:
            b.box(x,y+side*d/2,z-.04,w,.22,.20,4)
            for row in range(16):
                yy=y+side*d*.5*(1-row/16);zz=z+(ridge-z)*row/16
                for col in range(round(w/.30)):
                    xx=x-w/2+.15+col*.30
                    b.beam((xx,yy,zz+.055),(xx,yy-side*d/32,zz+(ridge-z)/16+.055),.073,[7,8,9][(col+row)%3],8)
        for i in range(round(w/.3)):b.beam((x-w/2+i*.3,y,ridge+.07),(x-w/2+(i+1)*.3,y,ridge+.07),.115,8,10)
    roof(-8,0,4.5,15.5);roof(8,0,4.5,15.5);roof(0,5.6,12,4.5)
    # Luis Vives monument, centred in the open courtyard.
    b.box(0,-.8,.15,1.55,1.55,.30,5);b.box(0,-.8,.42,1.2,1.2,.25,4)
    b.box(0,-.8,1.04,.83,.83,1.0,5);b.box(0,-.8,1.60,1.08,1.08,.16,4)
    b.beam((0,-.8,1.68),(0,-.8,2.60),.32,15,18,r2=.22)
    b.sphere(0,-.8,2.84,.18,15,sx=.85,sy=.86,sz=1.2,n=20,rings=12)
    for side in [-1,1]:
        b.beam((side*.20,-.8,2.48),(side*.34,-.95,2.16),.075,15,12)
        b.beam((side*.34,-.95,2.16),(side*.16,-1.10,2.23),.06,15,12)
    b.box(0,-1.11,2.23,.38,.20,.08,15)
    return b.finish()


def repair_landmarks(roots):
    old=next(o for o in roots if o.name=='university');roots.remove(old);bpy.data.objects.remove(old,do_unlink=True)
    roots.append(university())
    aqua=next(o for o in roots if o.name=='aqua')
    # Remove the two old rectangular side plates from existing saved models.
    # Their rear corners stood outside the tapered podium footprint.
    bm=bmesh.new();bm.from_mesh(aqua.data)
    obsolete=[v for v in bm.verts if any(abs(abs(v.co.x)-x)<.0001 for x in [9.08,9.28])
              and any(abs(v.co.y-y)<.0001 for y in [-5,3])
              and any(abs(v.co.z-z)<.0001 for z in [.05,4.65])]
    bmesh.ops.delete(bm,geom=obsolete,context='VERTS');bm.to_mesh(aqua.data);bm.free()
    if aqua.get('structure_version') != 1:
        # Add complete cladding to the tapered podium sides. No free box strips.
        b=Builder('aqua_structure')
        podium=[(-9.2,-5.1),(9.2,-5.1),(8.55,2.9),(3.7,5.25),(-6.9,4.5)]
        for i in range(1,len(podium)):
            x,y=podium[i];xx,yy=podium[(i+1)%len(podium)];length=math.hypot(xx-x,yy-y);a=math.atan2(yy-y,xx-x)
            for z in [.18,1.05,1.94,2.83,3.72,4.70]:b.box((x+xx)/2,(y+yy)/2,z,length+.08,.26,.16,4,a)
            for j in range(max(2,int(length/.85))):
                f=(j+.5)/max(2,int(length/.85));cx=x+(xx-x)*f;cy=y+(yy-y)*f
                for row in range(5):b.box(cx,cy,.61+row*.89,.64,.13,.61,16 if j%3 else 17,a)
                b.box(cx,cy,2.40,.055,.19,4.54,15,a)
        # The rectangular hotel roof previously projected beyond its bowed wall.
        # A full supported cornice follows that wall; rooftop equipment has plinths.
        hx,hy=-3.35,.10
        for j in range(48):
            a=-j*math.pi/48;aa=-(j+1)*math.pi/48
            b.beam((hx+2.48*math.cos(a),hy+2.66*math.sin(a),14.55),(hx+2.48*math.cos(aa),hy+2.66*math.sin(aa),14.55),.15,4,10)
        for x in [hx-2.18,hx+2.18]:b.box(x,hy,14.66,.24,4.2,.35,5)
        for x in [2.75,4.35]:b.box(x,.72,23.17,1.14,1.14,.16,15)
        # Atrium bars terminate in a continuous roof curb.
        b.box(1.02,2.2,4.88,4.3,.22,.35,4)
        for x in [-.9,2.94]:b.box(x,.65,4.88,.22,3.35,.35,4)
        detail=b.finish();bpy.ops.object.select_all(action='DESELECT');aqua.select_set(True);detail.select_set(True);bpy.context.view_layer.objects.active=aqua;bpy.ops.object.join()
        aqua['structure_version'] = 1
    # Correct face winding on closed parts across the complete landmark set.
    for o in roots:
        if o.type!='MESH':continue
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()

if __name__=='__main__':
    import sys
    from pathlib import Path
    root=Path(__file__).resolve().parents[1]
    bpy.ops.wm.open_mainfile(filepath=str(root/'assets/valencia-landmarks.blend'))
    import importlib,model_geometry
    importlib.reload(model_geometry)
    Builder=model_geometry.Builder;M=model_geometry.M
    roots=[o for o in bpy.context.scene.objects if o.type=='MESH']
    repair_landmarks(roots)
    bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets/valencia-landmarks.blend'))
    print('REPAIRED',[(o.name,len(o.data.polygons))for o in roots if o.name in ['university','aqua']],flush=True)
