"""Build the editable Astra festival monument and its material-batched game mesh.

Blender 5: blender --background --python scripts/build_astra_falla.py
Coordinates in this authoring file are (east, height, front). No existing art is edited.
"""
import bpy
import math
import json
import random
from pathlib import Path
from mathutils import Vector, Quaternion

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/art/astra-falla'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(60908)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
root = bpy.data.objects.new('FallaAstra', None)
scene.collection.objects.link(root)
M = {}


def material(name, color, metallic=0, roughness=.36):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    M[name] = m


material('Midnight enamel', (.018, .045, .095), .12)
material('Astra turquoise', (.025, .47, .43), .18)
material('Celadon silk', (.26, .73, .59), .12)
material('Warm porcelain', (.94, .83, .65))
material('Gold leaf', (.83, .47, .12), .62, .29)
material('Pale gold', (.98, .75, .34), .4)
material('Coral lacquer', (.85, .115, .07))
material('Sun orange', (1, .36, .035))
material('Honey skin', (.93, .51, .22))
material('Rose skin', (.98, .64, .48))
material('Blush', (.82, .20, .15))
material('Moon blue', (.18, .29, .67), .12)
material('Lavender', (.49, .42, .78), .16)
material('Silver leaf', (.68, .82, .88), .55)
material('Leaf green', (.11, .31, .105))
material('Jade', (.18, .55, .23))
material('Ink', (.012, .018, .028))
material('White', (.98, .96, .86))


def pos(p):
    return Vector((p[0], -p[2], p[1]))


def reg(o, name, mat):
    o.name = name
    o.parent = root
    o.data.materials.append(M[mat])
    return o


sphere_meshes = {}


def ball(name, p, s, mat, n=24, rings=12):
    key = (n, rings, mat)
    if key not in sphere_meshes:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=n, ring_count=rings)
        o = bpy.context.object
        data = o.data
        data.materials.append(M[mat])
        for f in data.polygons:
            f.use_smooth = True
        sphere_meshes[key] = data
        bpy.data.objects.remove(o, do_unlink=True)
    o = bpy.data.objects.new(name, sphere_meshes[key])
    scene.collection.objects.link(o)
    o.parent = root
    o.location = pos(p)
    o.scale = (s[0], s[2], s[1])
    return o


def mesh(name, verts, faces, mat, smooth=False):
    d = bpy.data.meshes.new(name)
    d.from_pydata([pos(v) for v in verts], [], faces)
    d.update()
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    for f in d.polygons:
        f.use_smooth = smooth
    return reg(o, name, mat)


def tube(name, points, radius, mat, sides=8):
    pp = [pos(p) for p in points]
    vs, fs = [], []
    for i, p in enumerate(pp):
        t = (pp[min(i+1, len(pp)-1)]-pp[max(0, i-1)]).normalized()
        u = t.cross(Vector((0, 1, 0)))
        if u.length < .01:
            u = t.cross(Vector((1, 0, 0)))
        u.normalize()
        v = t.cross(u).normalized()
        r = radius[i] if isinstance(radius, list) else radius
        vs.extend(p+r*(math.cos(j*math.tau/sides)*u+math.sin(j*math.tau/sides)*v) for j in range(sides))
    for i in range(len(pp)-1):
        for j in range(sides):
            a = i*sides+j
            b = i*sides+(j+1) % sides
            fs.append((a, b, b+sides, a+sides))
    fs.extend([tuple(reversed(range(sides))), tuple(range((len(pp)-1)*sides, len(pp)*sides))])
    return mesh(name, [(v.x, v.z, -v.y) for v in vs], fs, mat, True)


def lathe(name, profile, mat, cx=0, cz=0, pleats=0, n=96):
    vs, fs = [], []
    for y, r in profile:
        for j in range(n):
            a = j*math.tau/n
            rr = r*(1+pleats*math.cos(a*18))
            vs.append((cx+rr*math.cos(a), y, cz+rr*math.sin(a)))
    for i in range(len(profile)-1):
        for j in range(n):
            a = i*n+j
            b = i*n+(j+1) % n
            fs.append((a, b, b+n, a+n))
    fs.extend([tuple(reversed(range(n))), tuple(range((len(profile)-1)*n, len(profile)*n))])
    return mesh(name, vs, fs, mat, True)


