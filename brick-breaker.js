// 打砖块游戏 - JavaScript 代码

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const levelElement = document.getElementById('level');

// 游戏状态
let gameRunning = false;
let gamePaused = false;
let score = 0;
let lives = 3;
let level = 1;
let animationId;

// 挡板
const paddle = {
    width: 120