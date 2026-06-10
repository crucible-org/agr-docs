# Custom Sandbox Provider

If you prefer to use a cloud sandbox provider like E2B, Daytona, or Firecracker instead of a local Docker setup, we have made it easy for you to build a Custom Sandbox Provider.

You just need to fulfill the `SandboxProvider` interface. This interface handles provisioning the environment and returns a `SandboxHandle`, which details exactly how to execute commands or interact with files in that specific environment.

## Implementation Example

```typescript
import type { SandboxProvider, SandboxHandle } from "@agentgrader/core";

export class MyCloudProvider implements SandboxProvider {
  readonly name = "my-cloud";

  async create(opts: { image?: string; gitSnapshot?: string }): Promise<SandboxHandle> {
    // 1. Spin up a cloud environment using the specified image
    // 2. Clone the snapshot if one is provided

    return {
      exec: async (cmd) => { 
        // Put your logic here to run bash commands
      },
      readFile: async (path) => { 
        // Logic to read files
      },
      writeFile: async (path, content) => { 
        // Logic to write content
      },
      gitDiff: async () => { 
        // Returns the diff of the entire workspace
      },
      destroy: async () => { 
        // Teardown and clean up the environment
      },
    };
  }
}
```

Once your custom provider is ready, you can pass it right into the Programmatic API using either `runSingle` or `runBenchmark`.
