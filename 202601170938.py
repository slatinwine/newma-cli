import re
import requests
from typing import List, Dict, Any, Optional
import json

class ReActAgent:
    def __init__(self, name: str = "ReActAgent"):
        self.name = name
        self.context_history = []
        self.max_steps = 10
        self.current_step = 0
        
    def think(self, question: str, observation: str = "") -> str:
        """生成推理轨迹 - 基于当前问题和观察进行推理"""
        
        # 模拟语言模型的推理能力
        if not observation:
            # 初始推理：分析问题并制定计划
            if "?" in question.lower():
                if "how" in question.lower():
                    return "I need to understand the process and find step-by-step information."
                elif "what" in question.lower():
                    return "I need to identify the key entity or concept being asked about."
                elif "when" in question.lower():
                    return "I need to find temporal information about the event or person."
                elif "who" in question.lower():
                    return "I need to identify the person or entity being asked about."
                elif "why" in question.lower():
                    return "I need to understand the reasoning or causation behind something."
                else:
                    return "I need to understand what the question is asking and find relevant information."
            else:
                return "I need to understand the task and break it down into manageable steps."
        
        # 基于观察的后续推理
        else:
            if "not found" in observation.lower():
                return "The information is not available here. I should try a different approach or search term."
            elif any(word in observation.lower() for word in ["born", "created", "established", "founded"]):
                return "I found information about the origin or creation. Now I should look for more details."
            elif any(word in observation.lower() for word in ["died", "ended", "closed", "discontinued"]):
                return "I found information about the end or conclusion. I should check if I have enough information."
            else:
                return "I found relevant information. I should extract the key details and determine if I need more information."
    
    def act(self, thought: str, question: str) -> str:
        """基于推理决定下一步行动"""
        
        # 分析推理内容决定行动
        if "different approach" in thought.lower():
            return "Try searching with a different keyword"
        elif "entity" in thought.lower() or "concept" in thought.lower():
            # 提取问题中的关键实体
            entities = self.extract_entities(question)
            if entities:
                return f"Search for information about {entities[0]}"
        elif "temporal" in thought.lower():
            return "Search for historical timeline information"
        elif "step-by-step" in thought.lower():
            return "Search for process or procedure information"
        elif "more details" in thought.lower():
            return "Look for additional information"
        elif "enough information" in thought.lower():
            return "Finish with current information"
        else:
            return "Search for general information about the question"
    
    def execute_action(self, action: str, question: str) -> str:
        """执行行动并与环境交互"""
        
        # 模拟Wikipedia搜索
        if "search" in action.lower():
            search_term = self.extract_search_term(action)
            return self.mock_wikipedia_search(search_term)
        elif "try" in action.lower() and "different" in action.lower():
            search_term = self.extract_search_term(question)
            return self.mock_wikipedia_search(search_term, alternative=True)
        elif "finish" in action.lower():
            return "Task completed - providing final answer"
        else:
            return self.mock_wikipedia_search(question)
    
    def mock_wikipedia_search(self, search_term: str, alternative: bool = False) -> str:
        """模拟Wikipedia API搜索"""
        
        # 模拟的Wikipedia数据
        mock_data = {
            "python": "Python is a high-level, interpreted programming language created by Guido van Rossum and first released in 1991.",
            "guido van rossum": "Guido van Rossum is a Dutch programmer best known as the creator of the Python programming language, born on 31 January 1956.",
            "programming language": "A programming language is a formal language comprising a set of instructions that produce various kinds of output.",
            "1991": "1991 was a significant year in technology, marking the release of Python and the beginning of the World Wide Web's public availability."
        }
        
        search_lower = search_term.lower().strip()
        
        # 直接匹配
        for key, value in mock_data.items():
            if key in search_lower:
                return value
        
        # 模糊匹配
        if alternative:
            if "python" in search_lower:
                return "Found: Python was named after the British comedy series Monty Python's Flying Circus."
            elif any(word in search_lower for word in ["creator", "who"]):
                return "Found: Guido van Rossum created Python while working at CWI in the Netherlands."
        
        # 默认回应
        return f"Information about '{search_term}' not found. Try being more specific or check the spelling."
    
    def extract_entities(self, text: str) -> List[str]:
        """简单实体提取"""
        # 使用正则表达式提取可能的实体
        entities = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        return [entity for entity in entities if len(entity) > 2]
    
    def extract_search_term(self, text: str) -> str:
        """从行动描述中提取搜索词"""
        # 提取引号中的内容或关键名词
        quoted = re.findall(r'"([^"]*)"', text)
        if quoted:
            return quoted[0]
        
        # 如果没有引号，提取搜索相关的词
        search_match = re.search(r'search for (?:information about )?(.+)', text, re.IGNORECASE)
        if search_match:
            return search_match.group(1)
        
        return text

