/* ================= AUDIO CONTROLLER (MENU MP3 & SOUNDTRACK MP3) ================= */
const menuBgm = document.getElementById('menuBgm');
const gameBgm = document.getElementById('gameBgm');
let isMuted = false;

// Panggilan pertama saat klik overlay pertama kali
function initGameAudio() {
    initAudioContext();
    const overlay = document.getElementById('startOverlay');
    if (overlay) overlay.style.display = 'none';

    // Putar MENU BGM
    if (!isMuted) {
        menuBgm.volume = 0.4;
        menuBgm.currentTime = 0;
        menuBgm.play().catch(e => console.log("Menu Audio Error:", e));
    }
}

// Panggilan saat tombol PLAY diklik
function onPlayClicked() {
    // Stop Menu BGM total
    menuBgm.pause();
    menuBgm.currentTime = 0;

    // Mulai SoundTrack Game
    if (!isMuted) {
        gameBgm.volume = 0.4;
        gameBgm.currentTime = 0;
        gameBgm.play().catch(e => console.log("Soundtrack Error:", e));
    }

    // Sembunyikan Menu
    document.getElementById('mainMenuScreen').classList.add('hidden');
    document.getElementById('storyModal').classList.remove('hidden');
}

function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById('muteBtn');
    if (isMuted) {
        menuBgm.pause();
        gameBgm.pause();
        btn.innerText = '🔇';
        btn.classList.add('muted');
    } else {
        btn.innerText = '🔊';
        btn.classList.remove('muted');
        // Jika sedang di game putar soundtrack, kalau di menu putar menuBgm
        if (isGameActive) {
            gameBgm.play().catch(()=>{});
        } else {
            menuBgm.play().catch(()=>{});
        }
    }
}

function closeModal() {
    document.getElementById('storyModal').classList.add('hidden');
    isGameActive = true;
    generateMapChunk(10);
    startTimer();
    gameLoop();
}

/* ================= WEB AUDIO API SOUND GENERATOR ================= */
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function initAudioContext() { if (!audioCtx) audioCtx = new AudioContext(); }

function playTone(type, freqStart, freqEnd, dur, gainStart) {
    if (isMuted) return;
    initAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + dur);
    gain.gain.setValueAtTime(gainStart, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
}
function playStepSound() { playTone('triangle', 120, 30, 0.08, 0.15); }
function playAttackSound() { playTone('sawtooth', 400, 80, 0.15, 0.3); }
function playMagicSound() { playTone('sine', 200, 800, 0.25, 0.25); }
function playHitSound() { playTone('square', 150, 40, 0.12, 0.3); }
function playCritSound() { playTone('sawtooth', 700, 200, 0.2, 0.35); }
function playLevelSound() { playTone('sine', 300, 1000, 0.4, 0.3); }

/* ================= BACKGROUND CANVAS ANIMATION ================= */
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
let bgParticles = [];

function initBgAnimation() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    bgParticles = [];
    for (let i = 0; i < 60; i++) {
        bgParticles.push({
            x: Math.random() * bgCanvas.width,
            y: Math.random() * bgCanvas.height,
            radius: Math.random() * 2 + 1,
            color: Math.random() > 0.5 ? '#66fcf1' : '#45a29e',
            speedY: Math.random() * 0.5 + 0.2,
            opacity: Math.random()
        });
    }
}
function renderBgAnimation() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgParticles.forEach(p => {
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        bgCtx.fillStyle = p.color;
        bgCtx.globalAlpha = p.opacity;
        bgCtx.fill();
        p.y -= p.speedY;
        if (p.y < 0) { p.y = bgCanvas.height; p.x = Math.random() * bgCanvas.width; }
    });
    requestAnimationFrame(renderBgAnimation);
}
window.addEventListener('resize', initBgAnimation);
initBgAnimation();
renderBgAnimation();

