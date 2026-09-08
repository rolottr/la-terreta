"""Refine the existing civic falla and build a shared decorative firecracker."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'output/art/festival-craft';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/civic-plaza.blend'))
scene=bpy.context.scene
falla=bpy.data.objects['Falla'];keep=set(falla.children_recursive)|{falla}
for o in list(scene.objects):
    if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
falla.location=(0,0,0);falla.rotation_euler=(0,0,0)
M={m.name:m for m in bpy.data.materials}
def pos(p):return Vector((p[0],-p[2],p[1]))
def reg(o,name,m):o.name=name;o.parent=falla;o.data.materials.append(M[m]);return o
def ball(name,p,s,m,n=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=n,ring_count=4 if n==8 else 6,location=pos(p));o=reg(bpy.context.object,name,m);o.scale=(s[0],s[2],s[1])
    for f in o.data.polygons:f.use_smooth=True
    return o
def tube(name,pts,r,m,n=6):
    pp=[pos(p) for p in pts];vs=[];fs=[]
    for i,p in enumerate(pp):
        t=(pp[min(i+1,len(pp)-1)]-pp[max(0,i-1)]).normalized();u=t.cross(Vector((1,0,0)))
        if u.length<.01:u=t.cross(Vector((0,0,1)))
        u.normalize();v=t.cross(u).normalized();radius=r[i] if isinstance(r,list) else r
        vs.extend(p+radius*(math.cos(j*math.tau/n)*u+math.sin(j*math.tau/n)*v) for j in range(n))
    for i in range(len(pp)-1):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;fs.append((a,b,b+n,a+n))
    fs.extend([tuple(reversed(range(n))),tuple(range((len(pp)-1)*n,len(pp)*n))])
    data=bpy.data.meshes.new(name);data.from_pydata(vs,[],fs);data.update();o=bpy.data.objects.new(name,data);scene.collection.objects.link(o)
    for f in data.polygons:f.use_smooth=len(f.vertices)==4
    return reg(o,name,m)
def triangles(root):
    count=0
    for o in root.children_recursive:
        if o.type=='MESH':o.data.calc_loop_triangles();count+=len(o.data.loop_triangles)
    return count
before=triangles(falla)
# Smooth painted papier-mache. This changes normals without subdivision cost.
for o in falla.children_recursive:
    if o.type=='MESH' and any(word in o.name.lower() for word in ['tree','arm','skirt','shawl','branch','root']):
        for f in o.data.polygons:f.use_smooth=True
# A tapered, curved trunk removes the old open pipe top behind the painter.
old=next(o for o in falla.children_recursive if o.name=='Sculpted curling tree')
bpy.data.objects.remove(old,do_unlink=True)
controls=[Vector(p) for p in [(0,.4,0),(-.7,1.5,-.1),(.45,3,-.25),(-.15,4.9,-.6),(.7,6.6,-.5),(.35,8.5,-.4)]]
pts=[]
for j in range(len(controls)-1):
    a=controls[max(0,j-1)];b=controls[j];c=controls[j+1];d=controls[min(len(controls)-1,j+2)]
    for k in range(6):
        t=k/6;pts.append(tuple(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)))
pts.append(tuple(controls[-1]))
tube('Tapered sculpted tree',pts,[.66-.46*(i/(len(pts)-1)) for i in range(len(pts))],'wood',14)
# Brocade relief follows the skirt surface at every sample, including its pleats.
def skirt_radius(y,a):
    profile=[(1,2),(1.35,2.1),(2.4,1.7),(3.5,1.22),(4.55,.57)]
    for (y0,r0),(y1,r1) in zip(profile,profile[1:]):
        if y<=y1:return (r0+(r1-r0)*(y-y0)/(y1-y0))*(1+.055*math.cos(a*12))
    return .57
def skirt_point(y,a,lift=.026):
    r=skirt_radius(y,a)+lift
    return (-.55+r*math.cos(a),y,.3+r*.82*math.sin(a))
for o in list(falla.children_recursive):
    if o.name.startswith(('Skirt gold embroidery','Embroidered skirt flower')):bpy.data.objects.remove(o,do_unlink=True)
for j in range(12):
    a=j*math.tau/12
    tube('Raised gold panel braid',[skirt_point(1.15+k*3.28/22,a) for k in range(23)],.021,'gold',5)
    for height in [1.65,2.55,3.30]:
        tube('Brocade gold leaf',[skirt_point(height+.19*math.cos(k*math.tau/24),a+.072*math.sin(k*math.tau/24),.046) for k in range(25)],.018,'gold',5)
    for height in [1.50,2.42]:
        for k in range(5):
            t=k*math.tau/5
            o=ball('Sculpted silk petal',skirt_point(height+.08*math.sin(t),a+.047*math.cos(t),.06),(.075,.06,.075),'pink',8)
        ball('Flower gold heart',skirt_point(height,a,.12),(.042,.045,.042),'gold',8)
    tube('Ivory scalloped hem',[skirt_point(1.12+.045*math.cos(k*math.pi/4),a+(k/8-.5)*math.tau/12,.035) for k in range(9)],.034,'white',6)
# Lace loops and a jeweled brooch at the neckline.
for side in [-1,1]:
    for j in range(7):
        u=j/7;x=-.55+side*.54*(1-u);y=5.24-.64*u;z=.42+.38*u
        tube('Open shawl lace',[(x+side*.065*math.cos(k*math.tau/8),y+.065*math.sin(k*math.tau/8),z+.045) for k in range(9)],.015,'white',5)
    # Combed hair ridges, distinct from the old plain hair balls.
    for j in range(4):
        cx=-.55+side*.78;rr=.12+j*.037
        tube('Golden hair spiral',[(cx+rr*math.cos(k*math.tau/20),6.12+rr*1.12*math.sin(k*math.tau/20),.43) for k in range(21)],.016,'wood',5)
    ball('Pearl earring',(-.55+side*.70,5.73,.51),(.06,.10,.055),'gold')
ball('Bodice brooch',(-.55,4.79,.85),(.12,.15,.045),'gold');ball('Brooch enamel',(-.55,4.79,.89),(.075,.10,.03),'teal')
# Drum tension ropes and hoop nails give the instrument a clear construction.
for j in range(12):
    a=j*math.tau/12;b=a+math.tau/24
    tube('Drum tension cord',[(2.15+.615*math.cos(a),1.57,.12+.615*math.sin(a)),(2.15+.615*math.cos(b),2.32,.12+.615*math.sin(b))],.023,'gold',6)
# Painted leaf feathers give all three birds wings and a finished rear view.
for x,y,z,scale,color in [(.55,8.8,-.55,1,'blue'),(-2.18,7.9,-.24,.45,'pink'),(2.18,7.9,-.24,.45,'teal')]:
    for side in [-1,1]:
        for j in range(4):
            o=ball('Layered wing feather',(x+side*(.50+j*.06)*scale,y-j*.16*scale,z-.15*scale),(.20*scale,.43*scale,.12*scale),color)
            o.rotation_euler.y=side*.25
    for j in range(3):ball('Tail feather',(x+(j-1)*.18*scale,y-.55*scale,z-.52*scale),(.13*scale,.40*scale,.16*scale),color)
# Bark relief stays on the new tapered trunk, including the unseen rear.
for j in range(8):
    a=j*math.tau/8
    line=[]
    for i,(x,y,z) in enumerate(pts):
        r=.66-.46*(i/(len(pts)-1))+.012
        line.append((x+r*math.cos(a),y,z+r*math.sin(a)))
    tube('Fine sculpted bark ridge',line,.022,'wood',5)
# Render helper uses the exported shape, not an imagined concept.
def studio(root,prefix,target,scale):
    world=bpy.data.worlds.new(prefix+' studio');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.19,.21,1)
    bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=scale
    lights=[]
    for p,power in [((6,-10,16),1900),((-8,-3,9),1300),((3,7,13),2200)]:
        bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=8;o.rotation_euler=(pos(target)-o.location).to_track_quat('-Z','Y').to_euler();lights.append(o)
    scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='VERTEX' if prefix=='firecracker' else 'MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH';scene.render.resolution_x=720;scene.render.resolution_y=880;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    for name,p in [('front',(0,target[1]+2,20)),('back',(0,target[1]+2,-20)),('left',(-20,target[1]+2,0)),('right',(20,target[1]+2,0)),('top',(0,26,.01)),('hero',(12,target[1]+6,20))]:
        camera.location=pos(p);camera.rotation_euler=(pos(target)-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(prefix+'-'+name+'.png'));bpy.ops.render.render(write_still=True)
    for o in lights+[camera]:bpy.data.objects.remove(o,do_unlink=True)
def export(root,path):
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for o in root.children_recursive:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
# Preserve editable parts, then collapse runtime materials into vertex colours.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/falla-crafted.blend'))
after=triangles(falla)
# Batch by material for small node counts and fast loading.
batches={}
for o in list(falla.children_recursive):
    if o.type=='MESH':batches.setdefault(o.data.materials[0].name,[]).append(o)
for name,objects in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name='Falla / '+name
export(falla,ROOT/'public/models/falla-crafted.glb')
studio(falla,'falla',(0,5.7,0),14)
for o in list(scene.objects):bpy.data.objects.remove(o,do_unlink=True)
falla=bpy.data.objects.new('Firecracker',None);scene.collection.objects.link(falla)
# Decorative paper prop only; dimensions match the existing game prop.
tube('Red paper casing',[(0,-.06,0),(0,.06,0)],.035,'red',16)
for y in [-.061,.061]:tube('Pressed paper end',[(0,y-.002,0),(0,y+.002,0)],.033,'shade',16)
for y in [-.043,.037]:tube('Cream label band',[(0,y-.007,0),(0,y+.007,0)],.0357,'white',16)
tube('Paper overlap seam',[(.034,-.049,0),(.034,.049,0)],.0015,'pink',4)
tube('Curved braided fuse',[(0,.063,0),(.006,.076,0),(.018,.082,.003),(.025,.092,.003)],.003,'wood',6)
tube('Fuse pale twist',[(.001,.064,.002),(.008,.072,.002),(.011,.079,.004),(.021,.085,.004),(.026,.091,.004)],.0008,'shade',4)
# Merge all colours into one vertex-colour material, one draw call per charge.
objs=list(falla.children_recursive)
for o in objs:
    col=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER');rgba=o.data.materials[0].diffuse_color
    for d in col.data:d.color=rgba
bpy.ops.object.select_all(action='DESELECT')
for o in objs:o.select_set(True)
bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();o=bpy.context.object
m=bpy.data.materials.new('Paper vertex colour');m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.8;col=m.node_tree.nodes.new('ShaderNodeVertexColor');col.layer_name='Color';m.node_tree.links.new(col.outputs['Color'],bs.inputs['Base Color']);o.data.materials.clear();o.data.materials.append(m)
for p in o.data.polygons:p.material_index=0
export(falla,ROOT/'public/models/firecracker.glb')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/firecracker.blend'))
crackerTriangles=triangles(falla)
# Enlarge only the studio display, after export and source save.
falla.scale=(40,40,40);studio(falla,'firecracker',(0,.5,0),7)
(OUT/'stats.json').write_text(json.dumps({'fallaBeforeTriangles':before,'fallaAfterTriangles':after,'fallaRuntimeDrawCalls':1,'firecrackerTriangles':crackerTriangles,'firecrackerDrawCalls':1,'textureCount':0},indent=2))