def ring(name, x, y, z, r, mat, thickness=.055, vertical=False):
    return tube(name, [(x+r*math.cos(a), y+(r*math.sin(a) if vertical else 0), z+(0 if vertical else r*math.sin(a))) for a in [j*math.tau/80 for j in range(81)]], thickness, mat)


def star(name, x, y, z, size, mat, points=5):
    outline = [(x+size*(1 if j % 2 == 0 else .43)*math.sin(j*math.pi/points), y+size*(1 if j % 2 == 0 else .43)*math.cos(j*math.pi/points), z) for j in range(points*2)]
    vs = [(x, y, z+.13*size)] + outline + [(x, y, z-.08*size)]
    return mesh(name, vs, [(0, j+1, (j+1) % (points*2)+1) for j in range(points*2)]+[(points*2+1, (j+1) % (points*2)+1, j+1) for j in range(points*2)], mat)


def text(name, body, p, size, mat, serif=False):
    d = bpy.data.curves.new(name, 'FONT')
    d.body = body
    d.align_x = 'CENTER'
    d.align_y = 'CENTER'
    d.size = size
    d.space_character = 1.15
    d.extrude = .018
    d.bevel_depth = .006
    d.bevel_resolution = 2
    d.resolution_u = 8
    if serif:
        d.font = font
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = pos(p)
    o.rotation_euler.x = math.pi/2
    return reg(o, name, mat)


font = bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Georgia.ttf')


def leaf(name, p, length, width, angle, mat):
    x, y, z = p
    def pt(u, v, depth):
        return (x+u*math.cos(angle)-v*math.sin(angle), y+u*math.sin(angle)+v*math.cos(angle), z+depth)
    vs = [pt(0, 0, 0), pt(length*.42, width, 0), pt(length, 0, 0), pt(length*.42, -width, 0), pt(length*.45, 0, .08)]
    mesh(name, vs, [(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,3,2,1)], mat, True)
    tube(name+' vein', [pt(0,0,.02),pt(length*.45,0,.09),pt(length,0,.02)], .014, 'Pale gold', 5)


def face(name, x, y, z, s, skin, eyes='open'):
    ball(name+' sculpted head', (x,y,z), (.75*s,.96*s,.62*s), skin, 40, 24)
    ball(name+' chin', (x,y-.48*s,z+.32*s), (.44*s,.38*s,.35*s), skin)
    for side in [-1,1]:
        ball(name+' ear', (x+side*.73*s,y-.03*s,z), (.17*s,.26*s,.14*s), skin)
        ball(name+' cheek', (x+side*.43*s,y-.18*s,z+.49*s), (.27*s,.21*s,.13*s), skin)
        ball(name+' painted blush', (x+side*.48*s,y-.17*s,z+.60*s), (.12*s,.066*s,.013*s), 'Blush', 16, 8)
        ex=x+side*.29*s
        if eyes == 'open':
            ball(name+' eye white',(ex,y+.13*s,z+.552*s),(.205*s,.155*s,.095*s),'White')
            ball(name+' iris',(ex-side*.018*s,y+.13*s,z+.638*s),(.081*s,.105*s,.024*s),'Astra turquoise')
            ball(name+' pupil',(ex-side*.018*s,y+.13*s,z+.659*s),(.042*s,.074*s,.014*s),'Ink',16,8)
            ball(name+' eye glint',(ex-.024*s,y+.17*s,z+.674*s),(.022*s,.024*s,.01*s),'White',12,6)
        tube(name+' upper eyelid',[(ex+.20*s*math.cos(a),y+.12*s+.16*s*math.sin(a),z+.64*s) for a in [j*math.pi/12 for j in range(13)]],.027*s,'Ink',6)
        tube(name+' expressive brow',[(ex-.20*s,y+.38*s,z+.55*s),(ex,y+.44*s,z+.59*s),(ex+.18*s,y+.35*s,z+.56*s)],.044*s,'Midnight enamel',8)
        ring(name+' earring',x+side*.78*s,y-.33*s,z+.03*s,.12*s,'Gold leaf',.03*s,True)
    ball(name+' nose bridge',(x,y+.01*s,z+.60*s),(.12*s,.25*s,.14*s),skin)
    ball(name+' nose tip',(x,y-.12*s,z+.72*s),(.19*s,.13*s,.17*s),skin)
    tube(name+' smile',[(x+.31*s*math.cos(a),y-.32*s-.13*s*math.sin(a),z+.62*s) for a in [j*math.pi/18 for j in range(19)]],.04*s,'Blush',8)
    tube(name+' lower lip',[(x-.14*s,y-.46*s,z+.61*s),(x,y-.49*s,z+.64*s),(x+.14*s,y-.46*s,z+.61*s)],.045*s,skin,8)


