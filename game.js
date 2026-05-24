const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const messageElement = document.getElementById('message');
const messageText = document.getElementById('messageText');
const messageSubtext = document.getElementById('messageSubtext');

// 游戏状态
let gameRunning = false;
let score = 0;
let lives = 3;

// 挡板
const paddle = {
    width: 120,
    height: 20,
    x: 340,
    y: 560,
    speed: 8,
    dx: 0
};

// 球
const ball = {
    x: 400,
    y: 540,
    radius: 10,
    dx: 4,
    dy: -4,
    initialSpeed: 4
};

// 砖块配置
const brickConfig = {
    rows: 5,
    cols: 10,
    width: 70,
    height: 25,
    padding: 8,
    offsetX: 35,
    offsetY: 60
};

const brickColors = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#5f27cd'];

// 砖块数组
let bricks = [];

// 初始化砖块
function initBricks() {
    bricks = [];
    for (let row = 0; row < brickConfig.rows; row++) {
        bricks[row] = [];
        for (let col = 0; col < brickConfig.cols; col++) {
            bricks[row][col] = {
                x: col * (brickConfig.width + brickConfig.padding) + brickConfig.offsetX,
                y: row * (brickConfig.height + brickConfig.padding) + brickConfig.offsetY,
                status: 1,
                color: brickColors[row]
            };
        }
    }
}

// 绘制挡板
function drawPaddle() {
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 8);
    ctx.fillStyle = '#00ff88';
    ctx.fill();
    ctx.strokeStyle = '#00cc6a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();
}

// 绘制球
function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, ball.radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#00ff88');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.closePath();
}

// 绘制砖块
function drawBricks() {
    for (let row = 0; row < brickConfig.rows; row++) {
        for (let col = 0; col < brickConfig.cols; col++) {
            const brick = bricks[row][col];
            if (brick.status === 1) {
                ctx.beginPath();
                ctx.roundRect(brick.x, brick.y, brickConfig.width, brickConfig.height, 5);
                ctx.fillStyle = brick.color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.closePath();
            }
        }
    }
}

// 碰撞检测
function collisionDetection() {
    for (let row = 0; row < brickConfig.rows; row++) {
        for (let col = 0; col < brickConfig.cols; col++) {
            const brick = bricks[row][col];
            if (brick.status === 1) {
                if (ball.x + ball.radius > brick.x &&
                    ball.x - ball.radius < brick.x + brickConfig.width &&
                    ball.y + ball.radius > brick.y &&
                    ball.y - ball.radius < brick.y + brickConfig.height) {
                    ball.dy = -ball.dy;
                    brick.status = 0;
                    score += 10;
                    scoreElement.textContent = score;
                    
                    // 检查胜利
                    if (checkWin()) {
                        gameRunning = false;
                        showMessage('🎉 恭喜过关！', '按空格键重新开始');
                    }
                }
            }
        }
    }
}

// 检查胜利
function checkWin() {
    for (let row = 0; row < brickConfig.rows; row++) {
        for (let col = 0; col < brickConfig.cols; col++) {
            if (bricks[row][col].status === 1) {
                return false;
            }
        }
    }
    return true;
}

// 移动挡板
function movePaddle() {
    paddle.x += paddle.dx;
    
    // 边界检测
    if (paddle.x < 0) {
        paddle.x = 0;
    }
    if (paddle.x + paddle.width > canvas.width) {
        paddle.x = canvas.width - paddle.width;
    }
}

// 移动球
function moveBall() {
    ball.x += ball.dx;
    ball.y += ball.dy;
    
    // 左右边界碰撞
    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
        ball.dx = -ball.dx;
    }
    
    // 顶部边界碰撞
    if (ball.y - ball.radius < 0) {
        ball.dy = -ball.dy;
    }
    
    // 挡板碰撞
    if (ball.y + ball.radius > paddle.y &&
        ball.y - ball.radius < paddle.y + paddle.height &&
        ball.x > paddle.x &&
        ball.x < paddle.x + paddle.width) {
        
        // 根据击中位置改变角度
        let hitPos = (ball.x - paddle.x) / paddle.width;
        ball.dx = (hitPos - 0.5) * 8;
        ball.dy = -Math.abs(ball.dy);
    }
    
    // 底部边界 - 失去生命
    if (ball.y + ball.radius > canvas.height) {
        lives--;
        livesElement.textContent = lives;
        
        if (lives === 0) {
            gameRunning = false;
            showMessage('💀 游戏结束', '按空格键重新开始');
        } else {
            resetBall();
        }
    }
}

// 重置球位置
function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height - 50;
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * ball.initialSpeed;
    ball.dy = -ball.initialSpeed;
    paddle.x = (canvas.width - paddle.width) / 2;
}

// 重置游戏
function resetGame() {
    score = 0;
    lives = 3;
    scoreElement.textContent = score;
    livesElement.textContent = lives;
    initBricks();
    resetBall();
    messageElement.style.display = 'none';
    gameRunning = true;
}

// 显示消息
function showMessage(text, subtext) {
    messageText.textContent = text;
    messageSubtext.textContent = subtext;
    messageElement.style.display = 'flex';
}

// 游戏主循环
function gameLoop() {
    if (!gameRunning) return;
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制元素
    drawBricks();
    drawPaddle();
    drawBall();
    
    // 移动元素
    movePaddle();
    moveBall();
    
    // 碰撞检测
    collisionDetection();
    
    // 下一帧
    requestAnimationFrame(gameLoop);
}

// 键盘控制
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'Left') {
        paddle.dx = -paddle.speed;
    } else if (e.key === 'ArrowRight' || e.key === 'Right') {
        paddle.dx = paddle.speed;
    } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (!gameRunning) {
            resetGame();
            gameLoop();
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'Left' ||
        e.key === 'ArrowRight' || e.key === 'Right') {
        paddle.dx = 0;
    }
});

// 鼠标控制
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    paddle.x = mouseX - paddle.width / 2;
    
    // 边界检测
    if (paddle.x < 0) {
        paddle.x = 0;
    }
    if (paddle.x + paddle.width > canvas.width) {
        paddle.x = canvas.width - paddle.width;
    }
});

canvas.addEventListener('click', () => {
    if (!gameRunning) {
        resetGame();
        gameLoop();
    }
});

// 初始化游戏
initBricks();
drawBricks();
drawPaddle();
drawBall();
