export const SOOS_CONSTANTS = {
  EnvironmentVariables: {
    ApiKey: "SOOS_API_KEY",
    ClientId: "SOOS_CLIENT_ID",
  },
  FileUploads: {
    MaxManifests: 50,
  },
  Files: {
    ContributorAuditResults: "soos_contributor_audit",
    SoosDirectoryExclusionGlobPattern: "**/soos/**",
    SarifOutput: "results.sarif",
    MaxManifests: 50,
  },
  Urls: {
    API: {
      Analysis: "https://api.soos.io/api/",
      Hooks: "https://api-hooks.soos.io/api/",
      Projects: "https://api-projects.soos.io/api/",
      User: "https://api-user.soos.io/api/",
    },
    App: {
      Home: "https://app.soos.io/",
    },
  },
  SCA: {
    SoosPackageDirToExclude: "**/soos/**",
    SoosFileHashesManifest: "_soos_hashes.json",
  },
  Status: {
    DelayTime: 5000,
  },
  TerminalColors: {
    Success: "\x1b[32m",
    Info: "\x1b[34m",
    Low: "\x1b[90m",
    Medium: "\x1b[33m",
    High: "\x1b[31m",
    Critical: "\x1b[31m",
    Reset: "\x1b[0m",
  },
};