/* ================= GAME LOGIC ================= */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GRID_VIEW = 7;
const TILE_SIZE = 50;
const MAP_WIDTH = 7;

const images = {};
const imageSources = {
    'player': '/static/images/Player.jpeg',
    'monster': '/static/images/monster.jpeg',
    'wolf': '/static/images/monster.jpeg',
    'slime': '/static/images/monster.jpeg',
    'boss': '/static/images/bossmonster.jpeg',
    'merchant': '/static/images/dagang.jpeg',
    'wizard': '/static/images/penyihir.jpeg',
    'pohon': '/static/images/pohon.png',
    'pohon1': '/static/images/pohon1.webp',
    'pohon2': '/static/images/pohon2.webp',
    'stone': '/static/images/stone.webp'
};
Object.keys(imageSources).forEach(key => {
    images[key] = new Image();
    images[key].src = imageSources[key];
});

const MONSTER_TYPES = {
    slime:  { name: 'Slime Beracun',  color: '#8bd450', hpMul: 0.8, dmgMul: 0.7, poisonChance: 0.4 },
    monster:{ name: 'Monster Liar',   color: '#ff4d4d', hpMul: 1.0, dmgMul: 1.0, poisonChance: 0.2 },
    wolf:   { name: 'Serigala Hutan', color: '#c5c6c7', hpMul: 1.1, dmgMul: 1.25, poisonChance: 0.05 }
};

const DIFFICULTY = {
    easy:   { timeLimit: 600, monsterMul: 0.8, bossHp: 500 },
    normal: { timeLimit: 500, monsterMul: 1.0, bossHp: 600 },
    hard:   { timeLimit: 400, monsterMul: 1.35, bossHp: 800 }
};
let currentDifficulty = 'easy';

function selectDifficulty(diff) {
    currentDifficulty = diff;
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('selected', b.dataset.diff === diff));
}

let timeRemaining = DIFFICULTY[currentDifficulty].timeLimit;
let timerInterval = null;
let isPaused = false;

let gameScore = 0;
let playerLevel = 1;
let currentExp = 0;
let maxExp = 50;

let playerHp = 100;
let maxHp = 100;
let playerMp = 30;
let maxMp = 30;
let coins = 0;
let attackDmg = 20;
let critChance = 0.1;
let isGameActive = false;
let bossSpawned = false;
let hasElementSkill = false;

let poisonTurns = 0;
let stunTurns = 0;
let shieldCharges = 0;
let inventory = { heal: 0, mana: 0, shield: 0 };

let animFrame = 0;
let player = { x: 3, y: 0 };
let mapEntities = [];
let floatingTexts = [];
let particles = [];
let generatedMaxY = 0;

function getHighscore() {
    return parseInt(localStorage.getItem('adventureSlayerHighscore') || '0', 10);
}
function setHighscoreIfBetter(score) {
    if (score > getHighscore()) localStorage.setItem('adventureSlayerHighscore', String(score));
}
document.getElementById('highscoreLabel').innerText = getHighscore();

function togglePause() {
    if (!isGameActive) return;
    isPaused = !isPaused;
    document.getElementById('pauseBtn').innerText = isPaused ? '▶ Lanjut' : '⏸ Jeda';
    if (isPaused) {
        gameBgm.pause();
    } else {
        if (!isMuted) gameBgm.play().catch(()=>{});
        gameLoop();
    }
}

function startTimer() {
    timeRemaining = DIFFICULTY[currentDifficulty].timeLimit;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!isGameActive || isPaused) return;
        timeRemaining--;
        updateHUD();
        if (timeRemaining <= 0 && !bossSpawned) {
            clearInterval(timerInterval);
            spawnBoss();
        }
    }, 1000);
}

