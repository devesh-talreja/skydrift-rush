// ---------- GLOBALS ----------
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let gameActive = false;
    let paused = false;
    let animationId = null;
    let lastFrameTime = 0;
    let gameLoopRunning = false;

    // Player
    let player = {
        x: canvas.width/2 - 20,
        y: canvas.height - 90,
        width: 38,
        height: 56,
        durability: 3,
        maxDurability: 3,
        handling: 1.0,
        speedStat: 1.0
    };
    let currentSpeedMultiplier = 1.0;
    let baseScrollSpeed = 180;
    let scrollSpeed = 180;
    let distanceTraveled = 0;
    let distanceRequired = 5000;
    let timeLeft = 45;
    let levelIndex = 0;
    let flyingCharges = 2;
    let isFlying = false;
    let flyingTimer = 0;
    let flyYOffset = 0;
    let activePowerups = { speedBoost: 0, shield: 0, chaos: 0 };
    let isUnlimitedMode = false;
    let isLegendaryMode = false;
    let freeModeSpeedMultiplier = 1.0;
    let wideObstacleSpawnCount = 0;

    // Stun mechanic
    let stunned = false;
    let stunTimer = 0;

    // World objects
    let obstacles = [];
    let powerups = [];
    let particles = [];
    let spawnCooldown = 0;
    let powerupCooldown = 0;
    let lineSpawnCooldown = 0;
    let levelConfig = null;

    // Road boundaries
    const roadLeft = 70;
    const roadRight = canvas.width - 70;
    const roadWidth = roadRight - roadLeft;
    const numLanes = 4;
    const laneWidth = roadWidth / numLanes;
    const laneCenters = [];
    for (let i = 0; i < numLanes; i++) {
        laneCenters.push(roadLeft + (i + 0.5) * laneWidth);
    }
    const laneLines = [];
    for (let i = 1; i < numLanes; i++) {
        laneLines.push(roadLeft + i * laneWidth);
    }
    const obstacleWidth = 36;
    const lineObstacleWidth = 18;

    // ---------- LEVELS (26 levels) ----------
    const levelNames = [
        "Highway Rush", "Urban Chaos", "Mountain Pass", "Industrial Zone", "Storm Approach",
        "Neon District", "Desert Run", "Arctic Drift", "Volcano Ridge", "Cyber City",
        "Final Approach", "Hell's Highway", "Apocalypse", "Nightmare", "Doom's Gate",
        "Abyss", "Chaos Realm", "Frostbite", "Thunder Road", "Inferno",
        "Crimson Peak", "Void Edge", "Eternal Storm", "Judgment Day", "Abyss",
        "💀 IMPOSSIBLE"
    ];
    const LEVELS = [];
    for (let i = 0; i < 26; i++) {
        let lvl = i + 1;
        let timeLimit, distanceReq, spawnRate, speedMod, wideChance, powerupChance;
        if (lvl <= 10) {
            timeLimit = Math.floor(70 - (lvl-1) * 2.5);
            distanceReq = 5000 + lvl * 350;
            spawnRate = 0.90 - lvl * 0.03;
            speedMod = 1.05 + lvl * 0.05;
            wideChance = 0.05 + lvl * 0.01;
            powerupChance = 0.20 - lvl * 0.008;
        } else if (lvl <= 20) {
            timeLimit = Math.floor(52 - (lvl-11) * 1.8);
            distanceReq = 8000 + (lvl-10) * 300;
            spawnRate = 0.60 - (lvl-11) * 0.02;
            speedMod = 1.45 + (lvl-10) * 0.045;
            wideChance = 0.18 + (lvl-10) * 0.012;
            powerupChance = 0.11 - (lvl-10) * 0.005;
        } else {
            timeLimit = Math.floor(38 - (lvl-21) * 1.2);
            distanceReq = 10000 + (lvl-20) * 250;
            spawnRate = 0.40 - (lvl-21) * 0.015;
            speedMod = 1.85 + (lvl-20) * 0.03;
            wideChance = 0.30 + (lvl-20) * 0.01;
            powerupChance = 0.05 - (lvl-20) * 0.002;
        }
        // Final level (26) extreme
        if (lvl === 26) {
            timeLimit = 35;
            distanceReq = 12000;
            spawnRate = 0.30;
            speedMod = 2.0;
            wideChance = 0.45;
            powerupChance = 0.04;
        }
        timeLimit = Math.max(30, timeLimit);
        spawnRate = Math.max(0.28, spawnRate);
        powerupChance = Math.max(0.03, powerupChance);
        LEVELS.push({
            id: lvl,
            name: levelNames[i],
            timeLimit: timeLimit,
            distanceReq: distanceReq,
            spawnRate: spawnRate,
            speedMod: speedMod,
            wideChance: wideChance,
            powerupChance: powerupChance,
            desc: `Difficulty ${Math.floor(lvl/2)}/13`
        });
    }
    // Rename level 25 to "Abyss"
    LEVELS[24].name = "Abyss";

    // ---------- CARS (7 cars) ----------
    const CARS = [
        { name:"NIGHTSTRIKE", speed:1.0, handling:0.95, durability:3, color:"#6dd5ff", lightColor:"#88ddff", unlockLevel:0 },
        { name:"PHANTOM X", speed:1.2, handling:1.15, durability:3, color:"#b484e0", lightColor:"#d4a4ff", unlockLevel:5 },
        { name:"INFERNO", speed:1.4, handling:1.35, durability:3, color:"#ff8844", lightColor:"#ffaa66", unlockLevel:10 },
        { name:"THUNDER", speed:1.6, handling:1.55, durability:3, color:"#44ff88", lightColor:"#aaffcc", unlockLevel:15 },
        { name:"NOVA", speed:1.8, handling:1.75, durability:3, color:"#ff44aa", lightColor:"#ffaacc", unlockLevel:20 },
        { name:"GODSPEED", speed:2.0, handling:1.95, durability:3, color:"#7a8b9b", lightColor:"#aac0d0", unlockLevel:25 },
        { name:"CRIMSON FURY", speed:2.2, handling:2.1, durability:3, color:"#aa3333", lightColor:"#ff6666", unlockLevel:26 }
    ];
    let selectedCarIdx = 0;
    let bestScores = new Array(26).fill(0);
    let unlimitedBest = 0;
    let legendaryBest = 0;
    let completedLevels = new Array(26).fill(false);
    let highestLevelCompleted = -1;
    let lastPlayedLevel = 0;

    // Input
    const input = { left:false, right:false, up:false, down:false };

    // Helper
    if (!CanvasRenderingContext2D.prototype.roundRect) {
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
            if (w < 2 * r) r = w / 2;
            if (h < 2 * r) r = h / 2;
            this.moveTo(x+r, y);
            this.lineTo(x+w-r, y);
            this.quadraticCurveTo(x+w, y, x+w, y+r);
            this.lineTo(x+w, y+h-r);
            this.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
            this.lineTo(x+r, y+h);
            this.quadraticCurveTo(x, y+h, x, y+h-r);
            this.lineTo(x, y+r);
            this.quadraticCurveTo(x, y, x+r, y);
            return this;
        };
    }

    // ---------- STORAGE ----------
    function loadStorage() {
        const storedBest = localStorage.getItem('skyDrift_best');
        if(storedBest) bestScores = JSON.parse(storedBest);
        else bestScores = new Array(26).fill(0);
        const storedUnlimited = localStorage.getItem('skyDrift_unlimited');
        if(storedUnlimited !== null) unlimitedBest = parseInt(storedUnlimited);
        const storedLegendary = localStorage.getItem('skyDrift_legendary');
        if(storedLegendary !== null) legendaryBest = parseInt(storedLegendary);
        const storedCar = localStorage.getItem('skyDrift_car');
        if(storedCar !== null) selectedCarIdx = parseInt(storedCar);
        const storedLastLevel = localStorage.getItem('skyDrift_lastLevel');
        if(storedLastLevel !== null) lastPlayedLevel = parseInt(storedLastLevel);
        const storedCompleted = localStorage.getItem('skyDrift_completed');
        if(storedCompleted) completedLevels = JSON.parse(storedCompleted);
        const storedHighest = localStorage.getItem('skyDrift_highest');
        if(storedHighest !== null) highestLevelCompleted = parseInt(storedHighest);
        else highestLevelCompleted = -1;
        updateUnlocks();
        updateMenuInfo();
    }
    function saveBest() { localStorage.setItem('skyDrift_best', JSON.stringify(bestScores)); }
    function saveUnlimited() { localStorage.setItem('skyDrift_unlimited', unlimitedBest); }
    function saveLegendary() { localStorage.setItem('skyDrift_legendary', legendaryBest); }
    function saveCar() { localStorage.setItem('skyDrift_car', selectedCarIdx); }
    function saveLastLevel() { localStorage.setItem('skyDrift_lastLevel', lastPlayedLevel); }
    function saveCompleted() { localStorage.setItem('skyDrift_completed', JSON.stringify(completedLevels)); }
    function saveHighest() { localStorage.setItem('skyDrift_highest', highestLevelCompleted); }

    function updateUnlocks() {
        for(let i=0; i<CARS.length; i++) {
            CARS[i].unlocked = highestLevelCompleted+1 >= CARS[i].unlockLevel;
        }
        for(let i=0; i<LEVELS.length; i++) {
            if(i === 0) LEVELS[i].unlocked = true;
            else LEVELS[i].unlocked = completedLevels[i-1] === true;
        }
        const unlimitedUnlocked = completedLevels[14];
        const legendaryUnlocked = completedLevels[19];
        document.getElementById('unlimitedBtn').style.opacity = unlimitedUnlocked ? "1" : "0.6";
        document.getElementById('legendaryBtn').style.opacity = legendaryUnlocked ? "1" : "0.6";
        if(!unlimitedUnlocked) document.getElementById('unlimitedBtn').title = "Unlock after Level 15";
        if(!legendaryUnlocked) document.getElementById('legendaryBtn').title = "Unlock after Level 20";
        // Update achievement display in More screen when it becomes visible
        updateAchievementDisplay();
    }

    // Achievement check
    function isAllLevelsComplete() {
        for(let i=0; i<LEVELS.length; i++) {
            if(!completedLevels[i]) return false;
        }
        return true;
    }

    function updateAchievementDisplay() {
        const container = document.getElementById('achievementContainer');
        if(!container) return;
        const allComplete = isAllLevelsComplete();
        if(allComplete) {
            container.innerHTML = `
                <div class="achievement-card">
                    <div style="font-size: 3rem;">🏆🔥🏆</div>
                    <h3>LEGENDARY DRIVER</h3>
                    <p>You've conquered the impossible!</p>
                    <p class="msg">"Through fire and fury, you mastered every challenge. The road bows to you."</p>
                    <div style="margin-top: 12px; color: #ffaa66;">⭐ COMPLETED ALL 26 LEVELS ⭐</div>
                </div>
            `;
        } else {
            const completedCount = completedLevels.filter(v => v === true).length;
            container.innerHTML = `
                <div class="achievement-card achievement-locked">
                    <div style="font-size: 3rem;">🔒🏆🔒</div>
                    <h3>??? LEGENDARY DRIVER ???</h3>
                    <p>Complete all 26 levels to unlock this secret achievement!</p>
                    <p class="msg">Progress: ${completedCount}/26 levels</p>
                </div>
            `;
        }
    }

    // ---------- UI ----------
    const screens = {
        menu: document.getElementById('menuScreen'),
        game: document.getElementById('gameScreen'),
        car: document.getElementById('carScreen'),
        level: document.getElementById('levelScreen'),
        records: document.getElementById('recordsScreen'),
        controls: document.getElementById('controlsScreen'),
        more: document.getElementById('moreScreen'),
        result: document.getElementById('resultScreen')
    };
    function showScreen(screenName) {
        for (let key in screens) screens[key].classList.add('hidden');
        screens[screenName].classList.remove('hidden');
        if(screenName === 'game') {
            document.getElementById('pauseOverlay').style.display = 'none';
            paused = false;
        }
        if(screenName === 'more') {
            updateAchievementDisplay();
        }
    }

    function updateMenuInfo() {
        document.getElementById('lastLevelDisplay').innerText = (lastPlayedLevel+1);
        document.getElementById('lastCarDisplay').innerText = CARS[selectedCarIdx].name;
    }

    function applyCarStats() {
        const car = CARS[selectedCarIdx];
        player.maxDurability = car.durability;
        player.durability = car.durability;
        player.handling = car.handling;
        player.speedStat = car.speed;
    }

    // ---------- GAME INIT ----------
    function initLevel(levelIdx) {
        if(!LEVELS[levelIdx].unlocked) return false;
        levelConfig = LEVELS[levelIdx];
        isUnlimitedMode = false;
        isLegendaryMode = false;
        distanceRequired = levelConfig.distanceReq;
        timeLeft = levelConfig.timeLimit;
        distanceTraveled = 0;
        obstacles = [];
        powerups = [];
        particles = [];
        spawnCooldown = 0;
        powerupCooldown = 0;
        lineSpawnCooldown = 0;
        flyingCharges = 2;
        isFlying = false;
        flyingTimer = 0;
        flyYOffset = 0;
        currentSpeedMultiplier = 1.0;
        activePowerups = { speedBoost: 0, shield: 0, chaos: 0 };
        wideObstacleSpawnCount = 0;
        stunned = false;
        stunTimer = 0;
        applyCarStats();
        scrollSpeed = baseScrollSpeed * player.speedStat * levelConfig.speedMod;
        player.x = canvas.width/2 - player.width/2;
        player.durability = player.maxDurability;

        if(animationId) cancelAnimationFrame(animationId);
        gameActive = true;
        paused = false;
        lastFrameTime = 0;
        gameLoopRunning = true;
        animationId = requestAnimationFrame(gameLoop);
        return true;
    }

    function initUnlimitedMode() {
        if(!completedLevels[14]) return;
        isUnlimitedMode = true;
        isLegendaryMode = false;
        distanceRequired = Infinity;
        timeLeft = Infinity;
        distanceTraveled = 0;
        obstacles = [];
        powerups = [];
        particles = [];
        spawnCooldown = 0;
        powerupCooldown = 0;
        lineSpawnCooldown = 0;
        flyingCharges = 2;
        isFlying = false;
        flyingTimer = 0;
        flyYOffset = 0;
        currentSpeedMultiplier = 1.0;
        activePowerups = { speedBoost: 0, shield: 0, chaos: 0 };
        wideObstacleSpawnCount = 0;
        freeModeSpeedMultiplier = 1.0;
        stunned = false;
        stunTimer = 0;
        applyCarStats();
        const level5SpeedMod = LEVELS[4].speedMod;
        scrollSpeed = baseScrollSpeed * player.speedStat * level5SpeedMod;
        player.x = canvas.width/2 - player.width/2;
        player.durability = player.maxDurability;

        if(animationId) cancelAnimationFrame(animationId);
        gameActive = true;
        paused = false;
        lastFrameTime = 0;
        gameLoopRunning = true;
        animationId = requestAnimationFrame(gameLoop);
        showScreen('game');
    }

    function initLegendaryMode() {
        if(!completedLevels[19]) return;
        isUnlimitedMode = false;
        isLegendaryMode = true;
        distanceRequired = Infinity;
        timeLeft = 300;
        distanceTraveled = 0;
        obstacles = [];
        powerups = [];
        particles = [];
        spawnCooldown = 0;
        powerupCooldown = 0;
        lineSpawnCooldown = 0;
        flyingCharges = 2;
        isFlying = false;
        flyingTimer = 0;
        flyYOffset = 0;
        currentSpeedMultiplier = 1.0;
        activePowerups = { speedBoost: 0, shield: 0, chaos: 0 };
        wideObstacleSpawnCount = 0;
        freeModeSpeedMultiplier = 1.0;
        stunned = false;
        stunTimer = 0;
        applyCarStats();
        const level10SpeedMod = LEVELS[9].speedMod;
        scrollSpeed = baseScrollSpeed * player.speedStat * level10SpeedMod;
        player.x = canvas.width/2 - player.width/2;
        player.durability = player.maxDurability;

        if(animationId) cancelAnimationFrame(animationId);
        gameActive = true;
        paused = false;
        lastFrameTime = 0;
        gameLoopRunning = true;
        animationId = requestAnimationFrame(gameLoop);
        showScreen('game');
    }

    // ---------- Powerup spawning ----------
    function spawnPowerup() {
        const possibleX = [100, 200, 300, 400, 500, 600];
        const xPos = possibleX[Math.floor(Math.random() * possibleX.length)];
        const typeRand = Math.random();
        let pType;
        if(levelIndex >= 15) {
            if(typeRand < 0.35) pType = "speedboost";
            else if(typeRand < 0.55) pType = "flycharge";
            else if(typeRand < 0.70) pType = "repair";
            else if(typeRand < 0.85) pType = "shield";
            else if(typeRand < 0.95) pType = "chaos";
            else pType = "clear";
        } else {
            if(typeRand < 0.4) pType = "speedboost";
            else if(typeRand < 0.65) pType = "flycharge";
            else pType = "repair";
        }
        powerups.push({
            x: xPos, y: -40, width: 28, height: 28,
            type: pType,
            color: pType==="repair" ? "#ff6666" : (pType==="flycharge" ? "#66ffcc" : (pType==="speedboost" ? "#ffcc44" : (pType==="shield" ? "#66aaff" : (pType==="chaos" ? "#ffaa66" : "#88ddff"))))
        });
    }

    function drawPowerup(p) {
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x+p.width/2, p.y+p.height/2, 14, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "bold 14px monospace";
        let icon = "";
        if(p.type === "repair") icon = "❤️";
        else if(p.type === "flycharge") icon = "🕊️";
        else if(p.type === "speedboost") icon = "⚡";
        else if(p.type === "shield") icon = "🛡️";
        else if(p.type === "chaos") icon = "⚠️";
        else if(p.type === "clear") icon = "✨";
        ctx.fillText(icon, p.x+5, p.y+22);
    }

    function applyPowerup(type) {
        switch(type) {
            case "repair": player.durability = Math.min(player.maxDurability, player.durability+1); break;
            case "flycharge": if(flyingCharges < 4) flyingCharges++; break;
            case "speedboost": activePowerups.speedBoost = 3.0; break;
            case "shield": activePowerups.shield = 4.0; break;
            case "chaos": activePowerups.chaos = 4.0; break;
            case "clear": obstacles = []; break;
        }
    }

    // ---------- Obstacle spawning ----------
    function spawnObstacle() {
        const rand = Math.random();
        const isWide = (rand < levelConfig.wideChance);
        let width, xPos;
        if(isWide) {
            width = canvas.width - 140;
            xPos = 70;
        } else {
            width = obstacleWidth;
            const laneIndex = Math.floor(Math.random() * laneCenters.length);
            const laneCenter = laneCenters[laneIndex];
            xPos = laneCenter - width/2;
            xPos = Math.max(roadLeft, Math.min(roadRight - width, xPos));
        }
        let type = "car";
        const r = Math.random();
        if(r < 0.45) type = "car";
        else if(r < 0.7) type = "barrier";
        else type = "roadblock";
        if(isWide) type = "wide_obstacle";
        let color = "#e35f5f";
        if(type === "barrier") color = "#d49c3d";
        if(type === "roadblock") color = "#7c6e65";
        if(isWide) color = "#aa6fcf";
        obstacles.push({
            x: xPos, y: -60, width: width, height: 40,
            type: type, wide: isWide, color: color, damage: 1
        });
        if(isWide) {
            wideObstacleSpawnCount++;
            if(wideObstacleSpawnCount >= 3) {
                if(flyingCharges < 4) flyingCharges++;
                wideObstacleSpawnCount = 0;
                addParticles(player.x+player.width/2, player.y+player.height/2, "#aaffff");
            }
        }
    }

    // New: spawn line obstacles on the dotted lines (improved design)
    function spawnLineObstacle() {
        if (laneLines.length === 0) return;
        const lineIndex = Math.floor(Math.random() * laneLines.length);
        const xPos = laneLines[lineIndex] - lineObstacleWidth/2;
        obstacles.push({
            x: xPos, y: -60, width: lineObstacleWidth, height: 42,
            type: "line", wide: false, color: "#8b5a2b", damage: 1
        });
    }

    function addParticles(x, y, color) {
        for(let i=0;i<6;i++) {
            particles.push({
                x: x + Math.random()*30-15, y: y + Math.random()*30-15,
                vx: (Math.random()-0.5)*100, vy: (Math.random()-0.5)*100-50,
                life: 0.4, color: color
            });
        }
    }

    // ---------- Gameplay updates ----------
    function updateGame(deltaSec) {
        if(!gameActive || paused) return;
        if(deltaSec > 0.033) deltaSec = 0.033;

        if(stunned) {
            stunTimer -= deltaSec;
            if(stunTimer <= 0) {
                stunned = false;
                stunTimer = 0;
            }
        }

        if(isUnlimitedMode) {
            const startMod = LEVELS[4].speedMod;
            const endMod = LEVELS[19].speedMod;
            const ratio = endMod / startMod;
            let progress = Math.min(1, distanceTraveled / 12000);
            let mult = 1 + progress * (ratio - 1);
            scrollSpeed = baseScrollSpeed * player.speedStat * startMod * mult;
        } else if(isLegendaryMode) {
            const startMod = LEVELS[9].speedMod;
            const endMod = LEVELS[24].speedMod;
            const ratio = endMod / startMod;
            let progress = Math.min(1, distanceTraveled / 10000);
            let mult = 1 + progress * (ratio - 1);
            scrollSpeed = baseScrollSpeed * player.speedStat * startMod * mult;
        }

        if(!isUnlimitedMode && !isLegendaryMode) {
            timeLeft -= deltaSec;
            if(timeLeft <= 0) { gameOver(false, "Time's up!"); return; }
        } else if(isLegendaryMode) {
            timeLeft -= deltaSec;
            if(timeLeft <= 0) { gameOver(false, "Legendary time expired!"); return; }
        }

        let effectiveScrollSpeed = scrollSpeed * currentSpeedMultiplier * (activePowerups.speedBoost > 0 ? 1.4 : 1.0);
        let distanceDelta = effectiveScrollSpeed * deltaSec;
        distanceTraveled += distanceDelta;

        let progressPercent = 0;
        if(!isUnlimitedMode && !isLegendaryMode) {
            progressPercent = Math.min(100, (distanceTraveled / distanceRequired) * 100);
            if(distanceTraveled >= distanceRequired) { gameWin(); return; }
        }

        if(activePowerups.speedBoost > 0) {
            activePowerups.speedBoost -= deltaSec;
            if(activePowerups.speedBoost <= 0) activePowerups.speedBoost = 0;
        }
        if(activePowerups.shield > 0) {
            activePowerups.shield -= deltaSec;
            if(activePowerups.shield <= 0) activePowerups.shield = 0;
        }
        if(activePowerups.chaos > 0) {
            activePowerups.chaos -= deltaSec;
            if(activePowerups.chaos <= 0) activePowerups.chaos = 0;
        }

        let effectiveSpeedMult = (activePowerups.speedBoost > 0 ? 1.4 : 1.0);
        let effectiveScrollSpeedForSpawn = scrollSpeed * currentSpeedMultiplier * effectiveSpeedMult;

        let spawnInterval = Math.max(0.35, levelConfig.spawnRate / (effectiveScrollSpeedForSpawn*0.7/scrollSpeed + 0.6)) / (activePowerups.chaos > 0 ? 2.5 : 1);
        spawnCooldown -= deltaSec;
        if(spawnCooldown <= 0) {
            spawnObstacle();
            spawnCooldown = spawnInterval + Math.random() * 0.4;
        }

        let lineSpawnInterval = 1.2 / effectiveSpeedMult;
        if(activePowerups.chaos > 0) lineSpawnInterval /= 2.0;
        lineSpawnCooldown -= deltaSec;
        if(lineSpawnCooldown <= 0) {
            spawnLineObstacle();
            lineSpawnCooldown = lineSpawnInterval + Math.random() * 0.6;
        }

        powerupCooldown -= deltaSec;
        let powerupChanceMultiplier = isLegendaryMode ? 1.2 : 1.0;
        if(powerupCooldown <= 0 && Math.random() < levelConfig.powerupChance * 0.35 * powerupChanceMultiplier) {
            spawnPowerup();
            powerupCooldown = 1.5 + Math.random() * 1.2;
        }

        for(let i=0; i<obstacles.length; i++) obstacles[i].y += effectiveScrollSpeedForSpawn * deltaSec;
        obstacles = obstacles.filter(obs => obs.y < canvas.height + 80);
        for(let i=0; i<powerups.length; i++) powerups[i].y += effectiveScrollSpeedForSpawn * deltaSec;
        powerups = powerups.filter(p => p.y < canvas.height + 40);

        for(let i=0;i<particles.length;i++) {
            particles[i].x += particles[i].vx * deltaSec;
            particles[i].y += particles[i].vy * deltaSec;
            particles[i].life -= deltaSec;
        }
        particles = particles.filter(p => p.life > 0);

        if(!isFlying && activePowerups.shield <= 0) {
            for(let i=0; i<obstacles.length; i++) {
                const obs = obstacles[i];
                if(obs.y + obs.height > player.y && obs.y < player.y + player.height &&
                    obs.x < player.x+player.width && obs.x+obs.width > player.x) {
                    player.durability -= obs.damage;
                    addParticles(player.x+player.width/2, player.y+player.height/2, "#ffaa66");
                    obstacles.splice(i,1);
                    if(player.durability <= 0) { gameOver(false, "Vehicle destroyed!"); return; }
                    break;
                }
            }
        }

        for(let i=0; i<powerups.length; i++) {
            const p = powerups[i];
            if(p.y + p.height > player.y && p.y < player.y + player.height &&
                p.x < player.x+player.width && p.x+p.width > player.x) {
                applyPowerup(p.type);
                addParticles(p.x, p.y, "#ffffff");
                powerups.splice(i,1);
                break;
            }
        }

        if(!stunned) {
            let steering = 0;
            if(input.left) steering = -1;
            if(input.right) steering = 1;
            let steerSpeed = 320 * player.handling * deltaSec;
            player.x += steering * steerSpeed;
            let oldX = player.x;
            player.x = Math.min(roadRight - player.width, Math.max(roadLeft, player.x));
            if(player.x !== oldX && !isFlying && activePowerups.shield <= 0) {
                stunned = true;
                stunTimer = 2.0;
                player.durability = Math.max(1, player.durability - 1);
                addParticles(player.x+player.width/2, player.y+player.height/2, "#ffaa66");
                for(let i=0;i<12;i++) addParticles(player.x+player.width/2, player.y+player.height/2, "#ff8866");
                if(player.durability <= 0) { gameOver(false, "Crashed into wall!"); return; }
            }
        }

        if(input.up) currentSpeedMultiplier = Math.min(1.55, currentSpeedMultiplier + 1.2*deltaSec);
        if(input.down) currentSpeedMultiplier = Math.max(0.65, currentSpeedMultiplier - 1.4*deltaSec);
        currentSpeedMultiplier = Math.min(1.55, Math.max(0.65, currentSpeedMultiplier));

        let displaySpeed = Math.floor(effectiveScrollSpeedForSpawn * 1.2);
        document.getElementById('speedValue').innerText = displaySpeed;
        document.getElementById('timeValue').innerText = isUnlimitedMode ? "∞" : Math.max(0,Math.floor(timeLeft));
        if(isUnlimitedMode || isLegendaryMode) {
            document.getElementById('progressPercent').innerText = Math.floor(distanceTraveled) + "m";
            document.getElementById('progressFill').style.width = "0%";
        } else {
            document.getElementById('progressPercent').innerText = Math.floor(progressPercent);
            document.getElementById('progressFill').style.width = progressPercent + "%";
        }
        let duraStr = "";
        for(let i=0;i<player.durability;i++) duraStr += "❤️";
        for(let i=player.durability;i<player.maxDurability;i++) duraStr += "🖤";
        document.getElementById('durabilityVal').innerHTML = duraStr;
        document.getElementById('flyCharges').innerHTML = flyingCharges;
        let modeLabel = "";
        if(isUnlimitedMode) modeLabel = "∞";
        else if(isLegendaryMode) modeLabel = "👑";
        else modeLabel = (levelIndex+1);
        document.getElementById('levelNum').innerHTML = modeLabel;
    }

    function updateFly(deltaSec) {
        if(isFlying) {
            flyingTimer -= deltaSec;
            const totalFlight = 1.2;
            let t = 1 - (flyingTimer / totalFlight);
            if(t <= 0.3) {
                flyYOffset = -12 * (t/0.3);
            } else if(t <= 0.7) {
                flyYOffset = -12;
            } else {
                flyYOffset = -12 * (1 - (t-0.7)/0.3);
            }
            if(flyingTimer <= 0) {
                isFlying = false;
                flyYOffset = 0;
                flyingTimer = 0;
            }
        } else {
            flyYOffset = 0;
        }
    }

    function gameWin() {
        if(!gameActive) return;
        gameActive = false;
        let remainingTime = Math.floor(timeLeft);
        let isNewRecord = false;
        if(!isUnlimitedMode && !isLegendaryMode) {
            if(remainingTime > bestScores[levelIndex]) {
                bestScores[levelIndex] = remainingTime;
                saveBest();
                isNewRecord = true;
            }
            if(!completedLevels[levelIndex]) {
                completedLevels[levelIndex] = true;
                saveCompleted();
                if(levelIndex > highestLevelCompleted) {
                    highestLevelCompleted = levelIndex;
                    saveHighest();
                    updateUnlocks();
                }
            }
            lastPlayedLevel = levelIndex;
            saveLastLevel();
        } else if(isLegendaryMode) {
            let distance = Math.floor(distanceTraveled);
            if(distance > legendaryBest) {
                legendaryBest = distance;
                saveLegendary();
                isNewRecord = true;
            }
        }
        showResult(true, isUnlimitedMode ? Math.floor(distanceTraveled) : (isLegendaryMode ? Math.floor(distanceTraveled) : remainingTime), isNewRecord);
    }

    function gameOver(win, msg) {
        if(!gameActive) return;
        gameActive = false;
        if(isUnlimitedMode) {
            let distance = Math.floor(distanceTraveled);
            let isNewRecord = distance > unlimitedBest;
            if(isNewRecord) {
                unlimitedBest = distance;
                saveUnlimited();
            }
            showResult(false, distance, isNewRecord);
        } else if(isLegendaryMode) {
            let distance = Math.floor(distanceTraveled);
            let isNewRecord = distance > legendaryBest;
            if(isNewRecord) {
                legendaryBest = distance;
                saveLegendary();
            }
            showResult(false, distance, isNewRecord);
        } else {
            let remaining = Math.max(0, Math.floor(timeLeft));
            showResult(false, remaining, false);
        }
    }

    function showResult(isWin, value, isNewRecord) {
        if(animationId) cancelAnimationFrame(animationId);
        gameLoopRunning = false;
        const title = isWin ? (isUnlimitedMode ? "🏁 UNLIMITED" : (isLegendaryMode ? "👑 LEGENDARY" : "✨ VICTORY!")) : "💀 DEFEAT";
        document.getElementById('resultTitle').innerText = title;
        let details = "";
        if(isUnlimitedMode) {
            details = `
                <p>🏁 UNLIMITED MODE</p>
                <p>📏 Distance: ${value} m</p>
                <p>🏆 Best: ${unlimitedBest} m</p>
                ${isNewRecord ? '<p class="new-record">🏆 NEW RECORD! 🏆</p>' : ''}
            `;
            document.getElementById('nextLevelBtn').style.display = 'none';
        } else if(isLegendaryMode) {
            details = `
                <p>👑 LEGENDARY MODE</p>
                <p>📏 Distance: ${value} m</p>
                <p>🏆 Best: ${legendaryBest} m</p>
                ${isNewRecord ? '<p class="new-record">🏆 NEW RECORD! 🏆</p>' : ''}
            `;
            document.getElementById('nextLevelBtn').style.display = 'none';
        } else {
            details = `
                <p>🚗 Level ${levelIndex+1}: ${LEVELS[levelIndex].name}</p>
                <p>⏱️ Time left: ${value} sec</p>
                <p>📏 Distance: ${Math.floor(distanceTraveled)} / ${distanceRequired}</p>
                ${isNewRecord ? '<p class="new-record">🏆 NEW RECORD! 🏆</p>' : ''}
            `;
            document.getElementById('nextLevelBtn').style.display = (isWin && levelIndex+1 < LEVELS.length && LEVELS[levelIndex+1].unlocked) ? 'inline-block' : 'none';
        }
        document.getElementById('resultDetails').innerHTML = details;
        showScreen('result');
    }

    function startGameWithLevel(level) {
        if(!LEVELS[level].unlocked) return;
        levelIndex = level;
        if(initLevel(levelIndex)) {
            showScreen('game');
            lastPlayedLevel = levelIndex;
            saveLastLevel();
        }
    }

    function retry() {
        if(isUnlimitedMode) initUnlimitedMode();
        else if(isLegendaryMode) initLegendaryMode();
        else startGameWithLevel(levelIndex);
    }

    function nextLevel() {
        if(isUnlimitedMode || isLegendaryMode) return;
        if(levelIndex+1 < LEVELS.length && LEVELS[levelIndex+1].unlocked) {
            startGameWithLevel(levelIndex+1);
        } else {
            showScreen('menu');
        }
    }

    function triggerFly() {
        if(!gameActive || paused) return false;
        if(flyingCharges <= 0) return false;
        if(isFlying) return false;
        if(stunned) return false;
        isFlying = true;
        flyingTimer = 1.2;
        flyingCharges--;
        addParticles(player.x+player.width/2, player.y+player.height/2, "#aaffff");
        return true;
    }

    // Drawing functions
    function drawObstacle(obs) {
        ctx.save();
        ctx.shadowBlur = 5;
        ctx.fillStyle = obs.color;
        if(obs.type === "car") {
            ctx.beginPath();
            ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 8);
            ctx.fill();
            ctx.fillStyle = "#333";
            ctx.fillRect(obs.x+5, obs.y+5, obs.width-10, 6);
            ctx.fillStyle = "#aaa";
            ctx.fillRect(obs.x+3, obs.y+obs.height-8, 6, 6);
            ctx.fillRect(obs.x+obs.width-9, obs.y+obs.height-8, 6, 6);
        } else if(obs.type === "barrier") {
            ctx.fillStyle = "#d49c3d";
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            ctx.fillStyle = "#000";
            for(let i=0; i<3; i++) ctx.fillRect(obs.x+5, obs.y+5+i*10, obs.width-10, 3);
        } else if(obs.type === "roadblock") {
            ctx.fillStyle = "#7c6e65";
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            ctx.fillStyle = "#ffaa33";
            for(let i=0; i<3; i++) ctx.fillRect(obs.x+5, obs.y+8+i*12, obs.width-10, 4);
        } else if(obs.type === "wide_obstacle") {
            ctx.fillStyle = "#aa6fcf";
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            ctx.fillStyle = "#ffdd99";
            for(let i=0; i<4; i++) ctx.fillRect(obs.x+10+i*30, obs.y+5, 10, obs.height-10);
        } else if(obs.type === "line") {
            ctx.fillStyle = "#8b5a2b";
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            ctx.fillStyle = "#5a3a1a";
            for(let i=0; i<3; i++) ctx.fillRect(obs.x+3, obs.y+5+i*10, obs.width-6, 3);
            ctx.fillStyle = "#c97e3a";
            ctx.fillRect(obs.x+4, obs.y+obs.height-8, obs.width-8, 4);
        }
        ctx.restore();
    }

    function drawPlayerCar(x, y, carColor, lightColor, isFlying, flyOffset) {
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.fillStyle = carColor;
        ctx.beginPath();
        ctx.roundRect(x, y + flyOffset, player.width, player.height, 10);
        ctx.fill();
        ctx.fillStyle = "#222";
        ctx.fillRect(x+5, y+flyOffset+5, player.width-10, 12);
        ctx.fillStyle = "#2c3e66";
        ctx.fillRect(x+6, y+flyOffset+18, 8, 12);
        ctx.fillRect(x+player.width-14, y+flyOffset+18, 8, 12);
        ctx.fillStyle = "#88aaff";
        ctx.fillRect(x+12, y+flyOffset+8, 14, 8);
        ctx.fillStyle = lightColor;
        ctx.fillRect(x+2, y+flyOffset+player.height-12, 6, 8);
        ctx.fillRect(x+player.width-8, y+flyOffset+player.height-12, 6, 8);
        ctx.fillStyle = "#aaa";
        ctx.fillRect(x+player.width/2-8, y+flyOffset-6, 16, 6);
        ctx.fillStyle = "#555";
        ctx.fillRect(x+2, y+flyOffset+player.height-10, 6, 4);
        ctx.fillRect(x+player.width-8, y+flyOffset+player.height-10, 6, 4);
        ctx.fillStyle = "#ccc";
        ctx.fillRect(x+4, y+flyOffset+player.height-18, 6, 6);
        ctx.fillRect(x+player.width-10, y+flyOffset+player.height-18, 6, 6);
        ctx.restore();
    }

    function draw() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        let grad = ctx.createLinearGradient(0,0,0,canvas.height);
        grad.addColorStop(0,"#1a2a3a");
        grad.addColorStop(1,"#0f1a24");
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.strokeStyle = "#5f9eff";
        ctx.lineWidth = 4;
        ctx.setLineDash([30,40]);
        for(let i=0; i<laneLines.length; i++) {
            ctx.beginPath();
            ctx.moveTo(laneLines[i], 0);
            ctx.lineTo(laneLines[i], canvas.height);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.strokeStyle = "#ffcc66";
        ctx.lineWidth = 3;
        ctx.strokeRect(roadLeft,0,roadWidth,canvas.height);
        for(let obs of obstacles) drawObstacle(obs);
        for(let p of powerups) drawPowerup(p);
        for(let p of particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 4, 4);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        const car = CARS[selectedCarIdx];
        drawPlayerCar(player.x, player.y, car.color, car.lightColor, isFlying, flyYOffset);
        if(stunned) {
            ctx.fillStyle = "#ffaa66aa";
            ctx.font = "bold 12px monospace";
            ctx.fillText("💫 STUNNED", player.x-10, player.y+flyYOffset-25);
        }
        if(activePowerups.speedBoost > 0) {
            ctx.fillStyle = "#ffcc44aa";
            ctx.font = "bold 12px monospace";
            ctx.fillText("BOOST!", player.x-5, player.y+flyYOffset-12);
        }
        if(activePowerups.shield > 0) {
            ctx.fillStyle = "#66aaffaa";
            ctx.font = "bold 12px monospace";
            ctx.fillText("🛡️ SHIELD", player.x-10, player.y+flyYOffset-25);
        }
        if(activePowerups.chaos > 0) {
            ctx.fillStyle = "#ffaa66aa";
            ctx.font = "bold 12px monospace";
            ctx.fillText("⚠️ CHAOS", player.x-10, player.y+flyYOffset-38);
        }
        if(isFlying) {
            ctx.fillStyle = "#cceeffcc";
            ctx.font = "bold 14px monospace";
            ctx.fillText("✈ FLYING", player.x-10, player.y+flyYOffset-18);
        }
        ctx.shadowBlur = 0;
    }

    function gameLoop(nowMs) {
        if(!gameLoopRunning) return;
        if(!lastFrameTime) lastFrameTime = nowMs;
        let delta = Math.min(0.033, (nowMs - lastFrameTime) / 1000);
        if(delta > 0.001) {
            updateFly(delta);
            updateGame(delta);
        }
        draw();
        lastFrameTime = nowMs;
        animationId = requestAnimationFrame(gameLoop);
    }

    // ---------- MENU BUILDERS ----------
    function buildCarSelection() {
        const container = document.getElementById('carList');
        container.innerHTML = '';
        CARS.forEach((car, idx) => {
            const div = document.createElement('div');
            const unlocked = car.unlocked;
            div.className = 'car-card' + (idx===selectedCarIdx ? ' selected' : '') + (!unlocked ? ' locked' : '');
            div.innerHTML = `<strong>${car.name}</strong><div><span class="stat-badge">⚡speed ${car.speed}</span> <span class="stat-badge">🎮handling ${car.handling}</span> <span class="stat-badge">🛡️durability ${car.durability}</span> ${!unlocked ? '<span class="stat-badge">🔒 Unlock after level ' + car.unlockLevel + '</span>' : ''}</div>`;
            if(unlocked) {
                div.onclick = () => {
                    selectedCarIdx = idx;
                    saveCar();
                    buildCarSelection();
                    updateMenuInfo();
                };
            } else {
                div.style.cursor = 'not-allowed';
            }
            container.appendChild(div);
        });
    }

    function buildLevelSelection() {
        const container = document.getElementById('levelList');
        container.innerHTML = '';
        LEVELS.forEach((lvl, idx) => {
            const div = document.createElement('div');
            const unlocked = lvl.unlocked;
            div.className = 'level-card' + (!unlocked ? ' locked' : '');
            div.innerHTML = `<strong>${idx+1}. ${lvl.name}</strong><div>⏱️ ${lvl.timeLimit}s  🚗 ${lvl.speedMod.toFixed(2)}x</div><div style="font-size:0.7rem">${lvl.desc}</div>`;
            if(unlocked) {
                div.onclick = () => { startGameWithLevel(idx); };
            } else {
                div.style.cursor = 'not-allowed';
            }
            container.appendChild(div);
        });
    }

    function showRecords() {
        const cont = document.getElementById('recordsContainer');
        let html = `<div class="flex-between"><strong>♾️ UNLIMITED MODE</strong><span>⭐ Best distance: ${unlimitedBest} m</span></div>`;
        html += `<div class="flex-between"><strong>👑 LEGENDARY MODE</strong><span>⭐ Best distance: ${legendaryBest} m</span></div>`;
        html += '<div style="margin-top:12px;"><hr style="border-color:#2c3f4f;"></div>';
        for(let i=0; i<LEVELS.length; i++) {
            let best = bestScores[i] ? `${bestScores[i]}s` : 'Not yet';
            html += `<div class="flex-between"><span>${i+1}. ${LEVELS[i].name}</span><span>⭐ Best: ${best}</span></div>`;
        }
        cont.innerHTML = html;
        showScreen('records');
    }

    // ---------- EVENT LISTENERS ----------
    window.addEventListener('load', () => {
        loadStorage();
        buildCarSelection();
        buildLevelSelection();
        applyCarStats();
        document.getElementById('startBtn').onclick = () => startGameWithLevel(lastPlayedLevel);
        document.getElementById('unlimitedBtn').onclick = () => { if(completedLevels[14]) initUnlimitedMode(); };
        document.getElementById('legendaryBtn').onclick = () => { if(completedLevels[19]) initLegendaryMode(); };
        document.getElementById('carSelectBtn').onclick = () => { buildCarSelection(); showScreen('car'); };
        document.getElementById('levelSelectBtn').onclick = () => { buildLevelSelection(); showScreen('level'); };
        document.getElementById('recordsBtn').onclick = showRecords;
        document.getElementById('controlsBtn').onclick = () => showScreen('controls');
        document.getElementById('moreBtn').onclick = () => showScreen('more');
        document.getElementById('backCarBtn').onclick = () => showScreen('menu');
        document.getElementById('confirmCarBtn').onclick = () => { saveCar(); showScreen('menu'); updateMenuInfo(); };
        document.getElementById('backLevelBtn').onclick = () => showScreen('menu');
        document.getElementById('closeRecordsBtn').onclick = () => showScreen('menu');
        document.getElementById('closeControlsBtn').onclick = () => showScreen('menu');
        document.getElementById('backMoreBtn').onclick = () => showScreen('menu');
        document.getElementById('retryBtn').onclick = retry;
        document.getElementById('nextLevelBtn').onclick = nextLevel;
        document.getElementById('homeFromResultBtn').onclick = () => showScreen('menu');
        window.addEventListener('keydown', (e) => {
            const key = e.key;
            if(key === 'ArrowLeft' || key === 'a') input.left=true;
            if(key === 'ArrowRight' || key === 'd') input.right=true;
            if(key === 'ArrowUp' || key === 'w') {
                input.up=true;
                triggerFly();
            }
            if(key === 'ArrowDown' || key === 's') input.down=true;
            if(key === ' ' || key === 'Space') { e.preventDefault(); triggerFly(); }
            if(key === 'p' || key === 'P') {
                if(gameActive && !paused) { paused=true; document.getElementById('pauseOverlay').style.display='flex'; }
                else if(gameActive && paused) { paused=false; document.getElementById('pauseOverlay').style.display='none'; }
            }
        });
        window.addEventListener('keyup', (e) => {
            const key = e.key;
            if(key === 'ArrowLeft' || key === 'a') input.left=false;
            if(key === 'ArrowRight' || key === 'd') input.right=false;
            if(key === 'ArrowUp' || key === 'w') input.up=false;
            if(key === 'ArrowDown' || key === 's') input.down=false;
        });
        showScreen('menu');
        updateMenuInfo();
    });