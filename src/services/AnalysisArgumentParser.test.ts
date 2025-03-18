import { IntegrationName, IntegrationType, LogLevel, ScanType } from "../enums";
import AnalysisArgumentParser, { IBaseScanArguments } from "./AnalysisArgumentParser";

const getSut = () => {
  return AnalysisArgumentParser.create(
    IntegrationName.SoosCsa,
    IntegrationType.IDE,
    ScanType.CSA,
    "1.0.0-pre.1",
  );
};

describe("AnalysisArgumentParser", () => {
  test("Can create", () => {
    const argumentParser = getSut();
    expect(argumentParser).not.toBeNull();
  });

  test("Can parse args", () => {
    const argumentParser = getSut();

    const options = argumentParser.parseArguments<IBaseScanArguments>([
      "/path/to/node",
      "/path/to/soos-csa",
      "--clientId=123",
      "--apiKey",
      "xxxxxx",
      "--projectName",
      "TEST",
      "--integrationType=Webhook",
      "--logLevel",
      "DEBUG",
    ]);

    expect(options).not.toBeNull();
    console.log(options);
    expect(options.clientId).not.toBeUndefined();
    expect(options.clientId).toBe("123");
    expect(options.apiKey).not.toBeUndefined();
    expect(options.apiKey).toBe("xxxxxx");
    expect(options.integrationType).not.toBeUndefined();
    expect(options.integrationType).toBe(IntegrationType.Webhook);
    expect(options.logLevel).not.toBeUndefined();
    expect(options.logLevel).toBe(LogLevel.DEBUG);
  });

  test("Can parse args twice by using pre-process", () => {
    const argumentParser = getSut();

    const argv = [
      "node",
      "soos-csa",
      "--clientId=123",
      "--projectName=doh",
      "--apiKey",
      "xxxxxx",
      "--logLevel=ERROR",
      "--another",
      "bob",
    ];

    const preOptions = argumentParser.preParseArguments(argv);

    expect(preOptions).not.toBeNull();
    console.log(preOptions);
    expect(preOptions.clientId).not.toBeUndefined();
    expect(preOptions.clientId).toBe("123");

    argumentParser.addArgument("another", "description of another argument", { required: true });

    const options = argumentParser.parseArguments(argv);

    expect(options).not.toBeNull();
    console.log(options);
    expect(options.clientId).not.toBeUndefined();
    expect(options.clientId).toBe("123");
    expect(options.apiKey).not.toBeUndefined();
    expect(options.apiKey).toBe("xxxxxx");
    expect(options.apiURL).not.toBeUndefined();
    expect(options.apiURL).toBe("https://api.soos.io/api/");
    expect(options.logLevel).not.toBeUndefined();
    expect(options.logLevel).toBe(LogLevel.ERROR);
  });

  test("Can parse args with no option key", () => {
    const argumentParser = getSut();

    const argv = [
      "node",
      "soos-csa",
      "--clientId=123",
      "--projectName=doh",
      "--apiKey",
      "xxxxxx",
      "--logLevel=ERROR",
      "https://target.com/site",
    ];

    const preOptions = argumentParser.preParseArguments(argv);

    expect(preOptions).not.toBeNull();
    console.log(preOptions);
    expect(preOptions.clientId).not.toBeUndefined();
    expect(preOptions.clientId).toBe("123");

    argumentParser.addArgument("targetURL", "description of target argument", {
      required: true,
      useNoOptionKey: true,
    });

    const options = argumentParser.parseArguments(argv);

    expect(options).not.toBeNull();
    console.log(options);
    expect(options.clientId).not.toBeUndefined();
    expect(options.clientId).toBe("123");
    expect(options.apiKey).not.toBeUndefined();
    expect(options.apiKey).toBe("xxxxxx");
    expect(options.apiURL).not.toBeUndefined();
    expect(options.apiURL).toBe("https://api.soos.io/api/");
    expect(options.logLevel).not.toBeUndefined();
    expect(options.logLevel).toBe(LogLevel.ERROR);
    expect(options.targetURL).toBe("https://target.com/site");
  });

  test("Can parse flags", () => {
    const argumentParser = getSut();

    argumentParser.addArgument("myFlag", "description of myFlag argument", {
      isFlag: true,
    });

    const options = argumentParser.parseArguments([
      "/path/to/node",
      "/path/to/soos-csa",
      "--clientId=123",
      "--apiKey",
      "xxxxxx",
      "--projectName",
      "TEST",
      "--myFlag",
    ]);

    expect(options).not.toBeNull();
    console.log(options);
    expect(options.myFlag).not.toBeUndefined();
    expect(options.myFlag).toBe(true);
  });
});
