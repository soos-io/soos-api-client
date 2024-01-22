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
    ContributorAuditOutput: "soos_contributor_audit.json",
    SoosDirectoryExclusionGlobPattern: "**/soos/**",
    SarifOutput: "results.sarif",
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
  Status: {
    DelayTime: 5000,
  },
};
