import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  base: '/agr-docs/',
  title: "Agentgrader",
  description: "Agent testing framework.",
  themeConfig: {
    search: {
      provider: 'local'
    },
    logo: '/LGO.svg',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/what-is-agentgrader' },
      { text: 'Reference', link: '/reference/cli' },
      { text: 'API & Advanced', link: '/advanced/programmatic-api' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'What is Agentgrader?', link: '/guide/what-is-agentgrader' },
          { text: 'Quickstart', link: '/guide/quickstart' },
          { text: 'Core Concepts', link: '/guide/concepts' },
          { text: 'Best Practices', link: '/guide/best-practices' }
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'CLI Reference', link: '/reference/cli' },
          { text: 'Test Case (agr.yaml)', link: '/reference/test-case-yaml' },
          { text: 'Agent Config (agent.yaml)', link: '/reference/agent-config-yaml' },
          { text: 'Packages Architecture', link: '/reference/packages' }
        ]
      },
      {
        text: 'Developer API & Advanced',
        items: [
          { text: 'Programmatic API', link: '/advanced/programmatic-api' },
          { text: 'Custom Agent Adapter', link: '/advanced/custom-adapter' },
          { text: 'Custom Sandbox Provider', link: '/advanced/custom-sandbox' },
          { text: 'CI Integration', link: '/advanced/ci-integration' }
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/agentgrader/agr' }
    ]
  }
}))
