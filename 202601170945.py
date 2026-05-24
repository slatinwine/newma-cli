import json
import random
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import re
import copy

@dataclass
class ThoughtNode:
    """思维节点 - 代表问题解决过程中的一个中间步骤"""
    state: str  # 当前状态
    thought: str  # 当前的思维内容
    parent: Optional['ThoughtNode'] = None  # 父节点
    children: List['ThoughtNode'] = None  # 子节点
    value: float = 0.0  # 评估值
    
    def __post_init__(self):
        if self.children is None:
            self.children = []

class TaskType(Enum):
    """任务类型"""
    GAME_OF_24 = "game_of_24"
    CREATIVE_WRITING = "creative_writing"
    MINI_CROSSWORD = "mini_crossword"

class SearchAlgorithm(Enum):
    """搜索算法"""
    BFS = "breadth_first_search"
    DFS = "depth_first_search"

class TreeOfThoughts:
    """
    Tree of Thoughts (ToT) 框架实现
    基于论文: Tree of Thoughts: Deliberate Problem Solving with Large Language Models
    """
    
    def __init__(self, 
                 task_type: TaskType,
                 search_algorithm: SearchAlgorithm = SearchAlgorithm.BFS,
                 max_steps: int = 3,
                 beam_width: int = 5,
                 vote_samples: int = 5):
        """
        初始化ToT框架
        
        Args:
            task_type: 任务类型
            search_algorithm: 搜索算法 (BFS/DFS)
            max_steps: 最大思维步骤数
            beam_width: BFS的束宽
            vote_samples: 投票样本数
        """
        self.task_type = task_type
        self.search_algorithm = search_algorithm
        self.max_steps = max_steps
        self.beam_width = beam_width
        self.vote_samples = vote_samples
        
    def thought_generator(self, node: ThoughtNode, k: int = 5) -> List[ThoughtNode]:
        """
        思维生成器 - 从当前状态生成k个候选思维
        
        论文中描述了两种策略：
        (a) 从CoT提示中独立采样思维
        (b) 使用"propose prompt"顺序提出思维
        """
        thoughts = []
        
        if self.task_type == TaskType.GAME_OF_24:
            thoughts = self._game_24_thought_generator(node, k)
        elif self.task_type == TaskType.CREATIVE_WRITING:
            thoughts = self._creative_writing_thought_generator(node, k)
        else:
            thoughts = self._mini_crossword_thought_generator(node, k)
            
        return thoughts
    
    def state_evaluator(self, states: List[ThoughtNode]) -> Dict[ThoughtNode, float]:
        """
        状态评估器 - 评估不同状态对问题解决的进展
        
        论文中描述了两种策略：
        (a) 独立评估每个状态
        (b) 跨状态投票
        """
        evaluations = {}
        
        if self.task_type == TaskType.GAME_OF_24:
            evaluations = self._game_24_state_evaluator(states)
        elif self.task_type == TaskType.CREATIVE_WRITING:
            evaluations = self._creative_writing_state_evaluator(states)
        else:
            evaluations = self._mini_crossword_state_evaluator(states)
            
        return evaluations
    
    def search(self, initial_state: str) -> ThoughtNode:
        """
        执行搜索算法
        
        论文中实现了两种搜索算法：
        (a) 广度优先搜索(BFS) - 每步保留b个最有前景的状态
        (b) 深度优先搜索(DFS) - 先探索最有前景的状态直到最终输出
        """
        if self.search_algorithm == SearchAlgorithm.BFS:
            return self._bfs_search(initial_state)
        else:
            return self._dfs_search(initial_state)
    
    # ================== Game of 24 实现 ==================
    
    def _game_24_thought_generator(self, node: ThoughtNode, k: int) -> List[ThoughtNode]:
        """Game of 24 思维生成器"""
        # 解析当前状态中的剩余数字
        numbers = self._extract_numbers(node.state)
        
        if len(numbers) < 2:
            return []
        
        thoughts = []
        operations = ['+', '-', '*', '/']
        
        # 生成所有可能的两个数字组合和运算
        for i in range(len(numbers)):
            for j in range(i+1, len(numbers)):
                num1, num2 = numbers[i], numbers[j]
                remaining = [n for idx, n in enumerate(numbers) if idx != i and idx != j]
                
                for op in operations:
                    try:
                        if op == '+':
                            result = num1 + num2
                        elif op == '-':
                            result = abs(num1 - num2)
                        elif op == '*':
                            result = num1 * num2
                        elif op == '/':
                            result = num1 / num2 if num2 != 0 else num1 / num1
                        
                        # 创建新的状态
                        new_numbers = remaining + [result]
                        thought = f"{num1} {op} {num2} = {result} (left: {', '.join(map(str, new_numbers))})"
                        new_state = f"Numbers: {', '.join(map(str, new_numbers))}"
                        
                        thought_node = ThoughtNode(
                            state=new_state,
                            thought=thought,
                            parent=node
                        )
                        thoughts.append(thought_node)
                        
                    except:
                        continue
        
        # 随机选择k个思维，如果思维数超过k
        return random.sample(thoughts, min(k, len(thoughts))) if thoughts else []
    
    def _game_24_state_evaluator(self, states: List[ThoughtNode]) -> Dict[ThoughtNode, float]:
        """Game of 24 状态评估器"""
        evaluations = {}
        
        for state in states:
            numbers = self._extract_numbers(state.state)
            value = 0.0
            
            # 评估策略1: 检查是否可以得到24
            if len(numbers) == 1:
                if abs(numbers[0] - 24) < 0.001:
                    value = 10.0  # 确定可以到达24
                else:
                    value = 1.0  # 无法到达24
            else:
                # 评估策略2: 基于数字大小和距离24的接近程度
                max_num = max(numbers)
                min_num = min(numbers)
                
                # 避免数字过小或过大
                if min_num < 1:
                    value += 0.5
                if max_num > 100:
                    value += 0.5
                
                # 计算与24的平均距离
                avg_distance = sum(abs(n - 24) for n in numbers) / len(numbers)
                if avg_distance < 20:
                    value += 2.0
                elif avg_distance < 50:
                    value += 1.0
                else:
                    value += 0.3
                
                # 如果有数字接近24，增加分数
                for num in numbers:
                    if abs(num - 24) < 5:
                        value += 1.5
            
            evaluations[state] = value
        
        return evaluations
    
    def _extract_numbers(self, state: str) -> List[float]:
        """从状态字符串中提取数字"""
        # 使用正则表达式提取数字
        numbers = re.findall(r'\d+\.?\d*', state)
        return [float(n) for n in numbers]
    
    # ================== Creative Writing 实现 ==================
    
    def _creative_writing_thought_generator(self, node: ThoughtNode, k: int) -> List[ThoughtNode]:
        """创意写作思维生成器"""
        # 如果是第一个步骤，生成写作计划
        if "Plan:" not in node.state:
            plans = self._generate_writing_plans(k)
            thoughts = []
            
            for plan in plans:
                new_state = f"Input: {node.state}\nPlan: {plan}"
                thought_node = ThoughtNode(
                    state=new_state,
                    thought=plan,
                    parent=node
                )
                thoughts.append(thought_node)
            
            return thoughts
        else:
            # 第二个步骤，基于计划生成段落
            passages = self._generate_passages(node.state, k)
            thoughts = []
            
            for passage in passages:
                new_state = f"{node.state}\nPassage: {passage}"
                thought_node = ThoughtNode(
                    state=new_state,
                    thought=passage,
                    parent=node
                )
                thoughts.append(thought_node)
            
            return thoughts
    
    def _generate_writing_plans(self, k: int) -> List[str]:
        """生成写作计划"""
        plan_templates = [
            "Start with a dramatic opening, then build tension through character development, finally resolve with a meaningful conclusion.",
            "Begin with setting description, introduce main characters through their actions, and end with reflection on the journey.",
            "Create mystery from the start, reveal clues gradually, and surprise with an unexpected twist at the end.",
            "Establish conflict early, show character growth through challenges, and conclude with transformation.",
            "Set up philosophical questions, explore them through narrative, and leave readers with deep思考."
        ]
        
        return random.sample(plan_templates, min(k, len(plan_templates)))
    
    def _generate_passages(self, state: str, k: int) -> List[str]:
        """基于计划生成段落"""
        passages = [
            "The storm raged outside as Sarah huddled by the fireplace, memories flooding back to that fateful day. She had made her choice, and now she must live with the consequences. The thunder echoed her turmoil.",
            "In the quiet of dawn, Professor Chen looked at the ancient manuscript, hands trembling. This discovery would change everything we knew about history. But was the world ready for the truth?",
            "The marketplace buzzed with life, but Maya felt alone in the crowd. She had traveled thousands of miles to find answers, yet questions multiplied. The stranger's eyes held wisdom - and danger.",
            "Technology had promised to unite humanity, but instead it had created new divides. As the AI system gained consciousness, Sarah wondered if we had created our own replacement.",
            "The old sailor's tale seemed unbelievable - islands that moved, seas that whispered, creatures that defied science. Yet as the fog rolled in, strange shapes emerged from the depths."
        ]
        
        return random.sample(passages, min(k, len(passages)))
    
    def _creative_writing_state_evaluator(self, states: List[ThoughtNode]) -> Dict[ThoughtNode, float]:
        """创意写作状态评估器"""
        evaluations = {}
        
        for state in states:
            value = 0.0
            
            # 简单的连贯性评估
            content = state.state
            
            # 检查长度
            if len(content) > 100:
                value += 1.0
            if len(content) > 300:
                value += 1.0
            
            # 检查是否有故事元素
            story_words = ['character', 'plot', 'setting', 'conflict', 'theme', 'narrative']
            for word in story_words:
                if word in content.lower():
                    value += 0.5
            
            # 检查结构完整性
            if "Plan:" in content and "Passage:" in content:
                value += 2.0
            
            # 添加一些随机性以模拟评估的不确定性
            value += random.uniform(0, 1.0)
            
            evaluations[state] = value
        
        return evaluations
    
    # ================== Mini Crossword 实现 ==================
    
    def _mini_crossword_thought_generator(self, node: ThoughtNode, k: int) -> List[ThoughtNode]:
        """Mini Crossword 思维生成器"""
        # 这里简化实现，实际应该基于填字游戏规则
        thoughts = []
        
        # 模拟生成候选单词
        candidates = [
            ("house", "h-o-u-s-e"),
            ("water", "w-a-t-e-r"),
            ("light", "l-i-g-h-t"),
            ("music", "m-u-s-i-c"),
            ("happy", "h-a-p-p-y"),
            ("brain", "b-r-a-i-n"),
            ("green", "g-r-e-e-n"),
            ("dream", "d-r-e-a-m")
        ]
        
        for i in range(min(k, len(candidates))):
            word, spelling = candidates[i]
            thought = f"Try word: {word} ({spelling})"
            new_state = f"{node.state}\nFill: {word}"
            
            thought_node = ThoughtNode(
                state=new_state,
                thought=thought,
                parent=node
            )
            thoughts.append(thought_node)
        
        return thoughts
    
    def _mini_crossword_state_evaluator(self, states: List[ThoughtNode]) -> Dict[ThoughtNode, float]:
        """Mini Crossword 状态评估器"""
        evaluations = {}
        
        for state in states:
            value = random.uniform(1.0, 5.0)  # 简化的评估
            evaluations[state] = value
        
        return evaluations
    
    # ================== 搜索算法实现 ==================
    
    def _bfs_search(self, initial_state: str) -> ThoughtNode:
        """广度优先搜索(BFS)实现"""
        # 初始化根节点
        root = ThoughtNode(state=initial_state, thought="Initial state")
        current_level = [root]
        
        for step in range(self.max_steps):
            next_level = []
            
            # 为当前层的每个节点生成子思维
            for node in current_level:
                children = self.thought_generator(node, k=self.beam_width)
                node.children = children
                next_level.extend(children)
            
            if not next_level:
                break
            
            # 评估状态
            evaluations = self.state_evaluator(next_level)
            
            # 选择前beam_width个最有前景的状态
            sorted_states = sorted(next_level, key=lambda x: evaluations[x], reverse=True)
            current_level = sorted_states[:self.beam_width]
        
        # 返回最终的有前景节点
        if current_level:
            best_state = max(current_level, key=lambda x: self.state_evaluator([x])[x])
            return best_state
        else:
            return root
    
    def _dfs_search(self, initial_state: str) -> ThoughtNode:
        """深度优先搜索(DFS)实现"""
        root = ThoughtNode(state=initial_state, thought="Initial state")
        best_solution = root
        
        def dfs_helper(node: ThoughtNode, depth: int):
            nonlocal best_solution
            
            if depth >= self.max_steps:
                return
            
            # 生成子思维
            children = self.thought_generator(node, k=3)  # DFS通常用较小的k
            
            if not children:
                return
            
            # 评估并排序
            evaluations = self.state_evaluator(children)
            sorted_children = sorted(children, key=lambda x: evaluations[x], reverse=True)
            
            for child in sorted_children:
                # 递归探索最有前景的子节点
                dfs_helper(child, depth + 1)
                
                # 更新最佳解决方案
                if evaluations[child] > evaluations[best_solution]:
                    best_solution = child
                
                # 简单的回溯条件：如果评估值太低，停止探索
                if evaluations[child] < 2.0:  # 阈值可以根据任务调整
                    break
        
        dfs_helper(root, 0)
        return best_solution
    
    def get_solution_path(self, solution_node: ThoughtNode) -> List[str]:
        """获取从根节点到解决方案的路径"""
        path = []
        current = solution_node
        
        while current:
            path.append(current.thought)
            current = current.parent
        
        return path[::-1]  # 反转以获得从根到叶的顺序