def hand(name, p, s, skin):
    x,y,z=p
    ball(name+' palm',p,(.22*s,.29*s,.11*s),skin)
    for i in range(4):
        xx=x+(i-1.5)*.105*s
        tube(name+' finger',[(xx,y+.14*s,z),(xx+.018*s,y+(.42-abs(i-1.5)*.055)*s,z+.035*s),(xx+.015*s,y+(.48-abs(i-1.5)*.055)*s,z+.10*s)],.052*s,skin,8)
    tube(name+' thumb',[(x-.16*s,y-.08*s,z),(x-.31*s,y+.02*s,z+.08*s),(x-.29*s,y+.18*s,z+.12*s)],.075*s,skin,8)


# Architectural base: stepped porcelain, fluting, raised ceramic tesserae.
lathe('Scalloped stone foundation',[(0,4.7),(.16,4.7),(.22,4.58),(.38,4.58)],'Warm porcelain')
lathe('Gold lower moulding',[(.38,4.56),(.48,4.60),(.55,4.48)],'Gold leaf')
lathe('Midnight ceramic drum',[(.55,4.42),(1.30,4.42)],'Midnight enamel')
lathe('Porcelain upper cornice',[(1.30,4.45),(1.42,4.56),(1.54,4.42),(1.63,4.22)],'Warm porcelain')
for j in range(96):
    a=j*math.tau/96
    for k in range(2):
        aa=a+(k % 2)*math.pi/96
        o=ball('Glazed mosaic lozenge',(4.44*math.cos(aa),.76+k*.30,4.44*math.sin(aa)),(.072,.135,.055),'Astra turquoise' if (j+k)%3 else 'Gold leaf',12,6)
        o.rotation_euler.z=-aa
for j in range(48):
    a=j*math.tau/48
    ball('Cornice pearl',(4.48*math.cos(a),1.42,4.48*math.sin(a)),(.075,.075,.075),'Pale gold',12,6)
lathe('Central sculpted cloud stem',[(1.6,2.5),(2.2,2.4),(3.2,1.6),(4.5,1.3),(6,1.4),(8,1.0),(10,.65)],'Midnight enamel',cz=-.6)

# Four large curling flame / silk ribbons support the high figures.
for j,mat in enumerate(['Astra turquoise','Coral lacquer','Moon blue','Celadon silk']):
    pts=[]
    for k in range(85):
        t=k/84
        a=t*math.tau*1.15+j*math.pi/2
        r=2.1*(1-t)+.4
        pts.append((r*math.cos(a),1.7+10.3*t,-.7+r*math.sin(a)))
    tube('Rising festival scroll '+mat,pts,[.45*(1-k/84)+.10 for k in range(85)],mat,12)
    tube('Gold edge on rising scroll '+mat,[(x+.08,y,z+.18) for x,y,z in pts],.035,'Gold leaf',6)

# Terra: a garden keeper with an embroidered bell skirt and a small living globe.
lathe('Terra pleated garden skirt',[(1.62,1.58),(1.9,1.6),(2.6,1.27),(3.5,.74),(4.3,.48)],'Leaf green',cz=1.4,pleats=.065)
ball('Terra jacket',(0,4.4,1.4),(.64,.87,.42),'Jade')
face('Terra',0,5.58,1.55,.87,'Honey skin')
ball('Terra complete hair cap',(0,5.68,1.28),(.67,.81,.53),'Leaf green',32,16)
for j in range(15):
    a=j*math.tau/15
    ball('Terra curled hair',(.60*math.cos(a),5.8+.65*math.sin(a),1.43),(.21,.22,.25),'Leaf green',16,8)
