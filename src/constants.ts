export const SOOS_CONSTANTS = {
  EnvironmentVariables: {
    ApiKey: "SOOS_API_KEY",
    ClientId: "SOOS_CLIENT_ID",
  },
  FileUploads: {
    Encoding: "utf8" as BufferEncoding,
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
  },
  Status: {
    DelayTime: 5000,
  },
};
