"""Smile the existing face without adding or removing any mesh detail."""
import math

def add_smile(mesh):
    if not mesh.data.shape_keys:mesh.shape_key_add(name='Basis')
    key=mesh.data.shape_keys.key_blocks.get('Smile') or mesh.shape_key_add(name='Smile')
    key.value=0
    for vertex,out in zip(mesh.data.vertices,key.data):
        out.co=vertex.co
        x,back,height=vertex.co
        if back>-.045 or not 1.54<height<1.64 or abs(x)>.10:continue
        # Smooth falloff moves lip creases, cheeks and the face surface together.
        weight=math.exp(-((height-1.581)/.026)**2)*math.exp(-(x/.065)**4)
        front=min(1,max(0,(-back-.045)/.035))
        corner=min(1,abs(x)/.027)
        out.co.z+=.020*corner*weight*front
        out.co.x+=x*.20*weight*front
        out.co.y-=.0025*weight*front