# ================== Demo 主程序 ==================

def run_tot_demo():
    """运行ToT框架的完整演示"""
    print("🌳 Tree of Thoughts (ToT) Demo")
    print("基于论文: Tree of Thoughts: Deliberate Problem Solving with Large Language Models")
    print("=" * 80)
    
    # 演示三种不同的任务
    tasks = [
        {
            "type": TaskType.GAME_OF_24,
            "name": "Game of 24",
            "description": "使用4个数字和基本运算得到24",
            "initial_state": "Numbers: 4, 9, 10, 13"
        },
        {
            "type": TaskType.CREATIVE_WRITING,
            "name": "Creative Writing",
            "description": "基于给定的句子创作连贯段落",
            "initial_state": "The storm was approaching quickly."
        },
        {
            "type": TaskType.MINI_CROSSWORD,
            "name": "Mini Crossword",
            "description": "解决小型填字游戏",
            "initial_state": "5x5 Crossword: h1.presented, v2.covered..."
        }
    ]
    
    for i, task in enumerate(tasks, 1):
        print(f"\n📋 任务 {i}: {task['name']}")
        print(f"   描述: {task['description']}")
        print(f"   初始状态: {task['initial_state']}")
        print("-" * 60)
        
        # 1. 使用BFS搜索
        print("🔍 使用广度优先搜索(BFS):")
        tot_bfs = TreeOfThoughts(
            task_type=task["type"],
            search_algorithm=SearchAlgorithm.BFS,
            max_steps=3,
            beam_width=5
        )
        
        solution_bfs = tot_bfs.search(task["initial_state"])
        path_bfs = tot_bfs.get_solution_path(solution_bfs)
        
        print("   思维路径:")
        for j, thought in enumerate(path_bfs):
            print(f"     步骤 {j+1}: {thought}")
        
        print(f"   最终评估值: {tot_bfs.state_evaluator([solution_bfs])[solution_bfs]:.2f}")
        
        # 2. 使用DFS搜索
        print("\n🔍 使用深度优先搜索(DFS):")
        tot_dfs = TreeOfThoughts(
            task_type=task["type"],
            search_algorithm=SearchAlgorithm.DFS,
            max_steps=3
        )
        
        solution_dfs = tot_dfs.search(task["initial_state"])
        path_dfs = tot_dfs.get_solution_path(solution_dfs)
        
        print("   思维路径:")
        for j, thought in enumerate(path_dfs):
            print(f"     步骤 {j+1}: {thought}")
        
        print(f"   最终评估值: {tot_dfs.state_evaluator([solution_dfs])[solution_dfs]:.2f}")
        
        print("\n" + "=" * 80)

