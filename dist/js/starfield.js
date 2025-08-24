/* Minimal starfield + shooting stars reused */
(function(){
    const starCanvas = document.getElementById('starfield');
    const shootCanvas = document.getElementById('shooting');
    if(!starCanvas || !shootCanvas) return;
    const ctx = starCanvas.getContext('2d');
    const ctx2 = shootCanvas.getContext('2d');
    let w = window.innerWidth, h = window.innerHeight;
    starCanvas.width = w; starCanvas.height = h;
    shootCanvas.width = w; shootCanvas.height = h;

    let stars = [];
    const COUNT = 260;
    const prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize(){
        w = window.innerWidth; h = window.innerHeight;
        starCanvas.width = w; starCanvas.height = h;
        shootCanvas.width = w; shootCanvas.height = h;
        stars = stars.slice(0, COUNT);
        if (stars.length < COUNT) {
            for (let i=stars.length;i<COUNT;i++) {
                stars.push({
                    x: Math.random()*w,
                    y: Math.random()*h,
                    z: Math.random()*0.7 + 0.3,
                    r: Math.random()*1.3 + 0.3,
                    tw: Math.random()*360
                });
            }
        }
    }
    resize();
    window.addEventListener('resize', resize);

    const pointer = { x: w/2, y: h/2 };
    window.addEventListener('pointermove', e => {
        pointer.x = e.clientX; pointer.y = e.clientY;
    });

    const shooting = [];
    function spawnShooting(){
        if (prefersReduce) return;
        if (Math.random() > 0.28) return;
        shooting.push({
            x: Math.random()*w,
            y: Math.random()*h*0.35,
            l: 120 + Math.random()*260,
            s: 5 + Math.random()*5,
            life:0,
            max:60
        });
    }
    setInterval(spawnShooting, 3300);

    function drawStars(){
        ctx.clearRect(0,0,w,h);
        for (const s of stars) {
            s.tw += 0.4;
            const twinkle = (Math.sin(s.tw*Math.PI/180)+1)/2;
            const px = s.x + (pointer.x - w/2)*0.008*s.z;
            const py = s.y + (pointer.y - h/2)*0.008*s.z;
            ctx.beginPath();
            ctx.fillStyle = `rgba(255,255,255,${0.15 + twinkle*0.55})`;
            ctx.arc(px,py,s.r,0,Math.PI*2);
            ctx.fill();
        }
    }

    function drawShooting(){
        ctx2.clearRect(0,0,w,h);
        for(const s of shooting){
            s.x -= s.s;
            s.y += s.s*0.35;
            s.life++;
            const p = 1 - s.life/s.max;
            const g = ctx2.createLinearGradient(s.x,s.y,s.x+s.l,s.y - s.l*0.4);
            g.addColorStop(0,'rgba(255,255,255,0)');
            g.addColorStop(0.2,`rgba(255,255,255,${0.35*p})`);
            g.addColorStop(1,'rgba(255,255,255,0)');
            ctx2.beginPath();
            ctx2.strokeStyle=g;
            ctx2.lineWidth=2;
            ctx2.moveTo(s.x,s.y);
            ctx2.lineTo(s.x + s.l, s.y - s.l*0.4);
            ctx2.stroke();
        }
        for(let i=shooting.length-1;i>=0;i--){
            if(shooting[i].life > shooting[i].max) shooting.splice(i,1);
        }
    }

    function frame(){
        drawStars();
        drawShooting();
        requestAnimationFrame(frame);
    }
    if(!prefersReduce) frame();
})();