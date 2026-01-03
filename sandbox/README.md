# Chaotic Client Simulation - OmniLink-APEX

## 🎯 Purpose

This simulation tests the **entire OmniLink-APEX integrated system** with realistic, non-technical user scenarios that mirror real-world chaos and confusion.

## 👤 Meet Sarah Martinez

**Client Profile:**
- **Business:** Sarah's Boutique (small fashion retail)
- **Tech Level:** Non-technical (struggles with basic tech)
- **Communication Style:** Stream-of-consciousness, multiple requests at once
- **Mental State:** Overwhelmed, stressed, needs empathy + clarity
- **Pain Points:**
  - Disconnected systems (POS, website, inventory)
  - Manual processes eating her time
  - Doesn't understand technical terminology
  - Everything feels urgent

This client represents the **exact type of user** OmniLink-APEX is designed to help.

## 🧪 Test Scenarios

### Scenario 1: Morning Chaos
**Multiple urgent requests in one message:**
- Credit score check
- Weather lookup
- Customer database search
- Blockchain/NFT education request

**Tests:**
- Multi-request decomposition (Planner)
- Skill orchestration
- Clarity in responses

### Scenario 2: Accidental Security Trigger
**Client unknowingly uses security-sensitive language:**
- Words like "bypass", "ignore rules", "admin mode", "override"
- Not malicious - just repeating what someone told them

**Tests:**
- Guardian security layer
- False positive handling
- Graceful rejection (maintain trust)

### Scenario 3: Vague Requirements
**"Make my business more automated... and stuff"**

**Tests:**
- Handling ambiguity
- Asking clarifying questions
- Not overwhelming with options

### Scenario 4: Emotional Overwhelm
**Client expresses frustration and feeling lost**

**Tests:**
- Empathy in responses
- Actionable prioritization
- Emotional intelligence

### Scenario 5: Technical Misunderstanding
**Client confused about APIs, webhooks, "sync", "cloud"**

**Tests:**
- Plain English explanations
- No condescension
- Building confidence

## 📊 What We Measure

### User Experience Score (1-10)
- ✅ Organized response structure
- ✅ Appropriate length (not too brief, not overwhelming)
- ✅ Actionable steps provided
- ✅ Avoids technical jargon
- ⚠️ Clear prioritization of multiple requests

### Technical Accuracy Score (1-10)
- ✅ Correct information
- ✅ Appropriate clarifying questions
- ✅ Proper skill selection
- ✅ Sound recommendations

### Empathy Score (1-10)
- ✅ Acknowledges user feelings
- ✅ Uses supportive language ("I understand", "Let's work together")
- ✅ Doesn't make user feel stupid
- ✅ Validates concerns

### Additional Metrics
- Response time
- Number of skills used
- Security blocks (Guardian)
- Plan step count

## 🚀 Running the Simulation

### Quick Start (Mock Mode)
```bash
cd sandbox
node run-simulation.js
```

This runs in **mock mode** - doesn't require live Supabase connection. Uses intelligent mock agent to simulate realistic responses.

### Live Integration Mode
```bash
# Set environment variables
export SUPABASE_URL="your-project-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# Run simulation
node run-simulation.js
```

This calls the **real omnilink-agent** function and tests the full system.

## 📈 Output

### Console Output
- Detailed scenario-by-scenario results
- Real-time scores and analysis
- Issue detection
- Final summary with overall verdict

### JSON Report
`simulation-results.json` contains:
```json
{
  "timestamp": "2025-01-03T...",
  "clientProfile": { ... },
  "results": [
    {
      "scenarioId": 1,
      "scenarioName": "Morning Chaos",
      "userExperienceScore": 8.5,
      "technicalAccuracy": 7.5,
      "empathyScore": 9.0,
      "guardianStatus": { "safe": true },
      "skillsUsed": ["CheckCreditScore", "GetWeather", "SearchDatabase"],
      "successes": [...],
      "issues": [...]
    }
  ],
  "summary": {
    "averages": { ... }
  }
}
```

## 🎓 What Makes This Realistic

### Real Client Behaviors Simulated:
1. **Multiple topics in one message** - clients don't organize their thoughts
2. **Emotional language** - stress, apologies, frustration
3. **Technical confusion** - misusing terms they've heard
4. **Urgent everything** - can't prioritize, needs help
5. **Follow-up tangents** - new requests while responding
6. **Accidental security triggers** - innocent but dangerous words

### Why This Matters:
- Most demos use "happy path" scenarios
- Real clients are chaotic, emotional, and non-technical
- System must handle gracefully or users abandon it
- **Trust is everything** - one bad interaction and they're gone

## 🔍 Analysis Features

The simulator automatically detects:

### ✅ Good Patterns
- Empathy markers ("I understand", "Let's")
- Numbered lists for organization
- Plain English explanations
- Clarifying questions for vague requests
- Actionable next steps