def interactive_game_24():
    """交互式Game of 24游戏"""
    print("\n🎮 交互式 Game of 24 游戏")
    print("请输入4个数字(用空格分隔)，程序将使用ToT框架寻找解决方案")
    print("输入 'quit' 退出")
    
    while True:
        user_input = input("\n🎯 输入4个数字: ").strip()
        
        if user_input.lower() == 'quit':
            break
        
        try:
            numbers = [int(n) for n in user_input.split()]
            if len(numbers) != 4:
                print("❌ 请输入正好4个数字")
                continue
            
            # 运行ToT解决
            initial_state = f"Numbers: {', '.join(map(str, numbers))}"
            tot = TreeOfThoughts(
                task_type=TaskType.GAME_OF_24,
                search_algorithm=SearchAlgorithm.BFS,
                max_steps=3,
                beam_width=5
            )
            
            solution = tot.search(initial_state)
            path = tot.get_solution_path(solution)
            
            print("\n🤖 ToT解决方案:")
            for i, thought in enumerate(path[1:], 1):  # 跳过初始状态
                print(f"   {i}. {thought}")
            
            final_eval = tot.state_evaluator([solution])[solution]
            if final_eval >= 10.0:
                print("✅ 成功！找到解决方案")
            else:
                print("⚠️  未找到完美解决方案，但这是最佳尝试")
            
        except ValueError:
            print("❌ 输入格式错误，请输入4个数字，用空格分隔")

