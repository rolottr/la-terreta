"""Blender skin weights and reusable full-body animation clips."""
import bpy
import math
from mathutils import Vector,Quaternion,Matrix

CLIPS={'Idle':3,'Walk':1,'Run':2/3,'Cycle':1,'March':1.2,
       'Sit':4,'Row':2.327,'Talk':3,'Watch':4,'Drink':6,'Serve':3,'Dance':3,'OpenAwning':4}


def xyz(p):return Vector((p[0],-p[2],p[1]))


def make_rig(name,root):
    data=bpy.data.armatures.new(name+'_skeleton');rig=bpy.data.objects.new(name+'_rig',data)
    bpy.context.collection.objects.link(rig);rig.parent=root
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    defs=[('Root',(0,0,0),(0,.14,0),None),('Hips',(0,.86,0),(0,1.0,0),'Root'),
          ('Spine',(0,1.0,0),(0,1.22,0),'Hips'),('Chest',(0,1.22,0),(0,1.39,0),'Spine'),
          ('Neck',(0,1.39,0),(0,1.515,0),'Chest'),('Head',(0,1.515,0),(0,1.80,0),'Neck'),
          ('Slide',(0,1.447,.45),(0,1.447,.55),'Chest')]
    for s,k in [(-1,'L'),(1,'R')]:
        defs += [('Thigh_'+k,(s*.087,.86,0),(s*.087,.455,.01),'Hips'),
                 ('Shin_'+k,(s*.087,.455,.01),(s*.087,.12,0),'Thigh_'+k),
                 ('Foot_'+k,(s*.087,.12,0),(s*.087,.048,.122),'Shin_'+k),
                 ('Toe_'+k,(s*.087,.048,.122),(s*.087,.048,.17),'Foot_'+k),
                 ('UpperArm_'+k,(s*.167,1.315,-.008),(s*.264,.982,0),'Chest'),
                 ('Forearm_'+k,(s*.264,.982,0),(s*.302,.76,.028),'UpperArm_'+k),
                 ('Hand_'+k,(s*.302,.76,.028),(s*.308,.68,.041),'Forearm_'+k)]
    for key,a,b,parent in defs:
        bone=data.edit_bones.new(name+'_'+key);bone.head=xyz(a);bone.tail=xyz(b)
        if parent:bone.parent=data.edit_bones[name+'_'+parent]
        bone.use_deform=key!='Root'
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False);rig.show_in_front=True
    return rig


def mix(a,b,t):
    t=max(0,min(1,t));return [(a,1-t),(b,t)]


def weights(part,x,y,z,p):
    if part=='head':return [('Head' if y>1.512 else 'Neck',1)]
    if part.startswith('leg_'):
        k=part[-1]
        if y>.835:return mix('Thigh_'+k,'Hips',(y-.835)/.06)
        if y>.50:return [('Thigh_'+k,1)]
        if y>.40:return mix('Shin_'+k,'Thigh_'+k,(y-.40)/.1)
        if y>.20:return [('Shin_'+k,1)]
        if y>.11:return mix('Foot_'+k,'Shin_'+k,(y-.11)/.09)
        return [('Foot_'+k,1)]
    if part.startswith('arm_'):
        k=part[-1]
        if y>1.31:return mix('UpperArm_'+k,'Chest',(y-1.31)/.06)
        if y>1.025:return [('UpperArm_'+k,1)]
        if y>.94:return mix('Forearm_'+k,'UpperArm_'+k,(y-.94)/.085)
        if y>.785:return [('Forearm_'+k,1)]
        if y>.735:return mix('Hand_'+k,'Forearm_'+k,(y-.735)/.05)
        return [('Hand_'+k,1)]
    if part=='bouquet':return [('Hand_L',1)]
    if part.startswith(('stick_','cymbal_')):return [('Hand_'+part[-1],1)]
    if part=='slide':return [('Slide',1)]
    if part=='instrument':return [('Chest',1)]
    if y>1.49:return [('Head',1)]
    if y>1.40:return [('Neck',1)]
    if z<-.13 and y>.95:return [('Chest',1)]
    if (p.get('fallera') or p.get('outfit')=='dress') and y<.99:return [('Hips',1)]
    if y>1.23:return [('Chest',1)]
    if y>1.12:return mix('Spine','Chest',(y-1.12)/.11)
    if y>.98:return mix('Hips','Spine',(y-.98)/.14)
    return [('Hips',1)]


