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
    SarifOutput: "results.sarif",
  },
  Urls: {
    API: {
      Analysis: "https://api.soos.io/api/",
      Projects: "https://api-projects.soos.io/api/",
      Users: "https://api-user.soos.io/api/",
    },
  },
  Status: {
    DelayTime: 5000,
  },
};
