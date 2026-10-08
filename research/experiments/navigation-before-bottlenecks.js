/* Pure geometry: configuration-space regions and escape routes.
   Uses supplied observations, without reading or changing game state. */
(() => {
  const width=97,half=48,total=width*width;
  const position=i=>({x:i%width-half,y:Math.floor(i/width)-half});
  const index=(x,y)=>{const col=Math.round(x)+half,row=Math.round(y)+half;return col<0||row<0||col>=width||row>=width?-1:row*width+col;};
  function headSegments(o,t) {
    if(t<=0 || !o.trail?.length)return [{x:o.x,y:o.y,dx:o.vx*t,dy:o.vy*t}];
    const segments=[];
    for(let i=1;i<o.trail.length;i++) {
      const a=o.trail[i-1],b=o.trail[i];if(a.t>=t)break;
      const q=Math.min(1,(t-a.t)/(b.t-a.t));segments.push({x:a.x,y:a.y,dx:(b.x-a.x)*q,dy:(b.y-a.y)*q});
    }
    return segments;
  }
  function headClearance(o,x,y,t) {
    let value=Math.hypot(x-o.x,y-o.y)-o.radius;
    if(Math.hypot(x-o.x,y-o.y)>Math.hypot(o.vx,o.vy)*t+o.radius+2)return value;
    function segment(ax,ay,dx,dy) {
      const den=dx*dx+dy*dy,q=den?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/den)):0;
      value=Math.min(value,Math.hypot(x-ax-q*dx,y-ay-q*dy)-o.radius-.2*Math.min(t,1));
    }
    if(o.trail?.length) {
      for(let i=1;i<o.trail.length;i++) {
        const a=o.trail[i-1],b=o.trail[i];if(a.t>=t)break;
        const q=Math.min(1,(t-a.t)/(b.t-a.t));segment(a.x,a.y,(b.x-a.x)*q,(b.y-a.y)*q);
      }
    } else segment(o.x,o.y,o.vx*t,o.vy*t);
    return value;
  }
  function clipTrails(heads,bodies) {
    const bins=new Map(),cell=3,key=(x,y)=>x+','+y;let maximumRadius=0,cuts=0;
    for(const b of bodies) {
      maximumRadius=Math.max(maximumRadius,b.physical);
      const k=key(Math.floor(b.x/cell),Math.floor(b.y/cell));if(!bins.has(k))bins.set(k,[]);bins.get(k).push(b);
    }
    for(const head of heads) {
      if(head.invincible || !head.trail?.length)continue;
      const reach=Math.ceil((head.physical+maximumRadius)/cell);
      for(let i=1;i<head.trail.length;i++) {
        const p=head.trail[i];let blocked=!head.boss&&Math.max(Math.abs(p.x),Math.abs(p.y))>48.55-head.physical;
        const cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell);
        for(let dy=-reach;dy<=reach&&!blocked;dy++)for(let dx=-reach;dx<=reach&&!blocked;dx++) {
          for(const b of bins.get(key(cx+dx,cy+dy))??[]) {
            if(b.enemy===head.enemy || b.ttl<p.t+.15)continue;
            if(Math.hypot(p.x-b.x,p.y-b.y)<head.physical+b.physical-.1){blocked=true;break;}
          }
        }
        if(blocked){head.trail=head.trail.slice(0,i+1);head.predictedBarrierTime=p.t;cuts++;break;}
      }
    }
    return cuts;
  }
  function raster(obs,radius,future) {
    const clear=new Float32Array(total);
    for(let i=0;i<total;i++){const p=position(i);clear[i]=46-radius-Math.max(Math.abs(p.x),Math.abs(p.y));}
    for(const source of obs) {
     for(const segment of source.head?headSegments(source,future):[{x:source.x,y:source.y,dx:0,dy:0}]) {
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
        if(clear[j]<-.2 || (dr&&dc&&(clear[row*width+nc]<-.2||clear[nr*width+col]<-.2)))continue;
        visit(j);
      }
    }
    for(let start=0;start<total;start++) {
      if(clear[start]<-.2||labels[start]>=0)continue;
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
  function nearest(space,x,y) {
    let best=-1,distance=Infinity;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++) {
      const i=index(x+dx,y+dy);if(i<0||space.labels[i]<0)continue;
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
  function analyze(x,y,obs,radius,speed=5,delay=.15) {
    const current=raster(obs,radius,0),future=raster(obs,radius,8);
    const start=nearest(current,x,y),futureStart=nearest(future,x,y);
    const room=start<0?null:current.regions[current.labels[start]],later=futureStart<0?null:future.regions[future.labels[futureStart]];
    const area=room?.area??0,laterArea=later?.area??0,largest=future.largest?.area??0;
    let accessibleLargest=0;
    if(room)for(let i=0;i<total;i++)if(current.labels[i]===room.id && future.labels[i]>=0)accessibleLargest=Math.max(accessibleLargest,future.regions[future.labels[i]].area);
    const closing=area>laterArea+15 && laterArea<area*.75 && laterArea<accessibleLargest*.4;
    const confined=area<Math.max(80,(current.largest?.area??0)*.2) && area<(current.largest?.area??0)*.4;
    let escapePath=[];
    if(closing) {
      const heads=obs.filter(o=>o.head);
      escapePath=routeTo(current,start,i=>{const id=future.labels[i];return id>=0&&future.regions[id].area>=Math.max(80,accessibleLargest*.6,laterArea*1.5);},(i,t)=>{
        const p=position(i);
        for(const o of heads) {
          if(headClearance(o,p.x,p.y,t)<.3)return false;
        }
        return true;
      },speed,delay);
    }
    const waiting=(closing&&!escapePath.length)||confined;
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
    return {current,future,currentArea:area,futureArea:laterArea,largestFutureArea:largest,largestAccessibleFutureArea:accessibleLargest,closing,confined,escapePath,waiting,shelterPath};
  }
  window.__snakeTopology={analyze,regionAt,raster,routeTo,index,position,headClearance,headSegments,nearest,clipTrails};
  return 'Escape topology installed';
})();
