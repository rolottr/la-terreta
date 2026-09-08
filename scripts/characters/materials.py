"""Portable material atlas. Both Blender and the GLB use these same textures."""
import bpy
import math
import random
from functools import lru_cache
from mesh import rgb

# Four atlas fields: fine skin/leather grain, linen, canvas, and woven straw.
CLOTH=['#e9dfc8','#5b8e85','#c97d61','#728aa7','#ae7f87','#425f60','#344b59','#4b5a67','#b5a48b','#444f5b']
from diversity import SPECS
CLOTH += [row[3] for row in SPECS]+[row[4] for row in SPECS]+['#e6dac1']
CANVAS=['#ac7845','#6b7763']
STRAW=['#c7a269']

@lru_cache(maxsize=4096)
def category(color):
    value=rgb(color)
    # Compare chromaticity so tint() retains the same material field.
    total=sum(value) or 1
    value=[v/total for v in value]
    for index,colors in [(3,STRAW),(2,CANVAS),(1,CLOTH)]:
        for candidate in colors:
            c=rgb(candidate);s=sum(c)
            if sum((a-b/s)**2 for a,b in zip(value,c))<.00001:return index
    return 0


def make_material(root):
    n=256;width=n*4;rng=random.Random(742)
    base=[];normal=[]
    for y in range(n):
        for x in range(width):
            tile=x//n;u=x%n
            noise=rng.random()
            weave=(math.sin(u*math.tau/8)*math.cos(y*math.tau/8))
            straw=math.sin((u+y*.45)*math.tau/14)
            shade=[.974+(noise-.5)*.025,.965+weave*.025+(noise-.5)*.025,
                   .951+weave*.036+(noise-.5)*.045,.935+straw*.055+(noise-.5)*.025][tile]
            base.extend((shade,shade,shade,1))
            nx=[(noise-.5)*.045,math.cos(u*math.tau/8)*.13,
                math.cos(u*math.tau/8)*.18,math.cos((u+y*.45)*math.tau/14)*.22][tile]
            ny=[(rng.random()-.5)*.045,math.cos(y*math.tau/8)*.13,
                math.cos(y*math.tau/8)*.18,math.cos((u+y*.45)*math.tau/14)*.08][tile]
            normal.extend((.5+nx,.5+ny,1,1))
    maps=[]
    for name,pixels,space in [('character-fabric',base,'sRGB'),('character-normal',normal,'Non-Color')]:
        image=bpy.data.images.new(name,width=width,height=n)
        image.colorspace_settings.name=space;image.pixels.foreach_set(pixels)
        image.filepath_raw=str(root/'public/textures'/f'{name}.png');image.file_format='PNG';image.save();image.pack();maps.append(image)
    m=bpy.data.materials.new('Character skin linen canvas straw');m.use_nodes=True
    nodes=m.node_tree.nodes;links=m.node_tree.links;bsdf=nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=.79;bsdf.inputs['Specular IOR Level'].default_value=.27
    # glTF exports vertex colors independently; the image is the base-color factor.
    tex=nodes.new('ShaderNodeTexImage');tex.image=maps[0]
    colors=nodes.new('ShaderNodeVertexColor');colors.layer_name='Color'
    mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
    links.new(tex.outputs['Color'],mix.inputs[1]);links.new(colors.outputs['Color'],mix.inputs[2]);links.new(mix.outputs[0],bsdf.inputs['Base Color'])
    texn=nodes.new('ShaderNodeTexImage');texn.image=maps[1]
    norm=nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.3
    links.new(texn.outputs['Color'],norm.inputs['Color']);links.new(norm.outputs['Normal'],bsdf.inputs['Normal'])
    return m