def bind_part(obj,part,p,rig):
    name=p['name']
    groups={b.name:obj.vertex_groups.new(name=b.name)for b in rig.data.bones if b.use_deform}
    for vertex in obj.data.vertices:
        x,z,y=vertex.co;x=float(x);y=float(y);z=-float(z)
        for bone,weight in weights(part,x,y,z,p):
            if weight>1e-6:groups[name+'_'+bone].add([vertex.index],weight,'REPLACE')


def aim(rig,key,target):
    pb=rig.pose.bones[key];head=pb.head.copy();direction=(target-head).normalized()
    delta=(pb.tail-head).normalized().rotation_difference(direction)
    pb.matrix=Matrix.Translation(head)@delta.to_matrix().to_4x4()@pb.matrix.to_quaternion().to_matrix().to_4x4()
    bpy.context.view_layer.update()


def ik(rig,name,upper,lower,end,target,pole):
    a=rig.pose.bones[name+'_'+upper];b=rig.pose.bones[name+'_'+lower]
    head=a.head.copy();target=xyz(target);axis=target-head
    d=max(.001,min(axis.length,a.length+b.length-.0001));axis.normalize()
    target=head+axis*d
    n=xyz(pole);n=(n-axis*n.dot(axis)).normalized()
    along=(a.length*a.length-b.length*b.length+d*d)/(2*d)
    elbow=head+axis*along+n*math.sqrt(max(0,a.length*a.length-along*along))
    aim(rig,name+'_'+upper,elbow);aim(rig,name+'_'+lower,target)


def arm_targets(role,phase):
    beat=math.sin(phase*2)
    return {
      'trumpet':[(-.065,1.405,.285),(.055,1.43,.32)],
      'trombone':[(-.065,1.405,.24),(.065,1.385,.48+.07*beat)],
      'tuba':[(-.13,1.14,.33),(.035,1.27,.37)],
      'clarinet':[(-.025,1.38,.25),(.025,1.22,.36)],
      'snare':[(-.13,1.08+.04*beat,.26),(.13,1.08-.04*beat,.26)],
      'bass':[(-.18,1.14+.04*beat,.35),(.18,1.14-.04*beat,.35)],
      'cymbals':[(-.20+.11*max(0,beat),1.23,.34),(.20-.11*max(0,beat),1.23,.34)],
    }.get(role)


