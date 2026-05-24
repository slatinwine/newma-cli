#!/usr/bin/env python3
"""
US News Search Tool
使用免费的新闻API搜索美国新闻
"""

import requests
import json
from datetime import datetime

# 免费API端点（使用NewsAPI或替代服务）
NEWS_API_URL = "https://newsapi.org/v2/top-headlines"

def search_us_news(api_key=None, category='general'):
    """
    搜索美国新闻
    
    Args:
        api_key: NewsAPI密钥（需要在 https://newsapi.org/ 注册）
        category: 新闻类别 (business, entertainment, general, health, science, sports, technology)
    
    Returns:
        新闻数据列表
    """
    
    if not api_key:
        print("⚠️  需要API密钥")
        print("请访问 https://newsapi.org/ 注册获取免费API密钥")
        return []
    
    params = {
        'country': 'us',
        'category': category,
        'apiKey': api_key,
        'pageSize': 10
    }
    
    try:
        response = requests.get(NEWS_API_URL, params=params)
        response.raise_for_status()
        
        data = response.json()
        articles = data.get('articles', [])
        
        print(f"\n📰 美国新闻 - {category.upper()} - {datetime.now().strftime('%Y-%m-%d')}")
        print("=" * 60)
        
        for i, article in enumerate(articles, 1):
            print(f"\n{i}. {article['title']}")
            print(f"   来源: {article['source']['name']}")
            print(f"   时间: {article['publishedAt'][:10]}")
            print(f"   链接: {article['url']}")
        
        return articles
        
    except requests.exceptions.RequestException as e:
        print(f"❌ 请求失败: {e}")
        return []

def main():
    """主函数"""
    print("🇺🇸 美国新闻搜索工具")
    print("=" * 40)
    
    # 可以从环境变量或配置文件读取API密钥
    import os
    api_key = os.getenv('NEWS_API_KEY')
    
    if not api_key:
        print("\n提示: 设置环境变量 NEWS_API_KEY 来避免每次输入")
        api_key = input("请输入NewsAPI密钥: ").strip()
    
    category = input("新闻类别 (默认: general): ").strip() or 'general'
    
    search_us_news(api_key, category)

if __name__ == "main":
    main()