class ReActDemo:
    def __init__(self):
        self.agent = ReActAgent()
    
    def run_question_answering(self, question: str, max_steps: int = 5):
        """运行问答任务的REACT过程"""
        
        print(f"🔍 Question: {question}")
        print("=" * 50)
        
        # 初始化
        current_question = question
        observation = ""
        final_answer = ""
        
        for step in range(max_steps):
            self.agent.current_step = step + 1
            print(f"\n📝 Step {step + 1}/{max_steps}")
            
            # 1. 推理 (Thought)
            print("💭 Thinking...")
            thought = self.agent.think(current_question, observation)
            print(f"   Thought: {thought}")
            
            # 2. 行动 (Action)
            print("🎯 Planning action...")
            action = self.agent.act(thought, current_question)
            print(f"   Action: {action}")
            
            # 3. 执行行动并观察 (Action → Observation)
            print("🔍 Executing action...")
            observation = self.agent.execute_action(action, current_question)
            print(f"   Observation: {observation}")
            
            # 4. 检查是否可以完成任务
            if "finish" in action.lower() or "task completed" in observation.lower():
                final_answer = self.generate_final_answer(question, observation, thought)
                break
            
            # 5. 保存上下文历史
            self.agent.context_history.append({
                'step': step + 1,
                'question': current_question,
                'thought': thought,
                'action': action,
                'observation': observation
            })
        
        # 输出最终答案
        print("\n" + "=" * 50)
        print("✅ Final Answer:")
        print(f"   {final_answer}")
        
        return {
            'question': question,
            'final_answer': final_answer,
            'steps': self.agent.context_history
        }
    
    def generate_final_answer(self, question: str, observation: str, thought: str) -> str:
        """基于推理和观察生成最终答案"""
        
        if "not found" in observation.lower():
            return f"I couldn't find specific information about '{question}'. The search did not return relevant results."
        
        # 根据问题类型生成答案
        if "who" in question.lower():
            if "python" in question.lower():
                return "Python was created by Guido van Rossum, a Dutch programmer born on January 31, 1956."
        elif "when" in question.lower():
            if "python" in question.lower():
                return "Python was first released in 1991 by Guido van Rossum."
        elif "what" in question.lower():
            if "python" in question.lower():
                return "Python is a high-level, interpreted programming language created by Guido van Rossum, first released in 1991."
        
        # 默认答案
        return f"Based on the information gathered: {observation}"

def run_interactive_demo():
    """运行交互式demo"""
    print("🤖 REACT Demo - 基于《REACT: SYNERGIZING REASONING AND ACTING IN LANGUAGE MODELS》")
    print("=" * 70)
    print("这个demo展示了姚顺雨提出的REACT框架的核心思想：")
    print("推理 (Thought) → 行动 (Action) → 观察 (Observation) → 推理 (Thought)")
    print("=" * 70)
    
    demo = ReActDemo()
    
    # 预设的问题示例
    example_questions = [
        "Who created Python?",
        "When was Python first released?",
        "What is Python programming language?",
        "Tell me about Guido van Rossum"
    ]
    
    print("\n📋 示例问题：")
    for i, q in enumerate(example_questions, 1):
        print(f"   {i}. {q}")
    
    print("\n💬 您可以：")
    print("   - 输入数字运行示例问题")
    print("   - 输入您自己的问题")
    print("   - 输入 'quit' 退出")
    
    while True:
        print("\n" + "-" * 50)
        user_input = input("🧠 请选择: ").strip()
        
        if user_input.lower() in ['quit', 'exit', 'q']:
            print("👋 感谢使用REACT Demo!")
            break
        
        # 处理数字选择
        if user_input.isdigit():
            idx = int(user_input)
            if 1 <= idx <= len(example_questions):
                question = example_questions[idx - 1]
            else:
                print("❌ 无效的数字选择")
                continue
        else:
            question = user_input
        
        # 运行REACT过程
        if question:
            print(f"\n🚀 开始处理: {question}")
            result = demo.run_question_answering(question)
            print(f"\n📊 完整推理路径：{len(result['steps'])} 步")
        else:
            print("❌ 请输入有效的问题")

if __name__ == "__main__":
    # 运行交互式demo
    run_interactive_demo()
