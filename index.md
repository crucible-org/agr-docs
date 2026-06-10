---
layout: home

hero:
  name: "Agentgrader"
  text: ""
  tagline: The open-source benchmarking framework to test your AI agents on real coding tasks.
  image:
    src: /LGO.svg
    alt: Agentgrader Logo
  actions:
    - theme: brand
      text: Let's get started
      link: /guide/quickstart
    - theme: alt
      text: View on GitHub
      link: https://github.com/agentgrader/agr

features:
  - title: Language Agnostic
    details: You can run your agents in any programming language supported by Docker. Whether it is TypeScript, Python, Rust, or Go, Agentgrader has you covered.
  - title: Real Execution
    details: We do not use mocks. Your agent actually runs real commands and edits actual files directly inside a secure Docker container.
  - title: Automated Scoring
    details: It is easy to know if your agent succeeded. Pass and fail states are determined objectively by running real test suites like npm test or pytest.
  - title: Cost and Token Tracking
    details: Keep a close eye on your budget. Every run automatically tracks the exact tokens consumed and the total cost in USD per model.
  - title: Pluggable Adapters
    details: Flexibility is key. You can swap out the LLM provider, the sandbox environment, or the scoring logic without ever touching the core framework.
  - title: Node & Bun Support
    details: It is designed to be incredibly flexible and fast. The framework runs on standard Node.js or Bun, utilizing better-sqlite3 for a lightning fast local database experience.
---
