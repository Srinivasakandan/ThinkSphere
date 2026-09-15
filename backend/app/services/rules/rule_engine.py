"""The Python rule engine: structured product information + applicable
rules -> individual rule results.

    Structured fields + Rules
        v
    RuleEngine.evaluate_all()
        v
    RuleEvaluationOutcome per rule

This module never touches the database — it is a pure function of its
inputs, which is what makes app.tests.rules exhaustively testable.
"""

from app.models.enums import RuleConditionType
from app.models.rule import Rule
from app.services.rules.context import RuleEvaluationInput, RuleEvaluationOutcome
from app.services.rules.evaluators import (
    BaseRuleEvaluator,
    ConditionalEvaluator,
    DateEvaluator,
    FormatEvaluator,
    ManualReviewEvaluator,
    OptionalFieldEvaluator,
    RangeEvaluator,
    RequiredFieldEvaluator,
    UnitEvaluator,
    ValueEvaluator,
)

_EVALUATORS: dict[str, BaseRuleEvaluator] = {
    RuleConditionType.REQUIRED.value: RequiredFieldEvaluator(),
    RuleConditionType.OPTIONAL.value: OptionalFieldEvaluator(),
    RuleConditionType.FORMAT.value: FormatEvaluator(),
    RuleConditionType.VALUE.value: ValueEvaluator(),
    RuleConditionType.UNIT.value: UnitEvaluator(),
    RuleConditionType.DATE.value: DateEvaluator(),
    RuleConditionType.RANGE.value: RangeEvaluator(),
    RuleConditionType.CONDITIONAL.value: ConditionalEvaluator(),
    RuleConditionType.MANUAL_REVIEW.value: ManualReviewEvaluator(),
}


def evaluate_rule(rule: Rule, context: RuleEvaluationInput) -> RuleEvaluationOutcome:
    evaluator = _EVALUATORS.get(rule.condition_type)
    if evaluator is None:
        return RuleEvaluationOutcome(
            status="NEEDS_REVIEW",
            reason=f"Unknown rule condition type '{rule.condition_type}'; inspector review required.",
            detected_value=None,
            confidence=None,
            evidence_image_id=None,
        )
    return evaluator.evaluate(rule, context)


def evaluate_all(rules: list[Rule], context: RuleEvaluationInput) -> list[tuple[Rule, RuleEvaluationOutcome]]:
    return [(rule, evaluate_rule(rule, context)) for rule in rules]
