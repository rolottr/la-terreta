"""Modeled marching-band instruments and the falleras' bouquets."""
import math
from mesh import Mesh
from costumes import flower

GOLD='#c49a44';DARK='#3f3426';SILVER='#bac6c3'

def bell(m,x,y,z,r,length):
    vertices=[];faces=[];sides=32;rows=9
    for inner in [False,True]:
        for k in range(rows):
            t=k/(rows-1);radius=.009+(r-.009)*t**3
            if inner:radius=max(.003,radius-.0025)
            for j in range(sides):
                a=j*math.tau/sides;vertices.append((x+radius*math.sin(a),y+radius*math.cos(a),z+t*length))
    for layer in [0,1]:
        off=layer*rows*sides
        for k in range(rows-1):
            for j in range(sides):
                a=off+k*sides+j;b=off+k*sides+(j+1)%sides
                f=(a,b,b+sides,a+sides);faces.append(tuple(reversed(f))if layer else f)
    for j in range(sides):
        a=(rows-1)*sides+j;b=(rows-1)*sides+(j+1)%sides
        faces.append((a,b,b+rows*sides,a+rows*sides))
    m.poly(vertices,faces,GOLD)
    m.tube([(x+r*math.sin(a),y+r*math.cos(a),z+length)for a in [j*math.tau/32 for j in range(33)]],.003,GOLD,6)


def instrument_parts(p):
    role=p.get('band');parts=[]
    if p.get('fallera'):
        m=Mesh()
        for j in range(7):
            a=j*2.39996;x=-.307+.04*math.sin(a);y=.73+.025*(j%3);z=.073+.035*math.cos(a)
            m.tube([(-.30,.70,.03),(x,y,z)],.002,'#5b7650',5);flower(m,(x,y,z),.021,'#f1dfb3',petals=6)
        return [('bouquet',m)]
    if not role:return []
    m=Mesh()
    if role in ['trumpet','trombone']:
        y=1.493
        m.tube([(0,1.52,.119),(0,y,.16),(0,y,.37)],.010,GOLD,12)
        if role=='trumpet':
            m.tube([(0,y,.23),(-.058,y-.053,.30),(-.06,y-.058,.42),(.025,y-.035,.435),(.025,y,.34)],.011,GOLD,12)
            for j in range(3):
                z=.255+j*.034;m.tube([(-.014,y-.052,z),(-.014,y+.026,z)],.007,GOLD,10)
                m.ellipsoid((-.014,y+.03,z),(.011,.003,.009),SILVER,10,6)
            bell(m,.024,y,.35,.073,.21)
        else:
            m.tube([(-.033,y,.2),(-.058,y-.046,.28),(-.058,y-.046,.67),(.022,y-.046,.69),(.022,y-.046,.25)],.009,GOLD,10)
            bell(m,.033,y+.025,.24,.076,.28)
            slide=Mesh();slide.tube([(-.058,y-.046,.47),(-.058,y-.046,.79),(.022,y-.046,.80),(.022,y-.046,.47)],.007,SILVER,10);parts.append(('slide',slide))
    if role=='tuba':
        m.tube([(.04,1.49,.13),(.12,1.44,.18),(.17,1.14,.27),(.10,.91,.28),(-.1,.92,.29),(-.17,1.05,.3),(-.13,1.28,.3),(-.02,1.31,.28),(.08,1.10,.28),(.02,1.00,.28),(-.07,1.1,.29)],.028,GOLD,16)
        for j in range(3):m.tube([(-.045+j*.039,1.1,.35),(-.045+j*.039,1.30,.35)],.012,GOLD,10)
        bell(m,-.11,1.32,.23,.13,.23)
    if role=='clarinet':
        m.tube([(0,1.52,.122),(0,1.40,.22),(0,1.23,.35),(0,1.06,.46)],[.011,.015,.017,.023],'#24292a',16)
        for j in range(9):
            t=j/8;y=1.42-t*.32;z=.21+t*.25
            m.ellipsoid((.012,y,z+.012),(.008,.008,.005),SILVER,10,6)
    if role in ['snare','bass']:
        radius=.14 if role=='snare' else .235
        y=.99 if role=='snare' else 1.06;z=.29 if role=='snare' else .33
        if role=='snare':
            m.rings([(y-.12,radius,radius,0,z),(y,radius,radius,0,z)],'#7b434a',32)
            m.rings([(y-.124,radius+.007,radius+.007,0,z),(y-.109,radius+.007,radius+.007,0,z)],SILVER,32)
            m.rings([(y-.005,radius+.008,radius+.008,0,z),(y+.005,radius+.008,radius+.008,0,z)],'#e8dfc8',32)
            for j in range(8):
                a=j*math.tau/8;m.tube([(radius*math.sin(a),y-.11,z+radius*math.cos(a)),(radius*math.sin(a),y,z+radius*math.cos(a))],.004,SILVER,6)
        else:
            # Bass drum is vertical, with front and rear heads and tension rods.
            temp=Mesh();temp.rings([(-.10,radius,radius,0,0),(.10,radius,radius,0,0)],'#844b51',40)
            for v in temp.vertices:m.vertices.append((v[0],y+v[2],z+v[1]))
            m.faces.extend(temp.faces);m.colors.extend(temp.colors)
            for depth in [-.107,.107]:
                m.ellipsoid((0,y,z+depth),(radius,.235,.005),'#e7dfc8',40,12)
                m.tube([(radius*math.sin(a),y+radius*math.cos(a),z+depth)for a in [j*math.tau/40 for j in range(41)]],.006,SILVER,6)
            for j in range(10):
                a=j*math.tau/10;m.tube([(radius*math.sin(a),y+radius*math.cos(a),z-.1),(radius*math.sin(a),y+radius*math.cos(a),z+.1)],.005,SILVER,6)
        for s in [-1,1]:m.ribbon([(s*.1,1.35,.095),(s*.09,y+.03,z-.1)],.028,'#c9c3ac')
        for s,key in [(-1,'L'),(1,'R')]:
            stick=Mesh();stick.tube([(s*.308,.699,.041),(s*.308,.652,.22)],.004,'#b89967',8)
            if role=='bass':stick.ellipsoid((s*.308,.651,.226),(.025,.024,.024),'#eee3c7',12,8)
            parts.append(('stick_'+key,stick))
    if role=='cymbals':
        for s,key in [(-1,'L'),(1,'R')]:
            cymbal=Mesh();cymbal.ellipsoid((s*.308,.71,.085),(.116,.116,.008),GOLD,32,10)
            cymbal.ellipsoid((s*.308,.71,.092),(.03,.03,.014),GOLD,20,8)
            parts.append(('cymbal_'+key,cymbal))
    if m.faces:parts.insert(0,('instrument',m))
    return parts