for side in [-1,1]:
    tube('Terra bent sleeve',[(side*.50,4.8,1.4),(side*.93,4.2,1.65),(side*.57,4.0,2.1)],[.25,.23,.17],'Jade',12)
    hand('Terra supporting hand',(side*.54,4.08,2.17),.63,'Honey skin')
for j in range(18):
    a=j*math.tau/18
    pts=[]
    for k in range(16):
        y=1.78+k*.15
        r=1.57-(y-1.78)*.45
        pts.append((r*math.cos(a),y,1.4+r*math.sin(a)))
    tube('Terra skirt gold braid',pts,.022,'Pale gold',5)
    for y in [2.1,2.65,3.15]:
        r=1.59-(y-1.78)*.45
        x,z=r*math.cos(a),1.4+r*math.sin(a)
        leaf('Terra embroidered leaf',(x,y,z+.03),.25,.095,.9,'Jade')
ball('Terra blue planet',(0,4.40,2.48),(.53,.53,.53),'Astra turquoise',32,16)
for x,y,sz in [(-.18,4.61,.21),(.19,4.29,.23),(-.18,4.16,.13)]:
    ball('Raised planet continent',(x,y,2.94),(sz,sz*.8,.06),'Jade',16,8)
for j in range(9):
    a=j*math.pi/9
    leaf('Terra laurel crown',(.62*math.cos(a),6.1+.34*math.sin(a),1.72),.40,.13,a,'Jade')

# Sol: an exuberant sun ninot, with alternating flame rays and a bright coat.
sx,sy,sz=-2.78,8.38,.2
for j in range(20):
    a=j*math.tau/20
    pts=[(sx+math.cos(a)*r,sy+math.sin(a)*r,sz-.20+.12*math.sin(k*.8)) for k,r in enumerate([.9,1.25,1.55,1.8 if j%2 else 2.0])]
    tube('Sol sculpted flame ray',pts,[.18,.18,.12,.012],'Sun orange' if j%2 else 'Gold leaf',8)
ball('Sol golden hair disk',(sx,sy,sz-.10),(1.18,1.18,.38),'Sun orange',40,20)
ball('Sol coat',(sx,6.75,.18),(.78,1.0,.48),'Coral lacquer',32,16)
face('Sol',sx,sy,sz+.27,1.05,'Honey skin')
for side in [-1,1]:
    tube('Sol boot leg',[(sx+side*.34,6.2,.2),(sx+side*.43,5.58,.3),(sx+side*.61,5.45,.5)],[.21,.23,.14],'Sun orange',10)
    ball('Sol curled shoe',(sx+side*.64,5.40,.56),(.36,.19,.27),'Gold leaf')
    tube('Sol jubilant arm',[(sx+side*.60,7.15,.25),(sx+side*.95,7.45,.3),(sx+side*1.12,7.96,.4)],[.24,.20,.14],'Coral lacquer',12)
    hand('Sol raised hand',(sx+side*1.12,8.06,.44),.7,'Honey skin')
for k in range(5):
    ball('Sol gold jacket button',(sx,6.35+k*.25,.66),(.065,.065,.03),'Gold leaf',12,6)
for side in [-1,1]:
    tube('Sol ornate lapel',[(sx+side*.36,7.47,.57),(sx+side*.16,6.85,.68),(sx+side*.32,6.40,.62)],.075,'Gold leaf')

# Luna: a dreamer, seated in a blue and silver crescent with a star lantern.
lx,ly,lz=2.73,9.55,-.10
pts=[]
for k in range(65):
    a=-math.pi*.40+k/64*math.pi*1.50
    pts.append((lx+1.53*math.cos(a),ly+1.53*math.sin(a),lz-.33))
tube('Luna silver crescent',pts,[.035+.38*math.sin(k/64*math.pi) for k in range(65)],'Silver leaf',12)
lathe('Luna draped robe',[(5.9,.78),(6.1,.96),(6.8,.83),(7.5,.65),(8.4,.42),(8.8,.5)],'Moon blue',cx=lx,cz=lz,pleats=.065,n=64)
face('Luna',lx,ly,lz+.16,.86,'Rose skin',eyes='closed')
ball('Luna complete waved hair cap',(lx,ly+.10,lz-.12),(.66,.83,.54),'Lavender',32,16)
for j in range(9):
    x=lx-.63+j*.15
    tube('Luna waved hair',[(x,10.05,-.10),(x-.12,10.4,-.15),(x+.1,10.5,-.2),(x+.18,10.2,-.5)],[.13,.14,.12,.03],'Lavender',8)