function spawnBoss() {
    bossSpawned = true;
    const bossHp = DIFFICULTY[currentDifficulty].bossHp;
    mapEntities.push({
        x: player.x, y: player.y - 1, type: 'boss',
        name: 'Raja Monster Sihir',
        hp: bossHp, maxHp: bossHp, dmg: 30,
        hasAttackedThisTurn: false
    });
    document.getElementById('bossHpWrap').classList.add('active');
    updateStoryText("WAKTU HABIS! Sang Raja Monster Sihir telah bangkit tepat di depanmu!");
    log("WAKTU HABIS! RAJA MONSTER SIHIR MUNCUL DI DEPANMU!", "combat");
}

function addScore(val) {
    gameScore += val;
    showFloatingText(`+${val} SKOR`, player.x, player.y, '#f39c12');
    updateHUD();
}

function updateStoryText(text) { document.getElementById('storyText').innerText = text; }

function log(msg, type = 'normal') {
    const entryHtml = `<div class="log-entry log-${type}">&gt; ${msg}</div>`;
    ['gameLog', 'gameLogDesktop'].forEach(id => {
        const l = document.getElementById(id);
        if (!l) return;
        l.insertAdjacentHTML('beforeend', entryHtml);
        l.scrollTop = l.scrollHeight;
    });
}

function updateHUD() {
    document.getElementById('levelText').innerText = playerLevel;
    document.getElementById('scoreText').innerText = `Skor: ${gameScore}`;
    document.getElementById('timerText').innerText = `⏱️ ${Math.max(0, timeRemaining)}s`;
    document.getElementById('coinText').innerText = `💰 ${coins} Koin`;
    document.getElementById('hpText').innerText = `${Math.max(0, playerHp)}/${maxHp}`;
    document.getElementById('hpBarFill').style.width = `${Math.max(0, (playerHp/maxHp)*100)}%`;
    document.getElementById('mpText').innerText = `${Math.max(0, playerMp)}/${maxMp}`;
    document.getElementById('mpBarFill').style.width = `${Math.max(0, (playerMp/maxMp)*100)}%`;
    document.getElementById('expBarFill').style.width = `${Math.max(0, (currentExp/maxExp)*100)}%`;
    document.getElementById('shieldText').innerText = shieldCharges > 0 ? `🛡️ x${shieldCharges}` : '';

    document.getElementById('invHeal').innerText = inventory.heal;
    document.getElementById('invMana').innerText = inventory.mana;
    document.getElementById('invShield').innerText = inventory.shield;

    document.getElementById('skillElementBtn').disabled = !hasElementSkill || playerMp < 10;
    document.getElementById('skillDashBtn').disabled = playerMp < 5;

    let statusElem = document.getElementById('statusText');
    if (stunTurns > 0) { statusElem.innerText = 'STUNNED'; statusElem.style.color = 'yellow'; }
    else if (poisonTurns > 0) { statusElem.innerText = 'POISONED'; statusElem.style.color = '#a020f0'; }
    else { statusElem.innerText = 'Normal'; statusElem.style.color = 'lime'; }

    const boss = mapEntities.find(e => e.type === 'boss');
    if (boss) {
        document.getElementById('bossHpWrap').classList.add('active');
        document.getElementById('bossHpFill').style.width = `${Math.max(0, (boss.hp/boss.maxHp)*100)}%`;
        document.getElementById('bossNameLabel').innerText = boss.name;
    }
}

function showFloatingText(text, x, y, color = '#ff4d4d') {
    floatingTexts.push({ text, x, y, color, opacity: 1, life: 20 });
}

function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x * TILE_SIZE + 25, y: y * TILE_SIZE + 25,
            vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
            color: color, life: 15
        });
    }
}

function addExp(amount) {
    currentExp += amount;
    if (currentExp >= maxExp) {
        currentExp -= maxExp;
        playerLevel++;
        maxExp += 35;
        playLevelSound();
        log(`LEVEL UP! Kamu mencapai Level ${playerLevel}!`, 'event');
        showStory("LEVEL UP!", "Pilih atribut yang ingin kamu tingkatkan:", "Pilih Stat", false, null, true);
    }
}

