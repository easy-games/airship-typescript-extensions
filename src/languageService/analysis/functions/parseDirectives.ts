import ts from "typescript";
import { Provider } from "../../../util/provider";
import { CompilerDirective, getDirective, isIdentifierOrExclamationIdentifier } from "./getDirective";

export interface DirectivesAnalysisResult {
	/**
	 * The directives in this condition
	 */
	readonly directives: ReadonlyArray<CompilerDirective>;
	/**
	 * If the directive contains a complex check (e.g. includes non-directive expressions)
	 */
	readonly isComplexDirectiveCheck: boolean;
	readonly isServer: boolean;
	readonly isClient: boolean;
}

/**
 * Parses directives in this expression, and will return an expression
 *
 * @returns Updated expression, or false if consumed, undefined if invalid
 */
export function parseDirectives(
	state: Provider,
	conditionLikeExpression: ts.Expression,
	allowComplexExpressions = true,
	includeImplicitCalls = false,
): DirectivesAnalysisResult | undefined {
	const directives = new Array<CompilerDirective>();

	if (isIdentifierOrExclamationIdentifier(conditionLikeExpression)) {
		const directive = getDirective(state, conditionLikeExpression, includeImplicitCalls);
		if (directive !== undefined) {
			directives.push(directive);
			return {
				directives,
				isComplexDirectiveCheck: false,
				isServer: directive === CompilerDirective.SERVER || directive === CompilerDirective.NOT_CLIENT,
				isClient: directive === CompilerDirective.CLIENT || directive === CompilerDirective.NOT_SERVER,
			};
		}
	}

	return undefined;
}
