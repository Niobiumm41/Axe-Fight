var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');

// Получаем элементы картинок из HTML
var imgBg = document.getElementById('customBg');
var imgHero = document.getElementById('customHero');
var imgMonster = document.getElementById('customMonster');
var imgGift = document.getElementById('customGift');
var imgAxe = document.getElementById('customAxe');

// Функция безопасной проверки: загружена ли картинка и есть ли у нее адрес
function isImageValid(img) {
    return img && img.setAttribute && img.getAttribute('src') !== "" && img.complete && img.naturalWidth !== 0;
}

// --- НАСТРОЙКИ ИГРЫ ---
var HERO_NAME = "Денис"; 
var WIN_SCORE = 37;         
var GRAVITY = 0.6;

var gameState = 0; 
var score = 0;
var mouse = { x: 0, y: 0 };
var groundY = 460;

// Звездный фон по умолчанию (если нет картинки фона)
var stars = [];
for (var s = 0; s < 60; s++) {
    stars.push({ x: Math.random() * canvas.width, y: Math.random() * groundY, radius: Math.random() * 2, alpha: Math.random() });
}

// --- НАСТРОЙКА ИГРОКА ---
var player = {
    x: 355, 
    y: groundY - 150, 
    width: 190,   
    height: 150,  
    vx: 0, vy: 0, speed: 5, jumpForce: 13.5, grounded: true, color: '#38bdf8', 
    isAttacking: false, attackTimer: 0, attackMaxTime: 60, axeAngle: 0, targetAxeAngle: 0,
    maxHp: 100, hp: 100, invulnerableTimer: 0, buffRangeTimer: 0, buffSpeedTimer: 0,
    facing: 'right'
};

var enemies = [];
var particles = [];
var items = [];       
var damageTexts = []; 

var spawnTimer = 0;
var baseSpawnRate = 160;   
var currentSpawnRate = 160; 
var minSpawnRate = 70;     
var itemSpawnTimer = 0;
var itemSpawnRate = 640; 

var keys = {};
window.addEventListener('keydown', function(e) {
    var k = e.key.toLowerCase();
    keys[k] = true;
    if (e.key === " ") keys["space"] = true;
    if ((gameState === 2 || gameState === 3) && e.key === " ") restartGame();
});

window.addEventListener('keyup', function(e) {
    var k = e.key.toLowerCase();
    keys[k] = false;
    if (e.key === " ") keys["space"] = false;
});

canvas.addEventListener('mousemove', function(e) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', function(e) {
    if (e.button === 0) {
        if (gameState === 0) {
            gameState = 1;
            player.x = 355; player.y = groundY - player.height; player.vy = 0; player.grounded = true;
            return;
        }
        if (gameState === 1 && !player.isAttacking) {
            player.isAttacking = true;
            var currentMaxTime = player.buffSpeedTimer > 0 ? Math.floor(player.attackMaxTime / 2.5) : player.attackMaxTime;
            player.attackTimer = currentMaxTime;
            
            // ИЗМЕНЕНО: Цель замаха больше не зависит от мышки, а выбирается строго по направлению взгляда (0 радиан - право, PI радиан - лево)
            player.targetAxeAngle = (player.facing === 'right') ? 0 : Math.PI;
        }
    }
});

function spawnEnemy() {
    var side = Math.floor(Math.random() * 2); 
    var ex, ey, evx;

    var enemyWidth = 48;  
    var enemyHeight = 48; 

    if (side === 0) {
        ex = -enemyWidth; 
        ey = groundY - enemyHeight; 
        evx = 0.18; 
    } else {
        ex = canvas.width + enemyWidth; 
        ey = groundY - enemyHeight; 
        evx = -0.18; 
    }
    
    enemies.push({
        x: ex, y: ey, width: enemyWidth, height: enemyHeight, vx: evx,
        color: '#f43f5e', attackTimer: 0, stretchX: 0       
    });
}

