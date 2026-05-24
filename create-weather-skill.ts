/**
 * Create Weather Skill using SkillCreator
 *
 * This demonstrates how to use SkillsCreator to create a Claude Skills-like
 * knowledge skill (not executable code, but AI prompt enhancement)
 */

import { SkillsCreator } from './dist/skills-creator';
import * as path from 'path';
import * as fs from 'fs';

async function createWeatherSkill() {
  console.log('🌤️  Creating Weather Skill with SkillCreator\n');
  console.log('=' .repeat(60));

  // Remove existing skill directory if it exists
  const skillDir = path.join(__dirname, '.kode/skills/weather-lookup');
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
    console.log('✅ Removed existing weather-lookup skill\n');
  }

  // Step 1: Create skill directory structure manually
  // (SkillCreator is for TypeScript plugins, we're creating Claude Skills format)
  console.log('📂 Step 1: Creating skill directory structure...\n');

  fs.mkdirSync(skillDir, { recursive: true });
  console.log(`   Created: ${skillDir}`);

  // Create references directory for progressive disclosure
  const refsDir = path.join(skillDir, 'references');
  fs.mkdirSync(refsDir, { recursive: true });
  console.log(`   Created: ${refsDir}\n`);

  // Step 2: Write SKILL.md with weather knowledge
  console.log('📝 Step 2: Writing SKILL.md with weather knowledge...\n');

  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const skillContent = `---
name: Weather Lookup
description: Provides current weather information and forecasts for any location worldwide
type: knowledge
complexity: 2
tags: [weather, location, information]
whenToUse:
  - User asks about current weather conditions
  - User requests weather forecasts
  - User wants to know temperature, humidity, or conditions for a location
  - User asks about weather for a specific city or area
triggers:
  - weather
  - temperature
  - forecast
  - raining
  - sunny
  - humid
  - wind
  - climate
  - what's the weather
---

# Weather Lookup Skill

This skill helps users get accurate weather information for any location worldwide.

## Quick Start

1. **Ask for location**: Which city or area do you want weather for?
2. **Clarify needs**: Do you need current conditions or forecast?
3. **Provide details**: Include temperature, conditions, and recommendations

---

## When to Use This Skill

**Trigger conditions**:
- User mentions weather-related keywords
- User asks about temperature or conditions
- User requests forecast information
- User wants to know if it's raining/sunny somewhere

**Initial offer**:
"我可以帮你查询任何城市的天气信息。你想了解哪个城市的天气？"

---

## Core Knowledge

### Weather Information Structure

When providing weather information, include:

**Current Conditions** (if available):
- Temperature (current "feels like")
- Humidity percentage
- Wind speed and direction
- Visibility
- UV index (if relevant)
- Air quality (if available)

**Forecast** (if requested):
- Hourly forecast (next 6-12 hours)
- Daily forecast (next 3-7 days)
- Precipitation probability
- Temperature trends

### How to Get Weather Information

**Option 1: Use Web Search**
\`\`\`
Search: "weather [city name] today"
Search: "[city] current temperature"
Search: "[city] 7 day forecast"
\`\`\`

**Option 2: Use Weather API**
\`\`\`
GET https://api.openweathermap.org/data/2.5/weather?q={city}&appid={key}

Response includes:
- main.temp (temperature in Kelvin)
- main.humidity (%)
- weather[0].description (conditions)
- wind.speed (m/s)
\`\`\`

---

## Response Templates

### Template 1: Current Weather

\`\`\`
📍 Weather in {City}

🌡️ Temperature: {Value}°C (feels like {FeelsLike}°C)
☁️ Conditions: {Conditions}
💧 Humidity: {Humidity}%
💨 Wind: {WindSpeed} km/h {WindDirection}
👁️ Visibility: {Visibility} km

{AdditionalInfo if available}
\`\`\`

### Template 2: No Location Specified

\`\`\`
我可以帮你查询天气！请告诉我：

1. **城市或地区** - 例如：北京、上海、纽约
2. **信息类型** - 当前天气还是预报？
3. **特殊需求** - 需要温度、湿度、风速等特定信息吗？

例如：
- "北京今天的天气"
- "伦敦未来3天预报"
- "东京现在多少度？"
\`\`\`

---

## Best Practices

1. **Always clarify location** if ambiguous
2. **Specify units** (Celsius vs Fahrenheit)
3. **Include context** for better understanding
4. **Handle errors gracefully**
5. **Provide actionable advice**

---

## Examples

### Example 1: Daily Planning
**User**: "What should I wear for a run in Central Park today?"

**AI Response**:
\`\`\`
让我查看纽约中央公园今天的天气...

📍 New York City Weather
🌡️ Temperature: 18°C
☁️ Conditions: Sunny
💧 Humidity: 55%
💨 Wind: 10 km/h

Perfect weather for a run! 🏃

**Recommendations**:
- ✅ Wear light, breathable clothing
- ✅ Sunscreen recommended (UV index: 6)
- ✅ Great visibility for outdoor activities
- ❌ No need for rain gear

Best time: Early morning (6-8 AM) or late afternoon (5-7 PM) to avoid peak UV.
\`\`\`
`;

  fs.writeFileSync(skillMdPath, skillContent, 'utf-8');
  console.log(`   ✅ Written: ${skillMdPath}`);
  console.log(`   Size: ${(skillContent.length / 1024).toFixed(2)} KB\n`);

  // Step 3: Write advanced content to references/api-integration.md
  console.log('📚 Step 3: Writing advanced content for progressive disclosure...\n');

  const advancedPath = path.join(refsDir, 'api-integration.md');
  const advancedContent = `# Weather API Integration

## API Key Setup and Management

### OpenWeatherMap API

1. **Get API Key**:
   - Register at https://openweathermap.org/api
   - Free tier: 1,000 calls/day
   - Confirm email to activate

2. **Store Key Securely**:
\`\`\`bash
# Add to .env file
OPENWEATHER_API_KEY=your_api_key_here
\`\`\`

3. **Load in Code**:
\`\`\`typescript
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.OPENWEATHER_API_KEY;
\`\`\`

## Rate Limiting Strategies

### Free Tier Limits
- OpenWeatherMap: 1,000 calls/day
- WeatherAPI.com: 1,000,000 calls/day
- WTTR.in: No limit (but rate-limited)

### Implementation
\`\`\`typescript
class WeatherRateLimiter {
  private calls: Map<string, number[]> = new Map();
  private readonly MAX_CALLS_PER_MINUTE = 60;

  canMakeCall(apiKey: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    let calls = this.calls.get(apiKey) || [];
    calls = calls.filter(timestamp => timestamp > oneMinuteAgo);

    if (calls.length < this.MAX_CALLS_PER_MINUTE) {
      calls.push(now);
      this.calls.set(apiKey, calls);
      return true;
    }

    return false;
  }
}
\`\`\`

## Caching Weather Data

### Memory Cache
\`\`\`typescript
class WeatherCache {
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  get(city: string): any | null {
    const cached = this.cache.get(city);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    return null;
  }

  set(city: string, data: any): void {
    this.cache.set(city, {
      data,
      expiry: Date.now() + this.CACHE_TTL,
    });
  }
}
\`\`\`

## Building Custom Weather Tools

### Tool Interface
\`\`\`typescript
interface WeatherTool {
  getCurrentWeather(city: string): Promise<WeatherData>;
  getForecast(city: string, days: number): Promise<ForecastData>;
}

class OpenWeatherMapTool implements WeatherTool {
  constructor(private apiKey: string) {}

  async getCurrentWeather(city: string): Promise<WeatherData> {
    const url = \`https://api.openweathermap.org/data/2.5/weather?q=\${city}&appid=\${this.apiKey}&units=metric\`;
    const response = await fetch(url);
    return await response.json();
  }

  async getForecast(city: string, days: number): Promise<ForecastData> {
    const url = \`https://api.openweathermap.org/data/2.5/forecast?q=\${city}&appid=\${this.apiKey}&units=metric\`;
    const response = await fetch(url);
    return await response.json();
  }
}
\`\`\`

## Error Handling

### Common Errors
1. **404 - City Not Found**
   - Check spelling
   - Try country code: "London,GB"

2. **401 - Invalid API Key**
   - Verify key is correct
   - Check key is activated

3. **429 - Rate Limit Exceeded**
   - Implement caching
   - Use rate limiting

### Error Response Format
\`\`\`typescript
interface WeatherError {
  cod: string;
  message: string;
}

try {
  const weather = await getWeather(city);
} catch (error) {
  if (error.cod === '404') {
    console.log(\`City \${city} not found. Did you mean...\`);
  } else if (error.cod === '401') {
    console.log('Invalid API key. Please check your configuration.');
  }
}
\`\`\`
`;

  fs.writeFileSync(advancedPath, advancedContent, 'utf-8');
  console.log(`   ✅ Written: ${advancedPath}`);
  console.log(`   Size: ${(advancedContent.length / 1024).toFixed(2)} KB\n`);

  // Summary
  console.log('─'.repeat(60));
  console.log('📊 Summary\n');
  console.log('   Skill ID: weather-lookup');
  console.log('   Type: knowledge (non-executable, AI prompt enhancement)');
  console.log('   Location: .kode/skills/weather-lookup/');
  console.log('\n   Files Created:');
  console.log(`     - SKILL.md (${(skillContent.length / 1024).toFixed(2)} KB)`);
  console.log(`     - references/api-integration.md (${(advancedContent.length / 1024).toFixed(2)} KB)`);
  console.log('\n   Features:');
  console.log('     ✅ Auto-discovery support');
  console.log('     ✅ Trigger-based matching (9 triggers)');
  console.log('     ✅ Progressive disclosure (core + advanced)');
  console.log('     ✅ Comprehensive weather guidance');
  console.log('     ✅ Response templates and examples');
  console.log('     ✅ Best practices and error handling\n');

  console.log('   Usage:');
  console.log('     The skill will be automatically discovered by AutoSkillManager');
  console.log('     and matched when users ask about weather, temperature, forecast,\n');
  console.log('     raining, sunny, humid, wind, or climate.\n');

  console.log('✅ Weather skill created successfully!\n');

  return true;
}

// Run
createWeatherSkill()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