def animate(rig,p,clips=None):
    name=p['name'];fps=30;bpy.context.scene.render.fps=fps
    rig.animation_data_create()
    for clip,duration in (CLIPS if clips is None else clips).items():
        action=bpy.data.actions.new(name+'_'+clip);rig.animation_data.action=action
        total=round(duration*fps)
        for frame in range(0,total+1):
            phase=frame/total*math.tau
            angles={};locations={}
            angles['Chest']=(.013*math.sin(phase),0,.009*math.cos(phase))
            angles['Head']=(.018*math.sin(phase),.035*math.sin(phase),.012*math.sin(phase))
            if clip=='Idle':
                locations['Hips']=(0,-.006+.002*math.sin(phase),0)
                for s,k in [(-1,'L'),(1,'R')]:
                    angles['UpperArm_'+k]=(-.025+.012*math.sin(phase),0,s*.012)
                    angles['Forearm_'+k]=(-.14+.018*math.sin(phase),0,0)
            if clip in ['Walk','Run','March']:
                running=clip=='Run';marching=clip=='March'
                # Weight rises over the planted leg in a walk; a run compresses
                # over the stance foot and rises during the flight interval.
                bob=(-.080-.045*math.cos(phase*2-.115*math.tau*2)) if running else (-.037-.024*math.cos(phase*2))
                angles['Chest']=(.14 if running else .025,.075*math.sin(phase),.016*math.sin(phase))
                angles['Hips']=(0,-.055*math.sin(phase),-.025*math.sin(phase))
                angles['Head']=(-.07 if running else -.012,-.035*math.sin(phase),0)
                locations['Hips']=(.014*math.sin(phase),bob,0)
                for s,k in [(-1,'L'),(1,'R')]:
                    wave=math.cos(phase+(math.pi if s>0 else 0))
                    angles['UpperArm_'+k]=(wave*(.66 if running else .32)-(.12 if running else 0),0,s*.035)
                    angles['Forearm_'+k]=(-1.38+.13*wave if running else -.20-.15*max(0,-wave),0,0)
                    angles['Hand_'+k]=(.035*wave,0,0)
            if p.get('band')=='trombone' and clip in ['Idle','March']:
                locations['Slide']=(0,.065*math.sin(phase*2),0)
            if clip=='Cycle':
                # The rider sits above the saddle at bike Y=1.075. The game
                # places the character origin .35 m above the bicycle origin.
                angles['Spine']=(.23,0,0);angles['Chest']=(.14,0,0)
                angles['Head']=(-.23,.018*math.sin(phase),0)
                locations['Hips']=(0,-.055,-.30)
            if clip in ['Sit','Row']:
                locations['Hips']=(0,-.27,0)
                angles['Spine']=(.05,0,0)
                angles['Head']=(.02,.08*math.sin(phase),0)
            if clip=='Row':
                angles['Spine']=(.05+.14*math.sin(phase),0,0)
                angles['Chest']=(.06*math.sin(phase),0,0)
            if clip=='Talk':
                angles['Head']=(.045*math.sin(phase*2),.06*math.sin(phase),0)
                angles['UpperArm_R']=(-.5-.12*math.sin(phase),0,.18)
                angles['Forearm_R']=(-.65-.20*math.sin(phase*2),0,0)
                angles['Hand_R']=(0,.16*math.sin(phase),0)
            if clip=='Watch':
                angles['Head']=(-.025,.14*math.sin(phase),0)
                angles['Forearm_L']=(-.5,0,0)
                angles['Forearm_R']=(-.45,0,0)
            if clip in ['Drink','Serve']:
                u=frame/total
                lift=math.sin(math.pi*u)**.5
                angles['Head']=( -.10*lift if clip=='Drink' else .04,0,0)
                angles['Chest']=(.04*lift,0,0)
            if clip=='Dance':
                locations['Hips']=(.035*math.sin(phase),-.02+.015*math.cos(phase*2),0)
                angles['Hips']=(0,.10*math.sin(phase),.06*math.sin(phase))
                angles['Chest']=(0,-.12*math.sin(phase),-.04*math.sin(phase))
                angles['Head']=(0,.07*math.sin(phase),0)
                for s,k in [(-1,'L'),(1,'R')]:
                    angles['UpperArm_'+k]=(-.75,0,s*.45)
                    angles['Forearm_'+k]=(-.65,0,0)
            for bone in rig.pose.bones:
                suffix=bone.name[len(name)+1:];x,y,z=angles.get(suffix,(0,0,0))
                rest=bone.bone.matrix_local.to_quaternion()
                q=Quaternion((1,0,0),x)@Quaternion((0,0,1),y)@Quaternion((0,-1,0),z)
                bone.rotation_mode='QUATERNION';bone.rotation_quaternion=rest.inverted()@q@rest
                bone.location=locations.get(suffix,(0,0,0))
                if clip in ['Idle','Walk','Run','Cycle','March'] and suffix.startswith('Hand_'):
                    # Relaxed running hands face inward, with the thumb up.
                    side=-1 if suffix.endswith('_L') else 1
                    bone.rotation_quaternion @= Quaternion((0,1,0),-side*math.pi*.5)
            bpy.context.view_layer.update()
            if clip in ['Sit','Row','Dance']:
                for s,k in [(-1,'L'),(1,'R')]:
                    lift=.025*max(0,math.sin(phase+(math.pi if s>0 else 0))) if clip=='Dance' else 0
                    ik(rig,name,'Thigh_'+k,'Shin_'+k,'Foot_'+k,
                       (s*.12,.135+lift,.34 if clip in ['Sit','Row'] else .04),(s*.1,0,1))
                    foot=rig.pose.bones[name+'_Foot_'+k]
                    foot.matrix=Matrix.Translation(foot.head)@foot.bone.matrix_local.to_quaternion().to_matrix().to_4x4()
                    bpy.context.view_layer.update()
                    if clip in ['Sit','Row']:
                        ik(rig,name,'UpperArm_'+k,'Forearm_'+k,'Hand_'+k,(s*.17,.69,.26),(s*.5,-1,0))
            if clip=='OpenAwning':
                for s,k in [(-1,'L'),(1,'R')]:
                    pull=.5+.5*math.sin(phase+(math.pi if s<0 else 0))
                    ik(rig,name,'UpperArm_'+k,'Forearm_'+k,'Hand_'+k,(s*.06,1.75-.43*pull,.18),(s*.5,-.2,0))
            if clip in ['Drink','Serve']:
                lift=math.sin(math.pi*frame/total)**.5
                target=(.12,.92+.50*lift,.23-.06*lift) if clip=='Drink' else (.12,1.0+.05*lift,.18+.36*lift)
                ik(rig,name,'UpperArm_R','Forearm_R','Hand_R',target,(.8,-.4,0))
            if clip in ['Walk','Run','March']:
                running=clip=='Run';marching=clip=='March'
                stance=.23 if running else .60
                stroke=.72 if running else .58 if not marching else .44
                for s,k in [(-1,'L'),(1,'R')]:
                    u=(frame/total+(.5 if s>0 else 0))%1
                    if u<stance:
                        t=u/stance
                        forward=(.30 if running else stroke*.5)-stroke*t
                        # Heel contact, a level mid-stance, then toe release.
                        roll=-.10*max(0,1-t/.22)+(.38 if running else .28)*max(0,(t-.65)/.35)
                        lift=0
                    else:
                        t=(u-stance)/(1-stance)
                        # A quintic swing gives a smooth heel recovery and reach.
                        ease=t*t*t*(10+t*(-15+6*t))
                        forward=(.30 if running else stroke*.5)-stroke+stroke*ease
                        lift=(.31 if running else .105)*math.sin(math.pi*t)**1.3
                        roll=(.38 if running else .28)*(1-t)**4-.18*math.sin(math.pi*t)-.10*max(0,(t-.82)/.18)
                    ankle=.12*math.cos(roll)+(.19 if roll>0 else -.055)*math.sin(roll)
                    target=(s*.092,ankle+lift,forward+.015)
                    ik(rig,name,'Thigh_'+k,'Shin_'+k,'Foot_'+k,target,(s*.04,0,1))
                    foot=rig.pose.bones[name+'_Foot_'+k]
                    foot.matrix=Matrix.Translation(foot.head)@Quaternion((1,0,0),roll).to_matrix().to_4x4()@foot.bone.matrix_local.to_quaternion().to_matrix().to_4x4()
                    bpy.context.view_layer.update()
            if clip=='Cycle':
                for s,k in [(-1,'L'),(1,'R')]:
                    wave=phase+(math.pi if s>0 else 0)
                    # Same circular crank and shoe contact used by cycleRig.
                    target=(s*.22,.48-.35-.145*math.sin(wave)+.139,-.08+.145*math.cos(wave)-.065)
                    ik(rig,name,'Thigh_'+k,'Shin_'+k,'Foot_'+k,target,(s*.14,0,1))
                    foot=rig.pose.bones[name+'_Foot_'+k]
                    foot.matrix=Matrix.Translation(foot.head)@foot.bone.matrix_local.to_quaternion().to_matrix().to_4x4()
                    bpy.context.view_layer.update()
                    ik(rig,name,'UpperArm_'+k,'Forearm_'+k,'Hand_'+k,(s*.28,1.027,.282),(s*.5,-1,0))
            if p.get('band') and clip in ['Idle','March']:
                for s,k,target in zip([-1,1],['L','R'],arm_targets(p['band'],phase)):
                    ik(rig,name,'UpperArm_'+k,'Forearm_'+k,'Hand_'+k,target,(s*.5,-1,-.15))
            for bone in rig.pose.bones:
                bone.keyframe_insert('rotation_quaternion',frame=frame,group=bone.name)
                if bone.name.endswith(('_Hips','_Slide')):bone.keyframe_insert('location',frame=frame,group=bone.name)
        for layer in action.layers:
            for action_strip in layer.strips:
                for channelbag in action_strip.channelbags:
                    for curve in channelbag.fcurves:
                        for key in curve.keyframe_points:key.interpolation='LINEAR'
        rig.animation_data.action=None
        track=rig.animation_data.nla_tracks.new();track.name=name+'_'+clip
        strip=track.strips.new(name+'_'+clip,0,action);strip.action_frame_start=0;strip.action_frame_end=total
        track.mute=True
    for pb in rig.pose.bones:pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0)
    bpy.context.view_layer.update()