function spawnItem() {
    var r = Math.random();
    var itemType = (r < 0.4) ? 'heal' : (r < 0.7) ? 'range' : 'speed';
    var itemColor = (itemType === 'heal') ? '#eab308' : (itemType === 'range') ? '#f97316' : '#a855f7';
    items.push({ x: 80 + Math.random() * (canvas.width - 160), y: -30, width: 20, height: 20, vy: 0.8, type: itemType, color: itemColor });
}

function createParticles(x, y, color, count) {
    var amt = count || 10;
    for (var i = 0; i < amt; i++) {
        particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8 - 2, radius: Math.random() * 3 + 2, alpha: 1, color: color });
    }
}

function restartGame() {
    score = 0; currentSpawnRate = baseSpawnRate; spawnTimer = 0; itemSpawnTimer = 0;
    player.hp = player.maxHp; player.invulnerableTimer = 0; player.buffRangeTimer = 0; player.buffSpeedTimer = 0;
    player.x = 355; player.y = groundY - player.height; player.vx = 0; player.vy = 0; player.grounded = true;
    enemies = []; particles = []; items = []; damageTexts = []; gameState = 1;
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
}

function update() {
    if (gameState !== 1) return;

    if (player.invulnerableTimer > 0) player.invulnerableTimer--;
    if (player.buffRangeTimer > 0) player.buffRangeTimer--;
    if (player.buffSpeedTimer > 0) player.buffSpeedTimer--;

    player.vx = 0;
    if (keys['a'] || keys['ф'] || keys['arrowleft']) { player.vx = -player.speed; player.facing = 'left'; }
    if (keys['d'] || keys['в'] || keys['arrowright']) { player.vx = player.speed; player.facing = 'right'; }

    if ((keys['w'] || keys['ц'] || keys['arrowup']) && player.grounded) { player.vy = -player.jumpForce; player.grounded = false; }

    player.vy += GRAVITY; player.x += player.vx;
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    player.y += player.vy; player.grounded = false;
    if (player.y + player.height >= groundY && player.y + player.height - player.vy <= groundY + 4) {
        player.y = groundY - player.height; player.vy = 0; player.grounded = true;
    }

    if (player.isAttacking) {
        player.attackTimer--;
        var currentMaxTime = player.buffSpeedTimer > 0 ? Math.floor(player.attackMaxTime / 2.5) : player.attackMaxTime;
        var progress = (currentMaxTime - player.attackTimer) / currentMaxTime;
        player.axeAngle = player.targetAxeAngle - Math.PI / 4 + (progress * (Math.PI / 2));
        if (player.attackTimer <= 0) player.isAttacking = false;
    }

    currentSpawnRate = baseSpawnRate - (score * 1.5);
    if (currentSpawnRate < minSpawnRate) currentSpawnRate = minSpawnRate; 

    spawnTimer++; if (spawnTimer >= currentSpawnRate) { spawnEnemy(); spawnTimer = 0; }
    itemSpawnTimer++; if (itemSpawnTimer >= itemSpawnRate) { spawnItem(); itemSpawnTimer = 0; }

    var pCenterX = player.x + player.width / 2;
    var pCenterY = player.y + player.height / 2;

    for (var i = enemies.length - 1; i >= 0; i--) {
        var e = enemies[i];
        var distanceToPlayerX = Math.abs((e.x + e.width / 2) - pCenterX);

        if (e.attackTimer > 0) {
            e.attackTimer--;
            if (e.attackTimer > 30) e.stretchX += (e.vx > 0) ? 0.6 : -0.6;
            else e.stretchX -= (e.vx > 0) ? 0.6 : -0.6;

            if (e.attackTimer === 35 && distanceToPlayerX < 115 && player.invulnerableTimer === 0) {
                player.hp -= 10; player.invulnerableTimer = 45; 
                damageTexts.push({ x: pCenterX, y: player.y - 10, text: "-10", vy: -1, alpha: 1, color: '#ef4444' });
                createParticles(pCenterX, pCenterY, '#38bdf8', 8);
                player.vy = -4; player.vx = (e.x < pCenterX) ? 4 : -4; player.x += player.vx;
                if (player.hp <= 0) { player.hp = 0; gameState = 2; }
            }
            if (e.attackTimer <= 0) e.stretchX = 0; 
        } else {
            if (distanceToPlayerX < 110) e.attackTimer = 60; 
            else { e.vx = (e.x < pCenterX) ? 0.18 : -0.18; e.x += e.vx; }
        }

        if (player.isAttacking) {
            var axeRange = player.buffRangeTimer > 0 ? 360 : 130; 
            var eCenterX = e.x + e.width / 2 + e.stretchX;
            var eCenterY = e.y + e.height / 2;
            var dx = eCenterX - pCenterX; 
            var dy = eCenterY - pCenterY;
            var dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < axeRange) {
                var angleToEnemy = Math.atan2(dy, dx);
                var angleDiff = Math.abs(player.axeAngle - angleToEnemy);
                if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
                if (angleDiff < (player.buffRangeTimer > 0 ? 1.2 : 0.8)) {
                    createParticles(eCenterX, eCenterY, '#f43f5e', 12);
                    enemies.splice(i, 1); score++;
                    if (score >= WIN_SCORE) gameState = 3; 
                    continue;
                }
            }
        }
    }

    for (var k = items.length - 1; k >= 0; k--) {
        var it = items[k]; it.y += it.vy;
        if (it.y >= groundY - it.height) { it.y = groundY - it.height; it.vy = 0; }
        if (checkCollision(player, it)) {
            createParticles(it.x + 10, it.y + 10, it.color, 10);
            if (it.type === 'heal') {
                player.hp += 20; if (player.hp > player.maxHp) player.hp = player.maxHp;
                damageTexts.push({ x: pCenterX, y: player.y - 10, text: "+20 HP", vy: -1, alpha: 1, color: '#22c55e' });
            } else if (it.type === 'range') {
                player.buffRangeTimer = 1440;
                damageTexts.push({ x: pCenterX, y: player.y - 10, text: "МЕГА-ДАЛЬНОСТЬ X3!", vy: -1, alpha: 1, color: '#f97316' });
            } else if (it.type === 'speed') {
                player.buffSpeedTimer = 1440;
                damageTexts.push({ x: pCenterX, y: player.y - 10, text: "БЕРСЕРК!", vy: -1, alpha: 1, color: '#a855f7' });
            }
            items.splice(k, 1);
        }
    }

    for (var t = damageTexts.length - 1; t >= 0; t--) { var dt = damageTexts[t]; dt.y += dt.vy; dt.alpha -= 0.02; if (dt.alpha <= 0) damageTexts.splice(t, 1); }
