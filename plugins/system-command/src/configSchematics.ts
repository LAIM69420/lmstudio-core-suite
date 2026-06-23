import { createConfigSchematics } from "@lmstudio/sdk";

export function buildConfigSchematics() {
  return createConfigSchematics()
    .field(
      "allowedCommands",
      "string",
      {},
      "ls,git,date,du,df,pwd,whoami,uname,uptime,free,echo",
    )
    .field("allowedPaths", "string", {}, ".")
    .field("timeoutMs", "numeric", { min: 1000, max: 60000, int: true }, 15000)
    .field("maxRiskLevel", "select", {
      options: [
        { displayName: "Safe only", value: "safe" },
        { displayName: "Safe + Info", value: "info" },
        { displayName: "Safe + Info + Moderate", value: "moderate" },
        { displayName: "All (including Risky)", value: "risky" },
      ],
    }, "moderate")
    .build();
}
