import pygame
import random
import sys

# 初始化pygame
pygame.init()

# 游戏常量
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
PADDLE_WIDTH = 100
PADDLE_HEIGHT = 15
BALL_SIZE = 10
BRICK_ROWS = 5
BRICK_COLS = 10
BRICK_WIDTH = 70
BRICK_HEIGHT = 25
BRICK_PADDING = 5
BRICK_OFFSET_TOP = 50
BRICK_OFFSET_LEFT = 35

# 颜色
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
ORANGE = (255, 165, 0)
YELLOW = (255, 255, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
PURPLE = (128, 0, 128)
PADDLE_COLOR = (50, 150, 200)
BALL_COLOR = (255, 255, 255)

# 砖块颜色列表
BRICK_COLORS = [RED, ORANGE, YELLOW, GREEN, BLUE]

class BrickBreaker:
    def __init__(self):
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("打砖块游戏")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        self.big_font = pygame.font.Font(None, 72)
        
        # 初始化游戏状态
        self.reset_game()
        
    def reset_game(self):
        # 挡板
        self.paddle_x = SCREEN_WIDTH // 2 - PADDLE_WIDTH // 2
        self.paddle_y = SCREEN_HEIGHT - 40
        self.paddle_speed = 8
        
        # 球
        self.ball_x = SCREEN_WIDTH // 2
        self.ball_y = SCREEN_HEIGHT // 2
        self.ball_dx = random.choice([-4, 4])
        self.ball_dy = -5
        
        # 游戏状态
        self.score = 0
        self.lives = 3
        self.game_over = False
        self.game_won = False
        self.paused = False
        
        # 创建砖块
        self.bricks = []
        for row in range(BRICK_ROWS):
            brick_row = []
            for col in range(BRICK_COLS):
                brick_x = BRICK_OFFSET_LEFT + col * (BRICK_WIDTH + BRICK_PADDING)
                brick_y = BRICK_OFFSET_TOP + row * (BRICK_HEIGHT + BRICK_PADDING)
                brick_row.append(pygame.Rect(brick_x, brick_y, BRICK_WIDTH, BRICK_HEIGHT))
            self.bricks.append(brick_row)
    
    def handle_input(self):
        keys = pygame.key.get_pressed()
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    if self.game_over or self.game_won:
                        self.reset_game()
                    else:
                        self.paused = not self.paused
                elif event.key == pygame.K_r:
                    self.reset_game()
        
        if not self.game_over and not self.game_won and not self.paused:
            if keys[pygame.K_LEFT] and self.paddle_x > 0:
                self.paddle_x -= self.paddle_speed
            if keys[pygame.K_RIGHT] and self.paddle_x < SCREEN_WIDTH - PADDLE_WIDTH:
                self.paddle_x += self.paddle_speed
    
    def update_ball(self):
        if self.game_over or self.game_won or self.paused:
            return
            
        # 移动球
        self.ball_x += self.ball_dx
        self.ball_y += self.ball_dy
        
        # 墙壁碰撞检测
        if self.ball_x <= 0 or self.ball_x >= SCREEN_WIDTH - BALL_SIZE:
            self.ball_dx = -self.ball_dx
            self.ball_x = max(0, min(self.ball_x, SCREEN_WIDTH - BALL_SIZE))
        
        if self.ball_y <= 0:
            self.ball_dy = -self.ball_dy
            self.ball_y = 0
        
        # 球掉落
        if self.ball_y >= SCREEN_HEIGHT:
            self.lives -= 1
            if self.lives <= 0:
                self.game_over = True
            else:
                # 重置球的位置
                self.ball_x = SCREEN_WIDTH // 2
                self.ball_y = SCREEN_HEIGHT // 2
                self.ball_dx = random.choice([-4, 4])
                self.ball_dy = -5
                self.paddle_x = SCREEN_WIDTH // 2 - PADDLE_WIDTH // 2
    
    def check_paddle_collision(self):
        if self.game_over or self.game_won or self.paused:
            return
            
        ball_rect = pygame.Rect(self.ball_x, self.ball_y, BALL_SIZE, BALL_SIZE)
        paddle_rect = pygame.Rect(self.paddle_x, self.paddle_y, PADDLE_WIDTH, PADDLE_HEIGHT)
        
        if ball_rect.colliderect(paddle_rect) and self.ball_dy > 0:
            # 根据击中挡板的位置改变反弹角度
            hit_pos = (self.ball_x + BALL_SIZE // 2 - self.paddle_x) / PADDLE_WIDTH
            self.ball_dx = (hit_pos - 0.5) * 10
            self.ball_dy = -abs(self.ball_dy)
            self.ball_y = self.paddle_y - BALL_SIZE
    
    def check_brick_collision(self):
        if self.game_over or self.game_won or self.paused:
            return
            
        ball_rect = pygame.Rect(self.ball_x, self.ball_y, BALL_SIZE, BALL_SIZE)
        
        for row in self.bricks:
            for brick in row:
                if ball_rect.colliderect(brick):
                    # 确定碰撞方向
                    ball_center_x = self.ball_x + BALL_SIZE // 2
                    ball_center_y = self.ball_y + BALL_SIZE // 2
                    brick_center_x = brick.x + BRICK_WIDTH // 2
                    brick_center_y = brick.y + BRICK_HEIGHT // 2
                    
                    dx = ball_center_x - brick_center_x
                    dy = ball_center_y - brick_center_y
                    
                    if abs(dx) / BRICK_WIDTH > abs(dy) / BRICK_HEIGHT:
                        self.ball_dx = -self.ball_dx
                    else:
                        self.ball_dy = -self.ball_dy
                    
                    # 移除砖块并增加分数
                    row.remove(brick)
                    self.score += 10
                    
                    # 检查是否获胜
                    total_bricks = sum(len(row) for row in self.bricks)
                    if total_bricks == 0:
                        self.game_won = True
                    return
    
    def draw(self):
        self.screen.fill(BLACK)
        
        # 绘制砖块
        for row_index, row in enumerate(self.bricks):
            color = BRICK_COLORS[row_index % len(BRICK_COLORS)]
            for brick in row:
                pygame.draw.rect(self.screen, color, brick)
                pygame.draw.rect(self.screen, WHITE, brick, 2)
        
        # 绘制挡板
        pygame.draw.rect(self.screen, PADDLE_COLOR, 
                         (self.paddle_x, self.paddle_y, PADDLE_WIDTH, PADDLE_HEIGHT))
        pygame.draw.rect(self.screen, WHITE, 
                         (self.paddle_x, self.paddle_y, PADDLE_WIDTH, PADDLE_HEIGHT), 2)
        
        # 绘制球
        pygame.draw.circle(self.screen, BALL_COLOR, 
                          (self.ball_x + BALL_SIZE // 2, self.ball_y + BALL_SIZE // 2), 
                          BALL_SIZE // 2)
        
        # 绘制分数和生命
        score_text = self.font.render(f"分数: {self.score}", True, WHITE)
        lives_text = self.font.render(f"生命: {self.lives}", True, WHITE)
        self.screen.blit(score_text, (10, 10))
        self.screen.blit(lives_text, (SCREEN_WIDTH - 150, 10))
        
        # 游戏结束画面
        if self.game_over:
            game_over_text = self.big_font.render("游戏结束!", True, RED)
            restart_text = self.font.render("按空格键重新开始", True, WHITE)
            text_rect = game_over_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 30))
            restart_rect = restart_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 30))
            self.screen.blit(game_over_text, text_rect)
            self.screen.blit(restart_text, restart_rect)
        
        # 游戏胜利画面
        if self.game_won:
            win_text = self.big_font.render("恭喜获胜!", True, GREEN)
            restart_text = self.font.render("按空格键重新开始", True, WHITE)
            text_rect = win_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 30))
            restart_rect = restart_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 30))
            self.screen.blit(win_text, text_rect)
            self.screen.blit(restart_text, restart_rect)
        
        # 暂停画面
        if self.paused and not self.game_over and not self.game_won:
            pause_text = self.big_font.render("暂停", True, YELLOW)
            text_rect = pause_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2))
            self.screen.blit(pause_text, text_rect)
        
        pygame.display.flip()
    
    def run(self):
        while True:
            self.handle_input()
            self.update_ball()
            self.check_paddle_collision()
            self.check_brick_collision()
            self.draw()
            self.clock.tick(60)

if __name__ == "__main__":
    game = BrickBreaker()
    game.run()
