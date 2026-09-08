"""Small deterministic mesh tools for the street and coast asset collection."""
import bpy
import math
import random
from mathutils import Vector
from model_geometry import Builder as BaseBuilder

PALETTE = [
    ('ivory enamel', 'eee5ce', .34, .12, 'paint'),
    ('oxblood enamel', 'b54c3d', .35, .18, 'paint'),
    ('deep green iron', '304f49', .43, .62, 'metal'),
    ('brushed aluminium', 'a0aba3', .3, .78, 'metal'),
    ('rubber seals', '293833', .88, 0, 'plain'),
    ('oiled teak', 'ad8058', .65, 0, 'wood'),
    ('teak end grain', '795940', .78, 0, 'wood'),
    ('unbleached canvas', 'eddbb3', .96, 0, 'cloth'),
    ('sea green canvas', '588b87', .92, 0, 'cloth'),
    ('coral canvas', 'c36e50', .94, 0, 'cloth'),
    ('honey limestone', 'd1b793', .86, 0, 'stone'),
    ('stone shadow', 'a38d70', .9, 0, 'stone'),
    ('glazed ceramic', '397e86', .28, .06, 'ceramic'),
    ('glazed ivory', 'ead9ac', .3, .03, 'ceramic'),
    ('burnished brass', 'c8a15b', .29, .72, 'metal'),
    ('terracotta', 'bc7a58', .82, 0, 'stone'),
    ('leaf dark', '486847', .84, 0, 'plain'),
    ('leaf light', '829359', .85, 0, 'plain'),
    ('marram straw', 'b7ae79', .88, 0, 'plain'),
    ('sand', 'd7c298', .98, 0, 'stone'),
    ('cream porcelain', 'f5ead3', .21, 0, 'ceramic'),
    ('roasted coffee', '4a372a', .6, 0, 'plain'),
    ('soft amber light', 'ffe0a0', .23, .1, 'plain'),
    ('blue grey feathers', '77868b', .87, 0, 'cloth'),
    ('pigeon neck', '486965', .48, .15, 'plain'),
    ('ginger fur', 'b58a61', .96, 0, 'cloth'),
    ('tabby coat', 'b58a61', .98, 0, 'fur'),
    ('leaf flower', 'c190ad', .86, 0, 'plain'),
    ('display screen', '203c39', .38, .15, 'plain'),
    ('sea glass', '7fb3ab', .25, .05, 'ceramic'),
    ('rope', 'baaa83', .96, 0, 'cloth'),
    ('rose feet', 'b88d7a', .85, 0, 'plain'),
]
M = []

def setup_materials(atlas_path):
    atlas = bpy.data.images.load(str(atlas_path), check_existing=True)
    atlas.pack()
    for name, color, rough, metal, _ in PALETTE:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bs = m.node_tree.nodes['Principled BSDF']
        bs.inputs['Roughness'].default_value = rough
        bs.inputs['Metallic'].default_value = metal
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = atlas
        m.node_tree.links.new(tex.outputs['Color'], bs.inputs['Base Color'])
        M.append(m)
    glass = bpy.data.materials.new('clear green safety glass')
    glass.use_nodes = True
    bs = glass.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (.35, .58, .54, 1)
    bs.inputs['Roughness'].default_value = .17
    bs.inputs['Alpha'].default_value = .22
    glass.surface_render_method = 'DITHERED'
    M.append(glass)

