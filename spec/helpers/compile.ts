import { sync as globSync } from "glob";
import { sync as rimrafSync } from "rimraf";
import { loadSync as tsconfigSync } from "tsconfig";
import * as ts from "typescript";
import transformer from "../../src";
import { baseUrl, outDir } from "./config";

rimrafSync(outDir);

function logDiagnostics(diagnostics: ts.Diagnostic[]) {
  for (const diagnostic of diagnostics) {
    if (diagnostic.file) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start || -1
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n"
      );
      console.log(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      );
    }
  }
}

export default function compile(input: string) {
  const loadResult = tsconfigSync(baseUrl);
  const files = globSync(input);

  const { options, errors } = ts.convertCompilerOptionsFromJson(
    loadResult.config.compilerOptions,
    baseUrl
  );
  logDiagnostics(errors);

  if (errors.length > 0) {
    return;
  }
  const compilerHost = ts.createCompilerHost(options);
  const program = ts.createProgram(files, options, compilerHost);

  const emitResult = program.emit(
    undefined,
    undefined,
    undefined,
    undefined,
    transformer(program)
  );

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  logDiagnostics(allDiagnostics);
}
