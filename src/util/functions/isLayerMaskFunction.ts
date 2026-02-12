import type ts from "typescript";
import { Provider } from "util/provider";

// export function isLayerMaskFunction(provider: Provider, node: ts.Node) {
//     const { ts, typeChecker } = provider;

//     if (ts.isPropertyAccessExpression(node)) {
//         const typeId = typeChecker.getSymbolAtLocation(node.expression);
//         return typeId && typeChecker.symbolToString(typeId) === "LayerMask";
//     }

//     return false;
// }

export function isLayerMaskLiteral(provider: Provider, node: ts.Node): node is ts.StringLiteral {
    const { ts, typeChecker } = provider;
    if (ts.isStringLiteral(node) && ts.isCallExpression(node.parent) && ts.isPropertyAccessExpression(node.parent.expression)) {
        const layerName = node.text;
        const callee = node.parent.expression;
        
        const symbol = provider.typeChecker.getSymbolAtLocation(callee.expression);
        if (symbol) {
            return provider.typeChecker.symbolToString(symbol) === "LayerMask";
        }
    }

    return false;
}