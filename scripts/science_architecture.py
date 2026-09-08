"""Photo-led science campus meshes. Coordinates are Blender Z-up, in game units.

See PROMPT.md for the art direction.
This module changes only the six science identities; other landmarks stay intact.
"""
import math
import bpy
from model_geometry import Builder, M, material


def add_material(name, color, roughness=.45, metal=0):
    M.append(material(name, color, roughness, metal))
    return len(M) - 1


WHITE = add_material('science porcelain', 'f3f3ed', .3)
CONCRETE = add_material('science concrete', 'dce0dc', .65)
GLASS = add_material('science blue glass', '426a76', .17, .3)
GLASS_LIGHT = add_material('science roof glass', '91b3b2', .2, .25)
BLUE = add_material('science cobalt ceramic', '173667', .26, .1)
BLUE_EDGE = add_material('science cobalt ribs', '284777', .35, .15)
STEEL = add_material('science steel', 'bdc9ca', .28, .65)
DARK = add_material('science glazing gasket', '263d47', .5)
PAVING = add_material('science paving', 'cdd3cb', .8)
SOIL = add_material('science garden soil', '65594b', .9)


class CampusBuilder(Builder):
    def __init__(self, name):
        super().__init__(name)
        self.smooth_faces = []

    def surface(self, fn, nu, nv, mat, thick=0):
        """A welded parametric patch, with a closed underside for concrete shells."""
        start = len(self.f)
        verts = [fn(i / nu, j / nv) for i in range(nu + 1) for j in range(nv + 1)]
        faces = []
        for i in range(nu):
            for j in range(nv):
                k = i * (nv + 1) + j
                faces.append((k, k + nv + 1, k + nv + 2, k + 1))
        self.poly(verts, faces, mat)
        self.smooth_faces.extend(range(start, len(self.f)))
        if thick:
            bottom = [(x, y, z - thick) for x, y, z in verts]
            start = len(self.f)
            self.poly(bottom, [tuple(reversed(f)) for f in faces], mat)
            self.smooth_faces.extend(range(start, len(self.f)))
            edges = []
            for i in range(nu):
                for j in [0, nv]:
                    k = i * (nv + 1) + j
                    edges.append((k, k + nv + 1))
            for j in range(nv):
                for i in [0, nu]:
                    k = i * (nv + 1) + j
                    edges.append((k, k + 1))
            for a, c in edges:
                self.poly([verts[a], bottom[a], bottom[c], verts[c]], [(0, 1, 2, 3)], mat)

    def line(self, fn, count, radius, mat):
        for i in range(count):
            self.beam(fn(i / count), fn((i + 1) / count), radius, mat, 6)

    def finish(self):
        obj = super().finish()
        for i in self.smooth_faces:
            obj.data.polygons[i].use_smooth = True
        # Recalculate each closed component, so the game can keep front-face culling.
        import bmesh
        bm = bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data); bm.free()
        return obj


def ellipse(b, rx, ry, z, height, mat):
    for j in range(96):
        a = j * math.tau / 96; c = (j + 1) * math.tau / 96
        b.poly([(0, 0, z), (rx*math.cos(a), ry*math.sin(a), z), (rx*math.cos(c), ry*math.sin(c), z),
                (0, 0, z-height), (rx*math.cos(a), ry*math.sin(a), z-height), (rx*math.cos(c), ry*math.sin(c), z-height)],
               [(0, 1, 2), (3, 5, 4), (1, 4, 5, 2)], mat)