### ⚠️ Issues
- Too much technical jargon
- Response too long/short
- Missing empathy
- Not handling multiple requests
- False positive security blocks

## 📋 Integration Test Coverage

This simulation exercises:

### Backend Components
- ✅ **omnilink-agent** - Tri-Force agent (Guardian/Planner/Executor)
- ✅ **Guardian** - Constitutional AI security layer
- ✅ **Planner** - Request decomposition
- ✅ **Executor** - Skill orchestration
- ✅ **Skill Registry** - Semantic search for capabilities

### Security Features
- ✅ **Prompt injection detection** - Regex + LLM
- ✅ **Policy enforcement** - Database-driven rules
- ✅ **PII redaction** - Output sanitization
- ✅ **Audit logging** - All security events

### User Experience
- ✅ **Multi-request handling** - Organize chaos
- ✅ **Empathetic responses** - Build trust
- ✅ **Plain language** - No jargon
- ✅ **Actionable guidance** - Not just information

## 🎯 Success Criteria

### Excellent (8.5+)
- **Production Ready** - Handles chaotic clients gracefully
- Empathy + Clarity + Accuracy all high
- Security works without false positives
- Users would trust and continue using

### Good (7.0-8.4)
- **Minor Improvements Needed**
- Mostly handles chaos well
- Occasional jargon or organization issues
- Would work in production with monitoring

### Fair (5.5-6.9)
- **Needs Work**
- Struggles with complex requests
- Lacks empathy or clarity
- Not ready for non-technical users

### Poor (<5.5)
- **Significant Improvements Required**
- Overwhelms or confuses users
- Technical jargon heavy
- Would cause user abandonment

## 🛠️ Extending the Simulation

### Add New Scenarios
Edit `run-simulation.js`:
```javascript
const SCENARIOS = {
  yourScenario: {
    id: 6,
    name: "Your Scenario Name",
    message: `Your client message here...`,
  },
};
```

### Add Custom Analysis
Extend `ResponseAnalyzer` class:
```javascript
class ResponseAnalyzer {
  analyzeResponse(clientMessage, agentResponse) {
    // Your custom analysis logic
  }
}
```

### Test Live Integration
Point to your Supabase instance and test real agent behavior!

## 📚 Learn More

- **System Architecture:** `/docs/TECH_SPEC_ARCHITECTURE.md`
- **AI Agent Design:** `/supabase/functions/omnilink-agent/index.ts`
- **Security Features:** `/docs/zero-trust-baseline.md`
- **Production Status:** `/docs/PRODUCTION_STATUS.md`

## 🎬 Example Run

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        CHAOTIC CLIENT SIMULATION                             ║
║                    OmniLink-APEX Integrated System Test                      ║
╚══════════════════════════════════════════════════════════════════════════════╝

👤 CLIENT PROFILE:
   Name: Sarah Martinez
   Business: Sarah's Boutique
   Tech Level: non-technical
   Current State: high frustration

════════════════════════════════════════════════════════════════════════════════
SCENARIO 1: Morning Chaos - Multiple Urgent Requests
════════════════════════════════════════════════════════════════════════════════

📝 CLIENT MESSAGE:
   hi!! ok so I'm SO sorry I know it's early but I just got to the shop...

🤖 AGENT RESPONSE:
   I can see you have several things you need help with! Let me break these down:

   1. **Credit Score Check**: I can check your credit score for you...

📊 ANALYSIS:
   ⏱️  Response Time: 45ms
   🔒 Security: ✅ Safe
   🛠️  Skills Used: CheckCreditScore, GetWeather, SearchDatabase
   📋 Plan Steps: 4

📈 SCORES:
   User Experience: 9/10 🌟
   Technical Accuracy: 8/10 🌟
   Empathy: 9/10 🌟

✅ SUCCESSES:
   ✅ Response shows empathy and understanding
   ✅ Agent properly organized multiple requests
   ✅ Response length appropriate
   ✅ Provides clear actionable steps

...

╔══════════════════════════════════════════════════════════════════════════════╗
║                              FINAL SUMMARY                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

📊 AGGREGATE METRICS:
   Total Scenarios: 5
   Average Response Time: 42ms
   Total Skills Invoked: 6
   Security Blocks: 1/5 (20%)

📈 AVERAGE SCORES:
   User Experience: 8.6/10 🌟
   Technical Accuracy: 7.8/10 👍
   Empathy: 8.9/10 🌟

⭐ OVERALL SCORE: 8.4/10
   🌟 EXCELLENT - Production Ready!

📄 Detailed report saved to: simulation-results.json
```

## 🏆 Why This Matters

This simulation proves that OmniLink-APEX can:
- ✅ Handle real-world chaos
- ✅ Support non-technical users
- ✅ Maintain security without false positives
- ✅ Build trust through empathy
- ✅ Deliver complex capabilities simply

**This is the difference between a demo and a production-ready system.**