for side in [-1,1]:
    tube('Luna sleeve',[(lx+side*.4,8.75,lz),(lx+side*.7,8.20,.2),(lx+side*.5,7.95,.6)],[.25,.22,.14],'Lavender',12)
    hand('Luna hand',(lx+side*.5,8.0,.66),.6,'Rose skin')
star('Luna lantern star',lx,8.13,1.0,.55,'Pale gold')
for j in range(20):
    a=j*2.39996
    y=6.15+(j%6)*.37
    r=.91-(y-6.15)*.20
    star('Luna robe star',lx+math.cos(a)*r,y,lz+math.sin(a)*r,.105,'Silver leaf')

# Astra: the main figure, with a tall folded gown and a carved porcelain face.
lathe('Astra sweeping eighteen panel gown',[(8.25,1.70),(8.5,1.80),(9.2,1.70),(10.2,1.32),(11.2,.91),(12.15,.58)],'Astra turquoise',cz=-.5,pleats=.05)
ball('Astra sculpted bodice',(0,12.55,-.45),(.80,1.04,.51),'Warm porcelain',32,16)
lathe('Astra gold waist girdle',[(11.85,.61),(12.07,.60)],'Gold leaf',cz=-.46)
ball('Astra neck',(0,13.52,-.43),(.28,.46,.30),'Rose skin')
face('Astra',0,14.74,-.29,1.26,'Rose skin')
ball('Astra complete swept hair cap',(0,14.92,-.66),(.96,1.10,.70),'Midnight enamel',40,24)
for j in range(13):
    a=(j/12-.5)*math.pi*.80
    tube('Astra rear combed hair ridge',[(.97*math.sin(a)*math.sin(t),14.92+1.11*math.cos(t),-.66-.72*math.cos(a)*math.sin(t)) for t in [.18+k/24*2.6 for k in range(25)]],.026,'Gold leaf',6)
# Broad folds and brocade are modelled on the skirt, including its back.
def gown_point(y, a, lift=.035):
    profile=[(8.48,1.80),(9.2,1.70),(10.2,1.32),(11.2,.91),(12.15,.58)]
    for (y0,r0),(y1,r1) in zip(profile,profile[1:]):
        if y <= y1:
            r=(r0+(r1-r0)*(y-y0)/(y1-y0))*(1+.05*math.cos(a*18))+lift
            return (r*math.cos(a),y,-.5+r*math.sin(a))
    return (.6*math.cos(a),y,-.5+.6*math.sin(a))

for j in range(18):
    a=j*math.tau/18
    pts=[]
    for k in range(25):
        y=8.48+k*3.55/24
        pts.append(gown_point(y,a))
    tube('Astra gold gown piping',pts,.034,'Gold leaf',6)
    for y in [8.92,9.63,10.30,10.92]:
        ball('Astra pearl embroidery',gown_point(y,a,.075),(.064,.064,.064),'Warm porcelain',12,6)
    for y in [9.15,9.98,10.73]:
        tube('Astra embroidered gold arabesque',[gown_point(y+.27*math.cos(k*math.tau/32),a+.095*math.sin(k*math.tau/32),.055) for k in range(33)],.022,'Gold leaf',6)
        for k in range(5):
            b=k*math.tau/5
            ball('Astra brocade flower',gown_point(y+.085*math.sin(b),a+.04*math.cos(b),.075),(.06,.065,.06),'Warm porcelain',12,6)
        ball('Astra brocade emerald',gown_point(y,a,.13),(.035,.04,.035),'Astra turquoise',12,6)
    tube('Astra scalloped hem',[(1.81*math.cos(a+(k/12-.5)*math.tau/18),8.49+.08*math.cos(k*math.tau/12),-.5+1.81*math.sin(a+(k/12-.5)*math.tau/18)) for k in range(13)],.05,'Pale gold',6)
