/* Enhanced star / constellation starfield (aurora removed) */
(function(){
    const glCanvas = document.getElementById('glstars');
    const starCanvas = document.getElementById('starfield');
    const shootCanvas = document.getElementById('shooting');
    if(!starCanvas || !shootCanvas) return;
    const ctx = starCanvas.getContext('2d');
    const ctx2 = shootCanvas.getContext('2d');
    let w = window.innerWidth, h = window.innerHeight;
    starCanvas.width = w; starCanvas.height = h;
    shootCanvas.width = w; shootCanvas.height = h;
    if (glCanvas){ glCanvas.width = w; glCanvas.height = h; }

    // Always animate
    const duskFactor = 1;
    const starColors = ['255,255,255'];
    // Updated sizing + speed constants
    const STAR_SIZE_MULT = 2.4;          // larger stars (prev 1.9)
    const TWINKLE_SPEED_SCALE = 0.42;    // slow overall twinkle speed (lower = slower)
    const TWINKLE_FREQ_SCALE = 0.55;     // reduce sine frequency in 2D (visual smoothness)

    /* Toggle nebula for production performance */
    const ENABLE_NEBULA = false; // disabled for perf; set true to enable
    let nebulaCanvas, nebulaCtx, nebulaGenerated=false;
    function generateNebula(){
        if(!ENABLE_NEBULA) return; // disabled
        const N = 512;
        nebulaCanvas = document.createElement('canvas');
        nebulaCtx = nebulaCanvas.getContext('2d');
        nebulaCanvas.width=N; nebulaCanvas.height=N;
        const img = nebulaCtx.createImageData(N,N);
        const data = img.data;
        function fbm(x,y){ let v=0,amp=1,freq=1; for(let o=0;o<3;o++){ v+=amp*(Math.sin(x*freq*2.1)+Math.sin(y*freq*1.7))*0.25; x+=7.2; y-=5.1; amp*=0.5; freq*=1.9;} return 0.5+v; }
        for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const nx=x/N-0.5, ny=y/N-0.5; const r=Math.hypot(nx,ny); if(r>0.7){ data[(y*N+x)*4+3]=0; continue;} const t=Math.max(0,Math.min(1,fbm(x*0.015,y*0.015)*(1-r*r*1.3))); const b=t*t; const idx=(y*N+x)*4; data[idx]=60; data[idx+1]=80; data[idx+2]=130; data[idx+3]=Math.round(90*b); }
        nebulaCtx.putImageData(img,0,0); nebulaGenerated=true;
    }
    generateNebula();
    function drawNebula(time){
        if(!ENABLE_NEBULA || !nebulaGenerated) return;
        ctx.save();
        ctx.globalCompositeOperation='lighter';
        const scale=Math.max(w,h)/420;
        const driftX=(time*0.000015*w)%(nebulaCanvas.width*scale);
        const driftY=(time*0.00001*h)%(nebulaCanvas.height*scale);
        ctx.globalAlpha=0.18;
        ctx.drawImage(nebulaCanvas,-driftX,-driftY,nebulaCanvas.width*scale,nebulaCanvas.height*scale);
        ctx.drawImage(nebulaCanvas,-driftX+nebulaCanvas.width*scale,-driftY,nebulaCanvas.width*scale,nebulaCanvas.height*scale);
        ctx.restore();
    }

    /* ---------- Pointer Parallax ---------- */
    const pointer = { x: w/2, y: h/2 };
    window.addEventListener('pointermove', e=>{ pointer.x = e.clientX; pointer.y = e.clientY; });

    /* ---------- Stars Data (shared) ---------- */
    let stars = [];
    // Performance / capability detection (leave original logic but rename for clarity)
    const deviceMem = navigator.deviceMemory || 0;
    const cores = navigator.hardwareConcurrency || 4;
    const isSmallViewport = Math.min(window.innerWidth, window.innerHeight) < 700;
    const isCoarsePointer = matchMedia('(pointer: coarse)').matches;
    // Add URL/attribute overrides for feature forcing
    let forceFull = false, forceLite = false;
    try {
        const qp = new URLSearchParams(location.search);
        forceFull = qp.get('fx') === 'full' || document.documentElement.dataset.forceFull === 'true';
        forceLite = qp.get('fx') === 'lite' || document.documentElement.dataset.forceLite === 'true';
    } catch {}
    const lowPowerBase = isCoarsePointer || isSmallViewport || (deviceMem && deviceMem <= 4) || cores <= 4;
    const lowPower = forceFull ? false : (forceLite ? true : lowPowerBase);

    // Central perf configuration (aurora always on now)
    const PERF = {
        maxStars: 2500,
        baseDivisor: 2500,
        aurora: true,
        webgl: true,
        constellations: true, // now can be forced via fx param
        shootingMax: 6,
        shootingSkipThreshold: 0.88
    };

    // Dynamic quality scale (auto-tunes by frame time)
    let qualityScale = 1.0;
    const MIN_QUALITY = 0.35;

    // Replace calcCount with adaptive version
    const calcCount = () => Math.min(
        Math.floor((w * h) / PERF.baseDivisor * qualityScale),
        Math.floor(PERF.maxStars * qualityScale)
    );
    let STAR_TARGET = calcCount();

    function spawnStar(){
        return {
            x: Math.random()*w,
            y: Math.random()*h,
            z: Math.random() + 0.05,
            r: Math.random()*1.3 + 0.45,
            tw: Math.random()*360,
            twSpeed: 0.08 + Math.random() * 0.28,
            c: starColors[0]
        };
    }

    function rebuildStars(){
        STAR_TARGET = calcCount();
        if (stars.length > STAR_TARGET) stars.length = STAR_TARGET;
        while (stars.length < STAR_TARGET) stars.push(spawnStar());
        buildConstellations();
        uploadGLStars();
    }

    let dpr = Math.min(2, window.devicePixelRatio || 1);
    function sizeCanvases(){
        dpr = Math.min(2, window.devicePixelRatio || 1);
        starCanvas.width = w * dpr; starCanvas.height = h * dpr; starCanvas.style.width = w+'px'; starCanvas.style.height = h+'px';
        shootCanvas.width = w * dpr; shootCanvas.height = h * dpr; shootCanvas.style.width = w+'px'; shootCanvas.style.height = h+'px';
        if (glCanvas){ glCanvas.width = w * dpr; glCanvas.height = h * dpr; glCanvas.style.width = w+'px'; glCanvas.style.height = h+'px'; }
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx2.setTransform(dpr,0,0,dpr,0,0);
    }
    sizeCanvases();

    window.addEventListener('resize', ()=>{
        w = window.innerWidth; h = window.innerHeight;
        sizeCanvases();
        rebuildStars();
    });

    /* ---------- Constellations (simple proximity graph) ---------- */
    let constellationLines = [];
    function buildConstellations(){
        constellationLines = [];
        if (!stars.length) return;
        // Use a brighter subset
        const subset = [...stars].sort((a,b)=> b.r - a.r).slice(0, Math.min(90, Math.floor(stars.length*0.12)));
        const maxDist = Math.min(w,h) * 0.22;
        const K = 3;
        const edgeKey = (a,b)=> a.x<b.x || (a.x===b.x && a.y<b.y) ? `${a.x},${a.y},${b.x},${b.y}` : `${b.x},${b.y},${a.x},${a.y}`;
        const used = new Set();
        for (const a of subset){
            const near = subset.filter(b=>b!==a).map(b=>({b, d:( (a.x-b.x)**2 + (a.y-b.y)**2 )}))
                .filter(o=>o.d < maxDist*maxDist).sort((x,y)=>x.d - y.d).slice(0,K);
            for(const {b: bStar} of near){
                const key = edgeKey(a,bStar);
                if(used.has(key)) continue;
                used.add(key);
                constellationLines.push({ ax:a.x, ay:a.y, bx:bStar.x, by:bStar.y, depth:(a.z+bStar.z)/2 });
            }
        }
    }

    /* ---------- Shooting Stars & Aurora (2D) ---------- */
    const shooting = [];
    function spawnShooting(){
        if (shooting.length > PERF.shootingMax) return;
        if (Math.random() > PERF.shootingSkipThreshold) return; // rarity gate
        const speed = 6 + Math.random()*6;
        shooting.push({
            x: Math.random()*w*0.8 + w*0.1,
            y: Math.random()*h*0.5,
            l: 110 + Math.random()*170,
            s: speed,
            life:0,
            max: 50 + Math.random()*35
        });
    }
    // Faster interval retained; rarity handled in probability
    setInterval(()=> spawnShooting(), 1600 + Math.random()*1400);
    setTimeout(()=>{ spawnShooting(); }, 800);

    /* ---------- 2D Stars Fallback ---------- */
    function drawStars2D(){
        for(const s of stars){
            s.tw += s.twSpeed * TWINKLE_SPEED_SCALE;
            const tw = (Math.sin(s.tw*Math.PI/180 * TWINKLE_FREQ_SCALE)+1)/2;
            const px = s.x + (pointer.x - w/2)*0.012*s.z;
            const py = s.y + (pointer.y - h/2)*0.012*s.z;
            const alpha = (0.18 + tw*0.55) * duskFactor;
            ctx.beginPath();
            ctx.fillStyle = `rgba(${s.c},${alpha})`;
            ctx.arc(px,py, STAR_SIZE_MULT*s.r*(0.78 + tw*0.35), 0, Math.PI*2);
            ctx.fill();
        }
    }

    function drawConstellations2D(){
        if (!constellationLines.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        for (const line of constellationLines){
            const parx = (pointer.x - w/2)*0.01*line.depth;
            const pary = (pointer.y - h/2)*0.01*line.depth;
            ctx.beginPath();
            ctx.moveTo(line.ax + parx, line.ay + pary);
            ctx.lineTo(line.bx + parx, line.by + pary);
            ctx.stroke();
        }
        ctx.restore();
    }

    /* ---------- WebGL Stars (Points) ---------- */
    let gl, glProgram, starBuffer, glUniforms = {}, starArray;
    let useWebGL = false;

    function initGL(){
        if (!glCanvas) return false;
        let gl2;
        try { gl2 = glCanvas.getContext('webgl2', { antialias:false, depth:false, stencil:false, premultipliedAlpha:true }); } catch(e){ gl2 = null; }
        if (!gl2) { console.warn('[stars] WebGL2 not supported, using 2D'); return false; }
        gl = gl2;
        useWebGL = true;
        if (starCanvas) starCanvas.style.background = 'transparent';
        if (glCanvas) glCanvas.style.background = 'radial-gradient(circle at 40% 60%, #18162b 0%, transparent 60%)';
        const vs = `#version 300 es\nprecision mediump float;\nlayout(location=0) in vec3 aPos;layout(location=1) in vec2 aData;uniform vec2 uRes;uniform vec2 uPointer;uniform float uTime;out float vAlpha;void main(){float depth=aPos.z;vec2 par=(uPointer-uRes*0.5)*0.012*depth;vec2 pos=aPos.xy+par;float tw=(sin((uTime*0.18 + aData.y))+1.0)*0.5;float size=aData.x*(0.85+tw*0.55);float depthFade=(0.55+(1.05-depth)*0.45);vAlpha=(0.20+tw*0.60)*depthFade;gl_Position=vec4((pos/uRes*2.0-1.0)*vec2(1.0,-1.0),0.0,1.0);gl_PointSize=size;}`;
        const fs = `#version 300 es\nprecision mediump float;uniform float uDusk;in float vAlpha;out vec4 outColor;void main(){vec2 p=gl_PointCoord-0.5;float r=length(p);if(r>0.5) discard;float fall=smoothstep(0.5,0.0,r);vec3 white=vec3(1.0);outColor=vec4(white, vAlpha*fall*uDusk);}`;
        function compile(type, source){ const sh = gl.createShader(type); gl.shaderSource(sh, source); gl.compileShader(sh); if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; }
        try {
            const prog = gl.createProgram();
            gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
            gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
            gl.linkProgram(prog); if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
            glProgram = prog; gl.useProgram(glProgram);
            glUniforms.uRes = gl.getUniformLocation(glProgram,'uRes');
            glUniforms.uPointer = gl.getUniformLocation(glProgram,'uPointer');
            glUniforms.uTime = gl.getUniformLocation(glProgram,'uTime');
            glUniforms.uDusk = gl.getUniformLocation(glProgram,'uDusk');
            starBuffer = gl.createBuffer();
            uploadGLStars();
            gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            console.info('[stars] WebGL2 starfield active');
            return true;
        } catch(err){
            console.warn('[stars] WebGL init failed, fallback 2D:', err.message);
            useWebGL = false; gl = null; glProgram = null;
            return false;
        }
    }

    function uploadGLStars(){
        if (!useWebGL) return;
        const N = stars.length;
        starArray = new Float32Array(N * 5);
        for (let i=0;i<N;i++){
            const s = stars[i];
            const o = i*5;
            starArray[o] = s.x; starArray[o+1] = s.y; starArray[o+2] = s.z; starArray[o+3] = STAR_SIZE_MULT*s.r*(0.85 + Math.random()*0.55); starArray[o+4] = Math.random()*Math.PI*2;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, starArray, gl.STATIC_DRAW);
    }

    function renderGL(time){
        if (!useWebGL) return;
        gl.viewport(0,0,w,h);
        gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(glProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false, 20, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,2,gl.FLOAT,false, 20, 12);
        gl.uniform2f(glUniforms.uRes, w, h);
        gl.uniform2f(glUniforms.uPointer, pointer.x, pointer.y);
        gl.uniform1f(glUniforms.uTime, time*0.001);
        gl.uniform1f(glUniforms.uDusk, duskFactor);
        gl.drawArrays(gl.POINTS, 0, stars.length);
    }

    /* ---------- Master Loop ---------- */
    let last = performance.now();
    let frameSampleCount = 0;
    let frameAccum = 0;
    function adaptQuality(avgMs){
        if (avgMs > 24 && qualityScale > MIN_QUALITY){
            qualityScale = Math.max(MIN_QUALITY, qualityScale * 0.85);
            rebuildStars();
        } else if (avgMs < 13 && qualityScale < 1.0 && stars.length < PERF.maxStars){
            qualityScale = Math.min(1.0, qualityScale * 1.05);
            rebuildStars();
        }
    }
    function frame(now){
        const dt = (now - last)/1000; last = now;
        ctx.clearRect(0,0,w,h);
        drawNebula(now);
        if (useWebGL) {
            renderGL(now);
            drawConstellations2D();
        } else {
            drawStars2D();
            drawConstellations2D();
        }
        drawShooting();
        // Frame timing adaptation
        frameSampleCount++;
        frameAccum += dt*1000;
        if (frameSampleCount >= 60){
            const avg = frameAccum / frameSampleCount;
            adaptQuality(avg);
            frameSampleCount = 0; frameAccum = 0;
        }
        requestAnimationFrame(frame);
    }

    // Shooting star path
    function drawShooting(){
        ctx2.clearRect(0,0,w,h);
        for(const s of shooting){
            s.x -= s.s;
            s.y += s.s*0.35;
            s.life++;
            const p=1 - s.life/s.max;
            const g=ctx2.createLinearGradient(s.x,s.y,s.x+s.l,s.y - s.l*0.4);
            g.addColorStop(0,'rgba(255,255,255,0)');
            g.addColorStop(0.08,`rgba(255,255,255,${0.55*p})`);
            g.addColorStop(0.4,`rgba(255,255,255,${0.25*p})`);
            g.addColorStop(1,'rgba(255,255,255,0)');
            ctx2.beginPath();
            ctx2.strokeStyle=g;
            ctx2.lineWidth=0.7 + 1.1 * p;
            ctx2.moveTo(s.x,s.y);
            ctx2.lineTo(s.x + s.l, s.y - s.l*0.4);
            ctx2.stroke();
            ctx2.beginPath();
            ctx2.fillStyle=`rgba(255,255,255,${0.55*p})`;
            ctx2.arc(s.x,s.y,0.9 + 1.3*p,0,Math.PI*2);
            ctx2.fill();
        }
        for(let i=shooting.length-1;i>=0;i--) if(shooting[i].life>shooting[i].max) shooting.splice(i,1);
    }

    /* ---------- Initialization ---------- */
    rebuildStars();
    if (glCanvas) initGL();
    requestAnimationFrame(frame);
})();