function showStory(title, text, btnLabel, showShop = false, callback = null, showLevelUp = false) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalText').innerText = text;
    const shopBox = document.getElementById('shopContainer');
    const lvlBox = document.getElementById('levelUpContainer');
    if (showShop) { refreshShopButtons(); shopBox.classList.remove('hidden'); } else shopBox.classList.add('hidden');
    if (showLevelUp) lvlBox.classList.remove('hidden'); else lvlBox.classList.add('hidden');

    const btn = document.getElementById('modalBtn');
    if (showLevelUp) btn.classList.add('hidden');
    else {
        btn.classList.remove('hidden');
        btn.innerText = btnLabel;
        btn.onclick = () => {
            document.getElementById('storyModal').classList.add('hidden');
            if (callback) callback();
        };
    }
    document.getElementById('storyModal').classList.remove('hidden');
}

function refreshShopButtons() {
    const shopBox = document.getElementById('shopContainer');
    const btns = shopBox.querySelectorAll('.shop-btn');
    const costs = [20, 15, 10, 25];
    btns.forEach((b, i) => { b.disabled = coins < costs[i]; });
}

function upgradeStat(type) {
    if (type === 'hp') { maxHp += 20; playerHp += 20; log("Max HP Bertambah +20!", "event"); }
    if (type === 'mp') { maxMp += 10; playerMp += 10; log("Max MP Bertambah +10!", "event"); }
    if (type === 'atk') { attackDmg += 8; log("Attack Power Bertambah +8!", "event"); }
    if (type === 'crit') { critChance = Math.min(0.6, critChance + 0.05); log("Peluang Kritikal Bertambah +5%!", "event"); }
    updateHUD();
    document.getElementById('storyModal').classList.add('hidden');
}

function getRandomTreeSprite() {
    const treeTypes = ['pohon', 'pohon1', 'pohon2'];
    return treeTypes[Math.floor(Math.random() * treeTypes.length)];
}

function pickMonsterType() {
    const roll = Math.random();
    if (roll < 0.4) return 'slime';
    if (roll < 0.75) return 'monster';
    return 'wolf';
}

function generateMapChunk(targetY) {
    const monsterMul = DIFFICULTY[currentDifficulty].monsterMul;
    while (generatedMaxY > -Math.abs(targetY) - 15) {
        let y = generatedMaxY;
        mapEntities.push({ x: 0, y: y, type: getRandomTreeSprite() });
        mapEntities.push({ x: MAP_WIDTH - 1, y: y, type: getRandomTreeSprite() });

        if (Math.abs(y) > 3) {
            let roll = Math.random();
            let spawnX = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1;

            if (roll < 0.16) {
                let mType = pickMonsterType();
                let baseHp = 45 + Math.floor(Math.abs(y) / 5);
                let baseDmg = 10 + Math.floor(Math.abs(y) / 10);
                let stats = MONSTER_TYPES[mType];
                mapEntities.push({
                    x: spawnX, y: y, type: mType,
                    name: stats.name,
                    hp: Math.round(baseHp * stats.hpMul * monsterMul),
                    maxHp: Math.round(baseHp * stats.hpMul * monsterMul),
                    dmg: Math.round(baseDmg * stats.dmgMul * monsterMul),
                    poisonChance: stats.poisonChance,
                    hasAttackedThisTurn: false
                });
            } else if (roll < 0.21) {
                mapEntities.push({ x: spawnX, y: y, type: 'trap', name: 'Jebakan Duri' });
            } else if (roll < 0.25) {
                mapEntities.push({ x: spawnX, y: y, type: 'stone', name: 'Batu Pixel' });
            } else if (roll < 0.28) {
                mapEntities.push({ x: spawnX, y: y, type: 'merchant', name: 'Pedagang Liar' });
            } else if (roll < 0.31) {
                mapEntities.push({ x: spawnX, y: y, type: 'wizard', name: 'Penyihir' });
            } else if (roll < 0.43) {
                mapEntities.push({ x: spawnX, y: y, type: getRandomTreeSprite() });
            }
        }
        generatedMaxY--;
    }
}