def palau():
    b = CampusBuilder('palau_arts')
    ellipse(b, 11, 6.5, .18, .18, PAVING)
    ellipse(b, 10.6, 6.15, .36, .18, WHITE)
    # The main side shells form pointed oval openings around the terraces.
    for side in [-1, 1]:
        def shell(u, v):
            a = u * math.tau
            outer = (10.35*math.cos(a), 5.35 + 4.85*math.sin(a)*abs(math.sin(a)))
            inner = (5.6*math.cos(a), 5.45 + 1.80*math.sin(a)*abs(math.sin(a)))
            x = outer[0]*(1-v) + inner[0]*v
            z = outer[1]*(1-v) + inner[1]*v
            y = side*(3.5 + .32*math.sin(math.pi*v) + .35*math.sin(a))
            return (x, y, z)
        b.surface(shell, 128, 14, WHITE, .14)
        for v in [0, 1]:
            b.line(lambda u: shell(u, v), 128, .047, CONCRETE)
    # Recessed glazed core, with two balconies visible through the shell eyes.
    for j in range(72):
        a=j*math.tau/72; c=(j+1)*math.tau/72
        p=(7.9*math.cos(a), 3.35*math.sin(a)); q=(7.9*math.cos(c), 3.35*math.sin(c))
        b.poly([(p[0],p[1],.37),(q[0],q[1],.37),(q[0],q[1],7.8),(p[0],p[1],7.8)],[(0,1,2,3)],GLASS)
        b.beam((p[0],p[1],.37),(p[0],p[1],7.8),.028,STEEL,6)
        for h in [1.7,3.6,5.5,7.7]:
            b.beam((p[0],p[1],h),(q[0],q[1],h),.034,STEEL,6)
    b.surface(lambda u,v:(7.9*math.cos(u*math.tau)*math.cos(v*math.pi/2),
                          3.35*math.sin(u*math.tau)*math.cos(v*math.pi/2),
                          7.78+1.6*math.sin(v*math.pi/2)),72,18,CONCRETE,.12)
    for h in [3.7,5.6]:
        ellipse(b, 7.4, 3.8, h, .20, WHITE)
        for side in [-1,1]:
            b.box(0,side*3.6,h+.19,9.2,.46,.36,CONCRETE)
            b.box(0,side*3.6,h+.39,8.9,.34,.06,SOIL)
            for j in range(24):
                x=-4.35+j*.38
                b.sphere(x,side*3.6,h+.59,.23,22+j%3,n=8,rings=4)
            b.line(lambda t:(-5.4+10.8*t,side*3.9,h+.65),24,.024,STEEL)
            for j in range(37):
                x=-5.4+j*.3;b.beam((x,side*3.9,h),(x,side*3.9,h+.65),.016,STEEL,5)
    # Continuous feather roof, with a finished edge and fine underside ribs.
    def feather(u,v):
        x=-14.6+29.2*u
        width=.07+2.55*math.sin(math.pi*u)**.72
        # The long roof has an upward V cross-section, not a convex disc.
        return(x,(2*v-1)*width,1.0+11.1*math.sin(math.pi*u*.86)+.48*abs(2*v-1)*math.sin(math.pi*u))
    b.surface(feather,112,16,WHITE,.17)
    for i in range(8,106,2):
        u=i/112
        b.line(lambda v:tuple(c-(.20 if k==2 else 0) for k,c in enumerate(feather(u,v))),8,.026,CONCRETE)
    # Cantilever support at the rear and slanted glazing mullions at ground level.
    b.box(-12.4,0,.19,5.0,1.25,.38,CONCRETE)
    for side in [-1,1]:
        b.beam((-14.45,side*.45,.38),(-8.4,side*1.1,6.6),.16,WHITE,10,.11)
        for j in range(17):
            x=-6.4+j*.8;b.beam((x,side*4.7,.38),(x+1.0,side*3.45,2.85),.055,WHITE,7)
    return b


