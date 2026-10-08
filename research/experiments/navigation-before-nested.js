/* Pure geometry: configuration-space regions and escape routes.
   Uses supplied observations, without reading or changing game state. */
(() => {
  const width=97,half=48,total=width*width;
  const position=i=>({x:i%width-half,y:Math.floor(i/width)-half});
  const index=(x,y)=>{const col=Math.round(x)+half,row=Math.round(y)+half;return col<0||row<0||col>=width||row>=width?-1:row*width+col;};
  function headSegments(o,t) {
    if(t<=0)return [{x:o.x,y:o.y,dx:0,dy:0}];
    const earliest=Math.max(0,t-(o.tailSeconds??Infinity));
    if(!o.trail?.length)return [{x:o.x+o.vx*earliest,y:o.y+o.vy*earliest,dx:o.vx*(t-earliest),dy:o.vy*(t-earliest)}];
    const segments=[];
    for(let i=1;i<o.trail.length;i++) {
      const a=o.trail[i-1],b=o.trail[i];if(a.t>=t)break;if(b.t<earliest)continue;
      const lo=Math.max(0,(earliest-a.t)/(b.t-a.t)),hi=Math.min(1,(t-a.t)/(b.t-a.t));
      segments.push({x:a.x+(b.x-a.x)*lo,y:a.y+(b.y-a.y)*lo,dx:(b.x-a.x)*(hi-lo),dy:(b.y-a.y)*(hi-lo)});
    }
    const last=o.trail.at(-1);
    if(last.t<t)segments.push({x:last.x,y:last.y,dx:0,dy:0});
    return segments;
  }
  function headClearance(o,x,y,t) {
    let value=Infinity;
    for(const segment of headSegments(o,t)) {
      const ax=segment.x,ay=segment.y,dx=segment.dx,dy=segment.dy,den=dx*dx+dy*dy;
      const q=den?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/den)):0;
      value=Math.min(value,Math.hypot(x-ax-q*dx,y-ay-q*dy)-o.radius-.2*Math.min(t,1));
    }
    return value;
  }
  function clipTrails(heads,bodies) {
    const bins=new Map(),cell=3,key=(x,y)=>x+','+y;let maximumRadius=0,cuts=0;
    for(const b of bodies) {
      maximumRadius=Math.max(maximumRadius,b.physical);
      for(let y=Math.floor((Math.min(b.y,b.y2??b.y)-b.physical)/cell);y<=Math.floor((Math.max(b.y,b.y2??b.y)+b.physical)/cell);y++)for(let x=Math.floor((Math.min(b.x,b.x2??b.x)-b.physical)/cell);x<=Math.floor((Math.max(b.x,b.x2??b.x)+b.physical)/cell);x++) {
        const k=key(x,y);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(b);
      }
    }
    for(const head of heads) {
      if(head.invincible || !head.trail?.length)continue;
      const reach=Math.ceil(head.physical/cell);
      for(let i=1;i<head.trail.length;i++) {
        const p=head.trail[i];let blocked=!head.boss&&Math.max(Math.abs(p.x),Math.abs(p.y))>48.55-head.physical;
        const cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell);
        for(let dy=-reach;dy<=reach&&!blocked;dy++)for(let dx=-reach;dx<=reach&&!blocked;dx++) {
          for(const b of bins.get(key(cx+dx,cy+dy))??[]) {
            if(b.enemy===head.enemy || b.ttl<p.t+.15)continue;
            const dx=(b.x2??b.x)-b.x,dy=(b.y2??b.y)-b.y,den=dx*dx+dy*dy,q=den?Math.max(0,Math.min(1,((p.x-b.x)*dx+(p.y-b.y)*dy)/den)):0;
            if(Math.hypot(p.x-b.x-q*dx,p.y-b.y-q*dy)<head.physical+b.physical-.1){blocked=true;break;}
          }
        }
        if(blocked){head.trail=head.trail.slice(0,i+1);head.predictedBarrierTime=p.t;cuts++;break;}
      }
    }
    return cuts;
  }
  function raster(obs,radius,future,threshold=-.2) {
    const arenaLimit=window.__snakeRuntime?.arenaLimit??46;
    const clear=new Float32Array(total);
    for(let i=0;i<total;i++){const p=position(i);clear[i]=arenaLimit-radius-Math.max(Math.abs(p.x),Math.abs(p.y));}
    for(const source of obs) {
     if(!source.head && source.ttl!==undefined && future>source.ttl+.25)continue;
     for(const segment of source.head?headSegments(source,future):[{x:source.x,y:source.y,dx:(source.x2??source.x)-source.x,dy:(source.y2??source.y)-source.y}]) {
      const o={...source,x:segment.x,y:segment.y},dx=segment.dx,dy=segment.dy;
      const r=o.radius+(o.head?.2*Math.min(future,1):0),reach=r+3,den=dx*dx+dy*dy;
      const lx=Math.max(0,Math.ceil(Math.min(o.x,o.x+dx)-reach)+half),hx=Math.min(width-1,Math.floor(Math.max(o.x,o.x+dx)+reach)+half);
      const ly=Math.max(0,Math.ceil(Math.min(o.y,o.y+dy)-reach)+half),hy=Math.min(width-1,Math.floor(Math.max(o.y,o.y+dy)+reach)+half);
      for(let row=ly;row<=hy;row++)for(let col=lx;col<=hx;col++) {
        const x=col-half,y=row-half,q=den?Math.max(0,Math.min(1,((x-o.x)*dx+(y-o.y)*dy)/den)):0;
        const i=row*width+col;
        clear[i]=Math.min(clear[i],Math.hypot(x-o.x-q*dx,y-o.y-q*dy)-r);
      }
    }
    }
    const labels=new Int32Array(total);labels.fill(-1);
    const regions=[],queue=new Int32Array(total);
    function neighbors(i,visit) {
      const row=Math.floor(i/width),col=i%width;
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++) {
        if(!dc&&!dr)continue;
        const nr=row+dr,nc=col+dc;
        if(nr<0||nc<0||nr>=width||nc>=width)continue;
        const j=nr*width+nc;
        if(clear[j]<threshold || (dr&&dc&&(clear[row*width+nc]<threshold||clear[nr*width+col]<threshold)))continue;
        visit(j);
      }
    }
    for(let start=0;start<total;start++) {
      if(clear[start]<threshold||labels[start]>=0)continue;
      const region={id:regions.length,area:0,maximumClearance:-Infinity,roomiest:start};
      let begin=0,end=1;queue[0]=start;labels[start]=region.id;
      while(begin<end) {
        const i=queue[begin++];region.area++;
        if(clear[i]>region.maximumClearance){region.maximumClearance=clear[i];region.roomiest=i;}
        neighbors(i,j=>{if(labels[j]<0){labels[j]=region.id;queue[end++]=j;}});
      }
      regions.push(region);
    }
    return {clear,labels,regions,neighbors,largest:regions.reduce((a,b)=>!a||b.area>a.area?b:a,null)};
  }
  function nearest(space,x,y,allowed=null) {
    let best=-1,distance=Infinity;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++) {
      const i=index(x+dx,y+dy);if(i<0||space.labels[i]<0 || allowed&&!allowed(i))continue;
      const p=position(i),d=Math.hypot(p.x-x,p.y-y);
      if(d<distance){distance=d;best=i;}
    }
    return best;
  }
  function routeTo(space,start,goal,allowed=null,speed=5,delay=0) {
    if(start<0)return [];
    const parent=new Int32Array(total);parent.fill(-1);
    const queue=new Int32Array(total),arrival=new Float32Array(total);let begin=0,end=1,found=-1;arrival[start]=delay;
    queue[0]=start;parent[start]=start;
    while(begin<end) {
      const i=queue[begin++];
      if(i!==start&&goal(i)){found=i;break;}
      space.neighbors(i,j=>{if(parent[j]<0){const a=position(i),b=position(j),when=arrival[i]+Math.hypot(a.x-b.x,a.y-b.y)/speed;if(allowed&&!allowed(j,when))return;parent[j]=i;arrival[j]=when;queue[end++]=j;}});
    }
    if(found<0)return [];
    const path=[];
    for(let i=found;i!==start;i=parent[i])path.push(position(i));
    return path.reverse();
  }
  function regionAt(space,x,y) {
    const i=index(x,y);return i<0||space.labels[i]<0?null:space.regions[space.labels[i]];
  }
  function wrapAt(x,y,obs) {
    const groups=new Map();
    for(const o of obs)if(!o.head){if(!groups.has(o.enemy))groups.set(o.enemy,[]);groups.get(o.enemy).push(o);}
    const threats=[];
    for(const [enemy,segments] of groups) {
      let lastAngle=null,lastHeading=null,sweep=0,turn=0,arcLength=0,maxRadius=0;
      function reset(){lastAngle=null;lastHeading=null;sweep=0;turn=0;arcLength=0;maxRadius=0;}
      for(const o of segments) {
        if(o.x2===undefined)continue;
        const distance=Math.max(Math.hypot(o.x-x,o.y-y),Math.hypot(o.x2-x,o.y2-y));
        if(distance>22 || o.ttl<2){reset();continue;}
        const begin=Math.atan2(o.y-y,o.x-x),end=Math.atan2(o.y2-y,o.x2-x),heading=Math.atan2(o.y2-o.y,o.x2-o.x);
        if(lastAngle===null)lastAngle=begin;
        const delta=Math.atan2(Math.sin(end-lastAngle),Math.cos(end-lastAngle));
        if(sweep*delta<-.15){reset();lastAngle=begin;}
        sweep+=Math.atan2(Math.sin(end-lastAngle),Math.cos(end-lastAngle));
        if(lastHeading!==null)turn+=Math.atan2(Math.sin(heading-lastHeading),Math.cos(heading-lastHeading));
        arcLength+=Math.hypot(o.x2-o.x,o.y2-o.y);maxRadius=Math.max(maxRadius,distance);
        lastAngle=end;lastHeading=heading;
        if(Math.abs(sweep)>=2 && Math.abs(turn)>=1.2 && sweep*turn>0 && arcLength>=12) {
          threats.push({enemy,sweep,turn,radius:maxRadius,length:arcLength});break;
        }
      }
    }
    return threats;
  }
  // A head may close onto any reachable point of its own body. Each prefix
  // plus that closing chord is a potential enclosure, regardless of its scale.
  function trapAt(x,y,obs) {
    const groups=new Map(),heads=new Map();
    for(const o of obs)if(o.head)heads.set(o.enemy,o);else{if(!groups.has(o.enemy))groups.set(o.enemy,[]);groups.get(o.enemy).push(o);}
    const result=[];
    for(const [enemy,segments] of groups) {
      const h=heads.get(enemy)??segments[0];if(!h)continue;
      const reach=(h.maxSpeed??10)*3.5,hx=h.x-x,hy=h.y-y;
      let ax=hx,ay=hy,sweep=0,length=0;
      for(const o of segments) {
        if(o.x2===undefined)continue;
        for(const p of [{x:o.x,y:o.y},{x:o.x2,y:o.y2}]) {
          const bx=p.x-x,by=p.y-y;
          sweep+=Math.atan2(ax*by-ay*bx,ax*bx+ay*by);length+=Math.hypot(bx-ax,by-ay);ax=bx;ay=by;
          const distance=Math.hypot(p.x-h.x,p.y-h.y);
          if(length<16 || distance>reach || length<distance*1.25)continue;
          const winding=sweep+Math.atan2(bx*hy-by*hx,bx*hx+by*hy);
          if(Math.abs(winding)>Math.PI) {
            result.push({enemy,potentialLoop:true,closureDistance:distance,closureSeconds:distance/(h.maxSpeed??10),length,radius:Math.hypot(bx,by)});break;
          }
        }
        if(result.at(-1)?.enemy===enemy)break;
      }
    }
    return result;
  }
  function dangerAt(x,y,obs) {return [...trapAt(x,y,obs),...wrapAt(x,y,obs)].filter((o,i,a)=>a.findIndex(b=>b.enemy===o.enemy)===i);}
  function territoryMask(obs) {
    const mask=new Uint8Array(total),groups=new Map(),heads=new Map();
    for(const o of obs)if(o.head)heads.set(o.enemy,o);else{if(!groups.has(o.enemy))groups.set(o.enemy,[]);groups.get(o.enemy).push(o);}
    for(const [enemy,segments] of groups) {
      const h=heads.get(enemy)??segments[0];if(!h)continue;
      const points=[h],reach=(h.maxSpeed??10)*3.5;let length=0;
      for(const o of segments) {
        if(o.x2===undefined)continue;
        for(const p of [{x:o.x,y:o.y},{x:o.x2,y:o.y2}]) {
          const last=points.at(-1),step=Math.hypot(p.x-last.x,p.y-last.y);if(step<.01)continue;
          length+=step;points.push(p);
          const distance=Math.hypot(p.x-h.x,p.y-h.y);if(length<16||distance>reach||length<distance*1.25)continue;
          const low=Math.max(-half,Math.ceil(Math.min(...points.map(p=>p.y)))),high=Math.min(half,Math.floor(Math.max(...points.map(p=>p.y))));
          for(let y=low;y<=high;y++) {
            const cuts=[];
            for(let k=0;k<points.length;k++) {
              const a=points[k],b=points[(k+1)%points.length];
              if(a.y<=y&&b.y>y)cuts.push({x:a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y),sign:1});
              else if(b.y<=y&&a.y>y)cuts.push({x:a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y),sign:-1});
            }
            cuts.sort((a,b)=>a.x-b.x);let winding=0,previous=0;
            for(const cut of cuts) {
              if(winding)for(let x=Math.max(-half,Math.ceil(previous));x<=Math.min(half,Math.floor(cut.x));x++)mask[index(x,y)]=1;
              winding+=cut.sign;previous=cut.x;
            }
          }
        }
      }
    }
    return mask;
  }
  function analyze(x,y,obs,radius,speed=5,delay=.15) {
    const surrounding=dangerAt(x,y,obs),territory=surrounding.length?territoryMask(obs):null;
    const current=raster(obs,radius,0),future=raster(obs,radius,8);
    const start=nearest(current,x,y),futureStart=nearest(future,x,y);
    const room=start<0?null:current.regions[current.labels[start]],later=futureStart<0?null:future.regions[future.labels[futureStart]];
    const area=room?.area??0,laterArea=later?.area??0,largest=future.largest?.area??0;
    let accessibleLargest=0;
    if(room)for(let i=0;i<total;i++)if(current.labels[i]===room.id && future.labels[i]>=0)accessibleLargest=Math.max(accessibleLargest,future.regions[future.labels[i]].area);
    const closing=area>laterArea+15 && laterArea<area*.75 && laterArea<accessibleLargest*.4;
    const wide=raster(obs,radius,0,2);
    let wideAccessible=0;
    if(room)for(let i=0;i<total;i++)if(current.labels[i]===room.id && wide.labels[i]>=0)wideAccessible=Math.max(wideAccessible,wide.regions[wide.labels[i]].area);
    const wideStart=nearest(wide,x,y,i=>current.labels[i]===room?.id),wideOwn=wideStart<0?0:wide.regions[wide.labels[wideStart]].area;
    const pinched=area>wideOwn+50 && wideOwn<wideAccessible*.3 && wideOwn<500 && wideAccessible>=80;
    const confined=area<Math.max(80,(current.largest?.area??0)*.2) && area<(current.largest?.area??0)*.4;
    let escapePath=[];
    if(surrounding.length && room) {
      const outside=Math.max(12,Math.min(24,Math.max(...surrounding.map(o=>o.radius))+4));
      const heads=obs.filter(o=>o.head);
      escapePath=routeTo(current,start,i=>{const p=position(i);return current.clear[i]>=1.5 && Math.hypot(p.x-x,p.y-y)>=(surrounding.some(o=>o.potentialLoop)?4:outside) && !territory[i] && !wrapAt(p.x,p.y,obs).length;},(i,t)=>{const p=position(i);return heads.every(o=>headClearance(o,p.x,p.y,t)>=.3);},speed,delay);
    }
    if(!escapePath.length && (closing || pinched)) {
      const heads=obs.filter(o=>o.head);
      escapePath=routeTo(current,start,i=>{const id=future.labels[i],w=wide.labels[i];return pinched ? w>=0&&wide.regions[w].area>=Math.max(80,wideAccessible*.6) && id>=0&&future.regions[id].area>=Math.max(80,accessibleLargest*.3) : id>=0&&future.regions[id].area>=Math.max(80,accessibleLargest*.6,laterArea*1.5);},(i,t)=>{
        const p=position(i);
        for(const o of heads) {
          if(headClearance(o,p.x,p.y,t)<.3)return false;
        }
        return true;
      },speed,delay);
    }
    const waiting=((closing||pinched||surrounding.length)&&!escapePath.length)||confined;
    let shelterPath=[];
    if(waiting && room) {
      let goal=-1,best=-Infinity;
      for(let i=0;i<total;i++) {
        if(current.labels[i]!==room.id || current.clear[i]<.6 || i===start)continue;
        const p=position(i),distance=Math.hypot(p.x-x,p.y-y);
        if(distance<3)continue;
        const heads=obs.filter(o=>o.head);
        const threat=heads.reduce((a,o)=>Math.min(a,headClearance(o,p.x,p.y,2)),10);
        const value=Math.min(12,distance)*.8+Math.min(5,current.clear[i])*.4+Math.min(5,threat)*.3;
        if(value>best){best=value;goal=i;}
      }
      if(goal>=0)shelterPath=routeTo(current,start,i=>i===goal);
    }
    return {current,future,territory,surrounding,currentArea:area,futureArea:laterArea,largestFutureArea:largest,largestAccessibleFutureArea:accessibleLargest,wideArea:wideOwn,wideAccessibleArea:wideAccessible,pinched,closing,confined,escapePath,waiting,shelterPath};
  }
  window.__snakeTopology={territoryMask,trapAt,dangerAt,wrapAt,analyze,regionAt,raster,routeTo,index,position,headClearance,headSegments,nearest,clipTrails};
  return 'Escape topology installed';
})();
