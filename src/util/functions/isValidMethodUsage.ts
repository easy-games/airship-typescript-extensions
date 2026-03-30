import ts from "typescript";
import { Provider } from "util/provider";

export function isValidMethodUsage({ ts }: Provider, method: ts.PropertyAccessExpression) {
    if (ts.isNonNullExpression(method.parent)) {
        return ts.isCallExpression(method.parent.parent);
    } else {
        return ts.isCallExpression(method.parent);
    }
}