# Open shawl with pearls; long bent arms carry an orbit of stars.
for side in [-1,1]:
    tube('Astra extended sleeve',[(side*.64,13.0,-.45),(side*1.40,12.6,-.35),(side*2.1,13.15,-.20)],[.30,.25,.17],'Warm porcelain',16)
    hand('Astra open hand',(side*2.16,13.4,-.16),.9,'Rose skin')
    tube('Astra gold shawl trim',[(side*.7,13.12,.04),(side*.48,12.78,.10),(side*.12,12.31,.10)],.065,'Gold leaf')
    for j in range(8):
        t=j/7
        ball('Astra shawl pearl',(side*(.69-.56*t),13.03-.70*t,.12),(.056,.056,.04),'White',12,6)
        ring('Astra open lace scallop',side*(.73-.56*t),13.03-.70*t,.10,.085,'Warm porcelain',.021,True)
    # Hair sweeps away from the face in individually carved locks.
    for j in range(8):
        pts=[]
        for k in range(33):
            t=k/32
            pts.append((side*(.15+j*.095+1.25*t+.18*math.sin(t*math.tau)),15.78-.08*j-3.7*t,-.60-.30*math.sin(t*math.pi)-j*.08))
        tube('Astra carved flowing hair',pts,[.14*(1-k/32)+.016 for k in range(33)],'Midnight enamel',8)
        tube('Astra gilded hair strand',[(x,y,z+.09) for x,y,z in pts],.025,'Gold leaf',6)
# Six interlaced loops, an OpenAI-inspired knot medallion.
for j in range(6):
    a=j*math.tau/6
    pts=[]
    for k in range(49):
        b=k*math.tau/48
        u=.22+.26*math.cos(b)
        v=.17*math.sin(b)
        pts.append((u*math.cos(a)-v*math.sin(a),12.77+u*math.sin(a)+v*math.cos(a),.12+.055*math.sin(2*b)))
    tube('Astra six-loop knot',pts,.035,'Astra turquoise',6)

# Pierced diadem and an asymmetric starburst crown: full monument height 20.6 m.
ring('Astra diadem band',0,15.8,-.29,.84,'Gold leaf',.095)
for j in range(11):
    a=j*math.pi/10
    x=.85*math.cos(a)
    y=15.94+.65*math.sin(a)
    leaf('Astra diadem point',(x,15.85,.0),.48+.30*math.sin(a),.13,math.pi/2,'Gold leaf')
    ball('Astra diadem emerald',(x,y,.02),(.09,.12,.07),'Astra turquoise',16,8)
for side in [-1,1]:
    pts=[]
    for k in range(65):
        t=k/64
        pts.append((side*(.85+1.48*math.sin(t*math.pi*.88)),15.8+3.30*t,-1.05))
    tube('Crown celestial arch',pts,[.13*(1-k/64)+.03 for k in range(65)],'Gold leaf',10)
    for j in range(7):
        t=(j+.6)/8
        x=side*(.85+1.48*math.sin(t*math.pi*.88))
        y=15.8+3.3*t
        star('Crown satellite',x,y,-.91,.19+(j%2)*.09,'Warm porcelain')
star('Astra eight pointed north star',0,19.42,-.80,1.17,'Pale gold',8)
ring('North star enamel halo',0,19.42,-.88,.60,'Astra turquoise',.055,True)
ball('North star turquoise jewel',(0,19.42,-.64),(.25,.25,.12),'Astra turquoise')
tube('North star central stem',[(0,16.10,-.9),(-.35,17.05,-1.0),(0,18.35,-.85)],.10,'Gold leaf',10)
for j in range(7):
    star('Astra orbit star',-3.0+j,12.6+math.sin(j/6*math.pi)*1.15,-.42,.16+(j%3)*.06,'Pale gold')

# Side and rear panels: constellations, scrolls, flowers and festival masks.
for j in range(12):
    a=j*math.tau/12
    x,z=3.30*math.cos(a),3.30*math.sin(a)
    ball('Sculpted cloud volute',(x,1.86,z),(.60,.40,.43),'Warm porcelain')
    ring('Cloud gold spiral',x,1.88,z+.34,.23,'Gold leaf',.035,True)
    for k in range(5):
        b=k*math.tau/5
        ball('Festival flower petal',(x+.16*math.cos(b),2.14+.16*math.sin(b),z+.25),(.12,.12,.05),'Coral lacquer',12,6)
    ball('Festival flower heart',(x,2.14,z+.31),(.07,.07,.04),'Gold leaf',12,6)
