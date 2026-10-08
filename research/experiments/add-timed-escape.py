from pathlib import Path
p=Path('outputs/snake-navigation.js');s=p.read_text();s=s.replace('function routeTo(space,start,goal)', 'function routeTo(space,start,goal,allowed=null,speed=5,delay=0)');s=s.replace('const queue=new Int32Array(total);let begin=0,end=1,found=-1;', 'const queue=new Int32Array(total),arrival=new Float32Array(total);let begin=0,end=1,found=-1;arrival[start]=delay;');s=s.replace("space.neighbors(i,j=>{if(parent[j]<0){parent[j]=i;queue[end++]=j;}});", "space.neighbors(i,j=>{if(parent[j]<0){const a=position(i),b=position(j),when=arrival[i]+Math.hypot(a.x-b.x,a.y-b.y)/speed;if(allowed&&!allowed(j,when))return;parent[j]=i;arrival[j]=when;queue[end++]=j;}});")
s=s.replace('function analyze(x,y,obs,radius)', 'function analyze(x,y,obs,radius,speed=5,delay=.15)');s=s.replace('future=raster(obs,radius,4);', 'future=raster(obs,radius,8);');s=s.replace('if(closing)escapePath=routeTo(current,start,i=>{const id=future.labels[i];return id>=0&&future.regions[id].area>=Math.max(80,largest*.4,laterArea*1.5);});', '''if(closing) {
      const heads=obs.filter(o=>o.head);
      escapePath=routeTo(current,start,i=>{const id=future.labels[i];return id>=0&&future.regions[id].area>=Math.max(80,largest*.4,laterArea*1.5);},(i,t)=>{
        const p=position(i);
        for(const o of heads) {
          const dx=o.vx*t,dy=o.vy*t,den=dx*dx+dy*dy;
          const q=den?Math.max(0,Math.min(1,((p.x-o.x)*dx+(p.y-o.y)*dy)/den)):0;
          if(Math.hypot(p.x-o.x-q*dx,p.y-o.y-q*dy)<o.radius+.3)return false;
        }
        return true;
      },speed,delay);
    }''');p.write_text(s)
p=Path('outputs/snake-world-controller-50000.js');s=p.read_text().replace('topology.analyze(x,y,fullObs,radius)', 'topology.analyze(x,y,fullObs,radius,baseSpeed,state.inputDelay+.15)');p.write_text(s)
p=Path('work/snake-game/check-topology.cjs');s=p.read_text();s=s.replace("const shut=n.analyze", "const tooLate=n.analyze(0,0,[...box,{x:-3,y:5,vx:5,vy:0,radius:1.3,head:true}],.3);\nassert(tooLate.closing&&!tooLate.escapePath.length&&tooLate.waitLoop,'An exit that seals before arrival must not be advertised as an escape');\nconst shut=n.analyze");p.write_text(s)