function handleTurn(dx, dy) {
    if (!isGameActive || isPaused) return;

    // Reset status per giliran
    mapEntities.forEach(e => { if (e.type !== 'trap') e.hasAttackedThisTurn = false; });

    if (stunTurns > 0) {
        stunTurns--;
        log("Kamu terkena Stun dan tidak bisa bergerak!", "combat");
        moveMonsters();
        updateHUD();
        return;
    }

    let moved = movePlayer(dx, dy);
    if (moved) {
        if (poisonTurns > 0) {
            poisonTurns--;
            playerHp -= 5;
            playHitSound();
            showFloatingText("-5 Poison", player.x, player.y, "#a020f0");
            log("Racun menggerogoti HP kamu (-5 DMG)!", "combat");
            if (playerHp <= 0) return endGame(false);
        }
        updateHUD();
        generateMapChunk(player.y);
        moveMonsters();
    }
}

function applyDamageToPlayer(amount, sourceName) {
    if (shieldCharges > 0) {
        shieldCharges--;
        log(`🛡️ Perisai menyerap serangan dari ${sourceName}!`, "info");
        showFloatingText("BLOCKED!", player.x, player.y, "#66fcf1");
        return;
    }
    playerHp -= amount;
    playHitSound();
    showFloatingText(`-${amount}`, player.x, player.y, "#f39c12");
}

function movePlayer(dx, dy) {
    let targetX = player.x + dx;
    let targetY = player.y + dy;
    if (targetX < 0 || targetX >= MAP_WIDTH) return false;

    let entIndex = mapEntities.findIndex(e => e.x === targetX && e.y === targetY);
    let targetEntity = entIndex !== -1 ? mapEntities[entIndex] : null;

    if (targetEntity && (targetEntity.type.includes('pohon') || targetEntity.type === 'stone')) {
        log("Jalan terhalang Rintangan!");
        return false;
    }

    if (targetEntity && targetEntity.type === 'trap') {
        applyDamageToPlayer(15, "Jebakan Duri");
        stunTurns = 1;
        showFloatingText("-15 TRAP!", targetX, targetY, "#f39c12");
        log("KAMU INJAK JEBAKAN DURI! Terkena DMG & Stun 1 turn!", "combat");
        mapEntities.splice(entIndex, 1);
        if (playerHp <= 0) return endGame(false);
        return true;
    }

    if (targetEntity && (targetEntity.type === 'monster' || targetEntity.type === 'boss' || targetEntity.type === 'wolf' || targetEntity.type === 'slime')) {
        playAttackSound();
        let isCrit = Math.random() < critChance;
        let dmg = attackDmg + Math.floor(Math.random() * 6);
        if (isCrit) { dmg = Math.round(dmg * 1.8); playCritSound(); }
        targetEntity.hp -= dmg;
        showFloatingText(isCrit ? `CRIT -${dmg}!` : `-${dmg}`, targetEntity.x, targetEntity.y, isCrit ? '#ffea00' : '#ff4d4d');
        spawnParticles(targetEntity.x, targetEntity.y, '#ff4d4d');
        log(`Kamu menebas ${targetEntity.name} sebesar ${dmg} DMG${isCrit ? ' (KRITIKAL!)' : ''}!`, 'combat');

        playerMp = Math.min(maxMp, playerMp + 3);

        if (targetEntity.hp <= 0) {
            let earnedCoins = targetEntity.type === 'boss' ? 100 : 10 + Math.floor(Math.random() * 8);
            coins += earnedCoins;
            if (targetEntity.type === 'boss') {
                addScore(200);
                addExp(300);
                triggerEnding();
                return false;
            } else {
                addScore(15);
                addExp(25);
            }
            log(`Kamu mengalahkan ${targetEntity.name} (+15 Skor, +${earnedCoins} Koin)!`, 'event');
            mapEntities.splice(entIndex, 1);
        } else {
            // Serangan balik monster HANYA 1x
            if (!targetEntity.hasAttackedThisTurn) {
                targetEntity.hasAttackedThisTurn = true;
                applyDamageToPlayer(targetEntity.dmg, targetEntity.name);
                log(`${targetEntity.name} menyerang balik sebesar ${targetEntity.dmg} DMG!`, 'combat');

                let pChance = targetEntity.poisonChance !== undefined ? targetEntity.poisonChance : 0.2;
                if (Math.random() < pChance) {
                    poisonTurns = 3;
                    log(`${targetEntity.name} memberimu RACUN!`, "combat");
                }
                if (playerHp <= 0) return endGame(false);
            }
        }
        return true;
    }

    if (targetEntity && targetEntity.type === 'merchant') {
        addScore(10);
        showStory("Pedagang Liar", "Pedagang liar menyediakan item perbekalan agar memudahkan perjalananmu!", "Selesai Belanja", true, null);
        mapEntities.splice(entIndex, 1);
    }

    if (targetEntity && targetEntity.type === 'wizard') {
        addScore(10);
        hasElementSkill = true;
        attackDmg += 15;
        log("Penyihir memberimu Elemen Pedang & Skill Sihir!", "event");
        showStory("Penyihir", "Penyihir memberikan kekuatan Elemen Pedang serta Skill Sihir untuk membasmi monster!", "Terima Elemen", false, null);
        mapEntities.splice(entIndex, 1);
    }

    playStepSound();
    player.x = targetX;
    player.y = targetY;
    return true;
}