def agora():
    b=CampusBuilder('agora')
    ellipse(b,6.5,4.6,.20,.20,PAVING)
    # Two curved flanks meet on a LONG arched ridge, not a conical apex.
    def shell(u,v):
        x=-6.4+12.8*u; longitudinal=math.sqrt(max(0,1-(x/6.4)**2))
        a=(2*v-1)*math.pi/2
        y=4.5*longitudinal*math.sin(a)
        z=.24+11.65*longitudinal*(1-abs(math.sin(a)))**.60
        return(x,y,z)
    b.surface(shell,80,64,BLUE,.10)
    # Silver-green roof cap seen above the cobalt side shells.
    b.surface(lambda u,v:tuple(c+(.045 if k==2 else 0) for k,c in enumerate(shell(u,.38+.24*v))),80,16,GLASS_LIGHT,.04)
    for i in range(1,48):
        u=i/48;b.line(lambda v:shell(u,v),48,.032,BLUE_EDGE)
        b.line(lambda v:tuple(c+(.08 if k==2 else 0) for k,c in enumerate(shell(u,.38+.24*v))),12,.022,STEEL)
    for side in [-1,1]:
        # Low recessed entrance at each end, set inside the shell footprint.
        b.box(side*5.83,0,.77,.035,2.0,1.10,GLASS)
        for y in [-1,-.5,0,.5,1]:b.box(side*5.86,y,.77,.045,.035,1.1,STEEL)
        b.box(side*5.86,0,1.33,.045,2.05,.05,STEEL)
    return b


def oceanografic():
    b=CampusBuilder('oceanografic')
    ellipse(b,8,8,.17,.17,PAVING)
    # One continuous eight-lobed saddle roof. Valleys are load-bearing feet.
    def roof(u,v):
        a=u*math.tau; r=7.7*v
        return(r*math.cos(a),r*math.sin(a),3.8+v*v*(2.75*math.cos(8*a)-.62))
    b.surface(roof,192,24,WHITE,.115)
    b.line(lambda u:roof(u,1),192,.045,CONCRETE)
    # Recess glazing behind every scalloped rim, with doors and slim frames.
    for j in range(128):
        a=j*math.tau/128; c=(j+1)*math.tau/128
        p=roof(j/128,.90); q=roof((j+1)/128,.90)
        p=(p[0],p[1],p[2]-.17); q=(q[0],q[1],q[2]-.17)
        b.poly([(p[0],p[1],.18),(q[0],q[1],.18),q,p],[(0,1,2,3)],GLASS)
        b.beam((p[0],p[1],.18),p,.023,DARK,6)
        for h in [1.2,2.3,3.4,4.5]:
            if h<min(p[2],q[2]):b.beam((p[0],p[1],h),(q[0],q[1],h),.021,STEEL,6)
    for j in range(8):
        a=(j+.5)*math.tau/8;p=roof((j+.5)/8,1)
        b.beam((p[0],p[1],.17),p,.11,CONCRETE,10)
    ellipse(b,6.7,6.7,.20,.03,CONCRETE)
    return b


def umbracle():
    b=CampusBuilder('umbracle')
    b.box(0,0,.05,24,8,.10,PAVING)
    # The paired arches are staggered along the promenade, as in the photographs.
    for i in range(33):
        x=-11.8+i*23.6/32
        b.line(lambda t:(x,3.9*math.cos(math.pi*t),.1+5.8*math.sin(math.pi*t)),40,.046,WHITE)
        for side in [-1,1]:
            b.line(lambda t:(x+.23,side*(3.9*(1-t)),.1+5.8*math.sin(t*math.pi/2)),24,.029,WHITE)
    for side in [-1,1]:
        b.box(0,side*3,.23,23.8,1.35,.40,CONCRETE)
        b.box(0,side*3,.45,23.6,1.18,.05,SOIL)
        for j in range(70):
            x=-11.5+j*.33
            b.sphere(x,side*(3+.23*math.sin(j*2)),.63,.24,22+j%3,n=7,rings=3)
        for i in range(13):
            x=-10.8+i*1.8
            b.beam((x,side*2.35,.12),(x,side*2.35,.56),.018,STEEL,5)
        b.beam((-11.8,side*2.35,.56),(11.8,side*2.35,.56),.022,STEEL,6)
    # Detailed palm crowns; the clear lanes run on both sides of the trunks.
    for x in [-9,-5,0,5,9]:
        b.beam((x,0,.1),(x+.12,0,3.6),.13,13,10,.085)
        for k in range(12):
            a=k*math.tau/12
            for j in range(8):
                t=j/7;r=1.65*t;z=3.6+.55*math.sin(math.pi*t)-.4*t
                center=(x+.12+math.cos(a)*r,math.sin(a)*r,z)
                b.leaf(center,.33*(1-.65*t),22+k%3,a+math.pi/2,.1)
            b.line(lambda t:(x+.12+math.cos(a)*1.65*t,math.sin(a)*1.65*t,3.6+.55*math.sin(math.pi*t)-.4*t),12,.018,23)
    return b