class Builder(BaseBuilder):
    def __init__(self, name):
        super().__init__(name)
        self.smooth_faces = set()
        self.face_uv = {}

    def beam(self, a, b, r, mat=2, n=12, r2=None):
        first = len(self.f)
        super().beam(a, b, r, mat, n, r2)
        self.smooth_faces.update(range(first + 2, len(self.f)))

    def sphere(self, x, y, z, r, mat=16, sx=1, sy=1, sz=1, n=20, rings=10):
        # Rings stop short of the poles, so there are no zero-area pole faces.
        vs = [(x, y, z + r * sz)]
        for k in range(1, rings):
            p = math.pi * k / rings
            for j in range(n):
                a = j * math.tau / n
                vs.append((x+r*sx*math.sin(p)*math.cos(a), y+r*sy*math.sin(p)*math.sin(a), z+r*sz*math.cos(p)))
        bottom = len(vs)
        vs.append((x, y, z-r*sz))
        fs = [(0, 1+j, 1+(j+1)%n) for j in range(n)]
        for k in range(rings-2):
            a = 1+k*n
            fs.extend((a+j, a+n+j, a+n+(j+1)%n, a+(j+1)%n) for j in range(n))
        fs.extend((bottom, bottom-1-j, bottom-1-(j+1)%n) for j in range(n))
        first = len(self.f)
        self.poly(vs, fs, mat)
        self.smooth_faces.update(range(first, len(self.f)))

    def lathe(self, profile, mat=10, x=0, y=0, n=48):
        vs = [(x+r*math.cos(j*math.tau/n), y+r*math.sin(j*math.tau/n), z) for r,z in profile for j in range(n)]
        fs = [(k*n+j, k*n+(j+1)%n, (k+1)*n+(j+1)%n, (k+1)*n+j) for k in range(len(profile)-1) for j in range(n)]
        first = len(self.f)
        self.poly(vs, fs, mat)
        self.smooth_faces.update(range(first, len(self.f)))

    def tube(self, points, radius, mat=2, n=10):
        pts = [Vector(p) for p in points]
        vs = []
        for i,p in enumerate(pts):
            tangent = (pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
            side = tangent.cross(Vector((0,0,1)))
            if side.length < .01: side = tangent.cross(Vector((0,1,0)))
            side.normalize()
            up = tangent.cross(side)
            for j in range(n):
                a = j*math.tau/n
                rr=radius[i] if isinstance(radius,(list,tuple)) else radius
                vs.append(tuple(p+rr*(side*math.cos(a)+up*math.sin(a))))
        fs = [tuple(range(n-1,-1,-1)), tuple(range((len(pts)-1)*n,len(pts)*n))]
        fs.extend((k*n+j,k*n+(j+1)%n,(k+1)*n+(j+1)%n,(k+1)*n+j) for k in range(len(pts)-1) for j in range(n))
        first = len(self.f)
        self.poly(vs,fs,mat)
        self.smooth_faces.update(range(first+2,len(self.f)))

    def ring(self, x,y,z,r,thickness,mat=2,n=48):
        self.tube([(x+r*math.cos(j*math.tau/n),y+r*math.sin(j*math.tau/n),z) for j in range(n+1)],thickness,mat,8)

    def transform(self, first, translate=(0,0,0), rz=0, rx=0, scale=1):
        c,s=math.cos(rz),math.sin(rz)
        cx,sx=math.cos(rx),math.sin(rx)
        for i in range(first,len(self.v)):
            x,y,z=self.v[i]
            y,z=y*cx-z*sx,y*sx+z*cx
            self.v[i]=(translate[0]+scale*(x*c-y*s),translate[1]+scale*(x*s+y*c),translate[2]+scale*z)

    def finish(self, bevel=.012):
        me=bpy.data.meshes.new(self.name)
        me.from_pydata(self.v,[],self.f)
        me.update()
        o=bpy.data.objects.new(self.name,me)
        bpy.context.collection.objects.link(o)
        for m in M: me.materials.append(m)
        for i,(p,mi) in enumerate(zip(me.polygons,self.mi)):
            p.material_index=mi
            p.use_smooth=i in self.smooth_faces
        uv=me.uv_layers.new(name='Craft atlas')
        for p in me.polygons:
            mi=p.material_index
            if mi>=32: continue
            if p.index in self.face_uv:
                for loop,(u,w) in zip(p.loop_indices,self.face_uv[p.index]):
                    uv.data[loop].uv=((mi%8+.04+.92*u)/8,1-(mi//8+.04+.92*w)/4)
                continue
            # Each small component uses its own surface tile. UV margins stop bleed.
            axis=max(range(3),key=lambda k:abs(p.normal[k]))
            axes=[k for k in range(3) if k!=axis]
            coords=[me.vertices[me.loops[i].vertex_index].co for i in p.loop_indices]
            lo=[min(v[k] for v in coords) for k in axes]
            hi=[max(v[k] for v in coords) for k in axes]
            for i,v in zip(p.loop_indices,coords):
                u=(v[axes[0]]-lo[0])/max(.001,hi[0]-lo[0])
                w=(v[axes[1]]-lo[1])/max(.001,hi[1]-lo[1])
                uv.data[i].uv=((mi%8+.04+.92*u)/8,1-(mi//8+.04+.92*w)/4)
        if bevel:
            mod=o.modifiers.new('Light-catching manufactured edges','BEVEL')
            mod.width=bevel
            mod.segments=2
            mod.limit_method='ANGLE'
            mod.angle_limit=1.0
            bpy.context.view_layer.objects.active=o
            bpy.ops.object.modifier_apply(modifier=mod.name)
        return o

def text_mesh(body, location, size, material=20, rotation=(math.pi/2,0,0)):
    bpy.ops.object.text_add(location=location,rotation=rotation)
    o=bpy.context.object
    o.data.body=body
    o.data.align_x='CENTER'
    o.data.align_y='CENTER'
    o.data.size=size
    o.data.extrude=.0015
    o.data.resolution_u=3
    bpy.ops.object.convert(target='MESH')
    o.data.materials.append(M[material])
    # Text UV lies at the centre of its atlas tile.
    uv=o.data.uv_layers.new(name='Craft atlas')
    for v in uv.data:v.uv=((material%8+.5)/8,1-(material//8+.5)/4)
    return o

def join(name, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    root=objects[0]
    root.name=name
    bpy.context.scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return root