function moveMonsters() {
    mapEntities.forEach(ent => {
        if (ent.type === 'monster' || ent.type === 'boss' || ent.type === 'wolf' || ent.type === 'slime') {
            let dist = Math.abs(ent.x - player.x) + Math.abs(ent.y - player.y);
            if (dist > 1 && dist <= 4) {
                let nextX = ent.x, nextY = ent.y;
                if (Math.abs(player.x - ent.x) > Math.abs(player.y - ent.y)) nextX += player.x > ent.x ? 1 : -1;
                else nextY += player.y > ent.y ? 1 : -1;
                let isOccupied = mapEntities.some(e => e.x === nextX && e.y === nextY);
                if (!isOccupied && !(nextX === player.x && nextY === player.y)) { ent.x = nextX; ent.y = nextY; }
            }
        }
    });
}

function useElementSkill() {
    if (!isGameActive || isPaused) return;
    if (!hasElementSkill) { log("Kamu belum mendapatkan Elemen Pedang dari Penyihir!"); return; }
    if (playerMp < 10) { log("MP tidak cukup untuk menggunakan Skill Elemen!"); return; }

    let enemyIndex = mapEntities.findIndex(e => Math.abs(e.x - player.x) <= 1 && Math.abs(e.y - player.y) <= 1 && (e.type === 'monster' || e.type === 'boss' || e.type === 'wolf' || e.type === 'slime'));
    if (enemyIndex === -1) { log("Tidak ada musuh di dekatmu untuk diserang skill!"); return; }

    playMagicSound();
    playerMp -= 10;
    let targetEntity = mapEntities[enemyIndex];
    let skillDmg = attackDmg * 2 + Math.floor(Math.random() * 10);
    targetEntity.hp -= skillDmg;
    showFloatingText(`🔥 -${skillDmg}`, targetEntity.x, targetEntity.y, '#66fcf1');
    spawnParticles(targetEntity.x, targetEntity.y, '#66fcf1');
    log(`KAMU MENGGUNAKAN TEBASAN ELEMEN! ${targetEntity.name} menerima ${skillDmg} DMG!`, 'combat');

    if (targetEntity.hp <= 0) {
        let earnedCoins = targetEntity.type === 'boss' ? 100 : 12;
        coins += earnedCoins;
        if (targetEntity.type === 'boss') { addScore(200); addExp(300); triggerEnding(); return; }
        else { addScore(15); addExp(30); }
        log(`Kamu memusnahkan ${targetEntity.name}!`, 'event');
        mapEntities.splice(enemyIndex, 1);
    } else if (!targetEntity.hasAttackedThisTurn) {
        targetEntity.hasAttackedThisTurn = true;
        applyDamageToPlayer(Math.round(targetEntity.dmg * 0.6), targetEntity.name);
        log(`${targetEntity.name} membalas serangan skill!`, 'combat');
        if (playerHp <= 0) { endGame(false); return; }
    }

    moveMonsters();
    updateHUD();
}