def museum():
    b=CampusBuilder('museum');b.box(0,0,.13,26,10,.26,PAVING)
    # Asymmetric roof and branching skeletal portico, repeated down the long hall.
    profile=[(-3.25,.27),(-2.85,6.3),(-1.95,7.8),(-.4,6.6),(3.45,5.3),(3.7,.27)]
    for j in range(len(profile)-1):
        y,z=profile[j];yy,zz=profile[j+1]
        b.surface(lambda u,v:(-12.2+24.4*u,y+(yy-y)*v,z+(zz-z)*v),32,1,GLASS,.04)
    for i in range(25):
        x=-12+i
        # Split diagonal legs and projecting pointed roof fins.
        for side in [-1,1]:
            b.beam((x,side*4.7,.28),(x,side*3.25,3.1),.09,WHITE,8)
            for dx in [-.46,.46]:b.beam((x,side*3.25,3.1),(x+dx,side*2.9,6.3),.075,WHITE,8)
        pts=[(x,-4.7,.28),(x,-3.25,3.1),(x,-2.85,6.3),(x,-2.65,8.55),(x,-1.95,7.8),(x,-.4,6.6),(x,3.45,5.3),(x,4.7,.28)]
        for a,c in zip(pts,pts[1:]):b.beam(a,c,.095,WHITE,8)
        b.poly([(x-.06,-2.9,6.25),(x-.06,-2.65,8.55),(x-.06,-1.9,7.75),
                (x+.06,-2.9,6.25),(x+.06,-2.65,8.55),(x+.06,-1.9,7.75)],[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)],WHITE)
    for y in [-2.9,3.5]:
        for h in [1.1,2.1,3.2,4.3,5.25]:b.box(0,y,h,24.4,.055,.036,STEEL)
    for side in [-1,1]:
        x=side*12.22
        b.poly([(x,y,z) for y,z in profile], [tuple(range(len(profile)))], GLASS_LIGHT)
        # Branches and horizontal floor plates finish both short elevations.
        for y in [-2.5,-1.25,0,1.25,2.5]:
            h=6.3 if y<0 else 5.25
            b.beam((x,y,.27),(x,y,h),.035,STEEL,6)
        for h in [1.1,2.1,3.2,4.3,5.25]:b.box(x,.2,h,.055,6.3,.045,STEEL)
        for y in [-2.5,0,2.5]:
            b.beam((x,y,.3),(x,y,2.8),.09,WHITE,8)
            for dy in [-1.2,1.2]:b.beam((x,y,2.8),(x,y+dy,5.6),.07,WHITE,8)
    return b


def install_science(roots):
    for build in [palau, agora, oceanografic, umbracle, museum]:
        builder=build()
        old=next((o for o in roots if o.name==builder.name),None)
        if old is not None:
            roots.remove(old);bpy.data.objects.remove(old,do_unlink=True)
        roots.append(builder.finish())
    # Keep the existing eye geometry, but use the same porcelain and glass palette.
    eye=next(o for o in roots if o.name=='hemisferic')
    for i,m in enumerate(eye.data.materials):
        if not m:continue
        name=m.name.lower()
        if any(n in name for n in ['limestone trim','ivory plaster','science porcelain']):eye.data.materials[i]=M[WHITE]
        elif any(n in name for n in ['window glass','science blue glazing','science blue glass']):eye.data.materials[i]=M[GLASS]
        elif any(n in name for n in ['window light','science roof glazing','science roof glass']):eye.data.materials[i]=M[GLASS_LIGHT]