for (var j = particles.length - 1; j >= 0; j--) { var pt = particles[j]; pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.2; pt.alpha -= 0.02; if (pt.alpha <= 0) particles.splice(j, 1); }
}
function draw() {
ctx.clearRect(0, 0, canvas.width, canvas.height);
if (isImageValid(imgBg)) {
ctx.drawImage(imgBg, 0, 0, canvas.width, canvas.height);
} else {
ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
for (var s = 0; s < stars.length; s++) {
var star = stars[s]; ctx.fillStyle = 'rgba(255, 255, 255, ' + star.alpha + ')'; ctx.fillRect(star.x, star.y, star.radius, star.radius);
if (Math.random() < 0.02) star.alpha = Math.random();
}
}
ctx.fillStyle = '#274230'; ctx.fillRect(0, groundY, canvas.width, 40);
ctx.fillStyle = '#2a5039'; ctx.fillRect(0, groundY, canvas.width, 4);
if (gameState !== 0) {
for (var j = 0; j < particles.length; j++) {
var pt = particles[j]; ctx.save(); ctx.globalAlpha = pt.alpha; ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
for (var k = 0; k < items.length; k++) {
var it = items[k];
if (isImageValid(imgGift)) {
ctx.drawImage(imgGift, it.x, it.y, it.width, it.height);
ctx.strokeStyle = it.color; ctx.lineWidth = 2; ctx.strokeRect(it.x, it.y, it.width, it.height);
} else {
ctx.fillStyle = it.color; ctx.fillRect(it.x, it.y, it.width, it.height);
ctx.fillStyle = '#fff'; ctx.fillRect(it.x + it.width / 2 - 2, it.y, 4, it.height); ctx.fillRect(it.x, it.y + it.height / 2 - 2, it.width, 4);
}
}
for (var i = 0; i < enemies.length; i++) {
var e = enemies[i];
if (isImageValid(imgMonster)) {
ctx.save();
if (e.vx < 0) { ctx.translate(e.x + e.stretchX + e.width, e.y); ctx.scale(-1, 1); ctx.drawImage(imgMonster, 0, 0, e.width, e.height); }
else { ctx.drawImage(imgMonster, e.x + e.stretchX, e.y, e.width, e.height); }
ctx.restore();
if (e.attackTimer > 35) { ctx.strokeStyle = '#fff'; ctx.strokeRect(e.x + e.stretchX, e.y, e.width, e.height); }
} else {
ctx.fillStyle = e.color; ctx.fillRect(e.x + e.stretchX, e.y, e.width, e.height);
ctx.fillStyle = e.attackTimer > 35 ? '#fff' : '#000'; ctx.fillRect(e.x + e.stretchX + 4, e.y + 6, 3, 3); ctx.fillRect(e.x + e.stretchX + 14, e.y + 6, 3, 3);
ctx.fillStyle = '#fff'; ctx.fillRect(e.x + e.stretchX + 6, e.y + 14, 12, 3);
}
}
if (gameState !== 2) {
if (player.invulnerableTimer === 0 || Math.floor(player.invulnerableTimer / 4) % 2 === 0) {
if (isImageValid(imgHero)) {
ctx.save();
if (player.facing === 'left') { ctx.translate(player.x + player.width, player.y); ctx.scale(-1, 1); ctx.drawImage(imgHero, 0, 0, player.width, player.height); }
else { ctx.drawImage(imgHero, player.x, player.y, player.width, player.height); }
ctx.restore();
} else {
ctx.fillStyle = player.color; ctx.fillRect(player.x, player.y, player.width, player.height);
ctx.fillStyle = '#eab308'; ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(player.x + player.width, player.y); ctx.lineTo(player.x + player.width / 2, player.y - 25); ctx.closePath(); ctx.fill();
}
var pCenterX = player.x + player.width / 2; var pCenterY = player.y + player.height / 2;
ctx.save(); ctx.translate(pCenterX, pCenterY);
// ИЗМЕНЕНО: Оружие в режиме ожидания или атаки теперь всегда развернуто в сторону направления взгляда facing
var currentAngle = player.isAttacking ? player.axeAngle : (player.facing === 'right' ? 0 : Math.PI);
ctx.rotate(currentAngle);
var currentHandleLength = 65;
var bladeSize = player.buffRangeTimer > 0 ? 100 : 50;
if (currentAngle > Math.PI / 2 || currentAngle < -Math.PI / 2) {
ctx.scale(1, -1);
}
if (isImageValid(imgAxe)) {
ctx.drawImage(imgAxe, currentHandleLength - 10, -bladeSize / 2, bladeSize, bladeSize);
}
ctx.restore();
}
var barWidth = 80; var barHeight = 8; var barX = player.x + (player.width - barWidth) / 2; var barY = player.y - 15;
ctx.fillStyle = '#1e293b'; ctx.fillRect(barX, barY, barWidth, barHeight);
ctx.fillStyle = player.hp > 30 ? '#22c55e' : '#ef4444'; ctx.fillRect(barX, barY, (player.hp / player.maxHp) * barWidth, barHeight);
}
for (var t = 0; t < damageTexts.length; t++) {
var dt = damageTexts[t]; ctx.save(); ctx.globalAlpha = dt.alpha; ctx.fillStyle = dt.color; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center'; ctx.fillText(dt.text, dt.x, dt.y); ctx.restore();
}
var buffOffsetY = 90;
ctx.save(); ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'; var bgWidth = 310; var bgHeight = 68;
if (player.buffRangeTimer > 0) bgHeight += 30; if (player.buffSpeedTimer > 0) bgHeight += 30;
ctx.beginPath(); ctx.roundRect(15, 12, bgWidth, bgHeight, 10); ctx.fill(); ctx.restore();
ctx.save(); ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Arial';
ctx.fillText("Убито монстров: " + score + " / " + WIN_SCORE, 25, 35);
ctx.fillStyle = '#ffffff'; ctx.fillText("Здоровье: ", 25, 65);
ctx.fillStyle = player.hp > 30 ? '#22c55e' : '#ef4444'; ctx.fillText(player.hp + "%", 125, 65);
if (player.buffRangeTimer > 0) {
ctx.save(); ctx.fillStyle = 'rgba(249, 115, 22, 0.15)'; ctx.beginPath(); ctx.roundRect(23, buffOffsetY - 16, bgWidth - 16, 24, 6); ctx.fill();
ctx.fillStyle = '#f97316'; ctx.fillRect(25, buffOffsetY - 12, 4, 16); ctx.restore();
ctx.fillStyle = '#f97316'; ctx.font = 'bold 13px Arial'; ctx.fillText("Увеличена дальность топора: " + Math.ceil(player.buffRangeTimer / 60) + "с", 36, buffOffsetY);
buffOffsetY += 30;
}
if (player.buffSpeedTimer > 0) {
ctx.save(); ctx.fillStyle = 'rgba(168, 85, 247, 0.15)'; ctx.beginPath(); ctx.roundRect(23, buffOffsetY - 16, bgWidth - 16, 24, 6); ctx.fill();
ctx.fillStyle = '#a855f7'; ctx.fillRect(25, buffOffsetY - 12, 4, 16); ctx.restore();
ctx.fillStyle = '#a855f7'; ctx.font = 'bold 13px Arial'; ctx.fillText("Режим Берсерка: " + Math.ceil(player.buffSpeedTimer / 60) + "с", 36, buffOffsetY);
}
ctx.restore();
}
if (gameState === 0) {
ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.textAlign = 'center'; ctx.fillStyle = '#227911'; ctx.font = 'bold 36px Arial';
ctx.fillText('БИТВА ТОПОРОМ', canvas.width / 2, canvas.height / 2 - 30);
ctx.fillStyle = '#fff'; ctx.font = '20px Arial';
ctx.fillText('ЛОВИ ПОДАРКИ С НЕБА И КРУШИ ВРАГОВ ТОПОРОМ!', canvas.width / 2, canvas.height / 2 + 20);
ctx.fillStyle = '#94a3b8';
ctx.font = '16px Arial'; ctx.fillText('Кликни для СТАРТА', canvas.width / 2, canvas.height / 2 + 130);
}
if (gameState === 2) {
ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#f43f5e'; ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center';
ctx.fillText('МОНСТРЫ ОДОЛЕЛИ ТЕБЯ!', canvas.width / 2, canvas.height / 2 - 20);
ctx.fillStyle = '#fff'; ctx.font = '20px Arial';
ctx.fillText('Нажмите ПРОБЕЛ, чтобы попробовать снова!', canvas.width / 2, canvas.height / 2 + 30);
}
if (gameState === 3) {
ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.textAlign = 'center'; ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 42px Arial';
ctx.fillText("🎉 С ДНЕМ РОЖДЕНИЯ, " + HERO_NAME + "! 🎉", canvas.width / 2, canvas.height / 2 - 50);
ctx.fillStyle = '#fff'; ctx.font = '22px Arial';
ctx.fillText('Ты разнёс 37 монстров по всему полю своим верным топором!', canvas.width / 2, canvas.height / 2 + 10);
ctx.fillText('Пусть в реальной жизни любые препятствия рушатся так же легко!', canvas.width / 2, canvas.height / 2 + 50);
ctx.fillStyle = '#94a3b8';
ctx.font = '16px Arial'; ctx.fillText('Нажмите ПРОБЕЛ, чтобы начать заново', canvas.width / 2, canvas.height / 2 + 130);
}
}
function gameLoop() {
update(); draw(); requestAnimationFrame(gameLoop);
}
gameLoop();