function useDashSkill() {
    if (!isGameActive || isPaused) return;
    if (playerMp < 5) { log("MP kurang untuk Dash!"); return; }
    let targetY = player.y - 2;
    let isOccupied = mapEntities.some(e => e.x === player.x && e.y === targetY && (e.type.includes('pohon') || e.type === 'stone'));
    if (!isOccupied && player.x > 0 && player.x < MAP_WIDTH - 1) {
        playStepSound();
        playerMp -= 5;
        player.y = targetY;
        log("KAMU MELAKUKAN DASH MELOMPAT!", "event");
        spawnParticles(player.x, player.y, '#f39c12');
        updateHUD();
        generateMapChunk(player.y);
    } else {
        log("Tidak bisa Dash, ada rintangan!");
    }
}

function buyItem(itemType) {
    const costs = { heal: 20, mana: 15, antidote: 10, shield: 25 };
    if (coins < costs[itemType]) { log("Koin tidak cukup!"); return; }
    coins -= costs[itemType];
    if (itemType === 'heal') { playerHp = Math.min(maxHp, playerHp + 40); log("Membeli Obat Herbal (+40 HP)", "event"); }
    else if (itemType === 'mana') { playerMp = Math.min(maxMp, playerMp + 20); log("Membeli Elixir Mana (+20 MP)", "event"); }
    else if (itemType === 'antidote') { poisonTurns = 0; log("Racun berhasil disembuhkan!", "event"); }
    else if (itemType === 'shield') { shieldCharges++; inventory.shield++; log("Perisai dipasang! Akan memblokir 1 serangan.", "event"); }
    updateHUD();
    refreshShopButtons();
}

function endGame(won) {
    isGameActive = false;
    clearInterval(timerInterval);
    setHighscoreIfBetter(gameScore);
    if (!won) {
        showStory("Ksatria Gugur", `Kamu kalah dalam pertempuran... Skor akhir: ${gameScore}`, "Coba Lagi", false, () => location.reload());
    }
    return false;
}

function triggerEnding() {
    isGameActive = false;
    clearInterval(timerInterval);
    setHighscoreIfBetter(gameScore);
    showStory(
        "DESA TERBEBAS - TAMAT",
        `Luar biasa! Kamu berhasil mengalahkan Sang Raja Monster Sihir dengan pencapaian Skor Akhir sebesar ${gameScore}! Sihir kesialan resmi runtuh dan seluruh desa merayakan kemenangannya!`,
        "Mainkan Lagi", false, () => location.reload()
    );
}

function gameLoop() {
    animFrame++;
    render();
    if (isGameActive && !isPaused) requestAnimationFrame(gameLoop);
}

function drawEntityImage(type, x, y, color) {
    let img = images[type];
    if (img && img.complete && img.naturalWidth !== 0) {
        ctx.drawImage(img, x, y, TILE_SIZE, TILE_SIZE);
    } else {
        ctx.fillStyle = color || '#333';
        ctx.fillRect(x + 5, y + 5, TILE_SIZE - 10, TILE_SIZE - 10);
    }
}

