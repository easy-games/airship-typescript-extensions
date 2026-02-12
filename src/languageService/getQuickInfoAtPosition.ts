import ts from "typescript";
import { isLayerMaskLiteral } from "../util/functions/isLayerMaskFunction";
import { Provider } from "../util/provider";
import { CompilerDirective, getDirective } from "./analysis/functions/getDirective";
import { parseDirectives } from "./analysis/functions/parseDirectives";

function nicifyVariableName(text: string): string {
    let result = "";

    let prevIsLetter = false;
    let prevIsLetterUpper = false;
    let prevIsDigit = false;
    let prevIsStartOfWord = false;
    let prevIsNumberWord = false;

    let firstCharIndex = 0;
    if (text.startsWith("_")) {
        firstCharIndex = 1;
    } else if (text.startsWith("m_")) {
        firstCharIndex = 2;
    }

    for (let i = text.length - 1; i >= firstCharIndex; i--) {
        let currentChar = text[i];

        let currIsLetter = currentChar.match(/[A-z]/) !== null;
        let currIsLetterUpper = currentChar.toUpperCase() === currentChar;
        let currIsDigit = currentChar.match(/\d/) !== null;
        let currIsSpacer = currentChar.match(/[\s_]/) !== null;

        if (i === firstCharIndex && currIsLetter) currentChar = currentChar.toUpperCase();

        let addSpace =
            (currIsLetter && !currIsLetterUpper && prevIsLetterUpper) ||
            (currIsLetter && prevIsLetterUpper && prevIsStartOfWord) ||
            (currIsDigit && prevIsStartOfWord) ||
            (!currIsDigit && prevIsNumberWord) ||
            (currIsLetter && !currIsLetterUpper && prevIsDigit);

        if (!currIsSpacer && addSpace) {
            result = " " + result;
        }

        result = currentChar + result;

        prevIsStartOfWord = currIsLetter && currIsLetterUpper && prevIsLetter && !prevIsLetterUpper;
        prevIsNumberWord = currIsDigit && prevIsLetter && !prevIsLetterUpper;
        prevIsLetterUpper = currIsLetter && currIsLetterUpper;
        prevIsLetter = currIsLetter;
        prevIsDigit = currIsDigit;
    }

    return result;
}

export function getQuickInfoAtPositionFactory(provider: Provider): ts.LanguageService["getQuickInfoAtPosition"] {
    const { ts, config } = provider;

    return (fileName, position) => {
        let info = provider.service.getQuickInfoAtPosition(fileName, position);

        const sourceFile = provider.getSourceFile(fileName);
        const node = ts.getTokenAtPosition(sourceFile, position);
        if (isLayerMaskLiteral(provider, node)) {
            info ??= {
                kind: ts.ScriptElementKind.enumElement,
                kindModifiers: "",
                textSpan: ts.createTextSpan(node.pos, node.end - node.pos)
            } satisfies ts.QuickInfo;

            const layerIndex = provider.config.layers.indexOf(node.text);

            if (layerIndex !== -1) {
                (info.documentation ??= []).push({
                    text: `${nicifyVariableName(node.text)} (Layer ${layerIndex})`,
                    kind: ""
                });
            }
        }

        if (config.networkBoundaryInfo) {
            if (ts.isIfStatement(node)) {
                const directives = parseDirectives(provider, node.expression, true, true);
                if (directives) {
                    info ??= {
                        kind: ts.ScriptElementKind.enumElement,
                        kindModifiers: "",
                        textSpan: ts.createTextSpan(node.pos, node.end - node.pos)
                    } satisfies ts.QuickInfo;

                    (info.documentation ??= []).push({
                        text: "test",
                        kind: "className"
                    })
                }
            }
        }

        if (!info) return undefined;
        const symbol = provider.typeChecker.getSymbolAtLocation(node);



        if (symbol && symbol.valueDeclaration && ts.isMethodDeclaration(symbol.valueDeclaration)) {
            const serverDecorator = symbol.valueDeclaration.modifiers
                ?.filter((f) => ts.isDecorator(f))
                .find((f) => {
                    return (
                        ts.isCallExpression(f.expression) &&
                        ts.isIdentifier(f.expression.expression) &&
                        ["Server", "Client"].includes(f.expression.expression.text)
                    );
                });

            if (serverDecorator) {
                const text = ((serverDecorator.expression as ts.CallExpression).expression as ts.Identifier).text;
                (info.tags ??= []).push({
                    name: text.toLowerCase(),
                    text: [
                        {
                            text: "declared as a " + text.toLowerCase() + "-only method",
                            kind: "className",
                        },
                    ],
                });
            }
        }


        return info;
    };
}