# Quickstart

It is super easy to get started with Agentgrader. You can have your first benchmark running in just a few minutes.

Before we jump in, make sure you have a few things ready:
*   Node.js (v18+) or [Bun](https://bun.sh/) installed on your machine.
*   [Docker](https://www.docker.com/) installed and currently running.
*   An API key from either OpenRouter or OpenAI.

## 1. Clone and Install

First, grab the repository from GitHub and install all the necessary dependencies using npm or Bun.

```bash
# 1. Clone the repository
git clone https://github.com/agentgrader/agr
cd agr

# 2. Install all dependencies
npm install  # or bun install

# 3. Build the packages
npm run build
```

## 2. Set Up Your Environment

By default, Agentgrader uses OpenRouter as the gateway for Large Language Models. You just need to set your API key in your environment variables. If you do not have an OpenRouter key, it will smoothly fall back to direct OpenAI as long as you provide an `OPENAI_API_KEY`.

```bash
export OPENROUTER_API_KEY=sk-or-...
```

## 3. Run Your First Benchmark

Now for the fun part! You can run an example benchmark that tests a baseline agent against a collection of TypeScript bugs. 

```bash
just bench
```

If you prefer using the CLI directly, this does the exact same thing:
```bash
node packages/cli/dist/index.js bench \
  --suite examples/suites/typescript-bugs/ \
  --configs examples/configs/baseline.yaml
```

Sometimes you just want to focus on a single test case instead of running a full benchmark. In that case, you can simply use:
```bash
just run
```

## 4. Programmatic API

If you are a developer looking to integrate Agentgrader directly into your own CI/CD pipelines, tools, or custom evaluation scripts, you don't have to use the CLI. Agentgrader has a powerful programmatic API!

Check out the [Programmatic API](/advanced/programmatic-api) guide to learn how to import `@agentgrader/core` and use the `runSingle` and `runBenchmark` functions directly in your code.
