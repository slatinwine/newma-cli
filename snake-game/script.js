// 游戏配置
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const GRID_SIZE = 20;
const CANVAS_SIZE = canvas.width;
const CELL_COUNT = CANVAS_SIZE / GRID_SIZE;

// 游戏状态
let snake = [];
let food = {};
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameRunning = false;
let gameLoop = null;
const GAME_SPEED = 120;

// DOM元素
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');

// 初始化
function init() {
    highScoreElement.textContent = highScore;
    resetGame();
    draw();
}

// 重置游戏
function resetGame() {
    snake = [
        { x: 5, y: 10 },
        { x: 4, y: 10 },
        { x: 3, y: 10 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    scoreElement.textContent = score;
    spawnFood();
}

// 生成食物
function spawnFood() {
    do {
        food = {
            x: Math.floor(Math.random() * CELL_COUNT),
            y: Math.floor(Math.random() * CELL_COUNT)
        };
    } while (snake.some(segment => segment.x === food.x && segment.y === food.y));
}

// 移动蛇
function moveSnake() {
    direction = { ...nextDirection };
    const head = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y
    };

    // 检查碰撞
    if (checkCollision(head)) {
        gameOver();
        return;
    }

    snake.unshift(head);

    // 检查是否吃到食物
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreElement.textContent = score;
        spawnFood();
    } else {
        snake.pop();
    }
}

// 检查碰撞
function checkCollision(head) {
    // 撞墙
    if (head.x < 0 || head.x >= CELL_COUNT || head.y < 0 || head.y >= CELL_COUNT) {
        return true;
    }
    // 撞自己
    return snake.some(segment => segment.x === head.x && segment.y === head.y);
}

// 绘制游戏
function draw() {
    // 清空画布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 绘制蛇
    snake.forEach((segment, index) => {
        if (index === 0) {
            // 蛇头
            ctx.fillStyle = '#00ff88';
        } else {
            // 蛇身（渐变色）
            const gradient = 1 - (index / snake.length) * 0.5;
            ctx.fillStyle = `rgba(0, 255, 136, ${gradient})`;
        }
        ctx.fillRect(
            segment.x * GRID_SIZE + 1,
            segment.y * GRID_SIZE + 1,
            GRID_SIZE - 2,
            GRID_SIZE - 2
        );
    });

    // 绘制食物
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(
        food.x * GRID_SIZE + GRID_SIZE / 2,
        food.y * GRID_SIZE + GRID_SIZE / 2,
        GRID_SIZE / 2 - 2,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

// 游戏循环
function gameUpdate() {
    moveSnake();
    draw();
}

// 开始游戏
function startGame() {
    if (gameRunning) return;
    
    resetGame();
    gameRunning = true;
    overlay.classList.add('hidden');
    gameLoop = setInterval(gameUpdate, GAME_SPEED);
}

// 暂停游戏
function pauseGame() {
    gameRunning = false;
    clearInterval(gameLoop);
    overlayTitle.textContent = '已暂停';
    overlay.classList.remove('hidden');
}

// 游戏结束
function gameOver() {
    gameRunning = false;
    clearInterval(gameLoop);
    
    // 更新最高分
    if (score > highScore) {
        highScore = score;
        highScoreElement.textContent = highScore;
        localStorage.setItem('snakeHighScore', highScore);
    }
    
    overlayTitle.textContent = '游戏结束!';
    overlay.querySelector('.message p').textContent = `最终得分: ${score} | 按空格键重新开始`;
    overlay.classList.remove('hidden');
}

// 键盘控制
document.addEventListener('keydown', (e) => {
    // 空格键控制开始/暂停
    if (e.code === 'Space') {
        e.preventDefault();
        if (!gameRunning) {
            startGame();
        } else {
            pauseGame();
        }
        return;
    }

    if (!gameRunning) return;

    switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
            if (direction.y !== 1) {
                nextDirection = { x: 0, y: -1 };
            }
            break;
        case 'ArrowDown':
        case 'KeyS':
            if (direction.y !== -1) {
                nextDirection = { x: 0, y: 1 };
            }
            break;
        case 'ArrowLeft':
        case 'KeyA':
            if (direction.x !== 1) {
                nextDirection = { x: -1, y: 0 };
            }
            break;
        case 'ArrowRight':
        case 'KeyD':
            if (direction.x !== -1) {
                nextDirection = { x: 1, y: 0 };
            }
            break;
    }
});

// 初始化游戏
init();