function render() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let cameraOffsetY = player.y - Math.floor(GRID_VIEW / 2);

    for (let r = 0; r < GRID_VIEW; r++) {
        for (let c = 0; c < GRID_VIEW; c++) {
            let worldX = c;
            let screenX = c * TILE_SIZE;
            let screenY = r * TILE_SIZE;
            ctx.strokeStyle = '#181818';
            ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            if (worldX > 0 && worldX < MAP_WIDTH - 1) {
                let pulse = Math.sin((animFrame * 0.05) + r) * 8;
                let bgShade = Math.floor(18 + pulse);
                ctx.fillStyle = `rgb(${bgShade}, ${bgShade + 5}, ${bgShade + 10})`;
                ctx.fillRect(screenX + 1, screenY + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            }
        }
    }

    mapEntities.forEach(ent => {
        let screenX = ent.x * TILE_SIZE;
        let screenY = (ent.y - cameraOffsetY) * TILE_SIZE;
        if (screenY >= -TILE_SIZE && screenY <= canvas.height) {
            if (ent.type === 'trap') {
                ctx.fillStyle = '#ff4d4d';
                ctx.fillRect(screenX + 20, screenY + 20, 10, 10);
                return;
            }
            let isEnemy = ent.type === 'monster' || ent.type === 'boss' || ent.type === 'wolf' || ent.type === 'slime';
            let floatOffsetY = isEnemy ? Math.sin(animFrame * 0.1) * 3 : 0;
            let fallbackColor = MONSTER_TYPES[ent.type] ? MONSTER_TYPES[ent.type].color : '#ff4d4d';
            drawEntityImage(ent.type, screenX, screenY + floatOffsetY, fallbackColor);

            if (ent.hp !== undefined) {
                let hpPercent = Math.max(0, ent.hp / ent.maxHp);
                ctx.fillStyle = 'red';
                ctx.fillRect(screenX + 6, screenY + 2 + floatOffsetY, TILE_SIZE - 12, 3);
                ctx.fillStyle = 'lime';
                ctx.fillRect(screenX + 6, screenY + 2 + floatOffsetY, (TILE_SIZE - 12) * hpPercent, 3);
            }
        }
    });

    let playerScreenX = player.x * TILE_SIZE;
    let playerScreenY = (player.y - cameraOffsetY) * TILE_SIZE;
    let playerFloat = Math.sin(animFrame * 0.12) * 2;
    drawEntityImage('player', playerScreenX, playerScreenY + playerFloat, '#3498db');

    if (shieldCharges > 0) {
        ctx.strokeStyle = '#66fcf1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(playerScreenX + TILE_SIZE/2, playerScreenY + TILE_SIZE/2 + playerFloat, TILE_SIZE/2 + 3, 0, Math.PI*2);
        ctx.stroke();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        let pScreenY = p.y - (cameraOffsetY * TILE_SIZE);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, pScreenY, 3, 3);
        p.x += p.vx; p.y += p.vy; p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i];
        let ftScreenX = ft.x * TILE_SIZE + 5;
        let ftScreenY = (ft.y - cameraOffsetY) * TILE_SIZE + 20 - (20 - ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 13px Courier New';
        ctx.fillText(ft.text, ftScreenX, ftScreenY);
        ft.life--;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
}

/* ================= CONTROLS ================= */
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') handleTurn(0, -1);
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') handleTurn(0, 1);
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') handleTurn(-1, 0);
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') handleTurn(1, 0);
    if (e.key === ' ') { e.preventDefault(); useElementSkill(); }
    if (e.key === 'Shift') useDashSkill();
    if (e.key === 'p' || e.key === 'P') togglePause();
});

let touchStartX = 0, touchStartY = 0, touchActive = false;
const SWIPE_THRESHOLD = 30;

canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchActive = true;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) > Math.abs(dy)) {
        handleTurn(dx > 0 ? 1 : -1, 0);
    } else {
        handleTurn(0, dy > 0 ? 1 : -1);
    }
}, { passive: true });

window.onload = () => { updateHUD(); };