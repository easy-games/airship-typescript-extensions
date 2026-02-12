import ts from "typescript";

export function isValidMethodUsage(method: ts.PropertyAccessExpression) {
    if (ts.isNonNullExpression(method.parent)) {
        return ts.isCallExpression(method.parent.parent);
    } else {
        return ts.isCallExpression(method.parent);
    }
}