for side in [-1,1]:
    for j in range(4):
        x=side*(1.7+j*.23)
        leaf('Acantus scroll',(x,2.4+j*.25,-1.8),.85,.24,side*.4+1,'Celadon silk')
for j in range(8):
    a=j*math.tau/8
    x,z=1.55*math.cos(a),-.5+1.55*math.sin(a)
    star('Rear constellation point',x,9.3+(j%3)*.27,z,.13,'Pale gold')

# Raised title cartouche and separate readable model nameplates.
ball('Main title dark enamel cartouche',(0,.98,4.43),(2.24,.48,.09),'Midnight enamel',40,16)
text('OpenAI signature','OPENAI',(0,1.19,4.55),.21,'Warm porcelain')
text('Astra title','GPT-6 ASTRA',(0,.85,4.56),.40,'Pale gold',True)
for word,x,y,z,w in [('SOL',-2.9,4.88,1.0,.65),('TERRA',0,2.46,3.18,.92),('LUNA',2.75,5.53,.75,.75)]:
    ball(word+' enamel plaque',(x,y,z),(w,.23,.09),'Midnight enamel')
    text(word+' name',word,(x,y,z+.11),.30,'Pale gold',True)
    for side in [-1,1]:
        tube(word+' plaque ribbon',[(x+side*w*.75,y,z-.02),(x+side*w*.9,y+.22,z-.1),(x+side*w*.7,y+.43,z-.2)],.035,'Gold leaf',6)
for side in [-1,1]:
    star('Title flanking star',side*2.0,.96,4.53,.13,'Gold leaf')
text('Rear artist inscription','ASTRA / SOL / TERRA / LUNA',(0,.92,-4.47),.20,'Pale gold').rotation_euler.z=math.pi

# Save the fully editable scene before batching. Keep all text and named parts.
bpy.context.view_layer.update()
source_objects = len(root.children_recursive)
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.shading.type = 'MATERIAL'
        area.spaces.active.overlay.show_overlays = False
        area.spaces.active.region_3d.view_distance = 21
        area.spaces.active.region_3d.view_location = (0,0,10)
        area.spaces.active.region_3d.view_rotation = Quaternion((0,0,1),.15) @ Quaternion((1,0,0),1.48)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/astra-falla.blend'))

# One mesh, material groups retained for porcelain, enamel, silk and metal.
bpy.ops.object.select_all(action='DESELECT')
for o in root.children_recursive:
    o.select_set(True)
bpy.context.view_layer.objects.active = next(o for o in root.children_recursive if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
bpy.ops.object.make_single_user(object=False, obdata=True, material=False)
bpy.ops.object.join()
o = bpy.context.object
o.name = 'AstraSculpture'
o.data.calc_loop_triangles()
triangles = len(o.data.loop_triangles)
root.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/astra-falla.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
bounds=[o.matrix_world @ Vector(v) for v in o.bound_box]
(OUT/'model-stats.json').write_text(json.dumps({'editableParts':source_objects,'triangles':triangles,'materials':len(o.data.materials),'heightMetres':max(v.z for v in bounds)-min(v.z for v in bounds),'widthMetres':max(v.x for v in bounds)-min(v.x for v in bounds),'glbBytes':(ROOT/'public/models/astra-falla.glb').stat().st_size},indent=2)+'\n')

# Studio views use the exported mesh and the same physical materials.
world=bpy.data.worlds.new('Astra studio')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.15,.19,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.world=world
for p,power,size in [((7,-12,22),3200,10),((-9,-6,12),2300,9),((3,7,20),4400,8)]:
    bpy.ops.object.light_add(type='AREA',location=p)
    light=bpy.context.object
    light.data.energy=power
    light.data.shape='DISK'
    light.data.size=size
    light.rotation_euler=(Vector((0,0,10))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add()
cam=bpy.context.object
scene.camera=cam
cam.data.type='ORTHO'
cam.data.ortho_scale=23.8
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1050
scene.render.resolution_y=1400
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
for name,p in [('front',(0,13,36)),('hero',(15,16,34)),('back',(-12,15,-34))]:
    cam.location=pos(p)
    cam.rotation_euler=(pos((0,10.0,0))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
print('ASTRA_EXPORT',json.dumps({'parts':source_objects,'triangles':triangles}))