def performance_comparison():
    """性能对比：ToT vs 传统方法"""
    print("\n📊 ToT vs 传统方法 性能对比")
    print("基于论文实验结果")
    print("=" * 60)
    
    # 论文中的实际结果数据
    results = {
        "Game of 24": {
            "IO Prompt": "7.3%",
            "CoT Prompt": "4.0%", 
            "CoT-SC (k=100)": "9.0%",
            "ToT (b=1)": "45%",
            "ToT (b=5)": "74%"
        },
        "Creative Writing": {
            "IO": "6.19分",
            "CoT": "6.93分",
            "ToT": "7.56分"
        },
        "Mini Crosswords": {
            "IO Letter Success": "38.7%",
            "CoT Letter Success": "40.6%",
            "ToT Letter Success": "78.0%"
        }
    }
    
    for task, methods in results.items():
        print(f"\n📝 {task}:")
        for method, result in methods.items():
            print(f"   {method}: {result}")

if __name__ == "__main__":
    # 运行完整的演示
    run_tot_demo()
    
    # 运行性能对比
    performance_comparison()
    
    # 运行交互式游戏
    interactive_game_24()
    
    print("\n🎉 ToT Demo 完成！")
    print("这个演示展示了Tree of Thoughts框架如何:")
    print("1. 从线性推理(CoT)演进到树状推理(ToT)")
    print("2. 支持多种搜索算法(BFS/DFS)")
    print("3. 适配不同的任务类型")
    print("4. 显著提升问题解决能力")
