import ts from "typescript";
import { Provider } from "../../../util/provider";
import {
	CompilerDirective,
	getDirective,
	isCallExpressionOrExclamationCallExpression,
	isIdentifierOrExclamationIdentifier,
} from "./getDirective";

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

function isAndBinaryExpression(expression: ts.Expression): expression is ts.BinaryExpression {
	return ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken;
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
	includeImplicitCalls = true,
): DirectivesAnalysisResult | undefined {
	const directives = new Array<CompilerDirective>();

	if (
		isIdentifierOrExclamationIdentifier(conditionLikeExpression) ||
		isCallExpressionOrExclamationCallExpression(conditionLikeExpression)
	) {
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

	if (allowComplexExpressions && isAndBinaryExpression(conditionLikeExpression)) {
		let { left, right } = conditionLikeExpression;

		if (isAndBinaryExpression(left)) {
			do {
				if (
					isIdentifierOrExclamationIdentifier(left) ||
					(includeImplicitCalls && isCallExpressionOrExclamationCallExpression(left))
				) {
					const directive = getDirective(state, left, includeImplicitCalls);

					if (directive !== undefined) {
						directives.push(directive);
						continue;
					}
				}

				right = left.right;
				left = left.left;
			} while (isAndBinaryExpression(left));
		} else {
			if (
				isIdentifierOrExclamationIdentifier(left) ||
				(includeImplicitCalls && isCallExpressionOrExclamationCallExpression(left))
			) {
				const directive = getDirective(state, left, includeImplicitCalls);

				if (directive !== undefined) {
					directives.push(directive);
				}
			}
		}

		if (
			isIdentifierOrExclamationIdentifier(right) ||
			(includeImplicitCalls && isCallExpressionOrExclamationCallExpression(right))
		) {
			const directive = getDirective(state, right, includeImplicitCalls);

			if (directive !== undefined) {
				directives.push(directive);
			}
		}

		if (directives.length > 0) {
			const result: DirectivesAnalysisResult = {
				directives,
				isComplexDirectiveCheck: true,
				isServer:
					directives.includes(CompilerDirective.SERVER) || directives.includes(CompilerDirective.NOT_CLIENT),
				isClient:
					directives.includes(CompilerDirective.CLIENT) || directives.includes(CompilerDirective.NOT_SERVER),
			};

			return result;
		}
	}

	return undefined;
}
